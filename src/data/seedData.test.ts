import { describe, expect, it } from 'vitest';
import { INITIAL_CLIENTS } from './seedData';
import { isValidCpf } from '../utils/cpfValidator';

describe('seeds de clientes', () => {
  const withCpf = INITIAL_CLIENTS.flatMap((c) => (c.cpf ? [[c.id, c.cpf] as const] : []));

  it.each(withCpf)('%s tem CPF válido (%s)', (_id, cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });
});
