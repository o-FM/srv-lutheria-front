import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import {
  Client,
  Instrument,
  Order,
  OrderStatus,
  StockItem,
  Payment,
  StockMovement,
  UserRole,
  SyncStatus,
  ToastMessage,
  Photo,
  ServiceItem,
  PhotoTag,
  CameraCallback,
} from '../types';
import {
  INITIAL_CLIENTS,
  INITIAL_INSTRUMENTS,
  INITIAL_ORDERS,
  INITIAL_STOCK,
  INITIAL_PAYMENTS,
  INITIAL_MOVEMENTS,
} from '../data/seedData';
import {
  BUSINESS_DATA_KEYS,
  isArray,
  readJson,
  readString,
  removeKeys,
  writeJson,
  writeString,
} from '../utils/storage';
import { newId } from '../utils/ids';
import { addDays, nowTimestamp, todayDate } from '../utils/dates';
import { computeOrderTotals } from '../domain/totals';
import { getRolePermissions } from '../utils/permissions';
import {
  buildPendingQuote,
  DEFAULT_PAYMENT_TERMS,
  canApproveQuote,
  canTransition,
  isPartsDeducted,
  nextStatus,
  partsToDeduct,
  remainingBalance,
  revertTransition,
} from '../domain/orderRules';

interface AppContextType {
  // State
  clients: Client[];
  instruments: Instrument[];
  orders: Order[];
  stock: StockItem[];
  payments: Payment[];
  stockMovements: StockMovement[];
  currentRole: UserRole;
  syncStatus: SyncStatus;
  offlineQueueCount: number;
  activeTab: string;
  searchQuery: string;
  recentSearches: string[];
  isSearchOpen: boolean;
  activeOrderId: string | null;
  /** Pedido para a OS aberta mostrar o formulário de pagamento (consumido pelo sheet). */
  orderSheetFocus: 'pagamento' | null;
  /** Ficha de cliente aberta na aba Clientes (também usada pela busca global). */
  activeClientId: string | null;
  isNewOrderWizardOpen: boolean;
  isWorkbenchModeOpen: boolean;
  isDarkMode: boolean;
  toasts: ToastMessage[];

  // Modals & Camera Callbacks
  isCameraModalOpen: boolean;
  cameraCallback: CameraCallback | null;
  cameraDefaultTag: PhotoTag;
  isBarcodeModalOpen: boolean;
  barcodeCallback: ((code: string) => void) | null;

  // Actions
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setIsSearchOpen: (open: boolean) => void;
  setActiveOrderId: (id: string | null) => void;
  setOrderSheetFocus: (focus: 'pagamento' | null) => void;
  setActiveClientId: (id: string | null) => void;
  setIsNewOrderWizardOpen: (open: boolean) => void;
  setIsWorkbenchModeOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  toggleSyncStatus: () => void;
  triggerHaptic: () => void;

  // Toast
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;

  // Domain Actions
  advanceOrderStatus: (orderId: string, specificStatus?: OrderStatus, note?: string) => void;
  updateOrder: (orderId: string, updates: Partial<Order>) => void;
  createOrder: (orderData: Partial<Order>, clientId: string, instrumentId: string) => Order;
  addServiceItem: (orderId: string, service: Omit<ServiceItem, 'id'>) => void;
  toggleServiceDone: (orderId: string, serviceId: string) => void;
  addOrderPhoto: (orderId: string, photo: Omit<Photo, 'id' | 'timestamp'>) => void;
  approveQuote: (orderId: string) => void;
  /** Entrega a OS. Com saldo em aberto, não entrega: abre a OS no pagamento. */
  deliverOrder: (orderId: string, note?: string) => void;
  rejectQuote: (orderId: string, reason: string) => void;

  createClient: (clientData: Omit<Client, 'id' | 'createdAt'>) => Client;
  createInstrument: (instrumentData: Omit<Instrument, 'id' | 'createdAt' | 'photos'>, photos?: Photo[]) => Instrument;

  updateStockQuantity: (stockItemId: string, delta: number, reason: string, orderId?: string) => void;
  /** Devolve `null` quando o papel atual não pode registrar pagamento. */
  recordPayment: (payment: Omit<Payment, 'id' | 'receiptNumber'>) => Payment | null;

