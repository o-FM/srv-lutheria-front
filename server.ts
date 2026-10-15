import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  cpfDigits: string; // 11 digits
  phone: string;
  role: 'luthier' | 'atendente' | 'cliente';
  salt: string;
  passwordHash: string;
}

interface Session {
  id: string;
  userId: string;
  role: 'luthier' | 'atendente' | 'cliente';
  createdAt: number;
  expiresAt: number;
}

interface ReauthTicket {
  ticket: string;
  userId: string;
  targetRole?: 'luthier' | 'atendente' | 'cliente';
  actionType: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
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

// Password hashing with crypto.pbkdf2Sync
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Seed Users with hashed passwords
const users: UserRecord[] = [
  (() => {
    const salt = crypto.randomBytes(16).toString('hex');
    return {
      id: 'usr-armando',
      name: 'Armando Luthier',
      email: 'armando.luthier@oficina.com',
      cpfDigits: '12345678909',
      phone: '(11) 98765-4321',
      role: 'luthier',
      salt,
      passwordHash: hashPassword('Luthier@2026', salt),
    };
  })(),
  (() => {
    const salt = crypto.randomBytes(16).toString('hex');
    return {
      id: 'usr-mariana',
      name: 'Mariana Balcão',
      email: 'mariana.balcao@oficina.com',
      cpfDigits: '23456789011',
      phone: '(11) 99123-8877',
      role: 'atendente',
      salt,
      passwordHash: hashPassword('Balcao@2026', salt),
    };
  })(),
  (() => {
    const salt = crypto.randomBytes(16).toString('hex');
    return {
      id: 'usr-lucas',
      name: 'Lucas Silveira',
      email: 'lucas.silveira@guitar.com',
      cpfDigits: '32165498712',
      phone: '(11) 98765-4321',
      role: 'cliente',
      salt,
      passwordHash: hashPassword('Cliente@2026', salt),
    };
  })(),
];

// In-memory store for sessions, reauth tickets, rate limits, and audit logs
const sessions = new Map<string, Session>();
const reauthTickets = new Map<string, ReauthTicket>();
const auditLogs: AuditLog[] = [];

// Rate limiting state: failed attempts by identifier and IP
interface FailedAttemptInfo {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}
const failedAttempts = new Map<string, FailedAttemptInfo>();

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

function logAudit(
  action: string,
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED',
  identifier: string,
  req: Request,
  user?: UserRecord,
  details?: string
) {
  const log: AuditLog = {
    id: 'aud-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    action,
    userId: user?.id,
    userRole: user?.role,
    maskedIdentifier: maskIdentifier(identifier),
    result,
    ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    details,
  };
  auditLogs.unshift(log);
  if (auditLogs.length > 200) auditLogs.pop();
}

// Check Rate Limit (5 attempts, 15 min lock)
function checkRateLimit(key: string): { locked: boolean; remainingSeconds: number } {
  const info = failedAttempts.get(key);
  if (!info) return { locked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (info.lockedUntil && info.lockedUntil > now) {
    return {
      locked: true,
      remainingSeconds: Math.ceil((info.lockedUntil - now) / 1000),
    };
  }

  // Reset if window of 15 min has passed
  if (now - info.lastAttempt > 15 * 60 * 1000) {
    failedAttempts.delete(key);
    return { locked: false, remainingSeconds: 0 };
  }

  return { locked: false, remainingSeconds: 0 };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const info = failedAttempts.get(key) || { count: 0, lastAttempt: now };
  info.count += 1;
  info.lastAttempt = now;
  if (info.count >= 5) {
    info.lockedUntil = now + 15 * 60 * 1000; // 15 min lock
  }
  failedAttempts.set(key, info);
}

function resetFailedAttempts(key: string) {
  failedAttempts.delete(key);
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

async function startServer() {
  const app = express();
  app.use(express.json());

  // ---------------- AUTH API ENDPOINTS ----------------

  // 1. POST /api/auth/login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { identifier, password, rememberMe } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'E-mail ou CPF e senha são obrigatórios.' });
    }

    const cleanInput = String(identifier).trim().toLowerCase();
    const rawDigits = cleanInput.replace(/\D/g, '');
    const rateLimitKey = cleanInput.includes('@') ? cleanInput : rawDigits || cleanInput;

    const rateStatus = checkRateLimit(rateLimitKey);
    if (rateStatus.locked) {
      logAudit('LOGIN', 'BLOCKED', cleanInput, req, undefined, 'Taxa excedida, conta bloqueada');
      res.setHeader('Retry-After', rateStatus.remainingSeconds);
      return res.status(429).json({
        error: `Conta bloqueada temporariamente por muitas tentativas inválidas. Tente novamente em ${Math.ceil(
          rateStatus.remainingSeconds / 60
        )} minutos.`,
        locked: true,
        remainingSeconds: rateStatus.remainingSeconds,
      });
    }

    // Find user by email or CPF digits
    const user = users.find((u) => {
      if (cleanInput.includes('@')) {
        return u.email.toLowerCase() === cleanInput;
      }
      return u.cpfDigits === rawDigits;
    });

    if (!user) {
      recordFailedAttempt(rateLimitKey);
      logAudit('LOGIN', 'FAILED', cleanInput, req, undefined, 'Usuário não localizado');
      return res.status(401).json({ error: 'E-mail/CPF ou senha incorretos.' });
    }

    // Verify hash in constant time
    const computedHash = hashPassword(String(password), user.salt);
    const hashBufferA = Buffer.from(computedHash, 'hex');
    const hashBufferB = Buffer.from(user.passwordHash, 'hex');

    const isValid =
      hashBufferA.length === hashBufferB.length &&
      crypto.timingSafeEqual(hashBufferA, hashBufferB);

    if (!isValid) {
      recordFailedAttempt(rateLimitKey);
      logAudit('LOGIN', 'FAILED', cleanInput, req, user, 'Senha inválida');
      return res.status(401).json({ error: 'E-mail/CPF ou senha incorretos.' });
    }

    // Success
    resetFailedAttempts(rateLimitKey);
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const duration = rememberMe ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000; // 24h or 2h
    const session: Session = {
      id: sessionToken,
      userId: user.id,
      role: user.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + duration,
    };
    sessions.set(sessionToken, session);

    logAudit('LOGIN', 'SUCCESS', cleanInput, req, user);

    return res.json({
      token: sessionToken,
      user: sanitizeUser(user),
      expiresAt: session.expiresAt,
    });
  });

