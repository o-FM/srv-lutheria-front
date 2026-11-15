import type { Order, OrderStatus, Quote } from '../types';

export const DEFAULT_PAYMENT_TERMS = '50% entrada + 50% na entrega';

/** Fluxo normal de uma OS, na ordem. `cancelado` fica fora do fluxo. */
export const STATUS_FLOW: readonly OrderStatus[] = [
  'recebido',
  'diagnostico',
  'orcamento',
  'aguardando_aprovacao',
  'em_execucao',
  'pronto',
  'entregue',
];

const FINAL_STATUSES: readonly OrderStatus[] = ['entregue', 'cancelado'];

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export interface TransitionOptions {
  /** Permite voltar um passo (luthier, com confirmação na UI). */
  allowStepBack?: boolean;
}

const flowIndex = (status: OrderStatus): number => STATUS_FLOW.indexOf(status);

/** Próximo status no fluxo, ou `undefined` se a OS já terminou. */
export function nextStatus(status: OrderStatus): OrderStatus | undefined {
  const index = flowIndex(status);
  if (index < 0 || index >= STATUS_FLOW.length - 1) return undefined;
  return STATUS_FLOW[index + 1];
}

/** Regra única de transição de status de uma OS. */
export function canTransition(
  order: Order,
  to: OrderStatus,
  options: TransitionOptions = {}
): TransitionResult {
  const from = order.status;

  if (from === to) return { ok: false, reason: 'A OS já está nesse status.' };
  if (FINAL_STATUSES.includes(from)) {
    return { ok: false, reason: 'OS entregue ou cancelada não muda mais de status.' };
  }
  if (to === 'cancelado') return { ok: true };

  const step = flowIndex(to) - flowIndex(from);

  if (step === 1) {
    if (to === 'em_execucao' && order.quote?.status !== 'aprovado') {
      return {
        ok: false,
        reason: 'A OS só pode ir para execução após a aprovação formal do orçamento.',
      };
    }
    return { ok: true };
  }

  if (step === -1) {
    return options.allowStepBack
      ? { ok: true }
      : { ok: false, reason: 'Só o luthier pode voltar a OS um passo.' };
  }

  return { ok: false, reason: 'Avance a OS um passo por vez.' };
}

/** O orçamento só pode ser aprovado uma vez, com a OS aguardando aprovação. */
export function canApproveQuote(order: Order): boolean {
  return (
    order.status === 'aguardando_aprovacao' &&
    order.quote !== undefined &&
    order.quote.status !== 'aprovado'
  );
}

/**
 * Indica se as peças da OS já saíram do estoque. OS antigas (sem a marcação)
 * que já passaram de `aguardando_aprovacao` são consideradas baixadas.
 */
export function isPartsDeducted(order: Order): boolean {
  if (order.partsDeducted !== undefined) return order.partsDeducted;
  return flowIndex(order.status) >= flowIndex('em_execucao');
}

export interface PartDeduction {
  stockItemId: string;
  quantity: number;
}

/** Orçamento pendente a partir dos serviços da OS (para OS antigas sem orçamento). */
export function buildPendingQuote(order: Order): Quote {
  const laborTotal = order.services.reduce((acc, s) => acc + s.laborPrice, 0);
  const partsTotal = order.services.reduce(
    (acc, s) => acc + s.partsUsed.reduce((sum, p) => sum + p.unitPrice * p.quantity, 0),
    0
  );
  return {
    id: `qt-${order.id}`,
    orderId: order.id,
    laborTotal,
    partsTotal,
    discount: 0,
    grandTotal: laborTotal + partsTotal,
    status: 'pendente',
    paymentTerms: DEFAULT_PAYMENT_TERMS,
  };
}

/** Peças de todos os serviços da OS, na ordem em que aparecem. */
export function partsToDeduct(order: Order): PartDeduction[] {
  return order.services.flatMap((service) =>
    service.partsUsed.map((part) => ({ stockItemId: part.stockItemId, quantity: part.quantity }))
  );
}
