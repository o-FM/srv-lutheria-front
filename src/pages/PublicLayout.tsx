import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { BrandMark } from '../components/common/BrandMark';
import { useTheme } from '../context/ThemeContext';

/** Casca das páginas públicas (sem login): portal do cliente, cadastro e redefinição de senha. */
export const PublicLayout: React.FC<{ children: React.ReactNode; width?: 'sm' | 'md' }> = ({
  children,
  width = 'md',
}) => {
  const { resolvedMode, toggleMode } = useTheme();
  return (
    <div className="min-h-dvh bg-base-950 text-base-100 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-base-800">
        <a href="/" className="flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="text-sm font-semibold text-base-50">Oficina Luthier</span>
        </a>
        <button
          type="button"
          onClick={toggleMode}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-base-400 hover:bg-base-800"
          aria-label="Alternar claro/escuro"
        >
          {resolvedMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>
      <main className={`flex-1 w-full mx-auto px-4 py-8 sm:py-12 ${width === 'sm' ? 'max-w-sm' : 'max-w-2xl'}`}>
        {children}
      </main>
    </div>
  );
};

export const Field: React.FC<{
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, error, hint, children }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-medium text-base-200">{label}</span>
    {children}
    {error ? <span className="block text-xs text-rose-400">{error}</span> : hint ? <span className="block text-xs text-base-500">{hint}</span> : null}
  </label>
);

export const inputClass =
  'w-full h-11 px-3 rounded-xl bg-base-900 border border-base-800 text-base-50 placeholder:text-base-600 focus:border-accent-500 focus:outline-none transition-colors';

export const primaryButton =
  'w-full h-11 rounded-xl bg-accent-600 hover:bg-accent-500 disabled:opacity-60 text-on-accent text-sm font-medium transition-colors flex items-center justify-center gap-2';
