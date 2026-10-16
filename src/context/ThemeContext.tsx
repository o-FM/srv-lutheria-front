import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Aparência: modo (claro/escuro/sistema), cor de destaque e tom dos neutros. Aplicado como
 * atributos no <html> (data-mode, data-accent, data-tone) que trocam as variáveis CSS de
 * src/index.css. Preferência salva por dispositivo.
 */
export type ThemeMode = 'system' | 'light' | 'dark';
export type AccentColor = 'ambar' | 'azul' | 'esmeralda' | 'violeta' | 'rosa' | 'petroleo';
export type NeutralTone = 'quente' | 'frio' | 'ardosia';

export interface ThemePreferences {
  mode: ThemeMode;
  accent: AccentColor;
  tone: NeutralTone;
}

/** Amostras para o seletor (valores próximos ao tom 600 de cada paleta). */
export const ACCENTS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: 'ambar', label: 'Âmbar', swatch: '#d97706' },
  { id: 'azul', label: 'Azul', swatch: '#2563eb' },
  { id: 'esmeralda', label: 'Esmeralda', swatch: '#059669' },
  { id: 'violeta', label: 'Violeta', swatch: '#7c3aed' },
  { id: 'rosa', label: 'Rosa', swatch: '#e11d48' },
  { id: 'petroleo', label: 'Petróleo', swatch: '#0d9488' },
];

export const TONES: { id: NeutralTone; label: string; swatch: string }[] = [
  { id: 'quente', label: 'Quente', swatch: '#78716c' },
  { id: 'frio', label: 'Neutro', swatch: '#71717a' },
  { id: 'ardosia', label: 'Ardósia', swatch: '#64748b' },
];

const STORAGE_KEY = 'luthier_theme';
const DEFAULTS: ThemePreferences = { mode: 'system', accent: 'ambar', tone: 'quente' };

interface ThemeContextType extends ThemePreferences {
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setTone: (tone: NeutralTone) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function load(): ThemePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<ThemePreferences>(load);
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedMode = prefs.mode === 'system' ? (systemDark ? 'dark' : 'light') : prefs.mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = resolvedMode;
    root.dataset.accent = prefs.accent;
    root.dataset.tone = prefs.tone;
    const themeColor = getComputedStyle(root).getPropertyValue('--base-950').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // armazenamento indisponível (modo privado): mantém só na sessão
    }
  }, [prefs, resolvedMode]);

  const update = useCallback((patch: Partial<ThemePreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      ...prefs,
      resolvedMode,
      setMode: (mode) => update({ mode }),
      setAccent: (accent) => update({ accent }),
      setTone: (tone) => update({ tone }),
      toggleMode: () => update({ mode: resolvedMode === 'dark' ? 'light' : 'dark' }),
    }),
    [prefs, resolvedMode, update]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};