  /** Abre a câmera com a categoria padrão de quem chamou (o usuário pode trocar). */
  openCamera: (callback: CameraCallback, defaultTag?: PhotoTag) => void;
  closeCamera: () => void;
  openBarcodeScanner: (callback: (code: string) => void) => void;
  closeBarcodeScanner: () => void;

  resetToDefaults: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  recebido: 'Instrumento acolhido na recepção',
  diagnostico: 'Instrumento posicionado na bancada para diagnóstico',
  orcamento: 'Orçamento detalhado elaborado',
  aguardando_aprovacao: 'Orçamento encaminhado para aprovação do cliente',
  em_execucao: 'Mãos à obra! Serviços iniciados na bancada',
  pronto: 'Serviços finalizados, instrumento limpo e pronto para retirada',
  entregue: 'Instrumento entregue ao músico com sucesso',
  cancelado: 'Ordem de serviço cancelada',
};

interface AppProviderProps {
  children: ReactNode;
  /** Papel do usuário logado. O provider é remontado (key) a cada troca de usuário. */
  initialRole?: UserRole;
  /** Sem usuário logado, nada é gravado no aparelho (o logout apagou os dados). */
  isPersistenceEnabled?: boolean;
  /** Toast exibido uma vez quando o provider monta. */
  initialNotice?: Omit<ToastMessage, 'id'> | null;
  /** Nome do usuário logado, usado como autor dos eventos da timeline. */
  currentUserName?: string;
}

