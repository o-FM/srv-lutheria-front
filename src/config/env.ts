/**
 * Configuração de ambiente (Vite injeta as variáveis VITE_* no build).
 *
 *  VITE_API_URL  URL do backend srv-luthieria (ex.: http://localhost:8080).
 *                Vazio → modo demonstração: dados locais + servidor mock (server.ts).
 */
const apiUrl = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');

export const env = {
  apiUrl,
  /** 'api' quando há backend configurado; 'mock' para demonstração offline. */
  dataSource: (apiUrl ? 'api' : 'mock') as 'api' | 'mock',
};

export const isApiMode = env.dataSource === 'api';
