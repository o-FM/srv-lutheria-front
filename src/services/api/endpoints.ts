/**
 * Um método por endpoint da API srv-luthieria, agrupados por módulo do backend.
 * Papéis exigidos estão documentados em docs/api.md (backend).
 */
import { fetchAll, http } from './http';
import type {
  AddServiceRequest,
  AuditLogDto,
  CatalogServiceDto,
  CatalogServiceRequest,
  CreateOrderRequest,
  CreateUserRequest,
  CustomerDataExportDto,
  CustomerDto,
  CustomerRequest,
  DashboardDto,
  FinancialDto,
  InstrumentDto,
  InstrumentRequest,
  MovementType,
  NotificationDto,
  OrderDto,
  Page,
  PaymentMethod,
  PortalOrderDto,
  ProductDto,
  ProductRequest,
  Profile,
  RegisterWorkshopRequest,
  StockMovementDto,
  TokenResponse,
  UpdateOrderRequest,
  UserDto,
  UserPreferencesDto,
} from './types';
import type { OrderStatus, StockCategory } from '../../types';

const id = (value: string) => encodeURIComponent(value);

export const authEndpoints = {
  /** identifier: e-mail ou CPF (só dígitos). */
  login: (identifier: string, password: string) =>
    http.post<TokenResponse>('/auth/login', { identifier, password }, { auth: false }),
  register: (body: RegisterWorkshopRequest) =>
    http.post<TokenResponse>('/auth/register', body, { auth: false }),
  logout: (refreshToken: string) =>
    http.post<void>('/auth/logout', { refreshToken }, { auth: false }),
  forgotPassword: (email: string) =>
    http.post<void>('/auth/forgot-password', { email }, { auth: false }),
  resetPassword: (token: string, newPassword: string) =>
    http.post<void>('/auth/reset-password', { token, newPassword }, { auth: false }),
};

export const userEndpoints = {
  me: () => http.get<UserDto>('/users/me'),
  updateMyPreferences: (preferences: UserPreferencesDto) =>
    http.put<UserDto>('/users/me/preferences', preferences),
  list: () => http.get<UserDto[]>('/users'),
  create: (body: CreateUserRequest) => http.post<UserDto>('/users', body),
  changeProfile: (userId: string, profile: Profile) =>
    http.patch<UserDto>(`/users/${id(userId)}/profile`, { profile }),
  activate: (userId: string) => http.post<UserDto>(`/users/${id(userId)}/activate`),
  deactivate: (userId: string) => http.post<UserDto>(`/users/${id(userId)}/deactivate`),
};

export const customerEndpoints = {
  search: (search?: string, page = 0, size = 20) =>
    http.get<Page<CustomerDto>>('/customers', { query: { search, page, size } }),
  all: () => fetchAll<CustomerDto>('/customers'),
  get: (customerId: string) => http.get<CustomerDto>(`/customers/${id(customerId)}`),
  create: (body: CustomerRequest) => http.post<CustomerDto>('/customers', body),
  update: (customerId: string, body: CustomerRequest) =>
    http.put<CustomerDto>(`/customers/${id(customerId)}`, body),
  deactivate: (customerId: string) => http.delete<void>(`/customers/${id(customerId)}`),
  anonymize: (customerId: string) => http.post<void>(`/customers/${id(customerId)}/anonymize`),
  /** Gera um novo código da área do cliente (revoga o anterior) e envia pelo WhatsApp. */
  sendAccessCode: (customerId: string) =>
    http.post<NotificationDto>(`/customers/${id(customerId)}/access-code`),
  instruments: (customerId: string) =>
    http.get<InstrumentDto[]>(`/customers/${id(customerId)}/instruments`),
  allInstruments: () => fetchAll<InstrumentDto>('/instruments'),
  addInstrument: (customerId: string, body: Partial<InstrumentRequest> & Pick<InstrumentRequest, 'type' | 'brand' | 'model'>) =>
    http.post<InstrumentDto>(`/customers/${id(customerId)}/instruments`, body),
  updateInstrument: (customerId: string, instrumentId: string, body: InstrumentRequest) =>
    http.put<InstrumentDto>(`/customers/${id(customerId)}/instruments/${id(instrumentId)}`, body),
};

export const productEndpoints = {
  search: (params: { search?: string; category?: StockCategory; lowStock?: boolean; page?: number; size?: number } = {}) =>
    http.get<Page<ProductDto>>('/products', { query: params }),
  all: () => fetchAll<ProductDto>('/products'),
  get: (productId: string) => http.get<ProductDto>(`/products/${id(productId)}`),
  byBarcode: (code: string) => http.get<ProductDto>(`/products/barcode/${id(code)}`),
  create: (body: ProductRequest) => http.post<ProductDto>('/products', body),
  update: (productId: string, body: ProductRequest) =>
    http.put<ProductDto>(`/products/${id(productId)}`, body),
  deactivate: (productId: string) => http.delete<void>(`/products/${id(productId)}`),
  move: (productId: string, body: { type: MovementType; quantity: number; reason: string; orderId?: string }) =>
    http.post<StockMovementDto>(`/products/${id(productId)}/movements`, body),
  movements: (productId: string, page = 0) =>
    http.get<Page<StockMovementDto>>(`/products/${id(productId)}/movements`, { query: { page } }),
};

