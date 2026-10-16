import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  CatalogItem,
  Client,
  Instrument,
  Order,
  OrderStatus,
  PaymentMethod,
  Photo,
  StockItem,
  StockMovement,
  UserRole,
  SyncStatus,
  ToastMessage,
} from '../types';
import { api, CreateOrderRequest, InstrumentRequest, ProductRequest, UpdateOrderRequest } from '../services/api';
import { ApiError } from '../services/http';
import {
  toCatalogItem,
  toClient,
  toInstrument,
  toMovement,
  toOrder,
  toOrderPhoto,
  toStockItem,
} from '../services/mappers';
import { useAuth } from './AuthContext';

export type CameraCallback = (photoUrl: string, caption?: string, tag?: Photo['tag']) => void;

interface NewServiceInput {
  catalogId?: string;
  title?: string;
  description?: string;
  laborPrice?: number;
}

interface AppContextType {
  // Dados da oficina (vindos da API)
  clients: Client[];
  instruments: Instrument[];
  orders: Order[];
  stock: StockItem[];
  stockMovements: StockMovement[];
  catalog: CatalogItem[];
  isDataLoading: boolean;

  // Estado de interface
  currentRole: UserRole;
  syncStatus: SyncStatus;
  activeTab: string;
  searchQuery: string;
  recentSearches: string[];
  isSearchOpen: boolean;
  activeOrderId: string | null;
  isNewOrderWizardOpen: boolean;
  isWorkbenchModeOpen: boolean;
  isDarkMode: boolean;
  toasts: ToastMessage[];
  isCameraModalOpen: boolean;
  cameraCallback: CameraCallback | null;
  cameraDefaultTag: Photo['tag'];
  isBarcodeModalOpen: boolean;
  barcodeCallback: ((code: string) => void) | null;

  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setIsSearchOpen: (open: boolean) => void;
  setActiveOrderId: (id: string | null) => void;
  setIsNewOrderWizardOpen: (open: boolean) => void;
  setIsWorkbenchModeOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  /** Recarrega tudo do servidor (botão de status de conexão). */
  refreshData: () => Promise<void>;
  triggerHaptic: () => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  /** Mostra o erro da API num toast; devolve false para encadear em handlers. */
  handleError: (error: unknown, title?: string) => false;

  // Ordens de serviço
  loadOrderDetail: (orderId: string) => Promise<void>;
  advanceOrderStatus: (orderId: string, specificStatus?: OrderStatus, note?: string) => Promise<boolean>;
  updateOrder: (orderId: string, updates: UpdateOrderRequest) => Promise<boolean>;
  createOrder: (
    data: Omit<CreateOrderRequest, 'customerId' | 'instrumentId'> & { photos?: Photo[] },
    clientId: string,
    instrumentId: string
  ) => Promise<Order | null>;
  addServiceItem: (orderId: string, service: NewServiceInput) => Promise<boolean>;
  removeServiceItem: (orderId: string, itemId: string) => Promise<boolean>;
  toggleServiceDone: (orderId: string, serviceId: string) => Promise<boolean>;
  addPart: (orderId: string, productId: string, quantity: number) => Promise<boolean>;
  removePart: (orderId: string, partId: string) => Promise<boolean>;
  addOrderPhoto: (orderId: string, photo: { url: string; tag: Photo['tag']; caption?: string }) => Promise<boolean>;
  removeOrderPhoto: (orderId: string, photoId: string) => Promise<boolean>;
  approveQuote: (orderId: string) => Promise<boolean>;
  rejectQuote: (orderId: string, reason: string) => Promise<boolean>;
  addNote: (orderId: string, note: string) => Promise<boolean>;
  recordPayment: (orderId: string, amount: number, method: PaymentMethod) => Promise<boolean>;

  // Clientes e instrumentos
  createClient: (data: { name: string; phone: string; email?: string; cpf?: string; address?: string; notes?: string }) => Promise<Client | null>;
  createInstrument: (clientId: string, data: InstrumentRequest) => Promise<Instrument | null>;

  // Estoque
  updateStockQuantity: (stockItemId: string, delta: number, reason: string, orderId?: string) => Promise<boolean>;
  createProduct: (data: ProductRequest) => Promise<StockItem | null>;
  loadStockMovements: () => Promise<void>;

  // Catálogo de serviços
  saveCatalogItem: (data: Omit<CatalogItem, 'id'>, id?: string) => Promise<boolean>;
  removeCatalogItem: (id: string) => Promise<boolean>;

