import React, { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { api, Profile, UserDto } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatPhone } from '../../services/mappers';

const PROFILES: { id: Profile; label: string; hint: string }[] = [
  { id: 'ATENDENTE', label: 'Atendente', hint: 'Balcão: clientes, abertura e entrega de OS' },
  { id: 'LUTHIER', label: 'Luthier', hint: 'Bancada: diagnóstico, peças, execução e estoque' },
  { id: 'ESTOQUISTA', label: 'Estoquista', hint: 'Somente estoque' },
  { id: 'ADMIN', label: 'Admin', hint: 'Acesso total, inclusive equipe e LGPD' },
];

/** Equipe da oficina (somente ADMIN): cria contas e ajusta perfil/acesso. */
export const TeamPanel: React.FC = () => {
  const { user } = useAuth();
  const { handleError, showToast } = useApp();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', profile: 'ATENDENTE' as Profile });

  useEffect(() => {
    api.users.list().then(setUsers).catch((e) => handleError(e, 'Falha ao carregar a equipe'));
  }, [handleError]);

  const replace = (u: UserDto) => setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 12) {
      showToast({ title: 'A senha inicial precisa ter 12+ caracteres', type: 'warning' });
      return;
    }
    setBusy(true);
    try {
      const created = await api.users.create({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
        password: form.password,
        profile: form.profile,
      });
      setUsers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: '', email: '', phone: '', password: '', profile: 'ATENDENTE' });
      setIsOpen(false);
      showToast({ title: `${created.name} adicionado à equipe`, description: 'Passe o e-mail e a senha inicial para a pessoa.', type: 'success' });
    } catch (err) {
      handleError(err, 'Usuário não criado');
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white';

  return (
    <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
          <Users className="w-4 h-4 text-amber-400" /> Equipe
        </h3>
        <button type="button" onClick={() => setIsOpen(!isOpen)} className="text-xs text-amber-400 font-semibold flex items-center gap-1">
          <UserPlus className="w-3.5 h-3.5" /> Novo usuário
        </button>
      </div>

      {isOpen && (
        <form onSubmit={create} className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
          <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
          <input required type="email" placeholder="E-mail de acesso" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
          <input type="tel" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className={field} />
          <input
            required
            type="text"
            autoComplete="off"
            placeholder="Senha inicial (12+ caracteres)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className={field}
          />
          <select value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value as Profile })} className={field}>
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.hint}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy} className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">
            {busy ? 'Criando...' : 'Criar usuário'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${u.active ? 'bg-stone-950 border-stone-800' : 'bg-stone-950/40 border-stone-800/60 opacity-60'}`}>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {u.name} {u.id === user?.id && <span className="text-[10px] text-amber-400">(você)</span>}
              </p>
              <p className="text-[11px] text-stone-400 truncate">{u.email}</p>
            </div>
            {u.id !== user?.id && (
              <div className="flex items-center gap-1.5 shrink-0">
                <select
                  value={u.profile}
                  onChange={(e) =>
                    api.users
                      .changeProfile(u.id, e.target.value as Profile)
                      .then(replace)
                      .catch((err) => handleError(err, 'Perfil não alterado'))
                  }
                  className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-700 text-[11px] text-white"
                >
                  {PROFILES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    (u.active ? api.users.deactivate(u.id) : api.users.activate(u.id))
                      .then(replace)
                      .catch((err) => handleError(err, 'Acesso não alterado'))
                  }
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${u.active ? 'bg-stone-800 text-rose-300' : 'bg-emerald-900 text-emerald-200'}`}
                >
                  {u.active ? 'Bloquear' : 'Liberar'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
