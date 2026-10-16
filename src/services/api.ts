/** Contrato da API (docs/openapi.json do srv-luthieria) e chamadas tipadas. */
import { http, TokenResponse } from './http';

// ---------------- DTOs ----------------

export type Profile = 'ADMIN' | 'LUTHIER' | 'ATENDENTE' | 'ESTOQUISTA';

export interface UserDto {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  maskedCpf: string | null;
  phone: string | null;
  profile: Profile;
  active: boolean;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface InstrumentDto {
  id: string;
  clientId: string;
  type: string;
  brand: string;
  model: string;
  serialNumber?: string | null;
  year?: string | null;
  finishColor?: string | null;
  stringsGauge?: string | null;
  tuningPreference?: string | null;
  actionHeight12thFret?: string | null;
  conditionNotes?: string | null;
  createdAt: string;
}

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  maskedCpf?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  instruments: InstrumentDto[];
}

export interface CustomerRequest {
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  address?: string;
  notes?: string;
}

export interface InstrumentRequest {
  type: string;
  brand: string;
  model: string;
  serialNumber?: string;
  year?: string;
  finishColor?: string;
  stringsGauge?: string;
  tuningPreference?: string;
  actionHeight12thFret?: string;
  conditionNotes?: string;
}

export interface ProductDto {
  id: string;
  name: string;
  category: 'pecas' | 'cordas' | 'madeiras' | 'insumos';
  brand?: string | null;
  sku: string;
  barcode?: string | null;
  currentQuantity: number;
  minQuantity: number;
  lowStock: boolean;
  unit: string;
  costPrice: number;
  salePrice: number;
  location?: string | null;
}

export interface ProductRequest {
  name: string;
  category: ProductDto['category'];
  brand?: string;
  sku: string;
  barcode?: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  minQuantity?: number;
  initialQuantity?: number;
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
  orderId?: string | null;
  createdBy: string;
}

export interface CatalogDto {
  id: string;
  title: string;
  description?: string | null;
  laborPrice: number;
  estimatedDays?: number | null;
}

export interface CatalogRequest {
  title: string;
  description?: string;
  laborPrice: number;
  estimatedDays?: number;
}

export interface OrderServiceDto {
  id: string;
  catalogId?: string | null;
  title: string;
  description?: string | null;
  laborPrice: number;
  done: boolean;
}

export interface OrderPartDto {
  id: string;
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteDto {
  laborTotal: number;
  partsTotal: number;
  discount: number;
  grandTotal: number;
  status: 'pendente' | 'aprovado' | 'rejeitado' | null;
  sentAt?: string | null;
  answeredAt?: string | null;
  rejectionReason?: string | null;
  paymentTerms?: string | null;
}

export interface TimelineDto {
  id: string;
  timestamp: string;
  type: string;
  title: string;
  description?: string | null;
  user?: string | null;
}

export interface PaymentDto {
  id: string;
  amount: number;
  method: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia';
  date: string;
  receiptNumber: string;
  receivedBy: string;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  clientId: string;
  instrumentId: string;
  status: string;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  reportedIssue: string;
  diagnosisNotes?: string | null;
  technicianNotes?: string | null;
  entryDate: string;
  estimatedDeliveryDate?: string | null;
  completedDate?: string | null;
  deliveredDate?: string | null;
  services: OrderServiceDto[];
  parts: OrderPartDto[];
  quote?: QuoteDto | null;
  timeline: TimelineDto[];
  payments: PaymentDto[];
  totalAmount: number;
  paidAmount: number;
  balance: number;
  clientTrackingToken?: string | null;
}

export interface PhotoDto {
  id: string;
  tag: 'entrada' | 'diagnostico' | 'bancada' | 'finalizado' | 'detalhe_defeito';
  caption?: string | null;
  timestamp: string;
  user?: string | null;
}

export interface PortalOrderDto {
  orderNumber: number;
  customerFirstName: string | null;
  instrument: string | null;
  status: string;
  statusLabel: string;
  estimatedDeliveryDate?: string | null;
  services: OrderServiceDto[];
  parts: OrderPartDto[];
  quote?: QuoteDto | null;
  timeline: TimelineDto[];
  photos: PhotoDto[];
}

export interface CreateOrderRequest {
  customerId: string;
  instrumentId: string;
  priority?: OrderDto['priority'];
  reportedIssue: string;
  estimatedDeliveryDate?: string;
  services?: { catalogId?: string; title?: string; description?: string; laborPrice?: number }[];
}

export interface UpdateOrderRequest {
  priority?: OrderDto['priority'];
  diagnosisNotes?: string;
  technicianNotes?: string;
  estimatedDeliveryDate?: string;
  discount?: number;
  paymentTerms?: string;
}

export interface DashboardDto {
  date: string;
  ordersByStatus: Record<string, number>;
  openOrders: number;
  dueToday: number;
  overdue: number;
  readyForPickup: number;
  awaitingApproval: number;
  lowStockItems: number;
  activeCustomers: number;
}

export interface FinancialDto {
  from: string;
  to: string;
  received: number;
  byMethod: Record<string, { amount: number; count: number }>;
  deliveredOrders: number;
  averageTicket: number;
  receivable: number;
}

export interface AuditLogDto {
  id: string;
  timestamp: string;
  actor: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: string | null;
  ip: string | null;
}

export interface AccountUpdateResponse {
  user: UserDto;
  session: TokenResponse | null;
}

// ---------------- chamadas ----------------

/** Busca todas as páginas de uma listagem paginada (oficina pequena: poucas páginas). */
async function all<T>(path: string, size = 100): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?';
  const first = await http.get<Page<T>>(`${path}${sep}page=0&size=${size}`);
  const items = [...first.content];
  for (let p = 1; p < first.totalPages; p++) {
    const next = await http.get<Page<T>>(`${path}${sep}page=${p}&size=${size}`);
    items.push(...next.content);
  }
  return items;
}

