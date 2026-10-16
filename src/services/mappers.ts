/** Converte as respostas da API para os tipos usados pelas telas. */
import type {
  CatalogDto,
  CustomerDto,
  InstrumentDto,
  OrderDto,
  PhotoDto,
  ProductDto,
  Profile,
  StockMovementDto,
  UserDto,
} from './api';
import { api } from './api';
import type {
  CatalogItem,
  Client,
  Instrument,
  InstrumentType,
  Order,
  OrderStatus,
  Photo,
  StockItem,
  StockMovement,
  TimelineEvent,
  UserRole,
} from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Instant ISO → "AAAA-MM-DD HH:mm" no fuso do aparelho. */
export function toLocalTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Instant ISO → "AAAA-MM-DD" no fuso do aparelho (datas já no formato LocalDate passam direto). */
export function toLocalDate(iso?: string | null): string {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return toLocalTimestamp(iso).substring(0, 10);
}

export function todayIso(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function roleOf(profile: Profile): UserRole {
  return profile === 'ADMIN' || profile === 'LUTHIER' ? 'luthier' : 'atendente';
}

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  maskedCpf: string;
  phone: string;
  profile: Profile;
  role: UserRole;
  isAdmin: boolean;
}

export function toAuthUser(u: UserDto): AuthUser {
  return {
    id: u.id,
    tenantId: u.tenantId,
    name: u.name || u.email,
    email: u.email,
    maskedCpf: u.maskedCpf || '—',
    phone: u.phone ? formatPhone(u.phone) : '',
    profile: u.profile,
    role: roleOf(u.profile),
    isAdmin: u.profile === 'ADMIN',
  };
}

export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function toClient(c: CustomerDto): Client {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email || '',
    cpf: c.maskedCpf || undefined,
    address: c.address || undefined,
    notes: c.notes || undefined,
    createdAt: toLocalDate(c.createdAt),
  };
}

export function toInstrument(i: InstrumentDto): Instrument {
  return {
    id: i.id,
    clientId: i.clientId,
    type: i.type as InstrumentType,
    brand: i.brand,
    model: i.model,
    serialNumber: i.serialNumber || undefined,
    year: i.year || undefined,
    finishColor: i.finishColor || undefined,
    stringsGauge: i.stringsGauge || undefined,
    tuningPreference: i.tuningPreference || undefined,
    actionHeight12thFret: i.actionHeight12thFret || undefined,
    conditionNotes: i.conditionNotes || undefined,
    photos: [],
    createdAt: toLocalDate(i.createdAt),
  };
}

export function toStockItem(p: ProductDto): StockItem {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand || '',
    sku: p.sku,
    barcode: p.barcode || '',
    currentQuantity: p.currentQuantity,
    minQuantity: p.minQuantity,
    unit: p.unit,
    costPrice: Number(p.costPrice),
    salePrice: Number(p.salePrice),
    location: p.location || '',
  };
}

export function toMovement(m: StockMovementDto, itemName: string): StockMovement {
  return {
    id: m.id,
    stockItemId: m.stockItemId,
    stockItemName: itemName,
    date: toLocalTimestamp(m.date),
    type: m.type,
    quantity: m.quantity,
    balanceAfter: m.balanceAfter,
    createdBy: m.createdBy,
    orderId: m.orderId || undefined,
    reason: m.reason,
  };
}

export function toCatalogItem(c: CatalogDto): CatalogItem {
  return {
    id: c.id,
    title: c.title,
    description: c.description || undefined,
    laborPrice: Number(c.laborPrice),
    estimatedDays: c.estimatedDays ?? undefined,
  };
}

export function toOrderPhoto(orderId: string, p: PhotoDto): Photo {
  return {
    id: p.id,
    url: '',
    authPath: api.orders.photoPath(orderId, p.id),
    tag: p.tag,
    caption: p.caption || '',
    timestamp: toLocalTimestamp(p.timestamp),
  };
}

/**
 * {@code previous} preserva o que a resposta não traz: a listagem é um resumo (sem serviços,
 * histórico, token do portal) e as fotos vêm de outra rota.
 */
export function toOrder(o: OrderDto, previous?: Order, detail = true): Order {
  const keep = !detail && previous?.detailLoaded ? previous : undefined;
  const timeline: TimelineEvent[] = (o.timeline || []).map((t) => ({
    id: t.id,
    timestamp: toLocalTimestamp(t.timestamp),
    type: t.type as TimelineEvent['type'],
    title: t.title,
    description: t.description || undefined,
    user: t.user || '',
  }));
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    clientId: o.clientId,
    instrumentId: o.instrumentId,
    status: o.status as OrderStatus,
    priority: o.priority,
    reportedIssue: o.reportedIssue,
    diagnosisNotes: keep ? keep.diagnosisNotes : o.diagnosisNotes || '',
    technicianNotes: keep ? keep.technicianNotes : o.technicianNotes || '',
    entryDate: toLocalDate(o.entryDate),
    estimatedDeliveryDate: toLocalDate(o.estimatedDeliveryDate),
    completedDate: o.completedDate ? toLocalDate(o.completedDate) : undefined,
    deliveredDate: o.deliveredDate ? toLocalDate(o.deliveredDate) : undefined,
    services: keep
      ? keep.services
      : (o.services || []).map((s) => ({
          id: s.id,
          catalogId: s.catalogId || undefined,
          title: s.title,
          description: s.description || undefined,
          laborPrice: Number(s.laborPrice),
          done: s.done,
        })),
    parts: keep
      ? keep.parts
      : (o.parts || []).map((p) => ({
          id: p.id,
          stockItemId: p.stockItemId,
          stockItemName: p.stockItemName,
          quantity: p.quantity,
          unitPrice: Number(p.unitPrice),
          total: Number(p.total),
        })),
    quote: keep
      ? keep.quote
      : o.quote
        ? {
            laborTotal: Number(o.quote.laborTotal),
            partsTotal: Number(o.quote.partsTotal),
            discount: Number(o.quote.discount),
            grandTotal: Number(o.quote.grandTotal),
            status: o.quote.status,
            sentAt: o.quote.sentAt ? toLocalTimestamp(o.quote.sentAt) : undefined,
            answeredAt: o.quote.answeredAt ? toLocalTimestamp(o.quote.answeredAt) : undefined,
            rejectionReason: o.quote.rejectionReason || undefined,
            paymentTerms: o.quote.paymentTerms || undefined,
          }
        : undefined,
    photos: previous?.photos ?? [],
    timeline: keep ? keep.timeline : timeline,
    payments: keep
      ? keep.payments
      : (o.payments || []).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          method: p.method,
          date: toLocalTimestamp(p.date),
          receiptNumber: p.receiptNumber,
          receivedBy: p.receivedBy,
        })),
    totalAmount: Number(o.totalAmount),
    paidAmount: Number(o.paidAmount),
    balance: Number(o.balance),
    clientTrackingToken: o.clientTrackingToken || previous?.clientTrackingToken || '',
    detailLoaded: detail || !!keep,
    photosLoaded: previous?.photosLoaded ?? false,
  };
}

/** Link público do portal do cliente (o mesmo que vai nos e-mails do backend). */
export function portalUrl(token: string): string {
  return `${window.location.origin}/acompanhar/${token}`;
}