export const AppProvider: React.FC<AppProviderProps> = ({
  children,
  initialRole = 'luthier',
  isPersistenceEnabled = true,
  initialNotice = null,
  currentUserName = '',
}) => {
  // Load from localStorage or seed (JSON corrompido volta para as seeds)
  const [clients, setClients] = useState<Client[]>(() =>
    readJson('luthier_clients', INITIAL_CLIENTS, isArray<Client>)
  );

  const [instruments, setInstruments] = useState<Instrument[]>(() =>
    readJson('luthier_instruments', INITIAL_INSTRUMENTS, isArray<Instrument>)
  );

  const [orders, setOrders] = useState<Order[]>(() =>
    readJson('luthier_orders', INITIAL_ORDERS, isArray<Order>)
  );

  const [stock, setStock] = useState<StockItem[]>(() =>
    readJson('luthier_stock', INITIAL_STOCK, isArray<StockItem>)
  );

  const [payments, setPayments] = useState<Payment[]>(() =>
    readJson('luthier_payments', INITIAL_PAYMENTS, isArray<Payment>)
  );

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() =>
    readJson('luthier_movements', INITIAL_MOVEMENTS, isArray<StockMovement>)
  );

  // UI state
  // O papel vem do usuário logado; trocar de usuário remonta o provider.
  const currentRole: UserRole = initialRole;
  const permissions = getRolePermissions(currentRole);
  // Autor da timeline: o usuário logado de verdade (o provider é remontado por usuário).
  const actor = currentUserName ? `${currentUserName} (${permissions.roleLabel})` : permissions.roleLabel;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('online');
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>('hoje');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'Stratocaster',
    'Lucas Silveira',
    'OS 1042',
    'Cavalete',
  ]);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderSheetFocus, setOrderSheetFocus] = useState<'pagamento' | null>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [isNewOrderWizardOpen, setIsNewOrderWizardOpen] = useState<boolean>(false);
  const [isWorkbenchModeOpen, setIsWorkbenchModeOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return readString('luthier_dark_mode') === 'true';
  });

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraCallback, setCameraCallback] = useState<CameraCallback | null>(null);
  const [cameraDefaultTag, setCameraDefaultTag] = useState<PhotoTag>('bancada');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [barcodeCallback, setBarcodeCallback] = useState<((code: string) => void) | null>(null);

  useEffect(() => {
    writeString('luthier_dark_mode', String(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 4500;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync to localStorage. Se a gravação falhar (cota cheia, storage bloqueado),
  // avisa uma única vez até a próxima gravação bem-sucedida.
  const storageWarnedRef = useRef(false);
  const persist = useCallback(
    (key: string, value: unknown) => {
      if (!isPersistenceEnabled) return;
      if (writeJson(key, value)) {
        storageWarnedRef.current = false;
        return;
      }
      if (storageWarnedRef.current) return;
      storageWarnedRef.current = true;
      showToast({
        title: 'Armazenamento do aparelho cheio',
        description: 'As últimas alterações não foram salvas. Remova fotos ou exporte dados.',
        type: 'error',
        duration: 8000,
      });
    },
    [showToast, isPersistenceEnabled]
  );

  useEffect(() => persist('luthier_clients', clients), [persist, clients]);
  useEffect(() => persist('luthier_instruments', instruments), [persist, instruments]);
  useEffect(() => persist('luthier_orders', orders), [persist, orders]);
  useEffect(() => persist('luthier_stock', stock), [persist, stock]);
  useEffect(() => persist('luthier_payments', payments), [persist, payments]);
  useEffect(() => persist('luthier_movements', stockMovements), [persist, stockMovements]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
    triggerHaptic();
  }, [triggerHaptic]);

  const toggleSyncStatus = useCallback(() => {
    triggerHaptic();
    setSyncStatus((prev) => {
      if (prev === 'online') {
        showToast({
          title: 'Modo Offline Ativado',
          description: 'Ações da oficina serão enfileiradas e salvas localmente.',
          type: 'info',
        });
        return 'offline';
      }
      if (prev === 'offline') {
        setSyncStatus('sincronizando');
        setTimeout(() => {
          setSyncStatus('online');
          setOfflineQueueCount(0);
          showToast({
            title: 'Sincronização Concluída',
            description: 'Todas as ordens e fotos foram sincronizadas com sucesso.',
            type: 'success',
          });
        }, 1200);
        return 'sincronizando';
      }
      return 'online';
    });
  }, [triggerHaptic, showToast]);

  // Aviso vindo de fora do provider (ex.: troca de perfil), mostrado uma vez ao montar.
  const initialNoticeShownRef = useRef(false);
  useEffect(() => {
    if (!initialNotice || initialNoticeShownRef.current) return;
    initialNoticeShownRef.current = true;
    showToast(initialNotice);
  }, [initialNotice, showToast]);

  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== query.toLowerCase());
      return [query, ...filtered].slice(0, 6);
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
  }, []);

  // Leitura síncrona do estoque: várias baixas no mesmo clique enxergam o saldo já atualizado.
  const stockRef = useRef(stock);
  useEffect(() => {
    stockRef.current = stock;
  }, [stock]);

  // Toda escrita no estoque passa por aqui: o ref fica em dia na hora, não só depois do render.
  const mutateStock = useCallback((fn: (prev: StockItem[]) => StockItem[]) => {
    stockRef.current = fn(stockRef.current);
    setStock(stockRef.current);
  }, []);

  // Avisa e devolve false quando o papel atual não pode executar a ação.
  const denyUnless = useCallback(
    (allowed: boolean, action: string): boolean => {
      if (allowed) return true;
      showToast({
        title: 'Ação não permitida para o seu perfil',
        description: `${action} é exclusivo do Luthier / Dono.`,
        type: 'warning',
      });
      return false;
    },
    [showToast]
  );

  // Movimento de estoque (uso interno: baixas automáticas das transições de OS).
  const applyStockDelta = useCallback(
    (stockItemId: string, delta: number, reason: string, orderId?: string) => {
      const item = stockRef.current.find((s) => s.id === stockItemId);
      if (!item) {
        showToast({ title: 'Item de estoque não encontrado', type: 'warning' });
        return;
      }

      const newQty = Math.max(0, item.currentQuantity + delta);
      const applied = newQty - item.currentQuantity;

      if (delta < 0 && applied !== delta) {
        showToast({
          title: `Estoque insuficiente: ${item.name}`,
          description: `Pedido: ${Math.abs(delta)} · Disponível: ${item.currentQuantity}. Baixadas ${Math.abs(applied)}.`,
          type: 'warning',
        });
      }

      if (applied === 0 && delta !== 0) return;

      const updatedItem = { ...item, currentQuantity: newQty };
      mutateStock((prev) => prev.map((s) => (s.id === stockItemId ? updatedItem : s)));

      const movement: StockMovement = {
        id: newId('mov'),
        stockItemId,
        stockItemName: item.name,
        date: nowTimestamp(),
        type: applied > 0 ? 'entrada' : applied < 0 ? 'saida' : 'ajuste',
        quantity: Math.abs(applied),
        orderId,
        reason,
      };
      setStockMovements((prev) => [movement, ...prev]);
    },
    [showToast, mutateStock]
  );

  // Ajuste manual de estoque (tela de Estoque): exige permissão.
  const updateStockQuantity = useCallback(
    (stockItemId: string, delta: number, reason: string, orderId?: string) => {
      if (!denyUnless(permissions.canManageInventory, 'Movimentar estoque')) return;
      applyStockDelta(stockItemId, delta, reason, orderId);
    },
    [denyUnless, permissions.canManageInventory, applyStockDelta]
  );

  // Leitura síncrona das OS para validar antes de alterar (sem efeitos dentro de updaters).
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Toda escrita nas OS passa por aqui: quem lê o ref logo depois (no mesmo handler) já vê a mudança.
  const mutateOrders = useCallback((fn: (prev: Order[]) => Order[]) => {
    ordersRef.current = fn(ordersRef.current);
    setOrders(ordersRef.current);
  }, []);

  /** Aplica uma mudança a uma OS a partir da versão mais recente dela. */
  const mutateOrder = useCallback(
    (orderId: string, fn: (order: Order) => Order) => {
      mutateOrders((prev) => prev.map((o) => (o.id === orderId ? fn(o) : o)));
    },
    [mutateOrders]
  );

  const commitOrder = useCallback(
    (updated: Order) => mutateOrder(updated.id, () => updated),
    [mutateOrder]
  );

  const deductParts = useCallback(
    (order: Order, reason: string) => {
      partsToDeduct(order).forEach((part) =>
        applyStockDelta(part.stockItemId, -part.quantity, reason, order.id)
      );
    },
    [applyStockDelta]
  );

  // Advance Order Status
  const advanceOrderStatus = useCallback(
    (orderId: string, specificStatus?: OrderStatus, note?: string) => {
      triggerHaptic();

      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!order) return;

      const target = specificStatus ?? nextStatus(order.status);
      if (!target) {
        showToast({ title: `OS #${order.orderNumber} já foi finalizada`, type: 'info' });
        return;
      }

      const check = canTransition(order, target, { allowStepBack: currentRole === 'luthier' });
      if (!check.ok) {
        showToast({ title: 'Mudança de status bloqueada', description: check.reason, type: 'warning' });
        return;
      }

      // Entrega com saldo em aberto: primeiro o pagamento (abre a OS no formulário).
      const balance = remainingBalance(order);
      if (target === 'entregue' && balance > 0) {
        showToast({
          title: 'Registre o pagamento antes da entrega',
          description: `Saldo em aberto: R$ ${balance.toFixed(2)}.`,
          type: 'warning',
        });
        setActiveOrderId(orderId);
        setOrderSheetFocus('pagamento');
        return;
      }

      const alreadyDeducted = isPartsDeducted(order);
      const deductNow = target === 'em_execucao' && !alreadyDeducted;


      const newTimelineEvent = {
        id: newId('tl'),
        timestamp: nowTimestamp(),
        type: 'status_change' as const,
        title: `Status alterado para ${target.toUpperCase()}`,
        description: note || STATUS_DESCRIPTIONS[target],
        user: actor,
      };

      const updated: Order = {
        ...order,
        status: target,
        completedDate: target === 'pronto' ? todayDate() : order.completedDate,
        deliveredDate: target === 'entregue' ? todayDate() : order.deliveredDate,
        partsDeducted: alreadyDeducted || deductNow,
        quote:
          target === 'aguardando_aprovacao' && !order.quote ? buildPendingQuote(order) : order.quote,
        timeline: [newTimelineEvent, ...order.timeline],
      };
      commitOrder(updated);

      if (deductNow) {
        deductParts(order, `Baixa automática: OS #${order.orderNumber} em execução`);
      }

      if (target === 'pronto' || target === 'entregue') {
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
        } catch {
          // ignore
        }
      }

      // Desfazer só quando a transição não mexeu no estoque.
      const undo = deductNow
        ? {}
        : {
            undoLabel: 'Desfazer',
            undoAction: () => {
              const current = ordersRef.current.find((o) => o.id === orderId);
              const reverted =
                current && revertTransition(current, order, target, newTimelineEvent.id);
              if (!reverted) {
                showToast({
                  title: 'Não foi possível desfazer',
                  description: `A OS #${order.orderNumber} mudou de status depois disso.`,
                  type: 'warning',
                });
                return;
              }
              commitOrder(reverted);
              showToast({
                title: `OS #${order.orderNumber} restaurada`,
                description: `Status voltou para ${order.status}`,
                type: 'info',
              });
            },
          };

      showToast({
        title: `OS #${order.orderNumber} avançou para ${target}`,
        description: deductNow
          ? 'Peças baixadas do estoque. Alteração registrada na linha do tempo.'
          : 'Alteração registrada na linha do tempo.',
        type: 'success',
        ...undo,
      });

      if (syncStatus === 'offline') {
        setOfflineQueueCount((c) => c + 1);
      }
    },
    [currentRole, triggerHaptic, showToast, commitOrder, deductParts, syncStatus]
  );

  const deliverOrder = useCallback(
    (orderId: string, note = 'Entregue ao cliente no balcão') => {
      if (!denyUnless(permissions.canRegisterDelivery, 'Registrar entrega')) return;
      advanceOrderStatus(orderId, 'entregue', note);
    },
    [advanceOrderStatus, denyUnless, permissions.canRegisterDelivery]
  );

  const updateOrder = useCallback(
    (orderId: string, updates: Partial<Order>) => {
      mutateOrder(orderId, (o) => ({ ...o, ...updates }));
    },
    [mutateOrder]
  );

  const addServiceItem = useCallback(
    (orderId: string, serviceData: Omit<ServiceItem, 'id'>) => {
      if (!denyUnless(permissions.canModifyPricingAndParts, 'Alterar serviços e preços')) return;
      const newService: ServiceItem = {
        ...serviceData,
        id: newId('srv'),
      };

      mutateOrder(orderId, (order) => {
        const updatedServices = [...order.services, newService];
        // totalAmount é sempre o total já com desconto (antes ignorava o desconto).
        const totals = computeOrderTotals(updatedServices, order.quote?.discount ?? 0);

        return {
          ...order,
          services: updatedServices,
          totalAmount: totals.grandTotal,
          quote: order.quote ? { ...order.quote, ...totals } : order.quote,
        };
      });
    },
    [denyUnless, permissions.canModifyPricingAndParts, mutateOrder]
  );

  const toggleServiceDone = useCallback(
    (orderId: string, serviceId: string) => {
      triggerHaptic();
      mutateOrder(orderId, (order) => ({
        ...order,
        services: order.services.map((s) => (s.id === serviceId ? { ...s, done: !s.done } : s)),
      }));
    },
    [triggerHaptic, mutateOrder]
  );

  const addOrderPhoto = useCallback(
    (orderId: string, photoData: Omit<Photo, 'id' | 'timestamp'>) => {
      const newPhoto: Photo = {
        ...photoData,
        id: newId('ph'),
        timestamp: nowTimestamp(),
      };

      mutateOrder(orderId, (order) => ({
        ...order,
        photos: [newPhoto, ...order.photos],
        timeline: [
          {
            id: newId('tl'),
            timestamp: newPhoto.timestamp,
            type: 'photo_added',
            title: `Nova foto adicionada: ${newPhoto.tag}`,
            description: newPhoto.caption,
            user: actor,
          },
          ...order.timeline,
        ],
      }));

      showToast({
        title: 'Foto registrada com sucesso',
        description: 'Disponível na galeria e no portal do cliente.',
        type: 'success',
      });
    },
    [currentRole, showToast, mutateOrder]
  );

  const approveQuote = useCallback(
    (orderId: string) => {
      triggerHaptic();
      if (!permissions.canApproveClientQuote) {
        showToast({
          title: 'Ação não permitida para o seu perfil',
          description: 'A aprovação do orçamento é feita pelo cliente ou pelo Luthier / Dono.',
          type: 'warning',
        });
        return;
      }

      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!order || !order.quote || !canApproveQuote(order)) {
        showToast({
          title: 'Orçamento não pode ser aprovado agora',
          description: 'Só é possível aprovar um orçamento pendente com a OS aguardando aprovação.',
          type: 'warning',
        });
        return;
      }

      const timestamp = nowTimestamp();
      const deductNow = !isPartsDeducted(order);

      const updated: Order = {
        ...order,
        status: 'em_execucao',
        partsDeducted: true,
        quote: { ...order.quote, status: 'aprovado', answeredAt: timestamp },
        timeline: [
          {
            id: newId('tl'),
            timestamp,
            type: 'quote_approved',
            title: 'Orçamento APROVADO pelo cliente',
            description: 'Autorização recebida com sucesso. OS liberada para execução na bancada.',
            user: currentRole === 'cliente' ? `${actor} pelo portal` : actor,
          },
          {
            id: newId('tl-exec'),
            timestamp,
            type: 'status_change',
            title: 'Status: EM EXECUÇÃO',
            description: 'Instrumento pronto para receber os serviços cadastrados.',
            user: 'Sistema Luthieria',
          },
          ...order.timeline,
        ],
      };
      commitOrder(updated);

      if (deductNow) {
        deductParts(order, `Aprovação de orçamento OS #${order.orderNumber}`);
      }

      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch {
        // ignore
      }

      showToast({
        title: 'Orçamento Aprovado!',
        description: 'Status avançado para Em Execução e peças reservadas.',
        type: 'success',
      });
    },
    [triggerHaptic, commitOrder, deductParts, currentRole, showToast, permissions.canApproveClientQuote]
  );

  const rejectQuote = useCallback(
    (orderId: string, reason: string) => {
      triggerHaptic();
      mutateOrder(orderId, (order) => {
        const timestamp = nowTimestamp();
        return {
          ...order,
          quote: order.quote
            ? {
                ...order.quote,
                status: 'rejeitado',
                answeredAt: timestamp,
                rejectionReason: reason,
              }
            : undefined,
          timeline: [
            {
              id: newId('tl'),
              timestamp,
              type: 'quote_rejected',
              title: 'Orçamento Recusado',
              description: `Motivo: ${reason}`,
              user: currentRole === 'cliente' ? `${actor} pelo portal` : actor,
            },
            ...order.timeline,
          ],
        };
      });

      showToast({
        title: 'Recusa registrada',
        description: 'Você pode reajustar o orçamento com o cliente.',
        type: 'warning',
      });
    },
    [triggerHaptic, currentRole, showToast, mutateOrder]
  );

  const createOrder = useCallback(
    (orderData: Partial<Order>, clientId: string, instrumentId: string) => {
      triggerHaptic();
      const nextNumber = Math.max(...ordersRef.current.map((o) => o.orderNumber), 1040) + 1;
      const client = clients.find((c) => c.id === clientId);
      const tokenInitials = client ? client.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : 'OS';
      const clientTrackingToken = `${tokenInitials}-${nextNumber}-${Math.floor(10 + Math.random() * 90)}`;

      const services = orderData.services || [];
      const totals = computeOrderTotals(services);
      const totalAmount = totals.grandTotal;

      const newOrder: Order = {
        id: 'ord-' + nextNumber,
        orderNumber: nextNumber,
        clientId,
        instrumentId,
        status: (orderData.status as OrderStatus) || 'recebido',
        priority: orderData.priority || 'normal',
        reportedIssue: orderData.reportedIssue || 'Revisão e regulagem geral',
        diagnosisNotes: orderData.diagnosisNotes || '',
        entryDate: todayDate(),
        estimatedDeliveryDate:
          orderData.estimatedDeliveryDate ||
          addDays(5),
        services,
        quote: {
          id: 'qt-' + nextNumber,
          orderId: 'ord-' + nextNumber,
          ...totals,
          status: 'pendente',
          paymentTerms: DEFAULT_PAYMENT_TERMS,
        },
        photos: orderData.photos || [],
        timeline: [
          {
            id: newId('tl'),
            timestamp: nowTimestamp(),
            type: 'status_change',
            title: 'Ordem de Serviço Aberta',
            description: `OS #${nextNumber} criada na recepção com previsão de 5 dias úteis.`,
            user: actor,
          },
        ],
        technicianNotes: orderData.technicianNotes || '',
        totalAmount,
        paidAmount: 0,
        clientTrackingToken,
      };

      mutateOrders((prev) => [newOrder, ...prev]);

      if (syncStatus === 'offline') {
        setOfflineQueueCount((c) => c + 1);
      }

      showToast({
        title: `OS #${nextNumber} aberta com sucesso!`,
        description: 'Pronta para diagnóstico e envio de link ao cliente.',
        type: 'success',
      });

      return newOrder;
    },
    [clients, currentRole, syncStatus, triggerHaptic, showToast, mutateOrders]
  );

  const createClient = useCallback(
    (clientData: Omit<Client, 'id' | 'createdAt'>) => {
      triggerHaptic();
      const newClient: Client = {
        ...clientData,
        id: newId('cli'),
        createdAt: todayDate(),
      };
      setClients((prev) => [newClient, ...prev]);
      showToast({
        title: `Cliente ${newClient.name} cadastrado`,
        type: 'success',
      });
      return newClient;
    },
    [triggerHaptic, showToast]
  );

  const createInstrument = useCallback(
    (instrumentData: Omit<Instrument, 'id' | 'createdAt' | 'photos'>, photos: Photo[] = []) => {
      triggerHaptic();
      const newInst: Instrument = {
        ...instrumentData,
        id: newId('inst'),
        photos,
        createdAt: todayDate(),
      };
      setInstruments((prev) => [newInst, ...prev]);
      showToast({
        title: `${newInst.brand} ${newInst.model} registrado`,
        type: 'success',
      });
      return newInst;
    },
    [triggerHaptic, showToast]
  );

  const recordPayment = useCallback(
    (paymentData: Omit<Payment, 'id' | 'receiptNumber'>) => {
      triggerHaptic();
      if (!permissions.canRegisterDelivery) {
        showToast({ title: 'Ação não permitida para o seu perfil', type: 'warning' });
        return null;
      }
      const receiptNumber = 'REC-2026-' + (payments.length + 100);
      const newPayment: Payment = {
        ...paymentData,
        id: newId('pay'),
        receiptNumber,
      };

      setPayments((prev) => [newPayment, ...prev]);

      // update order's paidAmount
      mutateOrder(paymentData.orderId, (order) => ({
        ...order,
        paidAmount: (order.paidAmount || 0) + paymentData.amount,
        timeline: [
          {
            id: newId('tl'),
            timestamp: paymentData.date,
            type: 'payment_received',
            title: `Pagamento recebido: R$ ${paymentData.amount.toFixed(2)} (${paymentData.method.toUpperCase()})`,
            description: `Recibo gerado: ${receiptNumber}`,
            user: actor,
          },
          ...order.timeline,
        ],
      }));

      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.7 },
        });
      } catch {
        // ignore
      }

      showToast({
        title: `Pagamento de R$ ${paymentData.amount.toFixed(2)} registrado!`,
        description: `Recibo #${receiptNumber} pronto para envio.`,
        type: 'success',
      });

      return newPayment;
    },
    [payments.length, currentRole, triggerHaptic, showToast, permissions.canRegisterDelivery, mutateOrder]
  );

  const openCamera = useCallback((callback: CameraCallback, defaultTag: PhotoTag = 'bancada') => {
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

  const resetToDefaults = useCallback(() => {
    if (!denyUnless(permissions.canResetDemoData, 'Restaurar dados de demonstração')) return;
    removeKeys(BUSINESS_DATA_KEYS);
    setClients(INITIAL_CLIENTS);
    setInstruments(INITIAL_INSTRUMENTS);
    mutateOrders(() => INITIAL_ORDERS);
    mutateStock(() => INITIAL_STOCK);
    setPayments(INITIAL_PAYMENTS);
    setStockMovements(INITIAL_MOVEMENTS);
    showToast({
      title: 'Dados restaurados para o padrão de demonstração!',
      type: 'info',
    });
  }, [showToast, denyUnless, permissions.canResetDemoData, mutateOrders, mutateStock]);

  return (
    <AppContext.Provider
      value={{
        clients,
        instruments,
        orders,
        stock,
        payments,
        stockMovements,
        currentRole,
        syncStatus,
        offlineQueueCount,
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
        toggleSyncStatus,
        triggerHaptic,
        showToast,
        dismissToast,
        advanceOrderStatus,
        updateOrder,
        createOrder,
        addServiceItem,
        toggleServiceDone,
        addOrderPhoto,
        approveQuote,
        deliverOrder,
        orderSheetFocus,
        setOrderSheetFocus,
        activeClientId,
        setActiveClientId,
        rejectQuote,
        createClient,
        createInstrument,
        updateStockQuantity,
        recordPayment,
        openCamera,
        closeCamera,
        openBarcodeScanner,
        closeBarcodeScanner,
        resetToDefaults,
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
