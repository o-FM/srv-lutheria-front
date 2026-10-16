import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoginPage } from './LoginPage';
import { ForgotPasswordModal } from './ForgotPasswordModal';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-100 p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-2xl mb-4 animate-pulse">
          <span className="font-black text-white text-lg">OS</span>
        </div>
        <div className="w-6 h-6 border-2 border-amber-600/30 border-t-amber-500 rounded-full animate-spin mb-2" />
        <p className="text-xs text-stone-400">Carregando oficina...</p>
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
