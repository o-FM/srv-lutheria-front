import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../services/api';
import { sessionStore } from '../services/http';
import { AuthUser, toAuthUser } from '../services/mappers';

export type { AuthUser };

interface RegisterInput {
  workshopName: string;
  workshopDocument?: string;
  ownerName: string;
  email: string;
  password: string;
  cpf?: string;
  phone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string, remember: boolean) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Aparelho compartilhado: outra pessoa da oficina entra sem sair do app. */
  switchUser: (email: string, pass: string) => Promise<AuthUser>;
  updateAccount: (changes: {
    currentPassword: string;
    email?: string;
    phone?: string;
    newPassword?: string;
  }) => Promise<AuthUser>;
  isSwitchUserOpen: boolean;
  setIsSwitchUserOpen: (open: boolean) => void;
  isAccountSettingsOpen: boolean;
  setIsAccountSettingsOpen: (open: boolean) => void;
  isForgotPasswordOpen: boolean;
  setIsForgotPasswordOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const REMEMBER_KEY = 'luthier_remember';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(sessionStore.hasSession());
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isSwitchUserOpen, setIsSwitchUserOpen] = useState(false);
  const [remember, setRemember] = useState(() => localStorage.getItem(REMEMBER_KEY) === 'true');

  const clearLocalState = useCallback(() => {
    sessionStore.clear();
    localStorage.removeItem('luthier_os_wizard_draft');
    setUser(null);
    setIsAccountSettingsOpen(false);
    setIsSwitchUserOpen(false);
  }, []);

  // Sessão salva: confirma com o servidor (o refresh acontece sozinho se o JWT venceu)
  useEffect(() => {
    if (!sessionStore.hasSession()) return;
    let alive = true;
    api.users
      .me()
      .then((me) => alive && setUser(toAuthUser(me)))
      .catch(() => alive && clearLocalState())
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, [clearLocalState]);

  useEffect(() => {
    const unsubscribe = sessionStore.onExpired(() => setUser(null));
    return () => {
      unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    const current = sessionStore.get();
    if (current) {
      try {
        await api.auth.logout(current.refreshToken);
      } catch {
        // sem rede: a sessão local é descartada mesmo assim
      }
    }
    clearLocalState();
  }, [clearLocalState]);

  // Sem "manter conectado", a sessão cai após 15 min sem uso (aparelho de balcão compartilhado)
  useEffect(() => {
    if (!user || remember) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [user, remember, logout]);

  const startSession = useCallback(async (tokens: Parameters<typeof sessionStore.set>[0], keep: boolean) => {
    sessionStore.set(tokens, keep);
    setRemember(keep);
    localStorage.setItem(REMEMBER_KEY, String(keep));
    const me = toAuthUser(await api.users.me());
    setUser(me);
    return me;
  }, []);

  const login = useCallback(
    async (email: string, pass: string, keep: boolean) => {
      const tokens = await api.auth.login(email.trim(), pass);
      return startSession(tokens, keep);
    },
    [startSession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const tokens = await api.auth.register({
        workshop: { name: input.workshopName.trim(), document: input.workshopDocument || undefined },
        owner: {
          name: input.ownerName.trim(),
          email: input.email.trim(),
          password: input.password,
          cpf: input.cpf || undefined,
          phone: input.phone || undefined,
        },
      });
      return startSession(tokens, true);
    },
    [startSession]
  );

  const switchUser = useCallback(
    async (email: string, pass: string) => {
      // Valida o novo usuário antes de encerrar a sessão atual
      const tokens = await api.auth.login(email.trim(), pass);
      const previous = sessionStore.get();
      if (previous) {
        api.auth.logout(previous.refreshToken).catch(() => undefined);
      }
      localStorage.removeItem('luthier_os_wizard_draft');
      return startSession(tokens, false);
    },
    [startSession]
  );

  const updateAccount = useCallback<AuthContextType['updateAccount']>(
    async (changes) => {
      const res = await api.users.updateMe(changes);
      // Trocar e-mail/senha encerra as outras sessões; este aparelho recebe tokens novos
      if (res.session) sessionStore.set(res.session);
      const updated = toAuthUser(res.user);
      setUser(updated);
      return updated;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        switchUser,
        updateAccount,
        isSwitchUserOpen,
        setIsSwitchUserOpen,
        isAccountSettingsOpen,
        setIsAccountSettingsOpen,
        isForgotPasswordOpen,
        setIsForgotPasswordOpen,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
