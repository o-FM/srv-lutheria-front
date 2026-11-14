import { describe, expect, it } from 'vitest';
import { isArray, readJson, readString, removeKeys, writeJson } from './storage';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
}

const throwingStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new DOMException('cheio', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('readJson', () => {
  it('devolve o valor salvo quando é válido', () => {
    const store = memoryStore({ k: '[1,2]' });
    expect(readJson('k', [], isArray, store)).toEqual([1, 2]);
  });

  it('devolve o fallback quando a chave não existe', () => {
    expect(readJson('k', ['seed'], isArray, memoryStore())).toEqual(['seed']);
  });

  it('devolve o fallback e remove a chave quando o JSON está corrompido', () => {
    const store = memoryStore({ k: '{x' });
    expect(readJson('k', ['seed'], isArray, store)).toEqual(['seed']);
    expect(store.data.has('k')).toBe(false);
  });

  it('devolve o fallback e remove a chave quando o formato é inesperado', () => {
    const store = memoryStore({ k: '{"a":1}' });
    expect(readJson('k', ['seed'], isArray, store)).toEqual(['seed']);
    expect(store.data.has('k')).toBe(false);
  });

  it('não lança quando o storage está bloqueado', () => {
    expect(readJson('k', ['seed'], isArray, throwingStore)).toEqual(['seed']);
  });
});

describe('writeJson', () => {
  it('grava e devolve true', () => {
    const store = memoryStore();
    expect(writeJson('k', { a: 1 }, store)).toBe(true);
    expect(store.data.get('k')).toBe('{"a":1}');
  });

  it('devolve false quando setItem lança QuotaExceededError', () => {
    expect(writeJson('k', [1], throwingStore)).toBe(false);
  });

  it('devolve false para valor não serializável', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(writeJson('k', circular, memoryStore())).toBe(false);
  });
});

describe('readString e removeKeys', () => {
  it('não lançam com storage bloqueado', () => {
    expect(readString('k', throwingStore)).toBeNull();
    expect(() => removeKeys(['a', 'b'], throwingStore)).not.toThrow();
  });

  it('removeKeys remove todas as chaves pedidas', () => {
    const store = memoryStore({ a: '1', b: '2', c: '3' });
    removeKeys(['a', 'b'], store);
    expect([...store.data.keys()]).toEqual(['c']);
  });
});
