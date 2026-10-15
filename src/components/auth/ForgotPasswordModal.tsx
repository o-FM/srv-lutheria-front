import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/authApi';
import { formatCpf, cleanCpf } from '../../utils/cpfValidator';
import { KeyRound, X, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export const ForgotPasswordModal: React.FC = () => {
  const { isForgotPasswordOpen, setIsForgotPasswordOpen } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isForgotPasswordOpen) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Informe seu e-mail ou CPF cadastrado.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await authApi.forgotPassword(identifier);
      setSuccessMsg(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar solicitação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in select-none">
      <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl text-stone-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/70">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-sm">Recuperação de Senha</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsForgotPasswordOpen(false);
              setSuccessMsg(null);
            }}
            className="p-1 text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {successMsg ? (
            <div className="space-y-3 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs text-stone-200 leading-relaxed">{successMsg}</p>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setSuccessMsg(null);
                }}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-white mt-2"
              >
                Voltar para o Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-stone-300">
                Digite seu e-mail ou CPF cadastrado. Enviaremos um link de uso único com expiração em 15 minutos.
              </p>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                  E-mail ou CPF
                </label>
                <input
                  type="text"
                  autoFocus
                  value={identifier}
                  onChange={handleIdentifierChange}
                  placeholder="seu.email@exemplo.com ou 000.000.000-00"
                  className="w-full px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-800 text-xs font-semibold text-stone-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                >
                  {isLoading ? 'Enviando...' : 'Enviar Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
