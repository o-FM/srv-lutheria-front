import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Lock, X, Eye, EyeOff, AlertCircle, ShieldCheck, Users } from 'lucide-react';

/**
 * Aparelho compartilhado no balcão/bancada: outra pessoa da equipe entra com o próprio e-mail e
 * senha. A sessão anterior é encerrada no servidor e os dados são recarregados para o novo perfil.
 */
export const SwitchUserSheet: React.FC = () => {
  const { user, isSwitchUserOpen, setIsSwitchUserOpen, switchUser } = useAuth();
  const { showToast, triggerHaptic } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSwitchUserOpen) {
      setEmail('');
      setPassword('');
      setErrorMsg(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isSwitchUserOpen]);

  if (!isSwitchUserOpen) return null;

  const close = () => setIsSwitchUserOpen(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    triggerHaptic();
    if (!email.trim() || !password) {
      setErrorMsg('Informe e-mail e senha.');
      return;
    }
    if (email.trim().toLowerCase() === user?.email.toLowerCase()) {
      setErrorMsg('Esta já é a sessão ativa.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const next = await switchUser(email, password);
      close();
      showToast({ title: 'Usuário alterado', description: `Sessão ativa: ${next.name}`, type: 'success' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'E-mail ou senha incorretos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="fixed inset-0" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="switch-user-title"
        className="relative z-10 w-full max-w-lg bg-stone-900 border-t sm:border border-stone-800 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden text-stone-100 shadow-2xl max-h-[90vh] pb-safe"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
              <Users className="w-4 h-4" />
            </div>
            <h2 id="switch-user-title" className="font-bold text-sm text-white">Trocar de usuário</h2>
          </div>
          <button type="button" onClick={close} className="p-1 text-stone-400 hover:text-white rounded-lg" aria-label="Cancelar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-4 space-y-3.5 overflow-y-auto">
          <p className="text-xs text-stone-300">
            Quem vai usar o aparelho entra com o próprio e-mail e senha. A sessão de {user?.name} será encerrada.
          </p>
          {errorMsg && (
            <div role="alert" className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          <div>
            <label htmlFor="switch-email" className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">E-mail</label>
            <input
              ref={inputRef}
              id="switch-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-3 bg-stone-950 border border-stone-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label htmlFor="switch-password" className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Senha</label>
            <div className="relative">
              <input
                id="switch-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-12 py-3 bg-stone-950 border border-stone-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1 bottom-1 w-11 flex items-center justify-center text-stone-400 hover:text-white"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <button type="button" onClick={close} className="flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              {isLoading ? 'Verificando...' : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Entrar
                </>
              )}
            </button>
          </div>
          <p className="text-[10px] text-stone-500 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Cada acesso fica registrado na trilha de auditoria.
          </p>
        </form>
      </div>
    </div>
  );
};
