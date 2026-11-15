import { describe, expect, it } from 'vitest';
import type { Order, OrderStatus, Quote } from '../types';
import {
  buildPendingQuote,
  canTransition,
  isPartsDeducted,
  nextStatus,
  partsToDeduct,
} from './orderRules';

function makeOrder(status: OrderStatus, overrides: Partial<Order> = {}): Order {
  return {
    id: 'os-1',
    orderNumber: 1,
    clientId: 'cli-1',
    instrumentId: 'inst-1',
    status,
    priority: 'normal',
    reportedIssue: '',
    diagnosisNotes: '',
    entryDate: '2026-11-01',
    estimatedDeliveryDate: '2026-11-10',
    services: [],
    photos: [],
    timeline: [],
    totalAmount: 0,
    paidAmount: 0,
    clientTrackingToken: 't',
    ...overrides,
  };
}

const approvedQuote = { status: 'aprovado' } as Quote;
const pendingQuote = { status: 'pendente' } as Quote;

describe('nextStatus', () => {
  it('segue o fluxo um passo por vez', () => {
    expect(nextStatus('recebido')).toBe('diagnostico');
    expect(nextStatus('pronto')).toBe('entregue');
  });

  it('não tem próximo depois de entregue ou cancelado', () => {
    expect(nextStatus('entregue')).toBeUndefined();
    expect(nextStatus('cancelado')).toBeUndefined();
  });
});

describe('canTransition', () => {
  it('permite avançar um passo', () => {
    expect(canTransition(makeOrder('recebido'), 'diagnostico').ok).toBe(true);
  });

  it('bloqueia saltar mais de um passo para frente', () => {
    expect(canTransition(makeOrder('recebido'), 'pronto').ok).toBe(false);
  });

  it('bloqueia ir para execução sem orçamento', () => {
    expect(canTransition(makeOrder('aguardando_aprovacao'), 'em_execucao').ok).toBe(false);
  });

  it('bloqueia ir para execução com orçamento pendente', () => {
    const order = makeOrder('aguardando_aprovacao', { quote: pendingQuote });
    expect(canTransition(order, 'em_execucao').ok).toBe(false);
  });

  it('permite ir para execução com orçamento aprovado', () => {
    const order = makeOrder('aguardando_aprovacao', { quote: approvedQuote });
    expect(canTransition(order, 'em_execucao').ok).toBe(true);
  });

  it('entregue só a partir de pronto', () => {
    expect(canTransition(makeOrder('em_execucao'), 'entregue').ok).toBe(false);
    expect(canTransition(makeOrder('pronto'), 'entregue').ok).toBe(true);
  });

  it('cancela de qualquer status, exceto entregue e cancelado', () => {
    expect(canTransition(makeOrder('em_execucao'), 'cancelado').ok).toBe(true);
    expect(canTransition(makeOrder('entregue'), 'cancelado').ok).toBe(false);
    expect(canTransition(makeOrder('cancelado'), 'cancelado').ok).toBe(false);
  });

  it('voltar um passo só com permissão explícita', () => {
    const order = makeOrder('pronto');
    expect(canTransition(order, 'em_execucao').ok).toBe(false);
    expect(canTransition(order, 'em_execucao', { allowStepBack: true }).ok).toBe(true);
  });

  it('nunca volta mais de um passo', () => {
    const order = makeOrder('pronto');
    expect(canTransition(order, 'diagnostico', { allowStepBack: true }).ok).toBe(false);
  });

  it('não sai de entregue nem de cancelado', () => {
    expect(canTransition(makeOrder('entregue'), 'pronto', { allowStepBack: true }).ok).toBe(false);
    expect(canTransition(makeOrder('cancelado'), 'recebido').ok).toBe(false);
  });

  it('recusa transição para o mesmo status com motivo', () => {
    const result = canTransition(makeOrder('orcamento'), 'orcamento');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/já está/i);
  });
});

describe('isPartsDeducted', () => {
  it('usa a marcação explícita quando existe', () => {
    expect(isPartsDeducted(makeOrder('aguardando_aprovacao', { partsDeducted: true }))).toBe(true);
    expect(isPartsDeducted(makeOrder('em_execucao', { partsDeducted: false }))).toBe(false);
  });

  it('considera baixadas as OS antigas que já passaram da execução', () => {
    expect(isPartsDeducted(makeOrder('em_execucao'))).toBe(true);
    expect(isPartsDeducted(makeOrder('entregue'))).toBe(true);
    expect(isPartsDeducted(makeOrder('orcamento'))).toBe(false);
  });
});

describe('buildPendingQuote', () => {
  it('monta um orçamento pendente com os totais dos serviços', () => {
    const order = makeOrder('orcamento', {
      services: [
        {
          id: 's1',
          title: 'Regulagem',
          laborPrice: 100,
          done: false,
          partsUsed: [{ stockItemId: 'stk-1', stockItemName: 'Cordas', quantity: 2, unitPrice: 30 }],
        },
      ],
    });
    const quote = buildPendingQuote(order);
    expect(quote).toMatchObject({
      orderId: 'os-1',
      laborTotal: 100,
      partsTotal: 60,
      discount: 0,
      grandTotal: 160,
      status: 'pendente',
    });
  });
});

describe('partsToDeduct', () => {
  it('lista as peças de todos os serviços', () => {
    const order = makeOrder('aguardando_aprovacao', {
      services: [
        {
          id: 's1',
          title: 'Troca de cordas',
          laborPrice: 50,
          done: false,
          partsUsed: [
            { stockItemId: 'stk-1', stockItemName: 'Cordas', quantity: 1, unitPrice: 40 },
            { stockItemId: 'stk-2', stockItemName: 'Pino', quantity: 2, unitPrice: 5 },
          ],
        },
      ],
    });
    expect(partsToDeduct(order)).toEqual([
      { stockItemId: 'stk-1', quantity: 1 },
      { stockItemId: 'stk-2', quantity: 2 },
    ]);
  });
});