  // 2. POST /api/auth/reauthenticate
  // Enforces Rule 2: Reauthentication with email/CPF + password before profile switch or sensitive change
  app.post('/api/auth/reauthenticate', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const { identifier, password, actionType, targetUserId, targetRole } = req.body;
    if (!identifier || !password || !actionType) {
      return res.status(400).json({ error: 'Credenciais e tipo de ação são obrigatórios.' });
    }

    const cleanInput = String(identifier).trim().toLowerCase();
    const rawDigits = cleanInput.replace(/\D/g, '');
    const rateLimitKey = 'reauth:' + (cleanInput.includes('@') ? cleanInput : rawDigits || cleanInput);

    const rateStatus = checkRateLimit(rateLimitKey);
    if (rateStatus.locked) {
      logAudit('REAUTH', 'BLOCKED', cleanInput, req, undefined, 'Bloqueio de reautenticação');
      return res.status(429).json({
        error: `Muitas tentativas. Aguarde ${Math.ceil(rateStatus.remainingSeconds / 60)} minutos.`,
        locked: true,
      });
    }

    // Determine which user must be verified
    let expectedUser: UserRecord | undefined;

    if (actionType === 'SWITCH_PROFILE') {
      // For switching profile: the credentials entered identify the TARGET user!
      expectedUser = users.find((u) => {
        if (cleanInput.includes('@')) return u.email.toLowerCase() === cleanInput;
        return u.cpfDigits === rawDigits;
      });
      if (expectedUser && targetRole && expectedUser.role !== targetRole) {
        expectedUser = undefined;
      }
    } else {
      // For editing own account / sensitive change: must match the CURRENT session user!
      const currentUser = users.find((u) => u.id === session.userId);
      if (currentUser) {
        const matchesCurrent = cleanInput.includes('@')
          ? currentUser.email.toLowerCase() === cleanInput
          : currentUser.cpfDigits === rawDigits;
        if (matchesCurrent) {
          expectedUser = currentUser;
        }
      }
    }

    if (!expectedUser) {
      recordFailedAttempt(rateLimitKey);
      logAudit('REAUTH', 'FAILED', cleanInput, req, undefined, `Ação: ${actionType} - Usuário incompatível`);
      return res.status(401).json({ error: 'E-mail/CPF ou senha incorretos.' });
    }

    const computedHash = hashPassword(String(password), expectedUser.salt);
    const hashBufferA = Buffer.from(computedHash, 'hex');
    const hashBufferB = Buffer.from(expectedUser.passwordHash, 'hex');

    const isValid =
      hashBufferA.length === hashBufferB.length &&
      crypto.timingSafeEqual(hashBufferA, hashBufferB);

    if (!isValid) {
      recordFailedAttempt(rateLimitKey);
      logAudit('REAUTH', 'FAILED', cleanInput, req, expectedUser, `Ação: ${actionType} - Senha incorreta`);
      return res.status(401).json({ error: 'E-mail/CPF ou senha incorretos.' });
    }

    resetFailedAttempts(rateLimitKey);

    // Issue short-lived reauth ticket (valid for strictly 5 minutes = 300,000 ms)
    const ticketStr = 'reauth_' + crypto.randomBytes(24).toString('hex');
    const ticketObj: ReauthTicket = {
      ticket: ticketStr,
      userId: expectedUser.id,
      targetRole: expectedUser.role,
      actionType,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min window
      used: false,
    };
    reauthTickets.set(ticketStr, ticketObj);

    logAudit('REAUTH', 'SUCCESS', cleanInput, req, expectedUser, `Janela de 5 min aberta para: ${actionType}`);

    return res.json({
      success: true,
      ticket: ticketStr,
      targetUser: sanitizeUser(expectedUser),
      expiresInSeconds: 300,
    });
  });

  // 3. POST /api/auth/switch-profile
  // Server-side profile switch requiring valid reauth ticket
  app.post('/api/auth/switch-profile', (req: Request, res: Response) => {
    const currentSession = getSessionFromReq(req);
    const { ticket } = req.body;

    if (!ticket) {
      return res.status(403).json({ error: 'Reautenticação obrigatória para troca de perfil.' });
    }

    const reauth = reauthTickets.get(ticket);
    if (!reauth || reauth.used || Date.now() > reauth.expiresAt || reauth.actionType !== 'SWITCH_PROFILE') {
      return res.status(403).json({ error: 'Reautenticação inválida ou expirada. Confirme sua senha novamente.' });
    }

    const targetUser = users.find((u) => u.id === reauth.userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário alvo não encontrado.' });
    }

    // Invalidate old session
    if (currentSession) {
      sessions.delete(currentSession.id);
    }
    reauth.used = true;
    reauthTickets.delete(ticket);

    // Establish new session
    const newSessionToken = crypto.randomBytes(32).toString('hex');
    const newSession: Session = {
      id: newSessionToken,
      userId: targetUser.id,
      role: targetUser.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    };
    sessions.set(newSessionToken, newSession);

    logAudit('PROFILE_SWITCH', 'SUCCESS', targetUser.email, req, targetUser, `Perfil alterado para ${targetUser.role}`);

    return res.json({
      token: newSessionToken,
      user: sanitizeUser(targetUser),
    });
  });

  // 4. POST /api/auth/sensitive-update
  // Modifies sensitive user data (email, phone, password), requiring valid reauth ticket
  app.post('/api/auth/sensitive-update', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Sessão inválida.' });
    }

    const { ticket, email, phone, newPassword } = req.body;
    if (!ticket) {
      return res.status(403).json({ error: 'Reautenticação obrigatória para alterar dados sensíveis.' });
    }

    const reauth = reauthTickets.get(ticket);
    if (!reauth || reauth.used || Date.now() > reauth.expiresAt || reauth.actionType !== 'SENSITIVE_UPDATE') {
      return res.status(403).json({ error: 'Reautenticação inválida ou expirada. Confirme sua senha novamente.' });
    }

    const user = users.find((u) => u.id === session.userId);
    if (!user || user.id !== reauth.userId) {
      return res.status(403).json({ error: 'Reautenticação não corresponde ao usuário da sessão.' });
    }

    // Apply updates
    if (email && email.includes('@')) {
      user.email = email.trim().toLowerCase();
    }
    if (phone) {
      user.phone = phone.trim();
    }
    if (newPassword && newPassword.length >= 6) {
      user.salt = crypto.randomBytes(16).toString('hex');
      user.passwordHash = hashPassword(newPassword, user.salt);
    }

    reauth.used = true;
    reauthTickets.delete(ticket);

    logAudit('SENSITIVE_UPDATE', 'SUCCESS', user.email, req, user, 'Dados sensíveis atualizados com reautenticação válida');

    return res.json({
      success: true,
      user: sanitizeUser(user),
    });
  });

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
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Informe seu e-mail ou CPF.' });
    }
    const cleanInput = String(identifier).trim().toLowerCase();
    const rawDigits = cleanInput.replace(/\D/g, '');

    logAudit('PASSWORD_RECOVERY_REQUEST', 'SUCCESS', cleanInput, req);

    // Uniform response time and message to avoid user enumeration
    return res.json({
      message: 'Se a conta existir, um link de recuperação válido por 15 minutos foi gerado para o e-mail cadastrado.',
      mockToken: 'recov_' + crypto.randomBytes(16).toString('hex'),
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

    const role = session.role;
    const permissions = {
      role,
      isAdmin: role === 'luthier',
      canAccessToday: role === 'luthier' || role === 'atendente',
      canAccessOrders: role === 'luthier' || role === 'atendente',
      canAccessClients: role === 'luthier' || role === 'atendente',
      canAccessStock: role === 'luthier', // Exclusive to Luthier/Admin
      canAccessFinancials: role === 'luthier', // Exclusive to Luthier/Admin
      canAccessAgenda: role === 'luthier' || role === 'atendente',
      canAccessMessages: role === 'luthier' || role === 'atendente',
      canAccessConfig: role === 'luthier', // Exclusive to Luthier/Admin
      canAccessWorkbench: role === 'luthier', // Exclusive to Luthier/Admin
      canAccessClientPortal: role === 'cliente' || role === 'luthier',
      canRegisterDelivery: role === 'luthier' || role === 'atendente',
      canRegisterEntry: role === 'luthier' || role === 'atendente',
      canPerformBenchLabor: role === 'luthier',
    };

    return res.json({ permissions });
  });

  // 10. POST /api/auth/validate-action (Backend action-level RBAC barrier)
  app.post('/api/auth/validate-action', (req: Request, res: Response) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { action } = req.body;
    const adminOnlyActions = [
      'VIEW_FINANCIALS',
      'MANAGE_STOCK',
      'WORKBENCH_EXECUTION',
      'VIEW_AUDIT_LOGS',
      'RESET_DEMO_DATA',
      'MODIFY_PRICING',
    ];

    if (adminOnlyActions.includes(action) && session.role !== 'luthier') {
      logAudit('RBAC_REJECT', 'BLOCKED', session.userId, req, undefined, `Ação restrita bloqueada: ${action}`);
      return res.status(403).json({
        error: `Ação '${action}' requer permissão de Administrador (Luthier / Dono).`,
        allowed: false,
      });
    }

    return res.json({ allowed: true });
  });

  // ---------------- VITE MIDDLEWARE SETUP ----------------
  const isProd = process.env.NODE_ENV === 'production';
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

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Luthieria OS] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