const pub = { auth: false } as const;

export const api = {
  auth: {
    login: (email: string, password: string) =>
      http.post<TokenResponse>('/auth/login', { email, password }, pub),
    register: (body: {
      workshop: { name: string; document?: string };
      owner: { name: string; email: string; password: string; cpf?: string; phone?: string };
    }) => http.post<TokenResponse>('/auth/register', body, pub),
    logout: (refreshToken: string) => http.post<void>('/auth/logout', { refreshToken }, pub),
    forgotPassword: (email: string) => http.post<void>('/auth/forgot-password', { email }, pub),
    resetPassword: (token: string, newPassword: string) =>
      http.post<void>('/auth/reset-password', { token, newPassword }, pub),
  },

  users: {
    me: () => http.get<UserDto>('/users/me'),
    updateMe: (body: { currentPassword: string; email?: string; phone?: string; newPassword?: string }) =>
      http.patch<AccountUpdateResponse>('/users/me', body),
    list: () => http.get<UserDto[]>('/users'),
    create: (body: { name: string; email: string; password: string; cpf?: string; phone?: string; profile: Profile }) =>
      http.post<UserDto>('/users', body),
    changeProfile: (id: string, profile: Profile) => http.patch<UserDto>(`/users/${id}/profile`, { profile }),
    activate: (id: string) => http.post<UserDto>(`/users/${id}/activate`),
    deactivate: (id: string) => http.post<UserDto>(`/users/${id}/deactivate`),
  },

  customers: {
    all: () => all<CustomerDto>('/customers'),
    get: (id: string) => http.get<CustomerDto>(`/customers/${id}`),
    create: (body: CustomerRequest) => http.post<CustomerDto>('/customers', body),
    update: (id: string, body: CustomerRequest) => http.put<CustomerDto>(`/customers/${id}`, body),
    addInstrument: (id: string, body: InstrumentRequest) =>
      http.post<InstrumentDto>(`/customers/${id}/instruments`, body),
  },

  products: {
    all: () => all<ProductDto>('/products'),
    create: (body: ProductRequest) => http.post<ProductDto>('/products', body),
    update: (id: string, body: ProductRequest) => http.put<ProductDto>(`/products/${id}`, body),
    byBarcode: (code: string) => http.get<ProductDto>(`/products/barcode/${encodeURIComponent(code)}`),
    movements: (id: string, size = 20) =>
      http.get<Page<StockMovementDto>>(`/products/${id}/movements?page=0&size=${size}`),
    move: (id: string, body: { type: StockMovementDto['type']; quantity: number; reason: string; orderId?: string }) =>
      http.post<StockMovementDto>(`/products/${id}/movements`, body),
  },

  catalog: {
    list: () => http.get<CatalogDto[]>('/service-catalog'),
    create: (body: CatalogRequest) => http.post<CatalogDto>('/service-catalog', body),
    update: (id: string, body: CatalogRequest) => http.put<CatalogDto>(`/service-catalog/${id}`, body),
    remove: (id: string) => http.delete<void>(`/service-catalog/${id}`),
  },

  orders: {
    all: () => all<OrderDto>('/service-orders'),
    get: (id: string) => http.get<OrderDto>(`/service-orders/${id}`),
    create: (body: CreateOrderRequest) => http.post<OrderDto>('/service-orders', body),
    update: (id: string, body: UpdateOrderRequest) => http.patch<OrderDto>(`/service-orders/${id}`, body),
    changeStatus: (id: string, status: string, note?: string) =>
      http.post<OrderDto>(`/service-orders/${id}/status`, { status, note }),
    addService: (id: string, body: { catalogId?: string; title?: string; description?: string; laborPrice?: number }) =>
      http.post<OrderDto>(`/service-orders/${id}/services`, body),
    removeService: (id: string, itemId: string) => http.delete<OrderDto>(`/service-orders/${id}/services/${itemId}`),
    markServiceDone: (id: string, itemId: string) =>
      http.post<OrderDto>(`/service-orders/${id}/services/${itemId}/done`),
    addPart: (id: string, productId: string, quantity: number) =>
      http.post<OrderDto>(`/service-orders/${id}/parts`, { productId, quantity }),
    removePart: (id: string, partId: string) => http.delete<OrderDto>(`/service-orders/${id}/parts/${partId}`),
    sendQuote: (id: string) => http.post<OrderDto>(`/service-orders/${id}/quote/send`),
    approveQuote: (id: string) => http.post<OrderDto>(`/service-orders/${id}/quote/approve`),
    rejectQuote: (id: string, reason: string) => http.post<OrderDto>(`/service-orders/${id}/quote/reject`, { reason }),
    addNote: (id: string, note: string) => http.post<OrderDto>(`/service-orders/${id}/notes`, { note }),
    receivePayment: (id: string, amount: number, method: PaymentDto['method']) =>
      http.post<OrderDto>(`/service-orders/${id}/payments`, { amount, method }),
    photos: (id: string) => http.get<PhotoDto[]>(`/service-orders/${id}/photos`),
    addPhoto: (id: string, body: { tag: PhotoDto['tag']; caption?: string; dataUrl: string }) =>
      http.post<PhotoDto>(`/service-orders/${id}/photos`, body),
    removePhoto: (id: string, photoId: string) => http.delete<void>(`/service-orders/${id}/photos/${photoId}`),
    photoPath: (id: string, photoId: string) => `/service-orders/${id}/photos/${photoId}/content`,
  },

  portal: {
    view: (token: string) => http.get<PortalOrderDto>(`/portal/orders/${token}`, pub),
    approve: (token: string) => http.post<PortalOrderDto>(`/portal/orders/${token}/quote/approve`, undefined, pub),
    reject: (token: string, reason: string) =>
      http.post<PortalOrderDto>(`/portal/orders/${token}/quote/reject`, { reason }, pub),
    photoPath: (token: string, photoId: string) => `/portal/orders/${token}/photos/${photoId}`,
  },

  reports: {
    dashboard: () => http.get<DashboardDto>('/reports/dashboard'),
    financial: (from: string, to: string) => http.get<FinancialDto>(`/reports/financial?from=${from}&to=${to}`),
  },

  notifications: {
    list: (channel?: string, status?: string) => {
      const q = new URLSearchParams({ page: '0', size: '50' });
      if (channel) q.set('channel', channel);
      if (status) q.set('status', status);
      return http.get<Page<NotificationDto>>(`/notifications?${q}`);
    },
    markSent: (id: string) => http.post<NotificationDto>(`/notifications/${id}/sent`),
  },

  auditLogs: (page = 0) => http.get<Page<AuditLogDto>>(`/audit-logs?page=${page}&size=50`),
};

export interface NotificationDto {
  id: string;
  channel: 'email' | 'whatsapp' | 'interno';
  status: 'enviado' | 'falhou' | 'pendente';
  recipient: string;
  subject: string;
  body: string;
  actionUrl?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  createdAt: string;
  sentAt?: string | null;
  error?: string | null;
}
