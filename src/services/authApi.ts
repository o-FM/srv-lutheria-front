/**
 * Auth API Client communicating with Express backend endpoints
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  maskedCpf: string;
  phone: string;
  role: 'luthier' | 'atendente' | 'cliente';
  isAdmin?: boolean;
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

/** Erro HTTP da API de auth; `status` distingue sessão rejeitada de falha de rede/servidor. */
export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

/** Só 401/403 significam que o servidor recusou a sessão. Rede fora ou 5xx não. */
export function isSessionRejected(err: unknown): boolean {
  return err instanceof AuthApiError && (err.status === 401 || err.status === 403);
}

export const authApi = {
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
      throw new AuthApiError('Sessão expirada ou inválida.', res.status);
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

