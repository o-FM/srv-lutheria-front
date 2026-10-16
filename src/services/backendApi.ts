/**
 * Endpoints de negócio do srv-lutheria + conversão para os tipos do front.
 * Contrato: srv-lutheria/docs/openapi.json.
 */
import { api, fetchAll } from './apiClient';
import {
  Client,
  Instrument,
  InstrumentType,
  Order,
  OrderStatus,
  Payment,
  PartUsage,
  ServiceItem,
  StockCategory,
  StockItem,
  StockMovement,
  TimelineEvent,
} from '../types';

// ---------- DTOs do backend ----------

export type BackendProfile = 'ADMIN' | 'LUTHIER' | 'ATENDENTE' | 'ESTOQUISTA';

export interface UserDto {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  maskedCpf?: string;
  phone?: string;
  profile: BackendProfile;
  active: boolean;
}

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email?: string;
  maskedCpf?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  instruments?: InstrumentDto[];
}

export interface InstrumentDto {
  id: string;
  clientId: string;
  type: InstrumentType;
  brand: string;
  model: string;
  serialNumber?: string;
  year?: string;
  finishColor?: string;
  stringsGauge?: string;
  tuningPreference?: string;
  actionHeight12thFret?: string;
  conditionNotes?: string;
  createdAt: string;
}

export interface ProductDto {
  id: string;
  name: string;
  category: StockCategory;
  brand?: string;
  sku: string;
  barcode?: string;
  currentQuantity: number;
  minQuantity: number;
  lowStock: boolean;
  unit: string;
  costPrice: number;
  salePrice: number;
  location?: string;
}

export interface StockMovementDto {
  id: string;
  stockItemId: string;
  date: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  delta: number;
  balanceAfter: number;
  reason: string;
  orderId?: string;
  createdBy?: string;
}

interface OrderServiceDto {
  id: string;
  catalogId?: string;
  title: string;
  description?: string;
  laborPrice: number;
  done: boolean;
}

interface OrderPartDto {
  id: string;
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface OrderPaymentDto {
  id: string;
  amount: number;
  method: Payment['method'];
  date: string;
  receiptNumber: string;
  receivedBy?: string;
}

interface QuoteDto {
  laborTotal: number;
  partsTotal: number;
  discount: number;
  grandTotal: number;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  sentAt?: string;
  answeredAt?: string;
  rejectionReason?: string;
  paymentTerms?: string;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  clientId: string;
  instrumentId: string;
  status: OrderStatus;
  priority: Order['priority'];
  reportedIssue: string;
  diagnosisNotes?: string;
  technicianNotes?: string;
  entryDate: string;
  estimatedDeliveryDate: string;
  completedDate?: string;
  deliveredDate?: string;
  services: OrderServiceDto[];
  parts: OrderPartDto[];
  quote?: QuoteDto;
  timeline: TimelineEvent[];
  payments: OrderPaymentDto[];
  totalAmount: number;
  paidAmount: number;
  balance: number;
  clientTrackingToken: string;
}

// ---------- Conversões ----------

/** "2026-10-16T13:45:00Z" → "2026-10-16 13:45" (formato usado nas telas). */
const toDisplayDateTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toDate = (iso?: string) => (iso ? iso.substring(0, 10) : '');

export const toClient = (c: CustomerDto): Client => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  email: c.email || '',
  // O backend só devolve o CPF mascarado (LGPD)
  cpf: c.maskedCpf || undefined,
  address: c.address,
  notes: c.notes,
  createdAt: toDate(c.createdAt),
});

export const toInstrument = (i: InstrumentDto): Instrument => ({
  id: i.id,
  clientId: i.clientId,
  type: i.type,
  brand: i.brand,
  model: i.model,
  serialNumber: i.serialNumber,
  year: i.year,
  finishColor: i.finishColor,
  stringsGauge: i.stringsGauge,
  tuningPreference: i.tuningPreference,
  actionHeight12thFret: i.actionHeight12thFret,
  conditionNotes: i.conditionNotes,
  photos: [],
  createdAt: toDate(i.createdAt),
});