export const catalogEndpoints = {
  list: () => http.get<CatalogServiceDto[]>('/service-catalog'),
  create: (body: CatalogServiceRequest) => http.post<CatalogServiceDto>('/service-catalog', body),
  update: (serviceId: string, body: CatalogServiceRequest) =>
    http.put<CatalogServiceDto>(`/service-catalog/${id(serviceId)}`, body),
  deactivate: (serviceId: string) => http.delete<void>(`/service-catalog/${id(serviceId)}`),
};

export const orderEndpoints = {
  search: (params: { status?: OrderStatus; customerId?: string; number?: number; full?: boolean; page?: number; size?: number } = {}) =>
    http.get<Page<OrderDto>>('/service-orders', { query: params }),
  all: () => fetchAll<OrderDto>('/service-orders', { full: true }),
  get: (orderId: string) => http.get<OrderDto>(`/service-orders/${id(orderId)}`),
  create: (body: CreateOrderRequest) => http.post<OrderDto>('/service-orders', body),
  update: (orderId: string, body: UpdateOrderRequest) =>
    http.patch<OrderDto>(`/service-orders/${id(orderId)}`, body),
  addService: (orderId: string, body: AddServiceRequest) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/services`, body),
  /** Valor do serviço no diagnóstico (ADMIN/LUTHIER, até o envio do orçamento). */
  updateService: (orderId: string, itemId: string, body: { laborPrice: number; title?: string; description?: string }) =>
    http.put<OrderDto>(`/service-orders/${id(orderId)}/services/${id(itemId)}`, body),
  removeService: (orderId: string, itemId: string) =>
    http.delete<OrderDto>(`/service-orders/${id(orderId)}/services/${id(itemId)}`),
  markServiceDone: (orderId: string, itemId: string) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/services/${id(itemId)}/done`),
  addPart: (orderId: string, productId: string, quantity: number) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/parts`, { productId, quantity }),
  removePart: (orderId: string, partId: string) =>
    http.delete<OrderDto>(`/service-orders/${id(orderId)}/parts/${id(partId)}`),
  changeStatus: (orderId: string, status: OrderStatus, note?: string) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/status`, { status, note }),
  sendQuote: (orderId: string) => http.post<OrderDto>(`/service-orders/${id(orderId)}/quote/send`),
  approveQuote: (orderId: string) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/quote/approve`),
  rejectQuote: (orderId: string, reason?: string) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/quote/reject`, { reason }),
  addNote: (orderId: string, note: string) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/notes`, { note }),
  receivePayment: (orderId: string, amount: number, method: PaymentMethod) =>
    http.post<OrderDto>(`/service-orders/${id(orderId)}/payments`, { amount, method }),
};

/** Portal do cliente: rotas públicas, sem login (token da OS no link). */
export const portalEndpoints = {
  view: (token: string) => http.get<PortalOrderDto>(`/portal/orders/${id(token)}`, { auth: false }),
  approve: (token: string) =>
    http.post<PortalOrderDto>(`/portal/orders/${id(token)}/quote/approve`, undefined, { auth: false }),
  reject: (token: string, reason?: string) =>
    http.post<PortalOrderDto>(`/portal/orders/${id(token)}/quote/reject`, { reason }, { auth: false }),
};

/** Área do cliente: login só com o código do WhatsApp; demais rotas com o token do cliente. */
export const clientEndpoints = {
  login: (code: string) =>
    http.post<TokenResponse>('/auth/customer/login', { code }, { auth: false }),
  me: (token: string) => http.get<{ id: string; name: string }>('/client/me', { bearer: token }),
  orders: (token: string) => http.get<PortalOrderDto[]>('/client/orders', { bearer: token }),
  approve: (token: string, orderId: string) =>
    http.post<PortalOrderDto>(`/client/orders/${id(orderId)}/quote/approve`, undefined, { bearer: token }),
  reject: (token: string, orderId: string, reason?: string) =>
    http.post<PortalOrderDto>(`/client/orders/${id(orderId)}/quote/reject`, { reason }, { bearer: token }),
};

export const reportEndpoints = {
  dashboard: () => http.get<DashboardDto>('/reports/dashboard'),
  financial: (from?: string, to?: string) =>
    http.get<FinancialDto>('/reports/financial', { query: { from, to } }),
};

export const notificationEndpoints = {
  list: (params: { channel?: NotificationDto['channel']; status?: NotificationDto['status']; page?: number } = {}) =>
    http.get<Page<NotificationDto>>('/notifications', { query: params }),
  markSent: (notificationId: string) =>
    http.post<NotificationDto>(`/notifications/${id(notificationId)}/sent`),
};

export const privacyEndpoints = {
  exportCustomer: (customerId: string) =>
    http.get<CustomerDataExportDto>(`/privacy/customers/${id(customerId)}/export`),
};

export const auditEndpoints = {
  list: (page = 0, size = 50) => http.get<Page<AuditLogDto>>('/audit-logs', { query: { page, size } }),
};

export const api = {
  auth: authEndpoints,
  users: userEndpoints,
  customers: customerEndpoints,
  products: productEndpoints,
  catalog: catalogEndpoints,
  orders: orderEndpoints,
  portal: portalEndpoints,
  client: clientEndpoints,
  reports: reportEndpoints,
  notifications: notificationEndpoints,
  privacy: privacyEndpoints,
  audit: auditEndpoints,
};
