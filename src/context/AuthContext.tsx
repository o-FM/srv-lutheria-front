import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { AuthUser, authApi } from '../services/authApi';
import { UserRole } from '../types';
import {
  BUSINESS_DATA_KEYS,
  readJson,
  readString,
  removeKeys,
  writeJson,
  writeString,
} from '../utils/storage';

const AUTH_KEYS = ['luthier_auth_token', 'luthier_auth_user'] as const;

/** Remove a sessão das duas storages. */
function clearStoredSession(): void {
  removeKeys(AUTH_KEYS);
  removeKeys(AUTH_KEYS, sessionStorage);
}

/** Grava a sessão em uma única storage (local = "manter conectado"). */
function persistSession(token: string, user: AuthUser, remember: boolean): void {
  clearStoredSession();
  const store = remember ? localStorage : sessionStorage;
  writeString('luthier_auth_token', token, store);
  writeJson('luthier_auth_user', user, store);
}

/** Apaga os dados de negócio do aparelho (no mock, voltam às seeds no próximo login). */
function clearBusinessData(): void {
  removeKeys(BUSINESS_DATA_KEYS);
}

const isRememberedSession = (): boolean => readString('luthier_auth_token') !== null;

const ROLES: readonly string[] = ['luthier', 'atendente', 'cliente'];

// Usuário salvo só é aceito se tiver o mínimo esperado; senão a sessão é descartada.
function isStoredAuthUser(value: unknown): value is AuthUser | null {
  if (typeof value !== 'object' || value === null) return false;
  const u = value as Record<string, unknown>;
  return (
    typeof u.id === 'string' &&
    typeof u.name === 'string' &&
    typeof u.email === 'string' &&
    typeof u.role === 'string' &&
    ROLES.includes(u.role)
  );
}

interface ReauthModalState {
  isOpen: boolean;
  actionType: 'SWITCH_PROFILE' | 'SENSITIVE_UPDATE';
  targetRole?: UserRole;
  title: string;
  description: string;
  resolve?: (ticket: string) => void;
  reject?: () => void;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, pass: string, remember: boolean) => Promise<AuthUser>;
  logout: () => Promise<void>;
  requestReauthentication: (config: {
    actionType: 'SWITCH_PROFILE' | 'SENSITIVE_UPDATE';
    targetRole?: UserRole;
    title?: string;
    description?: string;
  }) => Promise<string>;
  reauthModal: ReauthModalState;
  closeReauthModal: () => void;
  confirmReauthSuccess: (ticket: string) => void;
  switchProfileWithTicket: (ticket: string) => Promise<AuthUser>;
  isAccountSettingsOpen: boolean;
  setIsAccountSettingsOpen: (open: boolean) => void;
  isForgotPasswordOpen: boolean;
  setIsForgotPasswordOpen: (open: boolean) => void;
  updateUserInMemory: (user: AuthUser) => void;
  /** Usuário que acabou de assumir a sessão por troca de perfil (para o aviso na tela). */
  profileSwitchedTo: AuthUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return readString('luthier_auth_token') || readString('luthier_auth_token', sessionStorage);
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    return (
      readJson<AuthUser | null>('luthier_auth_user', null, isStoredAuthUser) ??
      readJson<AuthUser | null>('luthier_auth_user', null, isStoredAuthUser, sessionStorage)
    );
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [profileSwitchedTo, setProfileSwitchedTo] = useState<AuthUser | null>(null);

  const [reauthModal, setReauthModal] = useState<ReauthModalState>({
    isOpen: false,
    actionType: 'SENSITIVE_UPDATE',
    title: 'Confirme sua Identidade',
    description: 'Digite seu E-mail ou CPF e senha para continuar.',
  });

  // Verify session on mount with server
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }
      try {
        const remoteUser = await authApi.getMe(token);
        if (isMounted) {
          setUser(remoteUser);
          setIsLoading(false);
        }
      } catch {
        // Token expired or invalid
        if (isMounted) {
          clearStoredSession();
          clearBusinessData();
          setToken(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Inactivity tracking
  useEffect(() => {
    if (!token) return;

    let timer: NodeJS.Timeout;

    const resetInactivity = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Logout due to inactivity
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetInactivity));
    resetInactivity();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetInactivity));
    };
  }, [token]);

  const login = useCallback(
    async (identifier: string, pass: string, remember: boolean): Promise<AuthUser> => {
      const res = await authApi.login(identifier, pass, remember);
      persistSession(res.token, res.user, remember);
      setProfileSwitchedTo(null);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(async () => {
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // Sem rede ou sessão já expirada: o logout local acontece mesmo assim.
      }
    }
    clearStoredSession();
    clearBusinessData();
    setProfileSwitchedTo(null);
    setToken(null);
    setUser(null);
    setIsAccountSettingsOpen(false);
  }, [token]);

  // Opens the Reauthentication Bottom Sheet and returns a Promise resolving with the single-use ticket
  const requestReauthentication = useCallback(
    (config: {
      actionType: 'SWITCH_PROFILE' | 'SENSITIVE_UPDATE';
      targetRole?: UserRole;
      title?: string;
      description?: string;
    }): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        setReauthModal({
          isOpen: true,
          actionType: config.actionType,
          targetRole: config.targetRole,
          title: config.title || 'Confirme sua Identidade',
          description:
            config.description ||
            (config.actionType === 'SWITCH_PROFILE'
              ? 'Para trocar de perfil, informe as credenciais de acesso da conta destino.'
              : 'Para atualizar dados sensíveis, confirme sua identificação e senha atual.'),
          resolve,
          reject,
        });
      });
    },
    []
  );

  const closeReauthModal = useCallback(() => {
    if (reauthModal.reject) {
      reauthModal.reject();
    }
    setReauthModal((prev) => ({ ...prev, isOpen: false, resolve: undefined, reject: undefined }));
  }, [reauthModal]);

  const confirmReauthSuccess = useCallback(
    (ticket: string) => {
      if (reauthModal.resolve) {
        reauthModal.resolve(ticket);
      }
      setReauthModal((prev) => ({ ...prev, isOpen: false, resolve: undefined, reject: undefined }));
    },
    [reauthModal]
  );

  // Switch profile server-side, and purge local caches according to business rule
  const switchProfileWithTicket = useCallback(
    async (ticket: string): Promise<AuthUser> => {
      if (!token) throw new Error('Não autenticado.');

      const res = await authApi.switchProfile(token, ticket);

      // Rascunho do wizard é do usuário anterior: não pode vazar para o novo perfil.
      removeKeys(['luthier_os_wizard_draft']);

      // Mantém a sessão na mesma storage em que estava ("manter conectado" continua valendo).
      persistSession(res.token, res.user, isRememberedSession());
      setProfileSwitchedTo(res.user);
      setToken(res.token);
      setUser(res.user);

      return res.user;
    },
    [token]
  );

  const updateUserInMemory = useCallback((updated: AuthUser) => {
    setUser(updated);
    if (readString('luthier_auth_user') !== null) {
      writeJson('luthier_auth_user', updated);
    }
    if (readString('luthier_auth_user', sessionStorage) !== null) {
      writeJson('luthier_auth_user', updated, sessionStorage);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        requestReauthentication,
        reauthModal,
        closeReauthModal,
        confirmReauthSuccess,
        switchProfileWithTicket,
        isAccountSettingsOpen,
        setIsAccountSettingsOpen,
        isForgotPasswordOpen,
        setIsForgotPasswordOpen,
        updateUserInMemory,
        profileSwitchedTo,
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
