import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/authApi';
import { formatCpf, isValidCpf, isValidEmail, cleanCpf } from '../../utils/cpfValidator';
import {
  Lock,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const ReauthBottomSheet: React.FC = () => {
  const {
    token,
    user,
    reauthModal,
    closeReauthModal,
    confirmReauthSuccess,
    switchProfileWithTicket,
  } = useAuth();
  const { setRole, triggerHaptic, showToast, syncStatus } = useApp();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // When sheet opens, auto-fill current user's email if action is sensitive update, or clear if switching
  useEffect(() => {
    if (reauthModal.isOpen) {
      if (reauthModal.actionType === 'SENSITIVE_UPDATE' && user) {
        setIdentifier(user.email);
      } else if (reauthModal.targetRole) {
        // Pre-fill target role hint if switching
        const targetEmails = {
          luthier: 'armando.luthier@oficina.com',
          atendente: 'mariana.balcao@oficina.com',
          cliente: 'lucas.silveira@guitar.com',
        };
        setIdentifier(targetEmails[reauthModal.targetRole] || '');
      } else {
        setIdentifier('');
      }
      setPassword('');
      setErrorMsg(null);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [reauthModal.isOpen, reauthModal.actionType, reauthModal.targetRole, user]);

  if (!reauthModal.isOpen) return null;

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setErrorMsg(null);
    if (val.includes('@')) {
      setIdentifier(val.trim());
    } else {
      const digits = cleanCpf(val);
      if (digits.length > 0) {
        setIdentifier(formatCpf(digits));
      } else {
        setIdentifier(val);
      }
    }
  };

  const isEmailMode = identifier.includes('@');

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    triggerHaptic();

    if (!identifier.trim()) {
      setErrorMsg('Informe seu e-mail ou CPF.');
      inputRef.current?.focus();
      return;
    }

    if (!password) {
      setErrorMsg('Informe a senha.');
      return;
    }

    if (syncStatus === 'offline' || !navigator.onLine) {
      setErrorMsg('Sem conexão. A reautenticação requer rede ativa.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      // Call backend reauthentication endpoint
      const res = await authApi.reauthenticate(
        token,
        identifier,
        password,
        reauthModal.actionType,
        reauthModal.targetRole
      );

      triggerHaptic();

      if (reauthModal.actionType === 'SWITCH_PROFILE') {
        // Switch profile on server, invalidate old session, clear memory/cache
        const newUser = await switchProfileWithTicket(res.ticket);
        setRole(newUser.role);
        showToast({
          title: 'Perfil Alterado com Sucesso',
          description: `Sessão ativa: ${newUser.name} (${newUser.role.toUpperCase()})`,
          type: 'success',
        });
      }

      confirmReauthSuccess(res.ticket);
    } catch (err: any) {
      triggerHaptic();
      setErrorMsg(err.message || 'E-mail/CPF ou senha incorretos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      <div
        className="fixed inset-0"
        onClick={closeReauthModal}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-title"
        className="relative z-10 w-full max-w-lg bg-stone-900 border-t sm:border border-stone-800 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden text-stone-100 shadow-2xl max-h-[90vh] pb-safe"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 id="reauth-title" className="font-bold text-sm text-white">
                {reauthModal.title}
              </h2>
              <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Janela de segurança de 5 minutos
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={closeReauthModal}
            className="p-1 text-stone-400 hover:text-white rounded-lg transition-colors"
            aria-label="Cancelar reautenticação"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          <p className="text-xs text-stone-300 leading-relaxed">
            {reauthModal.description}
          </p>

          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleConfirm} className="space-y-3.5">
            <div>
              <label
                htmlFor="reauth-identifier"
                className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1"
              >
                E-mail ou CPF
              </label>
              <input
                ref={inputRef}
                id="reauth-identifier"
                type={isEmailMode ? 'email' : 'text'}
                inputMode={isEmailMode ? 'email' : 'numeric'}
                autoComplete="username"
                value={identifier}
                onChange={handleIdentifierChange}
                placeholder="nome@email.com ou 000.000.000-00"
                className="w-full px-3.5 py-3 bg-stone-950 border border-stone-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="reauth-password"
                className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="reauth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Digite sua senha"
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

            {/* Hint for demo passwords */}
            <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/80 text-[11px] text-stone-400">
              <span className="font-semibold text-stone-300">Senhas de teste: </span>
              Luthier: <code className="text-amber-400 font-mono">Luthier@2026</code> ·
              Balcão: <code className="text-amber-400 font-mono">Balcao@2026</code> ·
              Cliente: <code className="text-amber-400 font-mono">Cliente@2026</code>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={closeReauthModal}
                className="flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirmar Ação</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
