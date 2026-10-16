/**
 * Auth API Client.
 * - Com VITE_API_URL: fala direto com o backend srv-lutheria (/auth/**, /users/me, /audit-logs).
 * - Sem VITE_API_URL: usa o mock Express (server.ts, rotas /api/auth/**).
 */
import { api, tokenStore, TokenResponse, USE_BACKEND } from './apiClient';
import { UserDto } from './backendApi';

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


// ---------- Backend real (srv-lutheria) ----------

const toAuthUser = (u: UserDto): AuthUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  maskedCpf: u.maskedCpf || '',
  phone: u.phone || '',
  // O front tem 2 personas de equipe: bancada (luthier) e balcão (atendente)
  role: u.profile === 'ATENDENTE' ? 'atendente' : 'luthier',
  isAdmin: u.profile === 'ADMIN',
});

const requireEmail = (identifier: string) => {
  const email = identifier.trim();
  if (!email.includes('@')) {
    throw new Error('A API aceita login apenas por e-mail. Informe seu e-mail.');
  }
  return email;
};

const backendLogin = (identifier: string, password: string) =>
  api<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email: requireEmail(identifier), password },
    auth: false,
  });

const backendAuthApi: typeof mockAuthApi = {
  async login(identifier, password, rememberMe) {
    const tokens = await backendLogin(identifier, password);
    tokenStore.save(tokens, rememberMe);
    const user = toAuthUser(await api<UserDto>('/users/me'));
    return { token: tokens.accessToken, user, expiresAt: Date.now() + tokens.expiresIn * 1000 };
  },

  /**
   * A API não tem reautenticação dedicada: validamos as credenciais com um novo login.
   * Troca de perfil = entrar com a conta destino; o "ticket" carrega os tokens dela.
   */
  async reauthenticate(_token, identifier, password, actionType) {
    const tokens = await backendLogin(identifier, password);
    const targetUser = toAuthUser(await api<UserDto>('/users/me', { token: tokens.accessToken }));
    if (actionType !== 'SWITCH_PROFILE') {
      // Só validação: encerra a sessão extra que o login abriu
      await api<void>('/auth/logout', {
        method: 'POST',
        body: { refreshToken: tokens.refreshToken },
        auth: false,
      }).catch(() => undefined);
    }
    return {
      success: true,
      ticket: actionType === 'SWITCH_PROFILE' ? JSON.stringify(tokens) : 'validated',
      targetUser,
      expiresInSeconds: tokens.expiresIn,
    };
  },

  async switchProfile(_token, ticket) {
    const tokens: TokenResponse = JSON.parse(ticket);
    const oldRefresh = tokenStore.refresh();
    if (oldRefresh) {
      await api<void>('/auth/logout', {
        method: 'POST',
        body: { refreshToken: oldRefresh },
        auth: false,
      }).catch(() => undefined);
    }
    tokenStore.save(tokens);
    const user = toAuthUser(await api<UserDto>('/users/me'));
    return { token: tokens.accessToken, user, expiresAt: Date.now() + tokens.expiresIn * 1000 };
  },

  async updateSensitiveData() {
    throw new Error(
      'A API ainda não permite alterar e-mail, telefone ou senha pelo app. Use "Esqueci minha senha".'
    );
  },

  async getMe() {
    return toAuthUser(await api<UserDto>('/users/me'));
  },

  async logout() {
    const refreshToken = tokenStore.refresh();
    tokenStore.clear();
    if (!refreshToken) return;
    await api<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(
      () => undefined
    );
  },

  async forgotPassword(identifier) {
    await api<void>('/auth/forgot-password', {
      method: 'POST',
      body: { email: requireEmail(identifier) },
      auth: false,
    });
    return { message: 'Se o e-mail estiver cadastrado, você receberá o link de redefinição.' };
  },

  async getAuditLogs() {
    const page = await api<{
      content: { id: string; timestamp: string; actor?: string; action: string; resourceType?: string;
        resourceId?: string; details?: string; ip?: string }[];
    }>('/audit-logs', { query: { page: 0, size: 50 } });
    return page.content.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      action: l.action,
      userId: l.actor,
      maskedIdentifier: l.actor || '-',
      result: 'SUCCESS' as const,
      ip: l.ip || '-',
      details: [l.resourceType, l.resourceId, l.details].filter(Boolean).join(' · ') || undefined,
    }));
  },

  async getPermissions() {
    // Permissões vêm do papel no JWT; o front usa utils/permissions.ts
    return {};
  },

  async validateAction() {
    // Autorização real é feita pelo backend em cada endpoint (403)
    return true;
  },
};

export const authApi = USE_BACKEND ? backendAuthApi : mockAuthApi;
