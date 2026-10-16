import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { LoginPage } from './LoginPage';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { currentRole, setRole } = useApp();

  // Mantém o papel de tela igual ao do usuário logado (sem aviso: não foi uma troca manual)
  useEffect(() => {
    if (user && user.role !== currentRole) {
      setRole(user.role, { silent: true });
    }
  }, [user, currentRole, setRole]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-base-950 flex flex-col items-center justify-center gap-3 text-base-400 p-4" role="status">
        <div className="w-6 h-6 border-2 border-base-700 border-t-accent-500 rounded-full animate-spin" />
        <p className="text-sm">Carregando…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <ForgotPasswordModal />
      </>
    );
  }

  return <>{children}</>;
};
