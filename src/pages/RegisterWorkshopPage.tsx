import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Field, PublicLayout, inputClass, primaryButton } from './PublicLayout';
import { api, ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCpf } from '../utils/cpfValidator';

/** /cadastro — cadastro self-service de uma nova luthieria e do dono (vira ADMIN dela). */
export const RegisterWorkshopPage: React.FC = () => {
  const { adoptSession } = useAuth();
  const [form, setForm] = useState({ workshop: '', name: '', email: '', phone: '', cpf: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: key === 'cpf' ? formatCpf(e.target.value) : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrors({});
    setBusy(true);
    try {
      const tokens = await api.auth.register({
        workshop: { name: form.workshop },
        owner: {
          name: form.name,
          email: form.email,
          password: form.password,
          cpf: form.cpf || undefined,
          phone: form.phone || undefined,
        },
      });
      await adoptSession(tokens);
      window.history.replaceState(null, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (err) {
      if (err instanceof ApiError) {
        // "owner.email" → "email"
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k.split('.').pop()!, v])));
        if (err.status === 409) setError('Já existe uma conta com este e-mail.');
        else if (!Object.keys(err.fieldErrors).length) setError(err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout width="sm">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-base-50">Cadastre sua oficina</h1>
          <p className="text-sm text-base-400 mt-1">Você será o administrador e poderá convidar a equipe.</p>
        </div>
        <Field label="Nome da oficina" error={errors.name && !form.workshop ? errors.name : undefined}>
          <input className={inputClass} value={form.workshop} onChange={set('workshop')} required maxLength={120} />
        </Field>
        <Field label="Seu nome">
          <input className={inputClass} autoComplete="name" value={form.name} onChange={set('name')} required maxLength={100} />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <input type="email" className={inputClass} autoComplete="email" value={form.email} onChange={set('email')} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input type="tel" className={inputClass} autoComplete="tel" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="CPF" error={errors.cpf}>
            <input className={inputClass} inputMode="numeric" value={form.cpf} onChange={set('cpf')} />
          </Field>
        </div>
        <Field label="Senha" error={errors.password} hint="Mínimo de 12 caracteres.">
          <input type="password" className={inputClass} autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={12} />
        </Field>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Criar conta
        </button>
        <p className="text-center text-sm text-base-400">
          Já tem conta? <a href="/" className="text-accent-400 hover:underline">Entrar</a>
        </p>
      </form>
    </PublicLayout>
  );
};
