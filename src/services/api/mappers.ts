/**
 * Converte os DTOs da API para os tipos usados pelas telas (src/types), que nasceram no modo
 * demonstração. Mantê-los isolados aqui evita espalhar detalhes do backend pelos componentes.
 */
import type {
  Client,
  Instrument,
  Order,
  Payment,
  StockItem,
  StockMovement,
  TimelineEvent,
  UserRole,
} from '../../types';
import type {
  CustomerDto,
  InstrumentDto,
  OrderDto,
  ProductDto,
  Profile,
  StockMovementDto,
  TimelineDto,
  UserDto,
} from './types';
import type { AuthUser } from '../authApi';

/** ISO-8601 → "AAAA-MM-DD HH:mm" no fuso local (formato exibido pelas telas). */
export function toLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toLocalDate(iso: string | null | undefined): string {
  return toLocalDateTime(iso).substring(0, 10);
}

/** Perfis do backend → papéis de tela do front. */
export function roleFromProfile(profile: Profile): UserRole {
  switch (profile) {
    case 'ADMIN':
    case 'LUTHIER':
      return 'luthier';
    case 'ESTOQUISTA':
      return 'estoquista';
    default:
      return 'atendente';
  }
}

export function toAuthUser(u: UserDto): AuthUser {
  return {
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    maskedCpf: u.maskedCpf ?? '',
    phone: u.phone ?? '',
    role: roleFromProfile(u.profile),
    isAdmin: u.profile === 'ADMIN',
    profile: u.profile,
    tenantId: u.tenantId,
    preferences: u.preferences ?? undefined,
  };
}

export function toClient(c: CustomerDto): Client {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? '',
    cpf: c.maskedCpf ?? undefined,
    address: c.address ?? undefined,
    notes: c.notes ?? undefined,
    createdAt: toLocalDate(c.createdAt),
  };
}

export function toInstrument(i: InstrumentDto): Instrument {
  return {
    id: i.id,
    clientId: i.clientId,
    type: i.type,
    brand: i.brand,
    model: i.model,
    serialNumber: i.serialNumber ?? undefined,
    year: i.year ?? undefined,
    finishColor: i.finishColor ?? undefined,
    stringsGauge: i.stringsGauge ?? undefined,
    tuningPreference: i.tuningPreference ?? undefined,
    actionHeight12thFret: i.actionHeight12thFret ?? undefined,
    conditionNotes: i.conditionNotes ?? undefined,
    photos: [],
    createdAt: toLocalDate(i.createdAt),
  };
}

export function toStockItem(p: ProductDto): StockItem {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand ?? '',
    sku: p.sku,
    barcode: p.barcode ?? '',
    currentQuantity: p.currentQuantity,
    minQuantity: p.minQuantity,
    unit: p.unit,
    costPrice: Number(p.costPrice),
    salePrice: Number(p.salePrice),
    location: p.location ?? '',
  };
}

export function toStockMovement(m: StockMovementDto, stockItemName: string): StockMovement {
  return {
    id: m.id,
    stockItemId: m.stockItemId,
    stockItemName,
    date: toLocalDateTime(m.date),
    type: m.type,
    quantity: Math.abs(m.delta),
    orderId: m.orderId ?? undefined,
    reason: m.reason,
  };
}

function toTimeline(t: TimelineDto): TimelineEvent {
  return {
    id: t.id,
    timestamp: toLocalDateTime(t.timestamp),
    type: t.type,
    title: t.title,
    description: t.description ?? undefined,
    user: t.user ?? '',
  };
}

/**
 * No backend as peças pertencem à OS; no front, a um serviço. As peças são anexadas ao primeiro
 * serviço apenas para exibição — os totais vêm prontos da API.
 */
export function toOrder(o: OrderDto): Order {
  const parts = o.parts.map((p) => ({
    stockItemId: p.stockItemId,
    stockItemName: p.stockItemName,
    quantity: p.quantity,
    unitPrice: Number(p.unitPrice),
  }));
  const services = o.services.map((s, index) => ({
    id: s.id,
    title: s.title,
    description: s.description ?? undefined,
    laborPrice: Number(s.laborPrice),
    done: s.done,
    partsUsed: index === 0 ? parts : [],
  }));
  const q = o.quote;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    clientId: o.clientId,
    instrumentId: o.instrumentId,
    status: o.status,
    priority: o.priority,
    reportedIssue: o.reportedIssue,
    diagnosisNotes: o.diagnosisNotes ?? '',
    entryDate: toLocalDate(o.entryDate),
    estimatedDeliveryDate: o.estimatedDeliveryDate ?? '',
    completedDate: o.completedDate ? toLocalDate(o.completedDate) : undefined,
    deliveredDate: o.deliveredDate ? toLocalDate(o.deliveredDate) : undefined,
    services,
    quote: q
      ? {
          id: `qt-${o.id}`,
          orderId: o.id,
          laborTotal: Number(q.laborTotal),
          partsTotal: Number(q.partsTotal),
          discount: Number(q.discount),
          grandTotal: Number(q.grandTotal),
          status: q.status ?? 'pendente',
          sentAt: q.sentAt ? toLocalDateTime(q.sentAt) : undefined,
          answeredAt: q.answeredAt ? toLocalDateTime(q.answeredAt) : undefined,
          rejectionReason: q.rejectionReason ?? undefined,
          paymentTerms: q.paymentTerms ?? '',
        }
      : undefined,
    photos: [],
    timeline: o.timeline.map(toTimeline),
    technicianNotes: o.technicianNotes ?? undefined,
    totalAmount: Number(o.totalAmount),
    paidAmount: Number(o.paidAmount),
    clientTrackingToken: o.clientTrackingToken ?? '',
  };
}

/** Pagamentos vêm dentro de cada OS; a tela financeira precisa da lista achatada. */
export function paymentsFrom(orders: OrderDto[], clients: Client[], instruments: Instrument[]): Payment[] {
  return orders.flatMap((o) => {
    const client = clients.find((c) => c.id === o.clientId);
    const instrument = instruments.find((i) => i.id === o.instrumentId);
    return o.payments.map((p) => ({
      id: p.id,
      orderId: o.id,
      clientId: o.clientId,
      orderNumber: o.orderNumber,
      clientName: client?.name ?? '',
      instrumentDescription: instrument ? `${instrument.brand} ${instrument.model}` : '',
      amount: Number(p.amount),
      method: p.method,
      date: toLocalDateTime(p.date),
      receiptNumber: p.receiptNumber,
      status: 'concluido' as const,
    }));
  });
}
