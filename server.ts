import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { getRolePermissions, type RolePermissions } from './src/utils/permissions';
import { isValidEmail } from './src/utils/cpfValidator';

// ---------------- CONFIG ----------------

// `npm start` passa --production; NODE_ENV=production também vale.
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3000);

// Os usuários demo têm senhas públicas (README/CLAUDE.md): nunca em produção sem opt-in explícito.
if (isProd && process.env.ENABLE_DEMO_AUTH !== 'true') {
  throw new Error(
    'Usuários demo não podem subir em produção. Defina ENABLE_DEMO_AUTH=true só para demonstrações controladas.'
  );
}

const MINUTE_MS = 60 * 1000;
const RATE_WINDOW_MS = 15 * MINUTE_MS;
const MAX_FAILURES_PER_IDENTITY = 5;
const MAX_FAILURES_PER_IP = 20;
const MAX_RECOVERY_REQUESTS_PER_IP = 5;
const REAUTH_TICKET_TTL_MS = 5 * MINUTE_MS;
const SWEEP_INTERVAL_MS = MINUTE_MS;
const MAX_IDENTIFIER_LENGTH = 254;
const MAX_PHONE_LENGTH = 20;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_AUDIT_DETAILS = 200;
const PBKDF2_ITERATIONS = 10000;

type Role = 'luthier' | 'atendente' | 'cliente';
type ReauthAction = 'SWITCH_PROFILE' | 'SENSITIVE_UPDATE';
const REAUTH_ACTIONS: readonly ReauthAction[] = ['SWITCH_PROFILE', 'SENSITIVE_UPDATE'];

type PermissionFlag = {
  [K in keyof RolePermissions]: RolePermissions[K] extends boolean ? K : never;
}[keyof RolePermissions];

// Ação de domínio → permissão exigida (mesmos nomes de ROLE_PERMISSIONS).
const ACTION_POLICY: Record<string, PermissionFlag> = {
  VIEW_FINANCIALS: 'canViewFinancialTotals',
  MANAGE_STOCK: 'canManageInventory',
  WORKBENCH_EXECUTION: 'canExecuteBenchLabor',
  VIEW_AUDIT_LOGS: 'canViewAuditLogs',
  RESET_DEMO_DATA: 'canResetDemoData',
  MODIFY_PRICING: 'canModifyPricingAndParts',
  APPROVE_QUOTE: 'canApproveClientQuote',
  OPEN_ORDER: 'canOpenOrder',
  REGISTER_CLIENT: 'canRegisterClient',
  REGISTER_ENTRY_PHOTO: 'canRegisterEntryPhoto',
  REGISTER_DELIVERY: 'canRegisterDelivery',
};

interface UserRecord {
  id: string;
  name: string;
  email: string;
  cpfDigits: string; // 11 digits
  phone: string;
  role: Role;
  salt: string;
  passwordHash: string;
}

interface Session {
  id: string;
  userId: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
}

interface ReauthTicket {
  ticket: string;
  /** Sessão que pediu a reautenticação: o ticket só vale nela. */
  sessionId: string;
  userId: string;
  actionType: ReauthAction;
  createdAt: number;
  expiresAt: number;
}

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId?: string;
  userRole?: string;
  maskedIdentifier: string;
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  ip: string;
  details?: string;
}

// ---------------- PASSWORDS ----------------

const pbkdf2 = promisify(crypto.pbkdf2);

async function hashPassword(password: string, salt: string): Promise<string> {
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS, 64, 'sha512');
  return derived.toString('hex');
}

// Só para as seeds, na subida do servidor.
function hashPasswordSync(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
}

function seedUser(data: Omit<UserRecord, 'salt' | 'passwordHash'>, password: string): UserRecord {
  const salt = crypto.randomBytes(16).toString('hex');
  return { ...data, salt, passwordHash: hashPasswordSync(password, salt) };
}

// Usado quando o usuário não existe: o tempo de resposta fica igual ao de senha errada.
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = hashPasswordSync(crypto.randomBytes(16).toString('hex'), DUMMY_SALT);

