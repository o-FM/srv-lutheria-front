/**
 * Cliente HTTP do backend srv-lutheria (Spring Boot).
 *
 * O front chama a API DIRETO (sem proxy): a URL vem de VITE_API_URL e o backend libera a
 * origem via CORS (app.security.cors.allowed-origins). Sem VITE_API_URL o app continua no
 * modo demonstração (mock Express + localStorage).
 */

export const API_URL: string = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const USE_BACKEND = API_URL.length > 0;

const ACCESS_KEY = 'luthier_auth_token';
const REFRESH_KEY = 'luthier_refresh_token';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Tokens ficam no mesmo storage escolhido no login ("lembrar de mim" → localStorage). */
export const tokenStore = {
  storage(): Storage {
    return localStorage.getItem(ACCESS_KEY) ? localStorage : sessionStorage;
  },
  access(): string | null {
    return localStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(ACCESS_KEY);
  },
  refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY);
  },
  save(tokens: TokenResponse, remember?: boolean) {
    const target = remember === undefined ? this.storage() : remember ? localStorage : sessionStorage;
    this.clear();
    target.setItem(ACCESS_KEY, tokens.accessToken);
    target.setItem(REFRESH_KEY, tokens.refreshToken);
    window.dispatchEvent(new CustomEvent('luthier:token', { detail: tokens.accessToken }));
  },
  clear() {
    [localStorage, sessionStorage].forEach((s) => {
      s.removeItem(ACCESS_KEY);
      s.removeItem(REFRESH_KEY);
    });
  },
};

async function parseError(res: Response): Promise<ApiError> {
  let message = `Erro ${res.status} ao chamar a API.`;
  let fieldErrors: Record<string, string> | undefined;
  try {
    const body = await res.json();
    // RFC 9457 (application/problem+json)
    fieldErrors = body.errors;
    message = body.detail || body.title || message;
    if (fieldErrors) {
      message = `${message}: ${Object.entries(fieldErrors)
        .map(([field, msg]) => `${field} ${msg}`)
        .join('; ')}`;
    }
  } catch {
    // corpo vazio
  }
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    message = `Muitas tentativas. Tente novamente${retry ? ` em ${retry}s` : ' em instantes'}.`;
  }
  if (res.status === 403 && message.startsWith('Erro')) {
    message = 'Seu perfil não tem permissão para esta ação.';
  }
  return new ApiError(res.status, message, fieldErrors);
}

let refreshing: Promise<boolean> | null = null;

/** Troca o refresh token por um novo par. Chamadas concorrentes compartilham a mesma troca. */
async function refreshTokens(): Promise<boolean> {
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) return false;
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        tokenStore.save(await res.json());
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Rotas públicas (/auth/**, /portal/**) não enviam o Bearer nem tentam refresh. */
  auth?: boolean;
  /** Usa este access token em vez do armazenado (ex.: validar credenciais de outra conta). */
  token?: string;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true, token: tokenOverride } = options;
  const url = new URL(`${API_URL}${path}`);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  });

  const doFetch = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = tokenOverride || (auth ? tokenStore.access() : null);
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await doFetch();
    if (res.status === 401 && auth && !tokenOverride && (await refreshTokens())) {
      res = await doFetch();
    }
  } catch {
    throw new ApiError(0, `Não foi possível conectar à API em ${API_URL}. O backend está rodando?`);
  }

  if (res.status === 401 && auth && !tokenOverride) {
    tokenStore.clear();
    window.dispatchEvent(new CustomEvent('luthier:unauthorized'));
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204 || res.status === 202) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Busca todas as páginas (o backend limita size a 100). */
export async function fetchAll<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined> = {}
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; ; page++) {
    const res = await api<PageResponse<T>>(path, { query: { ...query, page, size: 100 } });
    items.push(...res.content);
    if (page + 1 >= res.totalPages) return items;
  }
}