export const toStockItem = (p: ProductDto): StockItem => ({
  id: p.id,
  name: p.name,
  category: p.category,
  brand: p.brand || '',
  sku: p.sku,
  barcode: p.barcode || '',
  currentQuantity: p.currentQuantity,
  minQuantity: p.minQuantity,
  unit: p.unit,
  costPrice: p.costPrice,
  salePrice: p.salePrice,
  location: p.location || '',
});

export const toStockMovement = (m: StockMovementDto, stockItemName: string): StockMovement => ({
  id: m.id,
  stockItemId: m.stockItemId,
  stockItemName,
  date: toDisplayDateTime(m.date),
  type: m.type,
  quantity: m.quantity,
  orderId: m.orderId,
  reason: m.reason,
});

/** Id do item sintético que exibe as peças quando a OS ainda não tem serviços. */
export const PARTS_ONLY_SERVICE_ID = '__parts__';

/**
 * No backend as peças pertencem à OS; no front ficam dentro de um serviço (partsUsed).
 * Para exibição, as peças vão para o primeiro serviço.
 */
export const toOrder = (o: OrderDto, previous?: Order): Order => {
  const parts: PartUsage[] = (o.parts || []).map((p) => ({
    stockItemId: p.stockItemId,
    stockItemName: p.stockItemName,
    quantity: p.quantity,
    unitPrice: p.unitPrice,
  }));
  const services: ServiceItem[] = (o.services || []).map((s, idx) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    laborPrice: s.laborPrice,
    done: s.done,
    partsUsed: idx === 0 ? parts : [],
  }));
  if (services.length === 0 && parts.length > 0) {
    services.push({
      id: PARTS_ONLY_SERVICE_ID,
      title: 'Peças e insumos',
      laborPrice: 0,
      done: true,
      partsUsed: parts,
    });
  }

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    clientId: o.clientId,
    instrumentId: o.instrumentId,
    status: o.status,
    priority: o.priority,
    reportedIssue: o.reportedIssue,
    diagnosisNotes: o.diagnosisNotes || '',
    technicianNotes: o.technicianNotes || '',
    entryDate: toDate(o.entryDate),
    estimatedDeliveryDate: toDate(o.estimatedDeliveryDate),
    completedDate: o.completedDate ? toDate(o.completedDate) : undefined,
    deliveredDate: o.deliveredDate ? toDate(o.deliveredDate) : undefined,
    services,
    quote: o.quote
      ? {
          id: `qt-${o.id}`,
          orderId: o.id,
          laborTotal: o.quote.laborTotal,
          partsTotal: o.quote.partsTotal,
          discount: o.quote.discount || 0,
          grandTotal: o.quote.grandTotal,
          status: o.quote.status,
          sentAt: o.quote.sentAt ? toDisplayDateTime(o.quote.sentAt) : undefined,
          answeredAt: o.quote.answeredAt ? toDisplayDateTime(o.quote.answeredAt) : undefined,
          rejectionReason: o.quote.rejectionReason,
          paymentTerms: o.quote.paymentTerms || '',
        }
      : undefined,
    // Fotos ainda não existem na API: ficam só na memória do navegador
    photos: previous?.photos || [],
    timeline: [...(o.timeline || [])]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .map((t) => ({ ...t, timestamp: toDisplayDateTime(t.timestamp) })),
    totalAmount: o.totalAmount,
    paidAmount: o.paidAmount,
    // A listagem omite o token do portal; ele só vem no detalhe da OS
    clientTrackingToken: o.clientTrackingToken || previous?.clientTrackingToken || '',
  };
};

export const paymentsFromOrder = (
  o: OrderDto,
  clientName: string,
  instrumentDescription: string
): Payment[] =>
  (o.payments || []).map((p) => ({
    id: p.id,
    orderId: o.id,
    clientId: o.clientId,
    orderNumber: o.orderNumber,
    clientName,
    instrumentDescription,
    amount: p.amount,
    method: p.method,
    date: toDisplayDateTime(p.date),
    receiptNumber: p.receiptNumber,
    status: 'concluido',
  }));

const emptyToUndefined = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? undefined : v])
  ) as T;

// ---------- Endpoints ----------