/** Confere a senha em tempo constante; sem usuário, compara com um hash fictício. */
async function verifyPassword(user: UserRecord | undefined, password: string): Promise<boolean> {
  const salt = user?.salt ?? DUMMY_SALT;
  const expected = Buffer.from(user?.passwordHash ?? DUMMY_HASH, 'hex');
  const computed = Buffer.from(await hashPassword(password, salt), 'hex');
  const matches = computed.length === expected.length && crypto.timingSafeEqual(computed, expected);
  return matches && user !== undefined;
}

// ---------------- IN-MEMORY STORES ----------------

// Usuários demo (senhas documentadas no CLAUDE.md). Substituídos por cópias imutáveis ao editar.
const users: UserRecord[] = [
  seedUser(
    {
      id: 'usr-armando',
      name: 'Armando Luthier',
      email: 'armando.luthier@oficina.com',
      cpfDigits: '12345678909',
      phone: '(11) 98765-4321',
      role: 'luthier',
    },
    'Luthier@2026'
  ),
  seedUser(
    {
      id: 'usr-mariana',
      name: 'Mariana Balcão',
      email: 'mariana.balcao@oficina.com',
      cpfDigits: '23456789092',
      phone: '(11) 99123-8877',
      role: 'atendente',
    },
    'Balcao@2026'
  ),
  seedUser(
    {
      id: 'usr-lucas',
      name: 'Lucas Silveira',
      email: 'lucas.silveira@guitar.com',
      cpfDigits: '32165498791',
      phone: '(11) 98765-4321',
      role: 'cliente',
    },
    'Cliente@2026'
  ),
];

const sessions = new Map<string, Session>();
const reauthTickets = new Map<string, ReauthTicket>();
const auditLogs: AuditLog[] = [];

interface AttemptInfo {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}
const attempts = new Map<string, AttemptInfo>();

// ---------------- HELPERS ----------------

/** Normaliza o identificador (e-mail ou CPF). `null` quando ausente, não-string ou longo demais. */
function parseIdentifier(raw: unknown): { input: string; digits: string; isEmail: boolean } | null {
  if (typeof raw !== 'string') return null;
  const input = raw.trim().toLowerCase();
  if (!input || input.length > MAX_IDENTIFIER_LENGTH) return null;
  return { input, digits: input.replace(/\D/g, ''), isEmail: input.includes('@') };
}

function findUserByIdentifier(id: { input: string; digits: string; isEmail: boolean }): UserRecord | undefined {
  return users.find((u) => (id.isEmail ? u.email.toLowerCase() === id.input : u.cpfDigits === id.digits));
}

function replaceUser(updated: UserRecord): void {
  const index = users.findIndex((u) => u.id === updated.id);
  if (index >= 0) users[index] = updated;
}

