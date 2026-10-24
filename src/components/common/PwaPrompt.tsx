import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Registra o service worker e avisa quando há versão nova do app. A troca só acontece no toque
 * em "Atualizar", para não recarregar a tela no meio de um formulário.
 */
export const PwaPrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // App instalado pode ficar aberto por dias: procura versão nova de hora em hora
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), UPDATE_CHECK_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-base-900/95 text-base-100 p-3.5 backdrop-blur-md border border-base-700/60 shadow-lg animate-in fade-in"
      >
        <RefreshCw className="w-5 h-5 text-accent-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-base-50">Nova versão disponível</p>
          <p className="text-xs text-base-300 mt-0.5 leading-snug">Atualize para usar a versão mais recente.</p>
        </div>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent-600 text-on-accent hover:bg-accent-500 transition-colors shrink-0"
        >
          Atualizar
        </button>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="Depois"
          className="p-1 text-base-400 hover:text-base-50 rounded-lg transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
