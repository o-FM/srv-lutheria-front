import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { AppearanceSettings } from './AppearanceSettings';

export const AppearanceModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 animate-in fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
        className="w-full sm:max-w-md bg-base-900 border border-base-800 rounded-t-2xl sm:rounded-2xl p-5 pb-safe shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="appearance-title" className="text-base font-semibold text-base-50">Aparência</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-base-400 hover:bg-base-800" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <AppearanceSettings />
      </div>
    </div>
  );
};
