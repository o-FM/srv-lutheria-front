/**
 * Cliente HTTP da API (srv-luthieria). Em produção o front e a API ficam no mesmo domínio:
 * o proxy (Caddy) entrega o front e encaminha /api/* para o backend. Em dev o Vite faz o mesmo.
 *
 * Sessão: access token JWT de 15 min + refresh token opaco com rotação. Um 401 dispara um
 * único refresh (compartilhado entre chamadas simultâneas) e a requisição é repetida.
 */

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

export interface Session {
  accessToken: string;
  refreshToken: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

const STORAGE_KEY = 'luthier_session';

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------------- armazenamento da sessão ----------------

let session: Session | null = readStoredSession();
let remember = localStorage.getItem(STORAGE_KEY) !== null;
const expiredListeners = new Set<() => void>();

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function persist() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (session) {
      (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // modo privado / armazenamento bloqueado: a sessão fica só em memória
  }
}

export const sessionStore = {
  get: () => session,
  hasSession: () => session !== null,
  set(tokens: TokenResponse | Session, keep?: boolean) {
    if (keep !== undefined) remember = keep;
    session = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    persist();
  },
  clear() {
    session = null;
    persist();
  },
  /** Avisado quando o refresh falha: a sessão acabou e o usuário precisa entrar de novo. */
  onExpired(listener: () => void) {
    expiredListeners.add(listener);
    return () => expiredListeners.delete(listener);
  },
};

// ---------------- requisições ----------------

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const current = session;
  if (!current) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!res.ok) return false;
        sessionStore.set((await res.json()) as TokenResponse);
        return true;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

function expireSession() {
  sessionStore.clear();
  expiredListeners.forEach((l) => l());
}

async function toError(res: Response): Promise<ApiError> {
  let message = `Erro ${res.status}`;
  let fieldErrors: Record<string, string> | undefined;
  try {
    const body = await res.json();
    message = body.detail || body.title || message;
    if (body.errors && typeof body.errors === 'object') fieldErrors = body.errors;
  } catch {
    // corpo vazio ou não-JSON
  }
  if (res.status === 401) message = 'E-mail ou senha incorretos.';
  if (res.status === 403) message = 'Seu perfil não tem permissão para esta ação.';
  if (res.status >= 500) message = 'Falha no servidor. Tente novamente em instantes.';
  if (fieldErrors && res.status === 400) {
    message = Object.values(fieldErrors)[0] || message;
  }
  const error = new ApiError(message, res.status);
  error.fieldErrors = fieldErrors;
  const retry = res.headers.get('Retry-After');
  if (retry) error.retryAfterSeconds = Number(retry);
  return error;
}

interface RequestOptions {
  body?: unknown;
  /** false para rotas públicas (/auth, /portal). */
  auth?: boolean;
}

async function send(method: string, path: string, opts: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const useAuth = opts.auth !== false;
  if (useAuth && session) headers.Authorization = `Bearer ${session.accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Sem conexão com o servidor. Verifique a internet.', 0);
  }

  if (res.status === 401 && useAuth && session && !retried) {
    if (await refreshSession()) return send(method, path, opts, true);
    expireSession();
    throw new ApiError('Sua sessão expirou. Entre novamente.', 401);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

async function json<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, opts);
  if (res.status === 204 || res.headers.get('Content-Length') === '0') return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => json<T>('GET', path, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    json<T>('POST', path, { ...opts, body }),
  put: <T>(path: string, body?: unknown) => json<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => json<T>('PATCH', path, { body }),
  delete: <T>(path: string) => json<T>('DELETE', path),
  /** Download autenticado (fotos da OS): devolve um Blob. */
  async blob(path: string): Promise<Blob> {
    const res = await send('GET', path, {});
    return res.blob();
  },
};

export type { TokenResponse };
