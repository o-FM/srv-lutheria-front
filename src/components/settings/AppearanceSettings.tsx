import React from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { ACCENTS, TONES, ThemeMode, useTheme } from '../../context/ThemeContext';

const MODES: { id: ThemeMode; label: string; icon: React.ElementType }[] = [
  { id: 'light', label: 'Claro', icon: Sun },
  { id: 'dark', label: 'Escuro', icon: Moon },
  { id: 'system', label: 'Sistema', icon: Monitor },
];

/** Seletor de aparência: modo, cor de destaque e tom dos neutros (cores pré-definidas). */
export const AppearanceSettings: React.FC = () => {
  const { mode, accent, tone, setMode, setAccent, setTone } = useTheme();

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-base-400 mb-2">Modo</legend>
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-base-800/60 border border-base-800">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              aria-pressed={mode === id}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                mode === id ? 'bg-base-950 text-base-50 shadow-sm' : 'text-base-400 hover:text-base-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium text-base-400 mb-2">Cor de destaque</legend>
        <div className="grid grid-cols-6 gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccent(a.id)}
              aria-pressed={accent === a.id}
              aria-label={a.label}
              title={a.label}
              className={`aspect-square rounded-full flex items-center justify-center ring-offset-2 ring-offset-base-900 transition ${
                accent === a.id ? 'ring-2 ring-base-200' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: a.swatch }}
            >
              {accent === a.id && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium text-base-400 mb-2">Tom dos neutros</legend>
        <div className="grid grid-cols-3 gap-2">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              aria-pressed={tone === t.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
                tone === t.id
                  ? 'border-accent-500 text-base-50 bg-base-800/60'
                  : 'border-base-800 text-base-400 hover:border-base-700'
              }`}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.swatch }} />
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
};
