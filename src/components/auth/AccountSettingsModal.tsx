import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isApiMode } from '../../config/env';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/authApi';
import {
  User,
  X,
  ShieldCheck,
  Lock,
  Mail,
  Phone,
  Key,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';

export const AccountSettingsModal: React.FC = () => {
  const {
    user,
    token,
    isAccountSettingsOpen,
    setIsAccountSettingsOpen,
    requestReauthentication,
    updateUserInMemory,
  } = useAuth();
  const { showToast, triggerHaptic, syncStatus } = useApp();

  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Audit logs tab for Admin
  const [showLogs, setShowLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  if (!isAccountSettingsOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    triggerHaptic();

    if (isApiMode) {
      // A API ainda não expõe alteração de dados pelo próprio usuário (só reset de senha por e-mail)
      setStatusMsg({
        type: 'error',
        text: 'Alteração de dados pela conta ainda não está disponível. Para trocar a senha, use "Esqueci minha senha" na tela de login.',
      });
      return;
    }

    if (syncStatus === 'offline' || !navigator.onLine) {
      setStatusMsg({
        type: 'error',
        text: 'Sem conexão com a internet. Alteração de dados sensíveis requer conexão.',
      });
      return;
    }

    try {
      // RULE 2: Open Reauth Bottom Sheet requiring identifier & password before sensitive update
      const ticket = await requestReauthentication({
        actionType: 'SENSITIVE_UPDATE',
        title: 'Confirme para Salvar Dados',
        description: 'Digite seu E-mail ou CPF e senha atual para autorizar as alterações na conta.',
      });

      setIsLoading(true);
      setStatusMsg(null);

      if (!token) throw new Error('Não autenticado.');

      // Submit to backend with ticket
      const res = await authApi.updateSensitiveData(token, ticket, {
        email: email !== user.email ? email : undefined,
        phone: phone !== user.phone ? phone : undefined,
        newPassword: newPassword.trim() ? newPassword : undefined,
      });

      updateUserInMemory(res.user);
      setNewPassword('');
      setStatusMsg({
        type: 'success',
        text: 'Dados sensíveis atualizados com sucesso no servidor!',
      });
      showToast({
        title: 'Dados Atualizados com Sucesso',
        description: 'Alterações registradas com reautenticação válida.',
        type: 'success',
      });
    } catch (err: any) {
      // If user canceled the reauth sheet, do nothing
      if (err?.message) {
        setStatusMsg({ type: 'error', text: err.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!token) return;
    try {
      const logs = await authApi.getAuditLogs(token);
      setAuditLogs(logs);
      setShowLogs(true);
    } catch {
      showToast({ title: 'Acesso restrito ao Administrador', type: 'warning' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-base-900 border-t sm:border border-base-800 rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden text-base-100 shadow-lg max-h-[92dvh] pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-800 bg-base-950/80">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-accent-500" />
            <h2 className="font-semibold text-sm text-base-50">Dados da Conta & Segurança</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsAccountSettingsOpen(false)}
            className="p-1 text-base-400 hover:text-base-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Identity info */}
          <div className="p-3.5 rounded-2xl bg-base-950 border border-base-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-base-50">{user.name}</p>
              <p className="text-xs text-accent-400 font-semibold capitalize mt-0.5">
                Perfil: {user.role}
              </p>
              <p className="text-[11px] font-mono text-base-500 mt-0.5">
                CPF: {user.maskedCpf} (Protegido por LGPD)
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-accent-950 border border-accent-800 text-accent-400 flex items-center justify-center font-semibold">
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
              <p className="text-xs text-base-400">
                Qualquer alteração em e-mail, telefone ou senha exigirá <strong>reautenticação obrigatória</strong> com identificação e senha atual.
              </p>

              <div>
                <label className="block text-xs font-semibold text-base-400 uppercase tracking-wider mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-base-950 border border-base-800 rounded-xl text-xs text-base-50 focus:outline-none focus:border-accent-500"
                  />
                  <Mail className="w-4 h-4 text-base-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-base-400 uppercase tracking-wider mb-1">
                  Telefone de Contato
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-base-950 border border-base-800 rounded-xl text-xs text-base-50 focus:outline-none focus:border-accent-500"
                  />
                  <Phone className="w-4 h-4 text-base-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-base-400 uppercase tracking-wider mb-1">
                  Nova Senha (deixe em branco se não desejar alterar)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-base-950 border border-base-800 rounded-xl text-xs text-base-50 focus:outline-none focus:border-accent-500"
                  />
                  <Key className="w-4 h-4 text-base-500 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                {(isApiMode ? user.isAdmin : user.role === 'luthier') && (
                  <button
                    type="button"
                    onClick={loadAuditLogs}
                    className="py-2.5 px-3 rounded-xl bg-base-800 hover:bg-base-700 text-base-300 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Logs de Auditoria
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-xl bg-accent-600 hover:bg-accent-500 text-on-accent text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Salvar Dados Sensíveis
                </button>
              </div>
            </form>
          ) : (
            /* Audit Logs View for Admin */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-base-400">
                  Logs de Auditoria de Segurança
                </span>
                <button
                  type="button"
                  onClick={() => setShowLogs(false)}
                  className="text-xs text-accent-400 hover:underline"
                >
                  ← Voltar aos dados
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-base-950 border border-base-800 text-[11px]"
                  >
                    <div className="flex justify-between items-center font-mono">
                      <span className="font-semibold text-accent-400">{log.action}</span>
                      <span
                        className={log.result === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}
                      >
                        {log.result}
                      </span>
                    </div>
                    <p className="text-base-400 mt-0.5">
                      Id: {log.maskedIdentifier} · IP: {log.ip}
                    </p>
                    {log.details && <p className="text-base-300 mt-0.5">{log.details}</p>}
                    <span className="text-[10px] text-base-500 block mt-0.5">
                      {log.timestamp}
                    </span>
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