function maskIdentifier(id: string): string {
  if (id.includes('@')) {
    const [name, domain] = id.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  const digits = id.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  return '***';
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'desconhecido';
}

function logAudit(
  action: string,
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED',
  identifier: string,
  req: Request,
  user?: UserRecord,
  details?: string
) {
  const log: AuditLog = {
    id: `aud-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    action,
    userId: user?.id,
    userRole: user?.role,
    maskedIdentifier: maskIdentifier(identifier),
    result,
    ip: clientIp(req),
    details: details?.slice(0, MAX_AUDIT_DETAILS),
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 200) auditLogs.pop();
}

/** Segundos restantes de bloqueio da chave (0 = liberada). */
function lockedSeconds(key: string): number {
  const info = attempts.get(key);
  if (!info) return 0;
  const now = Date.now();
  if (info.lockedUntil && info.lockedUntil > now) {
    return Math.ceil((info.lockedUntil - now) / 1000);
  }
  if (now - info.lastAttempt > RATE_WINDOW_MS) attempts.delete(key);
  return 0;
}

function recordAttempt(key: string, max: number): void {
  const now = Date.now();
  const previous = attempts.get(key);
  const count = previous && now - previous.lastAttempt <= RATE_WINDOW_MS ? previous.count + 1 : 1;
  attempts.set(key, {
    count,
    lastAttempt: now,
    lockedUntil: count >= max ? now + RATE_WINDOW_MS : undefined,
  });
}

/**
 * Chaves de limite de tentativas: a identidade é canônica (`user:<id>` quando o usuário
 * existe, então e-mail e CPF contam juntos) e o IP tem um teto próprio.
 */
function rateKeys(scope: string, req: Request, id: { input: string }, user?: UserRecord) {
  return {
    identity: `${scope}:${user ? `user:${user.id}` : `id:${id.input}`}`,
    ip: `${scope}:ip:${clientIp(req)}`,
  };
}

function lockStatus(keys: { identity: string; ip: string }): number {
  return Math.max(lockedSeconds(keys.identity), lockedSeconds(keys.ip));
}

function recordFailure(keys: { identity: string; ip: string }): void {
  recordAttempt(keys.identity, MAX_FAILURES_PER_IDENTITY);
  recordAttempt(keys.ip, MAX_FAILURES_PER_IP);
}

// Sanitize user profile output (no passwords or salts, mask CPF)
function sanitizeUser(u: UserRecord) {
  const cpf = u.cpfDigits;
  const maskedCpf = `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    maskedCpf,
    phone: u.phone,
    role: u.role,
    isAdmin: u.role === 'luthier',
  };
}

// Extract Bearer session token
function getSessionFromReq(req: Request): Session | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function createSession(user: UserRecord, durationMs: number): Session {
  const session: Session = {
    id: crypto.randomBytes(32).toString('hex'),
    userId: user.id,
    role: user.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + durationMs,
  };
  sessions.set(session.id, session);
  return session;
}

/** Ticket de reautenticação válido para a ação e a sessão; consome (apaga) o ticket. */
function consumeTicket(raw: unknown, action: ReauthAction, session: Session): ReauthTicket | null {
  if (typeof raw !== 'string') return null;
  const ticket = reauthTickets.get(raw);
  if (!ticket) return null;
  reauthTickets.delete(raw); // uso único, mesmo quando inválido para esta chamada
  const isValid =
    ticket.actionType === action && ticket.sessionId === session.id && Date.now() <= ticket.expiresAt;
  return isValid ? ticket : null;
}

// Varre sessões, tickets e contadores expirados (antes cresciam sem limite).
function sweepExpired(): void {
  const now = Date.now();
  for (const [key, session] of sessions) if (session.expiresAt < now) sessions.delete(key);
  for (const [key, ticket] of reauthTickets) if (ticket.expiresAt < now) reauthTickets.delete(key);
  for (const [key, info] of attempts) {
    const isLocked = info.lockedUntil !== undefined && info.lockedUntil > now;
    if (!isLocked && now - info.lastAttempt > RATE_WINDOW_MS) attempts.delete(key);
  }
}

// Express 4 não captura promise rejeitada: encaminha para o error handler.
type AsyncRoute = (req: Request, res: Response) => Promise<unknown>;
const asyncHandler =
  (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  // Em desenvolvimento o Vite injeta scripts inline (HMR): a CSP vale só em produção.
  if (isProd) {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; ')
    );
  }
  next();
}

