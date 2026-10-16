import React, { useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

/** Destino do link do e-mail de recuperação: /redefinir-senha#token=... */
export const ResetPasswordPage: React.FC = () => {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'Link inválido ou incompleto.');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      setError('A senha precisa ter pelo menos 12 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await api.auth.resetPassword(token, password);
      // O token sai da barra de endereço depois de usado
      window.history.replaceState(null, '', '/redefinir-senha');
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error && !err.message.startsWith('Erro')
          ? err.message
          : 'Link expirado ou já utilizado. Peça um novo na tela de login.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const input =
    'w-full px-4 py-3.5 bg-stone-900 border border-stone-800 rounded-2xl text-base text-stone-100 focus:outline-none focus:border-amber-500';

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-black text-amber-100">Criar nova senha</h1>
        </div>

        {done ? (
          <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-sm space-y-3 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400" />
            <p>Senha alterada. Entre com a nova senha.</p>
            <a href="/" className="block w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm">
              Ir para o login
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Nova senha (mín. 12 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={input}
            />
            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-sm"
            >
              {isLoading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
            <a href="/" className="block text-center text-xs text-amber-400">Voltar para o login</a>
          </form>
        )}
      </div>
    </div>
  );
};
