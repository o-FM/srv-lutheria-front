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
import {
  buildPendingQuote,
  canApproveQuote,
  canTransition,
  isPartsDeducted,
  nextStatus,
  partsToDeduct,
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
  isNewOrderWizardOpen: boolean;
  isWorkbenchModeOpen: boolean;
  isDarkMode: boolean;
  toasts: ToastMessage[];

  // Modals & Camera Callbacks
  isCameraModalOpen: boolean;
  cameraCallback: ((photoUrl: string, caption?: string) => void) | null;
  isBarcodeModalOpen: boolean;
  barcodeCallback: ((code: string) => void) | null;

  // Actions
  setRole: (role: UserRole) => void;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setIsSearchOpen: (open: boolean) => void;
  setActiveOrderId: (id: string | null) => void;
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
  rejectQuote: (orderId: string, reason: string) => void;

  createClient: (clientData: Omit<Client, 'id' | 'createdAt'>) => Client;
  createInstrument: (instrumentData: Omit<Instrument, 'id' | 'createdAt' | 'photos'>, photos?: Photo[]) => Instrument;

  updateStockQuantity: (stockItemId: string, delta: number, reason: string, orderId?: string) => void;
  recordPayment: (payment: Omit<Payment, 'id' | 'receiptNumber'>) => Payment;

  openCamera: (callback: (photoUrl: string, caption?: string) => void) => void;
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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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
  const [currentRole, setRoleState] = useState<UserRole>('luthier');
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
  const [isNewOrderWizardOpen, setIsNewOrderWizardOpen] = useState<boolean>(false);
  const [isWorkbenchModeOpen, setIsWorkbenchModeOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Dark mode
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return readString('luthier_dark_mode') === 'true';
  });

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraCallback, setCameraCallback] = useState<((photoUrl: string, caption?: string) => void) | null>(null);
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
    [showToast]
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

  const setRole = useCallback(
    (role: UserRole) => {
      setRoleState(role);
      triggerHaptic();
      const roleLabels: Record<UserRole, string> = {
        luthier: 'Luthier / Dono (Bancada & Gestão)',
        atendente: 'Atendente / Balcão (Recepção & OS Rápida)',
        cliente: 'Visão do Cliente (Portal sem senha)',
      };
      showToast({
        title: `Perfil alterado para ${roleLabels[role]}`,
        type: 'info',
        duration: 2500,
      });
    },
    [triggerHaptic, showToast]
  );

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

  // Update Stock with log
  const updateStockQuantity = useCallback(
    (stockItemId: string, delta: number, reason: string, orderId?: string) => {
      setStock((prev) =>
        prev.map((item) => {
          if (item.id === stockItemId) {
            const newQty = Math.max(0, item.currentQuantity + delta);
            return { ...item, currentQuantity: newQty };
          }
          return item;
        })
      );

      const targetItem = stock.find((s) => s.id === stockItemId);
      if (targetItem) {
        const movement: StockMovement = {
          id: 'mov-' + Date.now(),
          stockItemId,
          stockItemName: targetItem.name,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: delta > 0 ? 'entrada' : delta < 0 ? 'saida' : 'ajuste',
          quantity: Math.abs(delta),
          orderId,
          reason,
        };
        setStockMovements((prev) => [movement, ...prev]);
      }
    },
    [stock]
  );

  // Leitura síncrona das OS para validar antes de alterar (sem efeitos dentro de setOrders).
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const commitOrder = useCallback((updated: Order) => {
    ordersRef.current = ordersRef.current.map((o) => (o.id === updated.id ? updated : o));
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }, []);

  const deductParts = useCallback(
    (order: Order, reason: string) => {
      partsToDeduct(order).forEach((part) =>
        updateStockQuantity(part.stockItemId, -part.quantity, reason, order.id)
      );
    },
    [updateStockQuantity]
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

      const alreadyDeducted = isPartsDeducted(order);
      const deductNow = target === 'em_execucao' && !alreadyDeducted;

      // Timeline event title & user description
      const userLabel =
        currentRole === 'luthier'
          ? 'Armando (Luthier)'
          : currentRole === 'atendente'
          ? 'Mariana (Balcão)'
          : 'Cliente';

      const newTimelineEvent = {
        id: 'tl-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'status_change' as const,
        title: `Status alterado para ${target.toUpperCase()}`,
        description: note || STATUS_DESCRIPTIONS[target],
        user: userLabel,
      };

      const updated: Order = {
        ...order,
        status: target,
        completedDate: target === 'pronto' ? new Date().toISOString().substring(0, 10) : order.completedDate,
        deliveredDate: target === 'entregue' ? new Date().toISOString().substring(0, 10) : order.deliveredDate,
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
              commitOrder(order);
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

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o))
    );
  }, []);

  const addServiceItem = useCallback(
    (orderId: string, serviceData: Omit<ServiceItem, 'id'>) => {
      const newService: ServiceItem = {
        ...serviceData,
        id: 'srv-' + Date.now(),
      };

      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const updatedServices = [...order.services, newService];
          const laborTotal = updatedServices.reduce((acc, s) => acc + s.laborPrice, 0);
          const partsTotal = updatedServices.reduce(
            (acc, s) => acc + s.partsUsed.reduce((pAcc, p) => pAcc + p.unitPrice * p.quantity, 0),
            0
          );
          const grandTotal = laborTotal + partsTotal;

          return {
            ...order,
            services: updatedServices,
            totalAmount: grandTotal,
            quote: order.quote
              ? {
                  ...order.quote,
                  laborTotal,
                  partsTotal,
                  grandTotal: grandTotal - (order.quote.discount || 0),
                }
              : order.quote,
          };
        })
      );
    },
    []
  );

  const toggleServiceDone = useCallback(
    (orderId: string, serviceId: string) => {
      triggerHaptic();
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const updatedServices = order.services.map((s) =>
            s.id === serviceId ? { ...s, done: !s.done } : s
          );
          return {
            ...order,
            services: updatedServices,
          };
        })
      );
    },
    [triggerHaptic]
  );

  const addOrderPhoto = useCallback(
    (orderId: string, photoData: Omit<Photo, 'id' | 'timestamp'>) => {
      const newPhoto: Photo = {
        ...photoData,
        id: 'ph-' + Date.now(),
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };

      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          return {
            ...order,
            photos: [newPhoto, ...order.photos],
            timeline: [
              {
                id: 'tl-' + Date.now(),
                timestamp: newPhoto.timestamp,
                type: 'photo_added',
                title: `Nova foto adicionada: ${newPhoto.tag}`,
                description: newPhoto.caption,
                user: currentRole === 'luthier' ? 'Armando (Luthier)' : 'Mariana (Balcão)',
              },
              ...order.timeline,
            ],
          };
        })
      );

      showToast({
        title: 'Foto registrada com sucesso',
        description: 'Disponível na galeria e no portal do cliente.',
        type: 'success',
      });
    },
    [currentRole, showToast]
  );

  const approveQuote = useCallback(
    (orderId: string) => {
      triggerHaptic();

      const order = ordersRef.current.find((o) => o.id === orderId);
      if (!order || !order.quote || !canApproveQuote(order)) {
        showToast({
          title: 'Orçamento não pode ser aprovado agora',
          description: 'Só é possível aprovar um orçamento pendente com a OS aguardando aprovação.',
          type: 'warning',
        });
        return;
      }

      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const deductNow = !isPartsDeducted(order);

      const updated: Order = {
        ...order,
        status: 'em_execucao',
        partsDeducted: true,
        quote: { ...order.quote, status: 'aprovado', answeredAt: timestamp },
        timeline: [
          {
            id: 'tl-' + Date.now(),
            timestamp,
            type: 'quote_approved',
            title: 'Orçamento APROVADO pelo cliente',
            description: 'Autorização recebida com sucesso. OS liberada para execução na bancada.',
            user: currentRole === 'cliente' ? 'Cliente (Portal)' : 'Mariana (Balcão)',
          },
          {
            id: 'tl-exec-' + Date.now(),
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
    [triggerHaptic, commitOrder, deductParts, currentRole, showToast]
  );

  const rejectQuote = useCallback(
    (orderId: string, reason: string) => {
      triggerHaptic();
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
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
                id: 'tl-' + Date.now(),
                timestamp,
                type: 'quote_rejected',
                title: 'Orçamento Recusado',
                description: `Motivo: ${reason}`,
                user: currentRole === 'cliente' ? 'Cliente' : 'Atendente',
              },
              ...order.timeline,
            ],
          };
        })
      );

      showToast({
        title: 'Recusa registrada',
        description: 'Você pode reajustar o orçamento com o cliente.',
        type: 'warning',
      });
    },
    [triggerHaptic, currentRole, showToast]
  );

  const createOrder = useCallback(
    (orderData: Partial<Order>, clientId: string, instrumentId: string) => {
      triggerHaptic();
      const nextNumber = Math.max(...orders.map((o) => o.orderNumber), 1040) + 1;
      const client = clients.find((c) => c.id === clientId);
      const tokenInitials = client ? client.name.split(' ').map((n) => n[0]).join('').slice(0, 2) : 'OS';
      const clientTrackingToken = `${tokenInitials}-${nextNumber}-${Math.floor(10 + Math.random() * 90)}`;

      const services = orderData.services || [];
      const laborTotal = services.reduce((acc, s) => acc + s.laborPrice, 0);
      const partsTotal = services.reduce(
        (acc, s) => acc + s.partsUsed.reduce((pAcc, p) => pAcc + p.unitPrice * p.quantity, 0),
        0
      );
      const totalAmount = laborTotal + partsTotal;

      const newOrder: Order = {
        id: 'ord-' + nextNumber,
        orderNumber: nextNumber,
        clientId,
        instrumentId,
        status: (orderData.status as OrderStatus) || 'recebido',
        priority: orderData.priority || 'normal',
        reportedIssue: orderData.reportedIssue || 'Revisão e regulagem geral',
        diagnosisNotes: orderData.diagnosisNotes || '',
        entryDate: new Date().toISOString().substring(0, 10),
        estimatedDeliveryDate:
          orderData.estimatedDeliveryDate ||
          new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().substring(0, 10),
        services,
        quote: {
          id: 'qt-' + nextNumber,
          orderId: 'ord-' + nextNumber,
          laborTotal,
          partsTotal,
          discount: 0,
          grandTotal: totalAmount,
          status: 'pendente',
          paymentTerms: '50% entrada + 50% na entrega',
        },
        photos: orderData.photos || [],
        timeline: [
          {
            id: 'tl-' + Date.now(),
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            type: 'status_change',
            title: 'Ordem de Serviço Aberta',
            description: `OS #${nextNumber} criada na recepção com previsão de 5 dias úteis.`,
            user: currentRole === 'luthier' ? 'Armando (Luthier)' : 'Mariana (Balcão)',
          },
        ],
        technicianNotes: orderData.technicianNotes || '',
        totalAmount,
        paidAmount: 0,
        clientTrackingToken,
      };

      setOrders((prev) => [newOrder, ...prev]);

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
    [orders, clients, currentRole, syncStatus, triggerHaptic, showToast]
  );

  const createClient = useCallback(
    (clientData: Omit<Client, 'id' | 'createdAt'>) => {
      triggerHaptic();
      const newClient: Client = {
        ...clientData,
        id: 'cli-' + Date.now(),
        createdAt: new Date().toISOString().substring(0, 10),
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
        id: 'inst-' + Date.now(),
        photos,
        createdAt: new Date().toISOString().substring(0, 10),
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
      const receiptNumber = 'REC-2026-' + (payments.length + 100);
      const newPayment: Payment = {
        ...paymentData,
        id: 'pay-' + Date.now(),
        receiptNumber,
      };

      setPayments((prev) => [newPayment, ...prev]);

      // update order's paidAmount
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== paymentData.orderId) return order;
          const updatedPaid = (order.paidAmount || 0) + paymentData.amount;
          return {
            ...order,
            paidAmount: updatedPaid,
            timeline: [
              {
                id: 'tl-' + Date.now(),
                timestamp: paymentData.date,
                type: 'payment_received',
                title: `Pagamento recebido: R$ ${paymentData.amount.toFixed(2)} (${paymentData.method.toUpperCase()})`,
                description: `Recibo gerado: ${receiptNumber}`,
                user: currentRole === 'luthier' ? 'Armando (Luthier)' : 'Mariana (Balcão)',
              },
              ...order.timeline,
            ],
          };
        })
      );

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
    [payments.length, currentRole, triggerHaptic, showToast]
  );

  const openCamera = useCallback((callback: (photoUrl: string, caption?: string) => void) => {
    setCameraCallback(() => callback);
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
    removeKeys(BUSINESS_DATA_KEYS);
    setClients(INITIAL_CLIENTS);
    setInstruments(INITIAL_INSTRUMENTS);
    setOrders(INITIAL_ORDERS);
    setStock(INITIAL_STOCK);
    setPayments(INITIAL_PAYMENTS);
    setStockMovements(INITIAL_MOVEMENTS);
    showToast({
      title: 'Dados restaurados para o padrão de demonstração!',
      type: 'info',
    });
  }, [showToast]);

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
        isBarcodeModalOpen,
        barcodeCallback,
        setRole,
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