  openCamera: (callback: CameraCallback, defaultTag?: Photo['tag']) => void;
  closeCamera: () => void;
  openBarcodeScanner: (callback: (code: string) => void) => void;
  closeBarcodeScanner: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STATUS_FLOW: OrderStatus[] = [
  'recebido',
  'diagnostico',
  'orcamento',
  'aguardando_aprovacao',
  'em_execucao',
  'pronto',
  'entregue',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  diagnostico: 'Diagnóstico',
  orcamento: 'Orçamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_execucao: 'Em execução',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const isOpen = (o: Order) => o.status !== 'entregue' && o.status !== 'cancelado';

/** Executa tarefas com no máximo {@code limit} em paralelo. */
async function pooled<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift()!;
      await task(next).catch(() => undefined);
    }
  });
  await Promise.all(workers);
}

function celebrate(particleCount = 50) {
  try {
    confetti({ particleCount, spread: 60, origin: { y: 0.8 } });
  } catch {
    // ignore
  }
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [activeTab, setActiveTab] = useState<string>('hoje');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('luthier_recent_searches') || '[]');
    } catch {
      return [];
    }
  });
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isNewOrderWizardOpen, setIsNewOrderWizardOpen] = useState<boolean>(false);
  const [isWorkbenchModeOpen, setIsWorkbenchModeOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => localStorage.getItem('luthier_dark_mode') === 'true');

  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraCallback, setCameraCallback] = useState<CameraCallback | null>(null);
  const [cameraDefaultTag, setCameraDefaultTag] = useState<Photo['tag']>('bancada');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [barcodeCallback, setBarcodeCallback] = useState<((code: string) => void) | null>(null);

  const currentRole: UserRole = user?.role ?? 'atendente';
  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;

  const syncStatus: SyncStatus = !isOnline ? 'offline' : isDataLoading ? 'sincronizando' : 'online';

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('luthier_dark_mode', String(isDarkMode));
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('luthier_recent_searches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // ignore
      }
    }
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = 'toast-' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration ?? 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleError = useCallback(
    (error: unknown, title = 'Não foi possível concluir'): false => {
      const description = error instanceof ApiError || error instanceof Error ? error.message : undefined;
      showToast({ title, description, type: 'error', duration: 6000 });
      return false;
    },
    [showToast]
  );

  // ---------------- carga inicial ----------------

  const putOrder = useCallback((order: Order) => {
    setOrders((prev) => {
      const old = prev.find((o) => o.id === order.id);
      // Fotos vêm de outra rota: não perder as que já estão carregadas no estado
      const merged =
        old && old.photosLoaded && !order.photosLoaded
          ? { ...order, photos: old.photos, photosLoaded: true }
          : order;
      const next = old ? prev.map((o) => (o.id === order.id ? merged : o)) : [merged, ...prev];
      return next.sort((a, b) => b.orderNumber - a.orderNumber);
    });
  }, []);

  const applyOrder = useCallback(
    (dto: Parameters<typeof toOrder>[0]) => {
      const order = toOrder(dto, ordersRef.current.find((o) => o.id === dto.id));
      putOrder(order);
      return order;
    },
    [putOrder]
  );

  const loadPhotos = useCallback(async (orderId: string) => {
    const photos = await api.orders.photos(orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, photos: photos.map((p) => toOrderPhoto(orderId, p)), photosLoaded: true } : o
      )
    );
  }, []);

  const loadOrderDetail = useCallback(
    async (orderId: string) => {
      try {
        const [dto] = await Promise.all([api.orders.get(orderId), loadPhotos(orderId)]);
        applyOrder(dto);
      } catch (e) {
        handleError(e, 'Falha ao carregar a OS');
      }
    },
    [applyOrder, loadPhotos, handleError]
  );

  const refreshData = useCallback(async () => {
    setIsDataLoading(true);
    try {
      const [customers, orderPage, products, catalogItems] = await Promise.all([
        api.customers.all(),
        api.orders.all(),
        api.products.all(),
        api.catalog.list(),
      ]);
      setClients(customers.map(toClient));
      setInstruments(customers.flatMap((c) => (c.instruments || []).map(toInstrument)));
      setStock(products.map(toStockItem));
      setCatalog(catalogItems.map(toCatalogItem));

      const previous = new Map(ordersRef.current.map((o) => [o.id, o]));
      const summaries = orderPage.map((o) => toOrder(o, previous.get(o.id), false));
      setOrders(summaries);
      ordersRef.current = summaries;

      // OS em andamento: detalhe completo (serviços, peças, histórico) para bancada e painéis
      await pooled(summaries.filter(isOpen).map((o) => o.id), 6, async (id) => {
        const dto = await api.orders.get(id);
        putOrder(toOrder(dto, ordersRef.current.find((o) => o.id === id)));
      });
    } catch (e) {
      handleError(e, 'Falha ao carregar os dados da oficina');
    } finally {
      setIsDataLoading(false);
    }
  }, [handleError, putOrder]);

  useEffect(() => {
    setActiveOrderId(null);
    setActiveTab('hoje');
    if (user) {
      refreshData();
    } else {
      setClients([]);
      setInstruments([]);
      setOrders([]);
      setStock([]);
      setStockMovements([]);
      setCatalog([]);
    }
    // Recarrega quando muda o usuário (login, troca de usuário no aparelho)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ---------------- ações sobre a OS ----------------

  const run = useCallback(
    async (action: () => Promise<unknown>, errorTitle?: string): Promise<boolean> => {
      try {
        await action();
        return true;
      } catch (e) {
        return handleError(e, errorTitle);
      }
    },
    [handleError]
  );

  const advanceOrderStatus = useCallback(
    async (orderId: string, specificStatus?: OrderStatus, note?: string) => {
      triggerHaptic();
      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!order) return false;

      let target = specificStatus;
      if (!target) {
        const idx = STATUS_FLOW.indexOf(order.status);
        if (idx < 0 || idx >= STATUS_FLOW.length - 1) return false;
        target = STATUS_FLOW[idx + 1];
      }
      if (target === order.status) return false;

      return run(async () => {
        // Orçamento tem rotas próprias: enviar (aguardar aprovação) e aprovar (inicia execução)
        let dto;
        if (target === 'aguardando_aprovacao') {
          dto = await api.orders.sendQuote(orderId);
        } else if (order.status === 'aguardando_aprovacao' && target === 'em_execucao') {
          dto = await api.orders.approveQuote(orderId);
        } else {
          dto = await api.orders.changeStatus(orderId, target!, note);
        }
        applyOrder(dto);
        if (target === 'pronto' || target === 'entregue') celebrate();
        showToast({
          title: `OS #${order.orderNumber}: ${STATUS_LABELS[target!]}`,
          description: 'Alteração registrada na linha do tempo.',
          type: 'success',
        });
      }, `OS #${order.orderNumber} não avançou`);
    },
    [run, applyOrder, showToast, triggerHaptic]
  );

  const updateOrder = useCallback(
    (orderId: string, updates: UpdateOrderRequest) =>
      run(async () => applyOrder(await api.orders.update(orderId, updates)), 'Falha ao salvar a OS'),
    [run, applyOrder]
  );

  const createOrder = useCallback<AppContextType['createOrder']>(
    async (data, clientId, instrumentId) => {
      triggerHaptic();
      try {
        const { photos = [], ...body } = data;
        const dto = await api.orders.create({ ...body, customerId: clientId, instrumentId });
        let order = applyOrder(dto);
        // Fotos de entrada tiradas no wizard: enviadas depois que a OS existe
        for (const ph of photos) {
          try {
            await api.orders.addPhoto(order.id, { tag: ph.tag, caption: ph.caption, dataUrl: ph.url });
          } catch (e) {
            handleError(e, 'Uma foto de entrada não foi enviada');
          }
        }
        if (photos.length) {
          await loadPhotos(order.id);
          order = applyOrder(await api.orders.get(order.id));
        }
        showToast({
          title: `OS #${order.orderNumber} aberta com sucesso!`,
          description: 'Pronta para diagnóstico e envio de link ao cliente.',
          type: 'success',
        });
        return order;
      } catch (e) {
        handleError(e, 'Falha ao abrir a OS');
        return null;
      }
    },
    [applyOrder, handleError, loadPhotos, showToast, triggerHaptic]
  );

  const addServiceItem = useCallback(
    (orderId: string, service: NewServiceInput) =>
      run(async () => applyOrder(await api.orders.addService(orderId, service)), 'Serviço não adicionado'),
    [run, applyOrder]
  );

  const removeServiceItem = useCallback(
    (orderId: string, itemId: string) =>
      run(async () => applyOrder(await api.orders.removeService(orderId, itemId)), 'Serviço não removido'),
    [run, applyOrder]
  );

  const toggleServiceDone = useCallback(
    async (orderId: string, serviceId: string) => {
      triggerHaptic();
      const order = ordersRef.current.find((o) => o.id === orderId);
      const service = order?.services.find((s) => s.id === serviceId);
      if (service?.done) {
        showToast({ title: 'Serviço já concluído', type: 'info', duration: 2500 });
        return false;
      }
      return run(async () => applyOrder(await api.orders.markServiceDone(orderId, serviceId)), 'Serviço não concluído');
    },
    [run, applyOrder, showToast, triggerHaptic]
  );

  const addPart = useCallback(
    (orderId: string, productId: string, quantity: number) =>
      run(async () => applyOrder(await api.orders.addPart(orderId, productId, quantity)), 'Peça não adicionada'),
    [run, applyOrder]
  );

  const removePart = useCallback(
    (orderId: string, partId: string) =>
      run(async () => applyOrder(await api.orders.removePart(orderId, partId)), 'Peça não removida'),
    [run, applyOrder]
  );

  const addOrderPhoto = useCallback(
    (orderId: string, photo: { url: string; tag: Photo['tag']; caption?: string }) =>
      run(async () => {
        await api.orders.addPhoto(orderId, { tag: photo.tag, caption: photo.caption, dataUrl: photo.url });
        await loadPhotos(orderId);
        applyOrder(await api.orders.get(orderId));
        showToast({
          title: 'Foto registrada com sucesso',
          description: 'Disponível na galeria e no portal do cliente.',
          type: 'success',
        });
      }, 'Foto não enviada'),
    [run, loadPhotos, applyOrder, showToast]
  );

  const removeOrderPhoto = useCallback(
    (orderId: string, photoId: string) =>
      run(async () => {
        await api.orders.removePhoto(orderId, photoId);
        await loadPhotos(orderId);
      }, 'Foto não removida'),
    [run, loadPhotos]
  );

  const approveQuote = useCallback(
    (orderId: string) =>
      run(async () => {
        triggerHaptic();
        applyOrder(await api.orders.approveQuote(orderId));
        celebrate(70);
        showToast({ title: 'Orçamento aprovado!', description: 'OS liberada para execução na bancada.', type: 'success' });
      }, 'Orçamento não aprovado'),
    [run, applyOrder, showToast, triggerHaptic]
  );

  const rejectQuote = useCallback(
    (orderId: string, reason: string) =>
      run(async () => {
        applyOrder(await api.orders.rejectQuote(orderId, reason));
        showToast({ title: 'Recusa registrada', description: 'A OS voltou para orçamento.', type: 'warning' });
      }, 'Recusa não registrada'),
    [run, applyOrder, showToast]
  );

  const addNote = useCallback(
    (orderId: string, note: string) =>
      run(async () => applyOrder(await api.orders.addNote(orderId, note)), 'Observação não salva'),
    [run, applyOrder]
  );

  const recordPayment = useCallback(
    (orderId: string, amount: number, method: PaymentMethod) =>
      run(async () => {
        triggerHaptic();
        const order = applyOrder(await api.orders.receivePayment(orderId, amount, method));
        const receipt = order.payments[order.payments.length - 1]?.receiptNumber;
        celebrate(40);
        showToast({
          title: `Pagamento de R$ ${amount.toFixed(2)} registrado!`,
          description: receipt ? `Recibo ${receipt}` : undefined,
          type: 'success',
        });
      }, 'Pagamento não registrado'),
    [run, applyOrder, showToast, triggerHaptic]
  );

  // ---------------- clientes ----------------

  const createClient = useCallback<AppContextType['createClient']>(
    async (data) => {
      triggerHaptic();
      try {
        const dto = await api.customers.create({
          name: data.name,
          phone: data.phone,
          email: data.email || undefined,
          cpf: data.cpf || undefined,
          address: data.address || undefined,
          notes: data.notes || undefined,
        });
        const client = toClient(dto);
        setClients((prev) => [client, ...prev]);
        showToast({ title: `Cliente ${client.name} cadastrado`, type: 'success' });
        return client;
      } catch (e) {
        handleError(e, 'Cliente não cadastrado');
        return null;
      }
    },
    [handleError, showToast, triggerHaptic]
  );

  const createInstrument = useCallback<AppContextType['createInstrument']>(
    async (clientId, data) => {
      triggerHaptic();
      try {
        const inst = toInstrument(await api.customers.addInstrument(clientId, data));
        setInstruments((prev) => [inst, ...prev]);
        showToast({ title: `${inst.brand} ${inst.model} registrado`, type: 'success' });
        return inst;
      } catch (e) {
        handleError(e, 'Instrumento não cadastrado');
        return null;
      }
    },
    [handleError, showToast, triggerHaptic]
  );

  // ---------------- estoque ----------------

  const updateStockQuantity = useCallback(
    async (stockItemId: string, delta: number, reason: string, orderId?: string) => {
      if (delta === 0) return false;
      triggerHaptic();
      return run(async () => {
        const mov = await api.products.move(stockItemId, {
          type: delta > 0 ? 'entrada' : 'saida',
          quantity: Math.abs(delta),
          reason,
          orderId,
        });
        const item = stock.find((s) => s.id === stockItemId);
        setStock((prev) =>
          prev.map((s) => (s.id === stockItemId ? { ...s, currentQuantity: mov.balanceAfter } : s))
        );
        setStockMovements((prev) => [toMovement(mov, item?.name || ''), ...prev]);
      }, 'Estoque não atualizado');
    },
    [run, stock, triggerHaptic]
  );

  const createProduct = useCallback<AppContextType['createProduct']>(
    async (data) => {
      try {
        const item = toStockItem(await api.products.create(data));
        setStock((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
        showToast({ title: `${item.name} cadastrado no estoque`, type: 'success' });
        return item;
      } catch (e) {
        handleError(e, 'Item não cadastrado');
        return null;
      }
    },
    [handleError, showToast]
  );

  const loadStockMovements = useCallback(async () => {
    const collected: StockMovement[] = [];
    await pooled(stock, 6, async (item) => {
      const page = await api.products.movements(item.id, 10);
      collected.push(...page.content.map((m) => toMovement(m, item.name)));
    });
    collected.sort((a, b) => b.date.localeCompare(a.date));
    setStockMovements(collected.slice(0, 100));
  }, [stock]);

  // ---------------- catálogo ----------------

  const saveCatalogItem = useCallback(
    (data: Omit<CatalogItem, 'id'>, id?: string) =>
      run(async () => {
        const body = {
          title: data.title,
          description: data.description || undefined,
          laborPrice: data.laborPrice,
          estimatedDays: data.estimatedDays,
        };
        const saved = toCatalogItem(id ? await api.catalog.update(id, body) : await api.catalog.create(body));
        setCatalog((prev) => (id ? prev.map((c) => (c.id === id ? saved : c)) : [...prev, saved]));
      }, 'Serviço do catálogo não salvo'),
    [run]
  );

  const removeCatalogItem = useCallback(
    (id: string) =>
      run(async () => {
        await api.catalog.remove(id);
        setCatalog((prev) => prev.filter((c) => c.id !== id));
      }, 'Serviço do catálogo não removido'),
    [run]
  );

  // ---------------- interface ----------------

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
    triggerHaptic();
  }, [triggerHaptic]);

  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== query.toLowerCase());
      return [query, ...filtered].slice(0, 6);
    });
  }, []);

  const clearRecentSearches = useCallback(() => setRecentSearches([]), []);

  const openCamera = useCallback((callback: CameraCallback, defaultTag: Photo['tag'] = 'bancada') => {
    setCameraCallback(() => callback);
    setCameraDefaultTag(defaultTag);
    setIsCameraModalOpen(true);
  }, []);

  const closeCamera = useCallback(() => {
    setIsCameraModalOpen(false);
    setCameraCallback(null);
  }, []);

  const openBarcodeScanner = useCallback((callback: (code: string) => void) => {
    setBarcodeCallback(() => callback);
    setIsBarcodeModalOpen(true);
  }, []);

  const closeBarcodeScanner = useCallback(() => {
    setIsBarcodeModalOpen(false);
    setBarcodeCallback(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
        clients,
        instruments,
        orders,
        stock,
        stockMovements,
        catalog,
        isDataLoading,
        currentRole,
        syncStatus,
        activeTab,
        searchQuery,
        recentSearches,
        isSearchOpen,
        activeOrderId,
        isNewOrderWizardOpen,
        isWorkbenchModeOpen,
        isDarkMode,
        toasts,
        isCameraModalOpen,
        cameraCallback,
        cameraDefaultTag,
        isBarcodeModalOpen,
        barcodeCallback,
        setActiveTab,
        setSearchQuery,
        addRecentSearch,
        clearRecentSearches,
        setIsSearchOpen,
        setActiveOrderId,
        setIsNewOrderWizardOpen,
        setIsWorkbenchModeOpen,
        toggleDarkMode,
        refreshData,
        triggerHaptic,
        showToast,
        dismissToast,
        handleError,
        loadOrderDetail,
        advanceOrderStatus,
        updateOrder,
        createOrder,
        addServiceItem,
        removeServiceItem,
        toggleServiceDone,
        addPart,
        removePart,
        addOrderPhoto,
        removeOrderPhoto,
        approveQuote,
        rejectQuote,
        addNote,
        recordPayment,
        createClient,
        createInstrument,
        updateStockQuantity,
        createProduct,
        loadStockMovements,
        saveCatalogItem,
        removeCatalogItem,
        openCamera,
        closeCamera,
        openBarcodeScanner,
        closeBarcodeScanner,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export { STATUS_LABELS };