export const backendApi = {
  me: () => api<UserDto>('/users/me'),

  // Clientes e instrumentos
  listCustomers: () => fetchAll<CustomerDto>('/customers'),
  listInstruments: (customerId: string) => api<InstrumentDto[]>(`/customers/${customerId}/instruments`),
  createCustomer: (c: Omit<Client, 'id' | 'createdAt'>) =>
    api<CustomerDto>('/customers', {
      method: 'POST',
      body: emptyToUndefined({
        name: c.name,
        phone: c.phone,
        email: c.email,
        cpf: c.cpf,
        address: c.address,
        notes: c.notes,
      }),
    }),
  createInstrument: (i: Omit<Instrument, 'id' | 'createdAt' | 'photos'>) =>
    api<InstrumentDto>(`/customers/${i.clientId}/instruments`, {
      method: 'POST',
      body: emptyToUndefined({
        type: i.type,
        brand: i.brand,
        model: i.model,
        serialNumber: i.serialNumber,
        year: i.year,
        finishColor: i.finishColor,
        stringsGauge: i.stringsGauge,
        tuningPreference: i.tuningPreference,
        actionHeight12thFret: i.actionHeight12thFret,
        conditionNotes: i.conditionNotes,
      }),
    }),

  // Estoque
  listProducts: () => fetchAll<ProductDto>('/products'),
  getProduct: (id: string) => api<ProductDto>(`/products/${id}`),
  listMovements: (productId: string) =>
    api<{ content: StockMovementDto[] }>(`/products/${productId}/movements`, {
      query: { page: 0, size: 50 },
    }),
  createMovement: (
    productId: string,
    body: { type: 'entrada' | 'saida' | 'ajuste'; quantity: number; reason: string; orderId?: string }
  ) => api<StockMovementDto>(`/products/${productId}/movements`, { method: 'POST', body }),

  // Ordens de serviço
  listOrders: () => fetchAll<OrderDto>('/service-orders'),
  getOrder: (id: string) => api<OrderDto>(`/service-orders/${id}`),
  createOrder: (body: {
    customerId: string;
    instrumentId: string;
    priority?: Order['priority'];
    reportedIssue: string;
    estimatedDeliveryDate?: string;
    services?: { catalogId?: string; title: string; description?: string; laborPrice: number }[];
  }) => api<OrderDto>('/service-orders', { method: 'POST', body }),
  updateOrder: (
    id: string,
    body: {
      priority?: Order['priority'];
      diagnosisNotes?: string;
      technicianNotes?: string;
      estimatedDeliveryDate?: string;
      discount?: number;
      paymentTerms?: string;
    }
  ) => api<OrderDto>(`/service-orders/${id}`, { method: 'PATCH', body }),
  changeStatus: (id: string, status: OrderStatus, note?: string) =>
    api<OrderDto>(`/service-orders/${id}/status`, { method: 'POST', body: { status, note } }),
  addService: (id: string, body: { title: string; description?: string; laborPrice: number }) =>
    api<OrderDto>(`/service-orders/${id}/services`, { method: 'POST', body }),
  markServiceDone: (id: string, itemId: string) =>
    api<OrderDto>(`/service-orders/${id}/services/${itemId}/done`, { method: 'POST' }),
  addPart: (id: string, productId: string, quantity: number) =>
    api<OrderDto>(`/service-orders/${id}/parts`, { method: 'POST', body: { productId, quantity } }),
  sendQuote: (id: string) => api<OrderDto>(`/service-orders/${id}/quote/send`, { method: 'POST' }),
  approveQuote: (id: string) => api<OrderDto>(`/service-orders/${id}/quote/approve`, { method: 'POST' }),
  rejectQuote: (id: string, reason: string) =>
    api<OrderDto>(`/service-orders/${id}/quote/reject`, { method: 'POST', body: { reason } }),
  addNote: (id: string, note: string) =>
    api<OrderDto>(`/service-orders/${id}/notes`, { method: 'POST', body: { note } }),
  receivePayment: (id: string, amount: number, method: Payment['method']) =>
    api<OrderDto>(`/service-orders/${id}/payments`, { method: 'POST', body: { amount, method } }),

  // Portal do cliente (público, por token)
  portalApprove: (token: string) =>
    api<unknown>(`/portal/orders/${encodeURIComponent(token)}/quote/approve`, { method: 'POST', auth: false }),
  portalReject: (token: string, reason: string) =>
    api<unknown>(`/portal/orders/${encodeURIComponent(token)}/quote/reject`, {
      method: 'POST',
      body: { reason },
      auth: false,
    }),
};
