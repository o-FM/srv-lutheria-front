import { describe, expect, it } from 'vitest';
import { INITIAL_CLIENTS } from './seedData';
import { isValidCpf } from '../utils/cpfValidator';

describe('seeds de clientes', () => {
  it.each(INITIAL_CLIENTS.map((c) => [c.id, c.cpf]))('%s tem CPF válido (%s)', (_id, cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });
});
