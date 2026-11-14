/**
 * Acesso seguro ao Web Storage. Nenhuma função lança: storage bloqueado (modo
 * privado), cota cheia ou JSON corrompido viram fallback ou retorno `false`.
 * Todas aceitam o storage como parâmetro (padrão: localStorage) para facilitar testes.
 */

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Chaves com dados de negócio (seeds editadas pelo usuário). Não inclui preferências. */
export const BUSINESS_DATA_KEYS = [
  'luthier_clients',
  'luthier_instruments',
  'luthier_orders',
  'luthier_stock',
  'luthier_payments',
  'luthier_movements',
  'luthier_os_wizard_draft',
] as const;

const defaultStore = (): StorageLike => localStorage;

export function readString(key: string, store: StorageLike = defaultStore()): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string, store: StorageLike = defaultStore()): boolean {
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKeys(keys: readonly string[], store: StorageLike = defaultStore()): void {
  for (const key of keys) {
    try {
      store.removeItem(key);
    } catch {
      // storage bloqueado: nada a remover
    }
  }
}

/**
 * Lê JSON validado. Se a chave não existe, devolve o fallback. Se o conteúdo
 * estiver corrompido ou com formato inesperado, remove a chave e devolve o fallback.
 */
export function readJson<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
  store: StorageLike = defaultStore()
): T {
  const raw = readString(key, store);
  if (raw === null || raw === '') return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return parsed;
  } catch {
    // JSON corrompido: cai na remoção abaixo
  }
  removeKeys([key], store);
  return fallback;
}

/** Grava JSON. Devolve `false` quando a gravação falha (ex.: QuotaExceededError). */
export function writeJson(key: string, value: unknown, store: StorageLike = defaultStore()): boolean {
  try {
    return writeString(key, JSON.stringify(value), store);
  } catch {
    return false; // valor não serializável
  }
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isPlainObject<T extends object>(value: unknown): value is T {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
