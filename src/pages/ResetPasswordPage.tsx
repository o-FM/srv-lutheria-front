import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Field, PublicLayout, inputClass, primaryButton } from './PublicLayout';
import { isApiMode } from '../config/env';
import { api } from '../services/api';

/**
 * /redefinir-senha#token=XXXX — link do e-mail de recuperação. O token vem no fragmento (#),
 * que não vai para logs de servidor nem para o header Referer.
 */
export const ResetPasswordPage: React.FC = () => {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 12) return setError('Use pelo menos 12 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');
    setBusy(true);
    try {
      await api.auth.resetPassword(token, password);
      window.history.replaceState(null, '', window.location.pathname);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout width="sm">
      {!isApiMode || !token ? (
        <p className="text-sm text-base-400">Link de redefinição inválido.</p>
      ) : done ? (
        <div className="text-center space-y-4 py-8">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <p className="text-base-100">Senha alterada. Todas as sessões anteriores foram encerradas.</p>
          <a href="/" className={primaryButton}>Entrar</a>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-base-50">Nova senha</h1>
            <p className="text-sm text-base-400 mt-1">Mínimo de 12 caracteres.</p>
          </div>
          <Field label="Nova senha">
            <input type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Confirme a senha" error={error ?? undefined}>
            <input type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Salvar nova senha
          </button>
        </form>
      )}
    </PublicLayout>
  );
};
