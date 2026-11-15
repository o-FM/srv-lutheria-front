import type { ServiceItem } from '../types';

export interface OrderTotals {
  laborTotal: number;
  partsTotal: number;
  discount: number;
  /** Total a cobrar, já com o desconto. É o valor de `order.totalAmount`. */
  grandTotal: number;
}

const toCents = (value: number): number => Math.round(value * 100);
const fromCents = (cents: number): number => cents / 100;

/** Regra única dos totais da OS (contexto, sheet e portal usam esta função). */
export function computeOrderTotals(services: readonly ServiceItem[], discount = 0): OrderTotals {
  const laborCents = services.reduce((acc, s) => acc + toCents(s.laborPrice), 0);
  const partsCents = services.reduce(
    (acc, s) => acc + s.partsUsed.reduce((sum, p) => sum + toCents(p.unitPrice * p.quantity), 0),
    0
  );
  const discountCents = toCents(discount);
  return {
    laborTotal: fromCents(laborCents),
    partsTotal: fromCents(partsCents),
    discount: fromCents(discountCents),
    grandTotal: fromCents(Math.max(0, laborCents + partsCents - discountCents)),
  };
}

/** Total de peças de um serviço. */
export function servicePartsTotal(service: ServiceItem): number {
  return fromCents(service.partsUsed.reduce((sum, p) => sum + toCents(p.unitPrice * p.quantity), 0));
}
