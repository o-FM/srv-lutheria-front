import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast, triggerHaptic } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none md:bottom-6 md:right-6 md:left-auto md:w-96">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-accent-500 shrink-0" />,
          error: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
          info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
        };

        const icon = toast.type ? icons[toast.type] : icons.info;

        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-xl bg-base-900/95 dark:bg-base-900/95 text-base-100 p-3.5 backdrop-blur-md border border-base-700/60 transition-all duration-200 animate-in fade-in slide-in-from-bottom-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              {icon}
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold truncate leading-tight text-base-50">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="text-xs text-base-300 truncate mt-0.5 leading-snug">
                    {toast.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.undoAction && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    toast.undoAction?.();
                    dismissToast(toast.id);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-accent-400 hover:text-accent-300 bg-accent-950/70 hover:bg-accent-900/80 rounded-md border border-accent-600/50 transition-colors uppercase tracking-wider"
                >
                  {toast.undoLabel || 'Desfazer'}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 text-base-400 hover:text-base-50 rounded-lg transition-colors"
                aria-label="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