// ---------------- SERVER ----------------

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  // Atrás de proxy, defina TRUST_PROXY (ex.: "1") para req.ip usar o X-Forwarded-For.
  app.set('trust proxy', process.env.TRUST_PROXY ?? false);
  app.use(securityHeaders);
  app.use(express.json({ limit: '10kb' }));

  // ---------------- AUTH API ENDPOINTS ----------------

  // 1. POST /api/auth/login
  app.post(
    '/api/auth/login',
    asyncHandler(async (req, res) => {
      const { identifier, password, rememberMe } = req.body ?? {};
      const id = parseIdentifier(identifier);
      if (!id || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'E-mail ou CPF e senha são obrigatórios.' });
      }

      const user = findUserByIdentifier(id);
      const keys = rateKeys('login', req, id, user);
      const remainingSeconds = lockStatus(keys);
      if (remainingSeconds > 0) {
        res.setHeader('Retry-After', remainingSeconds);
        return res.status(429).json({
          error: `Conta bloqueada temporariamente por muitas tentativas inválidas. Tente novamente em ${Math.ceil(
            remainingSeconds / 60
          )} minutos.`,
          locked: true,
          remainingSeconds,
        });
      }

      if (!(await verifyPassword(user, password)) || !user) {
        recordFailure(keys);
        const isNowLocked = lockStatus(keys) > 0;
        logAudit(
          'LOGIN',
          isNowLocked ? 'BLOCKED' : 'FAILED',
          id.input,
          req,
          user,
          user ? 'Senha inválida' : 'Usuário não localizado'
        );
        return res.status(401).json({ error: 'E-mail/CPF ou senha incorretos.' });
      }

      attempts.delete(keys.identity);
      const session = createSession(user, rememberMe === true ? 24 * 60 * MINUTE_MS : 2 * 60 * MINUTE_MS);
      logAudit('LOGIN', 'SUCCESS', id.input, req, user);

      return res.json({
        token: session.id,
        user: sanitizeUser(user),
        expiresAt: session.expiresAt,
      });
    })
  );

  // 2. POST /api/auth/reauthenticate
  // Reautenticação com e-mail/CPF + senha antes de trocar de perfil ou alterar dados sensíveis
  app.post(
    '/api/auth/reauthenticate',
    asyncHandler(async (req, res) => {
      const session = getSessionFromReq(req);
      if (!session) {
        return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
      }

      const { identifier, password, actionType, targetRole } = req.body ?? {};
      const id = parseIdentifier(identifier);
      if (!id || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Credenciais e tipo de ação são obrigatórios.' });
      }
      if (!REAUTH_ACTIONS.includes(actionType)) {
        return res.status(400).json({ error: 'Tipo de ação inválido.' });
      }
      const action = actionType as ReauthAction;

      // Troca de perfil: as credenciais são do usuário DESTINO (e do papel pedido).
      // Dados sensíveis: as credenciais precisam ser do usuário da sessão.
      const candidate = findUserByIdentifier(id);
      const expectedUser =
        action === 'SWITCH_PROFILE'
          ? candidate && (!targetRole || candidate.role === targetRole)
            ? candidate
            : undefined
          : candidate?.id === session.userId
          ? candidate
          : undefined;

      const keys = rateKeys('reauth', req, id, expectedUser);
      const remainingSeconds = lockStatus(keys);
      if (remainingSeconds > 0) {
        return res.status(429).json({
          error: `Muitas tentativas. Aguarde ${Math.ceil(remainingSeconds / 60)} minutos.`,
          locked: true,
        });
      }

      if (!(await verifyPassword(expectedUser, password)) || !expectedUser) {
        recordFailure(keys);
        logAudit(
          'REAUTH',
          'FAILED',
          id.input,
          req,
          expectedUser,
          `Ação: ${action} - ${expectedUser ? 'Senha incorreta' : 'Usuário incompatível'}`
        );
        return res.status(401).json({ error: 'E-mail/CPF ou senha incorretos.' });
      }

      attempts.delete(keys.identity);

      const ticket: ReauthTicket = {
        ticket: 'reauth_' + crypto.randomBytes(24).toString('hex'),
        sessionId: session.id,
        userId: expectedUser.id,
        actionType: action,
        createdAt: Date.now(),
        expiresAt: Date.now() + REAUTH_TICKET_TTL_MS,
      };
      reauthTickets.set(ticket.ticket, ticket);

      logAudit('REAUTH', 'SUCCESS', id.input, req, expectedUser, `Janela de 5 min aberta para: ${action}`);

      return res.json({
        success: true,
        ticket: ticket.ticket,
        targetUser: sanitizeUser(expectedUser),
        expiresInSeconds: REAUTH_TICKET_TTL_MS / 1000,
      });
    })
  );

  // 3. POST /api/auth/switch-profile
  // Troca de perfil no servidor: exige sessão e ticket emitido para esta mesma sessão
  app.post('/api/auth/switch-profile', (req: Request, res: Response) => {
    const currentSession = getSessionFromReq(req);
    if (!currentSession) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const reauth = consumeTicket(req.body?.ticket, 'SWITCH_PROFILE', currentSession);
    if (!reauth) {
      return res.status(403).json({ error: 'Reautenticação inválida ou expirada. Confirme sua senha novamente.' });
    }

    const targetUser = users.find((u) => u.id === reauth.userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário alvo não encontrado.' });
    }

    sessions.delete(currentSession.id);
    const newSession = createSession(targetUser, 2 * 60 * MINUTE_MS);

    logAudit('PROFILE_SWITCH', 'SUCCESS', targetUser.email, req, targetUser, `Perfil alterado para ${targetUser.role}`);

    return res.json({
      token: newSession.id,
      user: sanitizeUser(targetUser),
    });
  });

  // 4. POST /api/auth/sensitive-update
  // Altera e-mail, telefone ou senha; exige ticket de reautenticação desta sessão
  app.post(
    '/api/auth/sensitive-update',
    asyncHandler(async (req, res) => {
      const session = getSessionFromReq(req);
      if (!session) {
        return res.status(401).json({ error: 'Sessão inválida.' });
      }

      const { ticket, email, phone, newPassword } = req.body ?? {};

      // Valida todos os campos antes de consumir o ticket ou alterar qualquer coisa.
      if (email !== undefined && (typeof email !== 'string' || email.length > MAX_IDENTIFIER_LENGTH || !isValidEmail(email))) {
        return res.status(400).json({ error: 'E-mail inválido.' });
      }
      if (phone !== undefined && (typeof phone !== 'string' || phone.trim().length > MAX_PHONE_LENGTH)) {
        return res.status(400).json({ error: 'Telefone inválido.' });
      }
      if (
        newPassword !== undefined &&
        (typeof newPassword !== 'string' ||
          newPassword.length < MIN_PASSWORD_LENGTH ||
          newPassword.length > MAX_PASSWORD_LENGTH)
      ) {
        return res.status(400).json({
          error: `A nova senha precisa ter entre ${MIN_PASSWORD_LENGTH} e ${MAX_PASSWORD_LENGTH} caracteres.`,
        });
      }

      const user = users.find((u) => u.id === session.userId);
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;
      if (normalizedEmail && users.some((u) => u.id !== session.userId && u.email.toLowerCase() === normalizedEmail)) {
        return res.status(409).json({ error: 'Este e-mail já está em uso por outra conta.' });
      }

      const reauth = consumeTicket(ticket, 'SENSITIVE_UPDATE', session);
      if (!reauth) {
        return res.status(403).json({ error: 'Reautenticação inválida ou expirada. Confirme sua senha novamente.' });
      }
      if (!user || user.id !== reauth.userId) {
        return res.status(403).json({ error: 'Reautenticação não corresponde ao usuário da sessão.' });
      }

      // Calcula tudo numa cópia e só então grava (nada fica pela metade se algo falhar).
      let updated: UserRecord = { ...user };
      if (normalizedEmail) updated = { ...updated, email: normalizedEmail };
      if (typeof phone === 'string') updated = { ...updated, phone: phone.trim() };
      if (typeof newPassword === 'string') {
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = await hashPassword(newPassword, salt);
        updated = { ...updated, salt, passwordHash };
      }
      replaceUser(updated);

      // Senha nova encerra as outras sessões do usuário (a atual continua).
      if (typeof newPassword === 'string') {
        for (const [key, other] of sessions) {
          if (other.userId === updated.id && key !== session.id) sessions.delete(key);
        }
      }

      logAudit('SENSITIVE_UPDATE', 'SUCCESS', updated.email, req, updated, 'Dados sensíveis atualizados com reautenticação válida');

      return res.json({
        success: true,
        user: sanitizeUser(updated),
      });
    })
  );

  // 5. GET /api/auth/me
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    const user = users.find((u) => u.id === session.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    return res.json({ user: sanitizeUser(user) });
  });

  // 6. POST /api/auth/logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (session) {
      const user = users.find((u) => u.id === session.userId);
      logAudit('LOGOUT', 'SUCCESS', user?.email || 'unknown', req, user);
      sessions.delete(session.id);
    }
    return res.json({ success: true });
  });

  // 7. POST /api/auth/forgot-password
  app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
    const id = parseIdentifier(req.body?.identifier);
    if (!id) {
      return res.status(400).json({ error: 'Informe seu e-mail ou CPF.' });
    }

    const ipKey = `forgot:ip:${clientIp(req)}`;
    const remainingSeconds = lockedSeconds(ipKey);
    if (remainingSeconds > 0) {
      res.setHeader('Retry-After', remainingSeconds);
      return res.status(429).json({
        error: `Muitas solicitações. Tente novamente em ${Math.ceil(remainingSeconds / 60)} minutos.`,
      });
    }
    recordAttempt(ipKey, MAX_RECOVERY_REQUESTS_PER_IP);

    logAudit('PASSWORD_RECOVERY_REQUEST', 'SUCCESS', id.input, req);

    // Mesma resposta exista ou não a conta (evita enumeração de usuários)
    return res.json({
      message: 'Se a conta existir, um link de recuperação válido por 15 minutos foi gerado para o e-mail cadastrado.',
    });
  });

  // 8. GET /api/auth/audit-logs (Security review - Admin/Luthier only)
  app.get('/api/auth/audit-logs', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (!session || session.role !== 'luthier') {
      return res.status(403).json({ error: 'Acesso restrito ao Administrador Luthier.' });
    }
    return res.json({ logs: auditLogs });
  });

  // 9. GET /api/auth/permissions (Server-enforced role permissions)
  app.get('/api/auth/permissions', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Mesma tabela usada pela interface (src/utils/permissions.ts): uma única fonte.
    const permissions = { ...getRolePermissions(session.role), isAdmin: session.role === 'luthier' };
    return res.json({ permissions });
  });

  // 10. POST /api/auth/validate-action (Backend action-level RBAC barrier)
  app.post('/api/auth/validate-action', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const action: unknown = req.body?.action;
    const flag = typeof action === 'string' ? ACTION_POLICY[action] : undefined;

    // Nega por padrão: ação desconhecida ou papel sem a permissão correspondente.
    if (!flag || !getRolePermissions(session.role)[flag]) {
      const label = typeof action === 'string' ? action.slice(0, 64) : 'inválida';
      logAudit('RBAC_REJECT', 'BLOCKED', session.userId, req, undefined, `Ação bloqueada: ${label}`);
      return res.status(403).json({
        error: flag
          ? `Ação '${label}' não é permitida para o seu perfil.`
          : `Ação '${label}' desconhecida.`,
        allowed: false,
      });
    }

    return res.json({ allowed: true });
  });

  // Qualquer outra rota de API: JSON 404 (não cai no index.html do SPA)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Rota não encontrada' });
  });

  // ---------------- VITE MIDDLEWARE SETUP ----------------
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  // Error handler final: JSON genérico, sem stack trace para o cliente.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 500;
    if (status >= 500) console.error('[Luthieria OS] Erro interno:', err);
    if (res.headersSent) return;
    // 4xx do body-parser (JSON malformado, corpo grande demais) mantém o status.
    res.status(status).json({ error: status >= 500 ? 'Erro interno' : 'Requisição inválida' });
  });

  setInterval(sweepExpired, SWEEP_INTERVAL_MS).unref();

  app.listen(PORT, HOST, () => {
    console.log(`[Luthieria OS] Server running at http://${HOST}:${PORT}`);
  });
}

startServer();
