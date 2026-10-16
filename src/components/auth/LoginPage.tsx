import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isApiMode } from '../../config/env';
import { BrandMark } from '../common/BrandMark';
import { useApp } from '../../context/AppContext';
import { formatCpf, isValidCpf, isValidEmail, cleanCpf } from '../../utils/cpfValidator';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  WifiOff,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, setIsForgotPasswordOpen } = useAuth();
  const { setRole, triggerHaptic, syncStatus } = useApp();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [lockedInfo, setLockedInfo] = useState<{ locked: boolean; remainingSeconds: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto focus first field
    inputRef.current?.focus();
  }, []);

  // Countdown timer if locked
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockedInfo?.locked && lockedInfo.remainingSeconds > 0) {
      timer = setInterval(() => {
        setLockedInfo((prev) => {
          if (!prev || prev.remainingSeconds <= 1) {
            return null;
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockedInfo]);

  // Handle single field input: email or CPF with live mask
  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFieldError(null);
    setGeneralError(null);

    if (val.includes('@')) {
      // Treat as email
      setIdentifier(val.trim());
    } else {
      // Numbers only -> CPF formatting
      const digits = cleanCpf(val);
      if (digits.length > 0) {
        setIdentifier(formatCpf(digits));
      } else {
        setIdentifier(val);
      }
    }
  };

  // Validate on blur
  const handleIdentifierBlur = () => {
    if (!identifier.trim()) return;

    if (identifier.includes('@')) {
      if (!isValidEmail(identifier)) {
        setFieldError('Formato de e-mail inválido.');
      } else {
        setFieldError(null);
      }
    } else {
      const digits = cleanCpf(identifier);
      if (digits.length > 0) {
        if (!isValidCpf(digits)) {
          setFieldError('CPF inválido. Verifique os dígitos digitados.');
        } else {
          setFieldError(null);
        }
      }
    }
  };

  const isEmailMode = identifier.includes('@');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || lockedInfo?.locked) return;

    triggerHaptic();

    if (!identifier.trim()) {
      setFieldError('Informe seu e-mail ou CPF.');
      inputRef.current?.focus();
      return;
    }

    if (!password) {
      setGeneralError('Informe sua senha de acesso.');
      return;
    }

    // Offline check: login requires connection
    if (syncStatus === 'offline' || !navigator.onLine) {
      setGeneralError('Sem conexão com a internet. O login requer rede ativa.');
      return;
    }

    setIsLoading(true);
    setGeneralError(null);

    try {
      const loggedUser = await login(identifier, password, rememberMe);
      // Sync AppContext's currentRole with the logged user role
      setRole(loggedUser.role, { silent: true });
    } catch (err: any) {
      triggerHaptic();
      if (err.locked) {
        setLockedInfo({ locked: true, remainingSeconds: err.remainingSeconds || 900 });
        setGeneralError(err.message || 'Conta bloqueada temporariamente.');
      } else {
        setGeneralError(err.message || 'E-mail/CPF ou senha incorretos.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Demo accounts helper
  const handleFillDemo = (emailVal: string, passVal: string) => {
    triggerHaptic();
    setIdentifier(emailVal);
    setPassword(passVal);
    setFieldError(null);
    setGeneralError(null);
  };

  return (
    <div className="min-h-dvh bg-base-950 text-base-100 flex flex-col justify-between px-4 py-6 sm:px-6 max-w-sm mx-auto w-full">
      {/* Top Branding */}
      <div className="pt-6 sm:pt-12 text-center space-y-4">
        <div className="flex justify-center">
          <BrandMark size="lg" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-base-50 tracking-tight">Oficina Luthier</h1>
          <p className="text-sm text-base-400 mt-1">Entre para continuar</p>
        </div>
      </div>

      {/* Main Login Form */}
      <div className="my-auto py-4 space-y-4">
        {/* Offline Warning Banner */}
        {(syncStatus === 'offline' || !navigator.onLine) && (
          <div
            role="alert"
            className="p-3 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2"
          >
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Sem conexão. O login requer internet para autenticação no servidor.</span>
          </div>
        )}

        {/* Lockout Warning Banner */}
        {lockedInfo?.locked && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-accent-950/80 border border-accent-700 text-accent-200 text-xs space-y-1"
          >
            <div className="flex items-center gap-2 font-semibold text-base-50">
              <Clock className="w-4 h-4 text-accent-400" />
              <span>Conta Bloqueada Temporariamente</span>
            </div>
            <p className="text-base-300">
              Múltiplas tentativas incorretas. Aguarde{' '}
              <strong className="text-accent-300">
                {Math.floor(lockedInfo.remainingSeconds / 60)}m {lockedInfo.remainingSeconds % 60}s
              </strong>{' '}
              antes de tentar novamente.
            </p>
          </div>
        )}

        {/* Generic Error Banner */}
        {generalError && !lockedInfo?.locked && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* E-mail or CPF field */}
          <div>
            <label
              htmlFor="auth-identifier"
              className="block text-xs font-semibold text-base-300 uppercase tracking-wider mb-1.5"
            >
              E-mail ou CPF
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="auth-identifier"
                name="username"
                type={isEmailMode ? 'email' : 'text'}
                inputMode={isEmailMode ? 'email' : 'numeric'}
                autoComplete="username"
                autoCapitalize="none"
                value={identifier}
                onChange={handleIdentifierChange}
                onBlur={handleIdentifierBlur}
                placeholder="seu.email@exemplo.com ou 000.000.000-00"
                aria-describedby={fieldError ? 'identifier-error' : undefined}
                aria-invalid={!!fieldError}
                className={`w-full px-4 py-3.5 bg-base-900 border rounded-2xl text-base text-base-100 placeholder-base-500 focus:outline-none transition-colors ${
                  fieldError
                    ? 'border-rose-600 focus:border-rose-500'
                    : 'border-base-800 focus:border-accent-500'
                }`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-base-500 pointer-events-none text-xs">
                {isEmailMode ? '@' : 'CPF'}
              </span>
            </div>
            {fieldError && (
              <p id="identifier-error" role="alert" className="text-xs text-rose-400 mt-1 pl-1">
                {fieldError}
              </p>
            )}
          </div>

          {/* Password field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="auth-password"
                className="text-xs font-semibold text-base-300 uppercase tracking-wider"
              >
                Senha
              </label>
              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                className="text-xs text-accent-400 hover:text-accent-300 transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setGeneralError(null);
                }}
                placeholder="Digite sua senha de acesso"
                className="w-full pl-4 pr-14 py-3.5 bg-base-900 border border-base-800 rounded-2xl text-base text-base-100 placeholder-base-500 focus:outline-none focus:border-accent-500 transition-colors"
              />
              {/* Show / Hide Password Button with 48px target */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1 bottom-1 w-12 flex items-center justify-center text-base-400 hover:text-base-200 transition-colors"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded bg-base-900 border-base-700 text-accent-600 focus:ring-accent-500 accent-accent-600 cursor-pointer"
            />
            <label
              htmlFor="remember-me"
              className="text-xs text-base-400 cursor-pointer select-none"
            >
              Manter conectado neste aparelho
            </label>
          </div>

          {/* Submit Button in Thumb Zone */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !!lockedInfo?.locked}
              className={`w-full py-4 px-4 rounded-2xl text-sm font-semibold text-base-50 transition-all flex items-center justify-center gap-2 active:scale-98 ${
                isLoading || lockedInfo?.locked
                  ? 'bg-base-800 text-base-500 cursor-not-allowed'
                  : 'bg-accent-600 hover:bg-accent-500 active:bg-accent-700 text-on-accent!'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <span>Entrar no Sistema</span>
              )}
            </button>
          </div>
        </form>

        {isApiMode && (
          <p className="text-center text-sm text-base-400">
            Ainda não tem conta?{' '}
            <a href="/cadastro" className="text-accent-400 hover:underline">
              Cadastre sua oficina
            </a>
          </p>
        )}

        {/* Demo Accounts Quick-Select Card (só no modo demonstração) */}
        {!isApiMode && (
        <div className="pt-3 border-t border-base-800/80 space-y-2">
          <p className="text-[11px] font-semibold text-base-400 uppercase tracking-wider text-center">
            Contas de Teste Rápidas (1 toque):
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-left">
            <button
              type="button"
              onClick={() => handleFillDemo('armando.luthier@oficina.com', 'Luthier@2026')}
              className="p-2 rounded-xl bg-base-900 border border-base-800 hover:border-accent-600/60 text-xs transition-colors"
            >
              <span className="text-[10px] text-accent-400 block font-semibold">Luthier/Dono</span>
              <p className="font-semibold text-base-50 truncate text-[11px]">Armando</p>
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('mariana.balcao@oficina.com', 'Balcao@2026')}
              className="p-2 rounded-xl bg-base-900 border border-base-800 hover:border-accent-600/60 text-xs transition-colors"
            >
              <span className="text-[10px] text-accent-400 block font-semibold">Atendente</span>
              <p className="font-semibold text-base-50 truncate text-[11px]">Mariana</p>
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('lucas.silveira@guitar.com', 'Cliente@2026')}
              className="p-2 rounded-xl bg-base-900 border border-base-800 hover:border-accent-600/60 text-xs transition-colors"
            >
              <span className="text-[10px] text-accent-400 block font-semibold">Cliente</span>
              <p className="font-semibold text-base-50 truncate text-[11px]">Lucas S.</p>
            </button>
          </div>
          <p className="text-[10px] text-base-500 text-center">
            Ou teste usando CPF com máscara: <span className="font-mono text-base-400">123.456.789-09</span>
          </p>
        </div>
        )}
      </div>

      {/* Footer Info & LGPD notice */}
      <footer className="text-center pt-2 pb-safe">
        <p className="text-[11px] text-base-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-base-400 inline" />
          Acesso seguro e auditado conforme LGPD
        </p>
      </footer>
    </div>
  );
};
