import { describe, expect, it } from 'vitest';
import { newId } from './ids';

describe('newId', () => {
  it('usa o prefixo informado', () => {
    expect(newId('mov')).toMatch(/^mov-[0-9a-f-]{36}$/);
  });

  it('gera ids diferentes mesmo em sequência imediata', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId('mov')));
    expect(ids.size).toBe(100);
  });
});
