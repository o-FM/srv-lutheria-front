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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('luthier_auth_token') || sessionStorage.getItem('luthier_auth_token');
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('luthier_auth_user') || sessionStorage.getItem('luthier_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

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
          localStorage.removeItem('luthier_auth_token');
          sessionStorage.removeItem('luthier_auth_token');
          localStorage.removeItem('luthier_auth_user');
          sessionStorage.removeItem('luthier_auth_user');
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
      setToken(res.token);
      setUser(res.user);

      if (remember) {
        localStorage.setItem('luthier_auth_token', res.token);
        localStorage.setItem('luthier_auth_user', JSON.stringify(res.user));
      } else {
        sessionStorage.setItem('luthier_auth_token', res.token);
        sessionStorage.setItem('luthier_auth_user', JSON.stringify(res.user));
      }

      return res.user;
    },
    []
  );

  const logout = useCallback(async () => {
    if (token) {
      await authApi.logout(token);
    }
    localStorage.removeItem('luthier_auth_token');
    sessionStorage.removeItem('luthier_auth_token');
    localStorage.removeItem('luthier_auth_user');
    sessionStorage.removeItem('luthier_auth_user');
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

      // Clean local storage cache, offline queues, and draft state to prevent leakage between roles
      localStorage.removeItem('luthier_os_wizard_draft');

      setToken(res.token);
      setUser(res.user);
      sessionStorage.setItem('luthier_auth_token', res.token);
      sessionStorage.setItem('luthier_auth_user', JSON.stringify(res.user));

      return res.user;
    },
    [token]
  );

  const updateUserInMemory = useCallback((updated: AuthUser) => {
    setUser(updated);
    if (localStorage.getItem('luthier_auth_user')) {
      localStorage.setItem('luthier_auth_user', JSON.stringify(updated));
    }
    if (sessionStorage.getItem('luthier_auth_user')) {
      sessionStorage.setItem('luthier_auth_user', JSON.stringify(updated));
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
