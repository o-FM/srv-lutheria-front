import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus, X } from 'lucide-react';
import { isApiMode } from '../../config/env';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { Profile, UserDto } from '../../services/api';
import { formatCpf } from '../../utils/cpfValidator';

const PROFILES: { id: Profile; label: string; hint: string }[] = [
  { id: 'LUTHIER', label: 'Luthier', hint: 'Bancada: diagnóstico, valores, peças e conclusão' },
  { id: 'ATENDENTE', label: 'Atendente', hint: 'Balcão: clientes, abertura de OS e entregas' },
  { id: 'ESTOQUISTA', label: 'Estoquista', hint: 'Estoque e movimentações' },
  { id: 'ADMIN', label: 'Administrador', hint: 'Tudo, inclusive faturamento e equipe' },
];

const labelOf = (p: Profile) => PROFILES.find((x) => x.id === p)?.label ?? p;

const field =
  'w-full px-3 py-2.5 bg-base-950 border border-base-800 rounded-xl text-sm text-base-50 placeholder-base-500 focus:outline-none focus:border-accent-500';

const EMPTY = { name: '', email: '', cpf: '', phone: '', password: '', profile: 'LUTHIER' as Profile };

/** Equipe da oficina: só o administrador cadastra usuários e define o perfil de cada um. */
export const TeamSettings: React.FC = () => {
  const { showToast } = useApp();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserDto[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.users
      .list()
      .then(setUsers)
      .catch((e) => showToast({ title: 'Erro ao carregar a equipe', description: e.message, type: 'error' }));
  }, [showToast]);

  useEffect(() => {
    if (isApiMode) load();
  }, [load]);

  if (!isApiMode) {
    return <p className="text-xs text-base-400">O cadastro da equipe fica disponível com a API configurada.</p>;
  }

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      showToast({ title: success, type: 'success' });
      load();
      return true;
    } catch (e) {
      showToast({ title: 'Não foi possível concluir', description: (e as Error).message, type: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(
      () =>
        api.users.create({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          cpf: form.cpf || undefined,
          phone: form.phone || undefined,
          profile: form.profile,
        }),
      `${form.name.split(' ')[0]} foi adicionado(a) à equipe`
    );
    if (ok) {
      setForm(EMPTY);
      setIsFormOpen(false);
    }
  };

  return (
    <div className="space-y-3">
      {!users && (
        <div className="flex justify-center py-6" role="status">
          <Loader2 className="w-5 h-5 text-base-500 animate-spin" />
        </div>
      )}

      {users?.map((u) => {
        const isMe = u.id === user?.id;
        return (
          <div
            key={u.id}
            className={`p-3 rounded-xl border border-base-800 bg-base-950/60 flex flex-wrap items-center gap-2 ${u.active ? '' : 'opacity-60'}`}
          >
            <div className="flex-1 min-w-[10rem]">
              <p className="text-sm font-semibold text-base-50">
                {u.name ?? u.email} {isMe && <span className="text-[10px] text-base-500">(você)</span>}
              </p>
              <p className="text-[11px] text-base-400">{u.email}</p>
            </div>
            <select
              aria-label={`Perfil de ${u.name ?? u.email}`}
              value={u.profile}
              disabled={busy || isMe}
              onChange={(e) =>
                run(() => api.users.changeProfile(u.id, e.target.value as Profile), 'Perfil alterado')
              }
              className="px-2 py-1.5 bg-base-900 border border-base-800 rounded-lg text-xs text-base-100"
            >
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {!isMe && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => (u.active ? api.users.deactivate(u.id) : api.users.activate(u.id)),
                    u.active ? 'Acesso desativado' : 'Acesso reativado'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg border border-base-800 text-[11px] font-semibold text-base-300 hover:bg-base-900"
              >
                {u.active ? 'Desativar' : 'Reativar'}
              </button>
            )}
          </div>
        );
      })}

      {isFormOpen ? (
        <form onSubmit={submit} className="p-3 rounded-xl border border-base-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-base-200">Novo usuário</span>
            <button type="button" aria-label="Fechar" onClick={() => setIsFormOpen(false)} className="text-base-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input required placeholder="Nome" className={field} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" placeholder="E-mail (login)" className={field} value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="CPF (opcional, login)" inputMode="numeric" className={field} value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })} />
            <input placeholder="Telefone (opcional)" inputMode="tel" className={field} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <input required type="password" minLength={12} autoComplete="new-password"
            placeholder="Senha inicial (mín. 12 caracteres)" className={field} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <div className="grid grid-cols-2 gap-1.5">
            {PROFILES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setForm({ ...form, profile: p.id })}
                className={`p-2 rounded-xl border text-left ${
                  form.profile === p.id ? 'border-accent-500 bg-accent-950/40' : 'border-base-800'
                }`}
              >
                <span className="block text-xs font-semibold text-base-100">{p.label}</span>
                <span className="block text-[10px] text-base-400 leading-tight">{p.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-on-accent text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Cadastrar {labelOf(form.profile).toLowerCase()}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-base-700 text-xs font-semibold text-accent-400 flex items-center justify-center gap-1.5 hover:bg-base-950"
        >
          <UserPlus className="w-4 h-4" /> Adicionar pessoa à equipe
        </button>
      )}
    </div>
  );
};
