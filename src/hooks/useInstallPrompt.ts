import { useSyncExternalStore } from 'react';

/** Evento do Chrome/Edge/Android que permite abrir o "Instalar app" quando quisermos. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// O evento dispara logo no carregamento (antes do login), então é capturado no nível do módulo.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad no Safari: não há prompt, a instalação é por Compartilhar → Adicionar à Tela de Início. */
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Instalação do PWA. `mode`: 'prompt' (navegador oferece o diálogo), 'ios' (só com instruções)
 * ou null (já instalado ou navegador sem suporte).
 */
export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, () => deferred);
  const mode: 'prompt' | 'ios' | null = isStandalone()
    ? null
    : event
      ? 'prompt'
      : isIos()
        ? 'ios'
        : null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    notify();
  };

  return { mode, install };
}
