/**
 * Cliente HTTP da API: JSON, Bearer token, erros RFC 9457 e renovação automática da sessão.
 *
 * Fluxo de sessão: o access token (JWT, 15 min) vai no header Authorization. Ao receber 401, o
 * cliente troca o refresh token por um par novo (rotação — o antigo deixa de valer) e repete a
 * requisição UMA vez. Requisições simultâneas compartilham a mesma renovação.
 */
import { env } from '../../config/env';
import type { ProblemDetail, TokenResponse } from './types';

const ACCESS_KEY = 'luthier_access_token';
const REFRESH_KEY = 'luthier_refresh_token';

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;
  readonly retryAfterSeconds?: number;

  constructor(problem: ProblemDetail, retryAfterSeconds?: number) {
    super(ApiError.messageFor(problem));
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** Erros de validação por campo (400): { phone: "Telefone deve ter DDD + número" } */
  get fieldErrors(): Record<string, string> {
    return this.problem.errors ?? {};
  }

  private static messageFor(p: ProblemDetail): string {
    if (p.errors && Object.keys(p.errors).length > 0) {
      return Object.values(p.errors)[0];
    }
    if (p.detail) return p.detail;
    switch (p.status) {
      case 0: return 'Sem conexão com o servidor.';
      case 401: return 'Sessão expirada. Entre novamente.';
      case 403: return 'Seu perfil não tem permissão para esta ação.';
      case 404: return 'Registro não encontrado.';
      case 409: return 'Conflito com o estado atual do registro.';
      case 429: return 'Muitas tentativas. Aguarde um pouco.';
      default: return p.title || 'Erro inesperado.';
    }
  }
}

// ---------------- armazenamento de tokens ----------------

/** "Lembrar de mim" → localStorage; senão sessionStorage (some ao fechar o navegador). */
interface TokenStore {
  readonly access: string | null;
  readonly refresh: string | null;
  readonly persistent: boolean;
  save(tokens: TokenResponse, remember?: boolean): void;
  clear(): void;
}

export const tokenStore: TokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY) ?? sessionStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  },
  get persistent(): boolean {
    return localStorage.getItem(REFRESH_KEY) !== null;
  },
  save(tokens: TokenResponse, remember?: boolean) {
    const keep = remember ?? tokenStore.persistent;
    tokenStore.clear();
    const storage = keep ? localStorage : sessionStorage;
    storage.setItem(ACCESS_KEY, tokens.accessToken);
    storage.setItem(REFRESH_KEY, tokens.refreshToken);
  },
  clear() {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(ACCESS_KEY);
      storage.removeItem(REFRESH_KEY);
    }
  },
};

let onSessionExpired: (() => void) | null = null;

/** O AuthContext registra o que fazer quando a renovação falha (volta para o login). */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// ---------------- requisições ----------------

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** false para rotas públicas (login, portal do cliente). */
  auth?: boolean;
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${env.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      tokenStore.save((await res.json()) as TokenResponse);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${env.apiUrl}${path}`, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export async function request<T>(method: Method, path: string, options: RequestOptions = {},
  retried = false): Promise<T> {
  const { body, query, auth = true, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError({ status: 0, title: 'Network Error' });
  }

  if (res.status === 401 && auth && !retried) {
    if (await refreshSession()) {
      return request<T>(method, path, options, true);
    }
    tokenStore.clear();
    onSessionExpired?.();
  }

  if (!res.ok) {
    const problem = (await res.json().catch(() => ({}))) as Partial<ProblemDetail>;
    const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
    throw new ApiError({ ...problem, status: res.status }, retryAfter);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};

/** Busca todas as páginas de um endpoint paginado (cargas iniciais pequenas por luthieria). */
export async function fetchAll<T>(path: string, query: RequestOptions['query'] = {},
  maxPages = 20): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const result = await http.get<import('./types').Page<T>>(path, {
      query: { ...query, page, size: 100 },
    });
    items.push(...result.content);
    if (page >= result.totalPages - 1) break;
  }
  return items;
}
