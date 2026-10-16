import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { isApiMode } from '../config/env';
import { api } from '../services/api';
import { toAuthUser } from '../services/api/mappers';

/**
 * Aparência: modo (claro/escuro/sistema), cor de destaque e tom dos neutros. Aplicado como
 * atributos no <html> (data-mode, data-accent, data-tone) que trocam as variáveis CSS de
 * src/index.css.
 *
 * A preferência é de cada USUÁRIO (atendente, luthier...), não do aparelho:
 * - modo API: salva na conta (PUT /users/me/preferences) e vale em qualquer dispositivo;
 * - modo demonstração: salva no navegador, separada por usuário.
 * Sem ninguém logado (tela de login, portal do cliente) vale a última aparência usada no aparelho.
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

/** Última aparência usada no aparelho (lida também pelo script inline do index.html). */
const DEVICE_KEY = 'luthier_theme';
const userKey = (userId: string) => `luthier_theme:${userId}`;
const DEFAULTS: ThemePreferences = { mode: 'system', accent: 'ambar', tone: 'quente' };
const SAVE_DELAY_MS = 600;

interface ThemeContextType extends ThemePreferences {
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setTone: (tone: NeutralTone) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function read(key: string): ThemePreferences | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function write(key: string, prefs: ThemePreferences) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // armazenamento indisponível (modo privado): mantém só na sessão
  }
}

const same = (a: ThemePreferences, b: ThemePreferences) =>
  a.mode === b.mode && a.accent === b.accent && a.tone === b.tone;

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, updateUserInMemory } = useAuth();
  const userId = user?.id ?? null;
  const [prefs, setPrefs] = useState<ThemePreferences>(() => read(DEVICE_KEY) ?? DEFAULTS);
  const [systemDark, setSystemDark] = useState(prefersDark);
  /** Última versão que está salva na conta (evita reenviar o que acabou de ser carregado). */
  const synced = useRef<ThemePreferences | null>(null);

  // Login / troca de usuário: aplica a aparência DESSE usuário
  useEffect(() => {
    if (!user) {
      synced.current = null;
      return;
    }
    const server = user.preferences;
    const fromAccount =
      server && (server.themeMode || server.themeAccent || server.themeTone)
        ? {
            mode: server.themeMode ?? DEFAULTS.mode,
            accent: server.themeAccent ?? DEFAULTS.accent,
            tone: server.themeTone ?? DEFAULTS.tone,
          }
        : null;
    const next = fromAccount ?? read(userKey(user.id)) ?? DEFAULTS;
    synced.current = fromAccount ? next : null;
    setPrefs(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando muda a pessoa
  }, [userId]);

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
    write(DEVICE_KEY, prefs);
    if (userId) write(userKey(userId), prefs);
  }, [prefs, resolvedMode, userId]);

  // Modo API: salva na conta (com atraso, para não enviar um PUT a cada clique no seletor)
  useEffect(() => {
    if (!isApiMode || !userId || (synced.current && same(synced.current, prefs))) return;
    const timer = setTimeout(() => {
      api.users
        .updateMyPreferences({ themeMode: prefs.mode, themeAccent: prefs.accent, themeTone: prefs.tone })
        .then((dto) => {
          synced.current = prefs;
          updateUserInMemory(toAuthUser(dto));
        })
        .catch(() => {
          // sem conexão: fica salvo neste aparelho e tenta de novo na próxima mudança
        });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [prefs, userId, updateUserInMemory]);

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
