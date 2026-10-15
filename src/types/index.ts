export type UserRole = 'luthier' | 'atendente' | 'cliente';

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
  url: string;
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
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unitPrice: number;
}

export interface ServiceItem {
  id: string;
  title: string;
  description?: string;
  laborPrice: number;
  done: boolean;
  partsUsed: PartUsage[];
}

export interface Quote {
  id: string;
  orderId: string;
  laborTotal: number;
  partsTotal: number;
  discount: number;
  grandTotal: number;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  sentAt?: string;
  answeredAt?: string;
  rejectionReason?: string;
  paymentTerms: string;
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
  quote?: Quote;
  photos: Photo[];
  timeline: TimelineEvent[];
  technicianNotes?: string;
  totalAmount: number;
  paidAmount: number;
  clientTrackingToken: string;
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
  method: 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia';
  date: string;
  receiptNumber: string;
  status: 'concluido' | 'pendente';
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
