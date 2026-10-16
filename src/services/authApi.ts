/**
 * Fachada de autenticação usada pelo AuthContext e pelas telas de conta.
 *
 * - Modo API (VITE_API_URL definido): fala com o backend srv-luthieria (JWT + refresh token).
 * - Modo demonstração: fala com o servidor mock local (server.ts), que simula personas.
 */
import { isApiMode } from '../config/env';
import { api, ApiError, tokenStore } from './api';
import { toAuthUser } from './api/mappers';
import type { Profile } from './api/types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  maskedCpf: string;
  phone: string;
  role: 'luthier' | 'atendente' | 'estoquista' | 'cliente';
  isAdmin?: boolean;
  /** Só no modo API */
  profile?: Profile;
  tenantId?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  expiresAt: number;
}

export interface ReauthResponse {
  success: boolean;
  ticket: string;
  targetUser: AuthUser;
  expiresInSeconds: number;
}

export interface AuditLogItem {
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

const mockAuthApi = {
  async login(identifier: string, password: string, rememberMe: boolean): Promise<LoginResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, rememberMe }),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Erro ao realizar login.');
      (err as any).status = res.status;
      (err as any).locked = data.locked;
      (err as any).remainingSeconds = data.remainingSeconds;
      throw err;
    }
    return data;
  },

  async reauthenticate(
    token: string,
    identifier: string,
    password: string,
    actionType: string,
    targetRole?: string
  ): Promise<ReauthResponse> {
    const res = await fetch('/api/auth/reauthenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ identifier, password, actionType, targetRole }),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Erro ao confirmar credenciais.');
      (err as any).status = res.status;
      (err as any).locked = data.locked;
      throw err;
    }
    return data;
  },

  async switchProfile(token: string, ticket: string): Promise<LoginResponse> {
    const res = await fetch('/api/auth/switch-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ticket }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao trocar de perfil no servidor.');
    }
    return data;
  },

  async updateSensitiveData(
    token: string,
    ticket: string,
    updates: { email?: string; phone?: string; newPassword?: string }
  ): Promise<{ success: boolean; user: AuthUser }> {
    const res = await fetch('/api/auth/sensitive-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ticket, ...updates }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao atualizar dados sensíveis.');
    }
    return data;
  },

  async getMe(token: string): Promise<AuthUser> {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Sessão expirada ou inválida.');
    }
    const data = await res.json();
    return data.user;
  },

  async logout(token: string): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // offline logout fallback
    }
  },

  async forgotPassword(identifier: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao solicitar recuperação.');
    }
    return data;
  },

  async getAuditLogs(token: string): Promise<AuditLogItem[]> {
    const res = await fetch('/api/auth/audit-logs', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Não autorizado.');
    const data = await res.json();
    return data.logs;
  },

  async getPermissions(token: string): Promise<any> {
    const res = await fetch('/api/auth/permissions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Falha ao obter permissões.');
    const data = await res.json();
    return data.permissions;
  },

  async validateAction(token: string, action: string): Promise<boolean> {
    const res = await fetch('/api/auth/validate-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Ação não permitida para o seu perfil.');
    }
    return true;
  },
};


// ---------------------------------------------------------------------------
// Modo API (backend srv-luthieria)
// ---------------------------------------------------------------------------

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireEmail(identifier: string): string {
  const email = identifier.trim().toLowerCase();
  if (!EMAIL.test(email)) {
    throw Object.assign(new Error('Use o e-mail cadastrado (login por CPF não está disponível).'), {
      status: 400,
    });
  }
  return email;
}

function rethrow(e: unknown): never {
  if (e instanceof ApiError) {
    throw Object.assign(new Error(e.message), {
      status: e.status,
      locked: e.status === 429,
      remainingSeconds: e.retryAfterSeconds,
    });
  }
  throw e;
}

/** Sessão aberta por outra tela (ex.: cadastro da luthieria): devolve o usuário já logado. */
async function currentUser(): Promise<AuthUser> {
  return toAuthUser(await api.users.me());
}

const backendAuthApi: typeof mockAuthApi = {
  async login(identifier, password, rememberMe) {
    try {
      const tokens = await api.auth.login(requireEmail(identifier), password);
      tokenStore.save(tokens, rememberMe);
      const user = await currentUser();
      return { token: tokens.accessToken, user, expiresAt: Date.now() + tokens.expiresIn * 1000 };
    } catch (e) {
      return rethrow(e);
    }
  },

  /** Confere a senha abrindo uma sessão descartável (o backend não tem endpoint de reauth). */
  async reauthenticate(_token, identifier, password, actionType) {
    try {
      const tokens = await api.auth.login(requireEmail(identifier), password);
      await api.auth.logout(tokens.refreshToken).catch(() => undefined);
      const user = await currentUser();
      if (actionType === 'SENSITIVE_UPDATE' && user.email !== identifier.trim().toLowerCase()) {
        throw Object.assign(new Error('As credenciais não são da conta atual.'), { status: 401 });
      }
      return { success: true, ticket: `verified-${Date.now()}`, targetUser: user, expiresInSeconds: 300 };
    } catch (e) {
      return rethrow(e);
    }
  },

  async switchProfile() {
    throw new Error('Para usar outro perfil, saia e entre com a conta desejada.');
  },

  async updateSensitiveData() {
    throw new Error('Alteração de dados pela conta ainda não está disponível na API.');
  },

  async getMe() {
    return currentUser();
  },

  async logout() {
    const refreshToken = tokenStore.refresh;
    tokenStore.clear();
    if (refreshToken) {
      await api.auth.logout(refreshToken).catch(() => undefined);
    }
  },

  async forgotPassword(identifier) {
    try {
      await api.auth.forgotPassword(requireEmail(identifier));
      return {
        message: 'Se o e-mail estiver cadastrado, enviaremos um link válido por 30 minutos.',
      };
    } catch (e) {
      return rethrow(e);
    }
  },

  async getAuditLogs() {
    const page = await api.audit.list();
    return page.content.map((a) => ({
      id: a.id,
      timestamp: a.timestamp,
      action: a.action,
      maskedIdentifier: a.actor,
      result: a.action.endsWith('FAILED') ? ('FAILED' as const) : ('SUCCESS' as const),
      ip: a.ip ?? '',
      details: [a.resourceType, a.details].filter(Boolean).join(' · ') || undefined,
    }));
  },

  async getPermissions() {
    return undefined;
  },

  async validateAction() {
    return true;
  },
};

export const authApi = isApiMode ? backendAuthApi : mockAuthApi;
