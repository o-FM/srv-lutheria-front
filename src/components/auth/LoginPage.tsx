import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isValidEmail, isValidCpf, cleanCpf, formatCpf } from '../../utils/cpfValidator';
import { formatPhone } from '../../services/mappers';
import { ApiError } from '../../services/http';
import { Eye, EyeOff, AlertCircle, WifiOff, Clock, ShieldCheck, Store } from 'lucide-react';

const inputClass =
  'w-full px-4 py-3.5 bg-stone-900 border border-stone-800 rounded-2xl text-base text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors';
const labelClass = 'block text-xs font-bold text-stone-300 uppercase tracking-wider mb-1.5';

const vibrate = () => {
  try {
    navigator.vibrate?.(20);
  } catch {
    // ignore
  }
};

export const LoginPage: React.FC = () => {
  const { login, register, setIsForgotPasswordOpen } = useAuth();
  const [mode, setMode] = useState<'login' | 'cadastro'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Cadastro da oficina
  const [workshopName, setWorkshopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Rate limit da API (429): contagem regressiva até poder tentar de novo
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const timer = setTimeout(() => setLockSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockSeconds]);

  const fail = (err: unknown) => {
    vibrate();
    if (err instanceof ApiError && err.status === 429) {
      setLockSeconds(err.retryAfterSeconds || 60);
    }
    setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || lockSeconds > 0) return;
    vibrate();
    if (!isValidEmail(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (!password) {
      setError('Informe sua senha de acesso.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password, rememberMe);
    } catch (err) {
      fail(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || lockSeconds > 0) return;
    vibrate();
    if (!workshopName.trim() || !ownerName.trim()) {
      setError('Informe o nome da oficina e o seu nome.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (cpf && !isValidCpf(cleanCpf(cpf))) {
      setError('CPF inválido.');
      return;
    }
    if (password.length < 12) {
      setError('A senha precisa ter pelo menos 12 caracteres.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('As senhas não conferem.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await register({ workshopName, ownerName, email, password, cpf: cpf || undefined, phone: phone || undefined });
    } catch (err) {
      fail(err);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordField = (id: string, autoComplete: string, placeholder: string) => (
    <div className="relative">
      <input
        id={id}
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
        placeholder={placeholder}
        className={`${inputClass} pr-14`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-1 top-1 bottom-1 w-12 flex items-center justify-center text-stone-400 hover:text-stone-200 transition-colors"
        aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
      >
        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );

  const submitButton = (label: string, loadingLabel: string) => (
    <button
      type="submit"
      disabled={isLoading || lockSeconds > 0 || !isOnline}
      className={`w-full py-4 px-4 rounded-2xl text-sm font-bold text-white transition-all shadow-xl flex items-center justify-center gap-2 active:scale-98 ${
        isLoading || lockSeconds > 0 || !isOnline
          ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
          : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-amber-950/60'
      }`}
    >
      {isLoading ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between px-4 py-6 sm:px-6 max-w-md mx-auto w-full">
      <div className="pt-4 sm:pt-8 text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-2xl mx-auto ring-4 ring-stone-900 border border-amber-500/30">
          <span className="font-black text-white text-2xl tracking-tighter">OS</span>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-amber-100 tracking-tight">Oficina Luthier</h1>
          <p className="text-xs text-stone-400 mt-1">Gestão Artesanal & Ordens de Serviço</p>
        </div>
      </div>

      <div className="my-auto py-4 space-y-4">
        {!isOnline && (
          <div role="alert" className="p-3 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Sem conexão. É preciso internet para entrar.</span>
          </div>
        )}

        {lockSeconds > 0 && (
          <div role="alert" className="p-3.5 rounded-2xl bg-amber-950/80 border border-amber-700 text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-white">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Muitas tentativas</span>
            </div>
            <p className="text-stone-300">
              Aguarde <strong className="text-amber-300">{lockSeconds}s</strong> antes de tentar novamente.
            </p>
          </div>
        )}

        {error && lockSeconds <= 0 && (
          <div role="alert" aria-live="assertive" className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <div>
              <label htmlFor="auth-email" className={labelClass}>E-mail</label>
              <input
                ref={inputRef}
                id="auth-email"
                name="username"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="seu.email@oficina.com"
                className={inputClass}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="text-xs font-bold text-stone-300 uppercase tracking-wider">Senha</label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              {passwordField('auth-password', 'current-password', 'Digite sua senha de acesso')}
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-stone-900 border-stone-700 accent-amber-600 cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-xs text-stone-400 cursor-pointer select-none">
                Manter conectado neste aparelho
              </label>
            </div>

            <div className="pt-2">{submitButton('Entrar no Sistema', 'Validando credenciais...')}</div>
          </form>
        ) : (
          <form onSubmit={handleRegister} noValidate className="space-y-3.5">
            <div>
              <label htmlFor="reg-workshop" className={labelClass}>Nome da oficina *</label>
              <input
                ref={inputRef}
                id="reg-workshop"
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                placeholder="Ex: Luthieria do Armando"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reg-owner" className={labelClass}>Seu nome *</label>
              <input
                id="reg-owner"
                autoComplete="name"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reg-email" className={labelClass}>E-mail de acesso *</label>
              <input
                id="reg-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="reg-cpf" className={labelClass}>CPF</label>
                <input
                  id="reg-cpf"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(cleanCpf(e.target.value)))}
                  placeholder="000.000.000-00"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className={labelClass}>WhatsApp</label>
                <input
                  id="reg-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(11) 98765-4321"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="reg-password" className={labelClass}>Senha (mín. 12 caracteres) *</label>
              {passwordField('reg-password', 'new-password', 'Crie uma senha forte')}
            </div>
            <div>
              <label htmlFor="reg-password2" className={labelClass}>Confirme a senha *</label>
              <input
                id="reg-password2"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="pt-2">{submitButton('Criar conta da oficina', 'Criando conta...')}</div>
          </form>
        )}

        <div className="pt-3 border-t border-stone-800/80 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'cadastro' : 'login');
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            <Store className="w-4 h-4" />
            {mode === 'login' ? 'Nova por aqui? Cadastre sua oficina' : 'Já tenho conta: entrar'}
          </button>
        </div>
      </div>

      <footer className="text-center pt-2 pb-safe">
        <p className="text-[11px] text-stone-500 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-400 inline" />
          Acesso seguro e auditado conforme LGPD
        </p>
      </footer>
    </div>
  );
};
