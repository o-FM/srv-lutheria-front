import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { api, AuditLogDto } from '../../services/api';
import { formatPhone, toLocalTimestamp } from '../../services/mappers';
import { User, X, ShieldCheck, Lock, Mail, Phone, Key, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

const PROFILE_LABELS: Record<string, string> = {
  ADMIN: 'Dono (Admin)',
  LUTHIER: 'Luthier',
  ATENDENTE: 'Atendente',
  ESTOQUISTA: 'Estoquista',
};

export const AccountSettingsModal: React.FC = () => {
  const { user, isAccountSettingsOpen, setIsAccountSettingsOpen, updateAccount } = useAuth();
  const { showToast, triggerHaptic } = useApp();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);

  useEffect(() => {
    if (isAccountSettingsOpen && user) {
      setEmail(user.email);
      setPhone(user.phone);
      setNewPassword('');
      setCurrentPassword('');
      setStatusMsg(null);
      setShowLogs(false);
    }
  }, [isAccountSettingsOpen, user]);

  if (!isAccountSettingsOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    triggerHaptic();
    if (!currentPassword) {
      setStatusMsg({ type: 'error', text: 'Confirme com a sua senha atual.' });
      return;
    }
    if (newPassword && newPassword.length < 12) {
      setStatusMsg({ type: 'error', text: 'A nova senha precisa ter pelo menos 12 caracteres.' });
      return;
    }
    setIsLoading(true);
    setStatusMsg(null);
    try {
      await updateAccount({
        currentPassword,
        email: email.trim() !== user.email ? email.trim() : undefined,
        phone: phone !== user.phone ? phone : undefined,
        newPassword: newPassword || undefined,
      });
      setNewPassword('');
      setCurrentPassword('');
      setStatusMsg({ type: 'success', text: 'Dados atualizados.' });
      showToast({
        title: 'Conta atualizada',
        description: newPassword || email.trim() !== user.email ? 'Outros aparelhos precisarão entrar de novo.' : undefined,
        type: 'success',
      });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Falha ao salvar.' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const page = await api.auditLogs();
      setAuditLogs(page.content);
      setShowLogs(true);
    } catch {
      showToast({ title: 'Acesso restrito ao administrador', type: 'warning' });
    }
  };

  const field =
    'w-full pl-3.5 pr-10 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-stone-900 border-t sm:border border-stone-800 rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden text-stone-100 shadow-2xl max-h-[92vh] pb-safe">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-amber-500" />
            <h2 className="font-bold text-sm text-white">Minha Conta & Segurança</h2>
          </div>
          <button type="button" onClick={() => setIsAccountSettingsOpen(false)} className="p-1 text-stone-400 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{user.name}</p>
              <p className="text-xs text-amber-400 font-semibold mt-0.5">Perfil: {PROFILE_LABELS[user.profile]}</p>
              <p className="text-[11px] font-mono text-stone-500 mt-0.5">CPF: {user.maskedCpf} (protegido por LGPD)</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/70 border border-rose-800 text-rose-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {!showLogs ? (
            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">E-mail de acesso</label>
                <div className="relative">
                  <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                  <Mail className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Telefone</label>
                <div className="relative">
                  <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className={field} />
                  <Phone className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
                  Nova senha (deixe em branco para manter)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 12 caracteres"
                    className={field}
                  />
                  <Key className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="pt-2 border-t border-stone-800">
                <label className="block text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                  Senha atual (obrigatória para salvar)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={field}
                  />
                  <Lock className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="pt-2 flex items-center justify-between gap-2">
                {user.isAdmin && (
                  <button
                    type="button"
                    onClick={loadAuditLogs}
                    className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Auditoria
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {isLoading ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-stone-400">Trilha de auditoria</span>
                <button type="button" onClick={() => setShowLogs(false)} className="text-xs text-amber-400 hover:underline">
                  ← Voltar
                </button>
              </div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {auditLogs.length === 0 && <p className="text-xs text-stone-500">Nenhum registro.</p>}
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px]">
                    <div className="flex justify-between items-center font-mono">
                      <span className="font-bold text-amber-400">{log.action}</span>
                      <span className="text-[10px] text-stone-500">{toLocalTimestamp(log.timestamp)}</span>
                    </div>
                    <p className="text-stone-400 mt-0.5">
                      {log.actor || 'sistema'}
                      {log.ip ? ` · IP ${log.ip}` : ''}
                    </p>
                    {log.details && <p className="text-stone-300 mt-0.5">{log.details}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
