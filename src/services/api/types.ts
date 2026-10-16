/**
 * Contratos da API srv-luthieria (espelham os records Java). Fonte da verdade:
 * docs/openapi.json no repositório do backend. Valores de enum já vêm no formato do front.
 */
import type { InstrumentType, OrderStatus, StockCategory } from '../../types';

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** RFC 9457 (application/problem+json) */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string>;
}

// ---------------- auth / users ----------------

export type Profile = 'ADMIN' | 'LUTHIER' | 'ATENDENTE' | 'ESTOQUISTA';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface RegisterWorkshopRequest {
  workshop: { name: string; document?: string };
  owner: { name: string; email: string; password: string; cpf?: string; phone?: string };
}

/** Preferências de aparência salvas na conta (valores do ThemeContext; null = padrão). */
export interface UserPreferencesDto {
  themeMode: 'system' | 'light' | 'dark' | null;
  themeAccent: 'ambar' | 'azul' | 'esmeralda' | 'violeta' | 'rosa' | 'petroleo' | null;
  themeTone: 'quente' | 'frio' | 'ardosia' | null;
}

export interface UserDto {
  id: string;
  tenantId: string;
  name: string | null;
  email: string;
  maskedCpf: string | null;
  phone: string | null;
  profile: Profile;
  active: boolean;
  preferences: UserPreferencesDto | null;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  cpf?: string;
  phone?: string;
  profile: Profile;
}

// ---------------- customers / instruments ----------------

export interface CustomerRequest {
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  address?: string;
  notes?: string;
}

export interface InstrumentDto {
  id: string;
  clientId: string;
  type: InstrumentType;
  brand: string;
  model: string;
  serialNumber: string | null;
  year: string | null;
  finishColor: string | null;
  stringsGauge: string | null;
  tuningPreference: string | null;
  actionHeight12thFret: string | null;
  conditionNotes: string | null;
  createdAt: string;
}

export type InstrumentRequest = Omit<InstrumentDto, 'id' | 'clientId' | 'createdAt'>;

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  maskedCpf: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  instruments: InstrumentDto[];
}

// ---------------- products / stock ----------------

export interface ProductDto {
  id: string;
  name: string;
  category: StockCategory;
  brand: string | null;
  sku: string;
  barcode: string | null;
  currentQuantity: number;
  minQuantity: number;
  lowStock: boolean;
  unit: string;
  costPrice: number;
  salePrice: number;
  location: string | null;
}

export interface ProductRequest {
  name: string;
  category: StockCategory;
  brand?: string;
  sku: string;
  barcode?: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  minQuantity: number;
  initialQuantity?: number;
  location?: string;
}

export type MovementType = 'entrada' | 'saida' | 'ajuste';

export interface StockMovementDto {
  id: string;
  stockItemId: string;
  date: string;
  type: MovementType;
  quantity: number;
  delta: number;
  balanceAfter: number;
  reason: string;
  orderId: string | null;
  createdBy: string | null;
}

// ---------------- service catalog ----------------

export interface CatalogServiceDto {
  id: string;
  title: string;
  description: string | null;
  laborPrice: number;
  estimatedDays: number | null;
}

export type CatalogServiceRequest = Omit<CatalogServiceDto, 'id'>;

// ---------------- service orders ----------------

export type Priority = 'baixa' | 'normal' | 'alta' | 'urgente';
export type QuoteStatus = 'pendente' | 'aprovado' | 'rejeitado';
export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia';

export interface OrderServiceItemDto {
  id: string;
  catalogId: string | null;
  title: string;
  description: string | null;
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
  status: QuoteStatus | null;
  sentAt: string | null;
  answeredAt: string | null;
  rejectionReason: string | null;
  paymentTerms: string | null;
}

export interface TimelineDto {
  id: string;
  timestamp: string;
  type:
    | 'status_change'
    | 'quote_sent'
    | 'quote_approved'
    | 'quote_rejected'
    | 'service_done'
    | 'payment_received'
    | 'note_added';
  title: string;
  description: string | null;
  user: string | null;
}

export interface PaymentDto {
  id: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  receiptNumber: string;
  receivedBy: string;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  clientId: string;
  instrumentId: string;
  status: OrderStatus;
  priority: Priority;
  reportedIssue: string;
  diagnosisNotes: string | null;
  technicianNotes: string | null;
  entryDate: string;
  estimatedDeliveryDate: string | null;
  completedDate: string | null;
  deliveredDate: string | null;
  services: OrderServiceItemDto[];
  parts: OrderPartDto[];
  quote: QuoteDto | null;
  timeline: TimelineDto[];
  payments: PaymentDto[];
  totalAmount: number;
  paidAmount: number;
  balance: number;
  clientTrackingToken: string | null;
}

export interface CreateOrderRequest {
  customerId: string;
  instrumentId: string;
  priority?: Priority;
  reportedIssue: string;
  estimatedDeliveryDate?: string;
  services?: AddServiceRequest[];
}

export interface AddServiceRequest {
  catalogId?: string;
  title?: string;
  description?: string;
  laborPrice?: number;
}

export interface UpdateOrderRequest {
  priority?: Priority;
  diagnosisNotes?: string;
  technicianNotes?: string;
  estimatedDeliveryDate?: string;
  discount?: number;
  paymentTerms?: string;
}

export interface PortalOrderDto {
  orderNumber: number;
  customerFirstName: string | null;
  instrument: string | null;
  status: OrderStatus;
  statusLabel: string;
  estimatedDeliveryDate: string | null;
  services: OrderServiceItemDto[];
  parts: OrderPartDto[];
  quote: QuoteDto;
  timeline: TimelineDto[];
}

// ---------------- reports / notifications / privacy / audit ----------------

export interface DashboardDto {
  date: string;
  ordersByStatus: Record<OrderStatus, number>;
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
  byMethod: Partial<Record<PaymentMethod, { amount: number; count: number }>>;
  deliveredOrders: number;
  averageTicket: number;
  receivable: number;
}

export interface NotificationDto {
  id: string;
  channel: 'email' | 'whatsapp' | 'interno';
  status: 'enviado' | 'falhou' | 'pendente';
  recipient: string | null;
  subject: string;
  body: string;
  actionUrl: string | null;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
  sentAt: string | null;
  error: string | null;
}

export interface AuditLogDto {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: string | null;
  ip: string | null;
}

export interface CustomerDataExportDto {
  generatedAt: string;
  workshopNotice: string;
  customer: Record<string, unknown>;
  serviceOrders: OrderDto[];
}
