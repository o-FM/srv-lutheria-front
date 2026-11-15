import { describe, expect, it } from 'vitest';
import type { ServiceItem } from '../types';
import { computeOrderTotals } from './totals';

const service = (laborPrice: number, parts: Array<[number, number]> = []): ServiceItem => ({
  id: `s-${laborPrice}`,
  title: 'Serviço',
  laborPrice,
  done: false,
  partsUsed: parts.map(([unitPrice, quantity], i) => ({
    stockItemId: `stk-${i}`,
    stockItemName: 'Peça',
    unitPrice,
    quantity,
  })),
});

describe('computeOrderTotals', () => {
  it('soma mão de obra e peças e aplica o desconto no total', () => {
    // OS 1042 das seeds: 690 de serviços + 165 de peças, desconto de 35
    const totals = computeOrderTotals([service(690), service(0, [[55, 3]])], 35);
    expect(totals).toEqual({ laborTotal: 690, partsTotal: 165, discount: 35, grandTotal: 820 });
  });

  it('adicionar um serviço de R$100 leva o total de 820 para 920', () => {
    const totals = computeOrderTotals([service(690), service(0, [[55, 3]]), service(100)], 35);
    expect(totals.grandTotal).toBe(920);
  });

  it('sem desconto, o total é a soma', () => {
    expect(computeOrderTotals([service(150, [[20, 2]])]).grandTotal).toBe(190);
  });

  it('o desconto nunca deixa o total negativo', () => {
    expect(computeOrderTotals([service(50)], 80).grandTotal).toBe(0);
  });

  it('arredonda para centavos', () => {
    expect(computeOrderTotals([service(0.1), service(0.2)]).grandTotal).toBe(0.3);
  });
});
