/**
 * Papel na interface: 'luthier' = bancada e gestão (perfis ADMIN e LUTHIER da API),
 * 'atendente' = balcão (ATENDENTE e ESTOQUISTA). O cliente usa o portal público, sem login.
 */
export type UserRole = 'luthier' | 'atendente';

export type InstrumentType =
  | 'violao_aco'
  | 'violao_nylon'
  | 'guitarra'
  | 'baixo'
  | 'cavaquinho'
  | 'viola'
  | 'violino'
  | 'outro';

export type OrderStatus =
  | 'recebido'
  | 'diagnostico'
  | 'orcamento'
  | 'aguardando_aprovacao'
  | 'em_execucao'
  | 'pronto'
  | 'entregue'
  | 'cancelado';

export interface Photo {
  id: string;
  /** data URL (foto ainda não enviada) ou URL pública (portal). */
  url: string;
  /** Caminho da API que exige token (fotos da OS vistas pela equipe). */
  authPath?: string;
  tag: 'entrada' | 'diagnostico' | 'bancada' | 'finalizado' | 'detalhe_defeito';
  caption: string;
  timestamp: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  cpf?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  avatarUrl?: string;
}

export interface Instrument {
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
  photos: Photo[];
  createdAt: string;
}

export interface PartUsage {
  id: string;
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ServiceItem {
  id: string;
  catalogId?: string;
  title: string;
  description?: string;
  laborPrice: number;
  done: boolean;
}

export interface Quote {
  laborTotal: number;
  partsTotal: number;
  discount: number;
  grandTotal: number;
  status: 'pendente' | 'aprovado' | 'rejeitado' | null;
  sentAt?: string;
  answeredAt?: string;
  rejectionReason?: string;
  paymentTerms?: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type:
    | 'status_change'
    | 'quote_sent'
    | 'quote_approved'
    | 'quote_rejected'
    | 'photo_added'
    | 'service_done'
    | 'payment_received'
    | 'note_added';
  title: string;
  description?: string;
  user: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  clientId: string;
  instrumentId: string;
  status: OrderStatus;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  reportedIssue: string;
  diagnosisNotes: string;
  entryDate: string;
  estimatedDeliveryDate: string;
  completedDate?: string;
  deliveredDate?: string;
  services: ServiceItem[];
  parts: PartUsage[];
  quote?: Quote;
  photos: Photo[];
  timeline: TimelineEvent[];
  payments: OrderPayment[];
  technicianNotes?: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  clientTrackingToken: string;
  /** A listagem da API traz um resumo; serviços, peças e histórico vêm no detalhe. */
  detailLoaded: boolean;
  photosLoaded: boolean;
}

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia';

export interface OrderPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  receiptNumber: string;
  receivedBy: string;
}

export type StockCategory = 'pecas' | 'cordas' | 'madeiras' | 'insumos';

export interface StockItem {
  id: string;
  name: string;
  category: StockCategory;
  brand: string;
  sku: string;
  barcode: string;
  currentQuantity: number;
  minQuantity: number;
  unit: string; // 'un', 'jogo', 'm', 'ml', 'g'
  costPrice: number;
  salePrice: number;
  location: string;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  stockItemName: string;
  date: string;
  type: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  balanceAfter?: number;
  createdBy?: string;
  orderId?: string;
  reason: string;
}

export interface Payment {
  id: string;
  orderId: string;
  clientId: string;
  orderNumber: number;
  clientName: string;
  instrumentDescription: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  receiptNumber: string;
  status: 'concluido' | 'pendente';
}

export interface CatalogItem {
  id: string;
  title: string;
  description?: string;
  laborPrice: number;
  estimatedDays?: number;
}

export type SyncStatus = 'online' | 'sincronizando' | 'offline';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  undoAction?: () => void;
  undoLabel?: string;
  duration?: number;
}
