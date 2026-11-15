import { describe, expect, it } from 'vitest';
import { INITIAL_CLIENTS, INITIAL_ORDERS } from './seedData';
import { isValidCpf } from '../utils/cpfValidator';
import { computeOrderTotals } from '../domain/totals';

describe('seeds de OS', () => {
  it.each(INITIAL_ORDERS.map((o) => [o.orderNumber, o] as const))(
    'OS %s tem totalAmount igual ao total calculado (com desconto)',
    (_n, order) => {
      expect(order.totalAmount).toBe(
        computeOrderTotals(order.services, order.quote?.discount ?? 0).grandTotal
      );
    }
  );
});

describe('seeds de clientes', () => {
  const withCpf = INITIAL_CLIENTS.flatMap((c) => (c.cpf ? [[c.id, c.cpf] as const] : []));

  it.each(withCpf)('%s tem CPF válido (%s)', (_id, cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });
});
