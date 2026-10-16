import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
import { USE_BACKEND } from '../services/apiClient';
import {
  backendApi,
  OrderDto,
  PARTS_ONLY_SERVICE_ID,
  paymentsFromOrder,
  toClient,
  toInstrument,
  toOrder,
  toStockItem,
  toStockMovement,
} from '../services/backendApi';
import { useAuth } from './AuthContext';

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
  /** true quando os dados vêm do backend srv-lutheria (VITE_API_URL). */
  isBackendMode: boolean;
  isLoadingData: boolean;
  reloadData: () => Promise<void>;

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
  createOrder: (orderData: Partial<Order>, clientId: string, instrumentId: string) => Promise<Order>;
  addServiceItem: (orderId: string, service: Omit<ServiceItem, 'id'>) => void;
  toggleServiceDone: (orderId: string, serviceId: string) => void;
  addOrderPhoto: (orderId: string, photo: Omit<Photo, 'id' | 'timestamp'>) => void;
  approveQuote: (orderId: string) => void;
  rejectQuote: (orderId: string, reason: string) => void;

  createClient: (clientData: Omit<Client, 'id' | 'createdAt'>) => Promise<Client>;
  createInstrument: (
    instrumentData: Omit<Instrument, 'id' | 'createdAt' | 'photos'>,
    photos?: Photo[]
  ) => Promise<Instrument>;

  updateStockQuantity: (stockItemId: string, delta: number, reason: string, orderId?: string) => void;
  recordPayment: (payment: Omit<Payment, 'id' | 'receiptNumber'>) => Promise<Payment>;

  openCamera: (callback: (photoUrl: string, caption?: string) => void) => void;
  closeCamera: () => void;
  openBarcodeScanner: (callback: (code: string) => void) => void;
  closeBarcodeScanner: () => void;

  resetToDefaults: () => void;
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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load from localStorage or seed
  const [clients, setClients] = useState<Client[]>(() => {
    if (USE_BACKEND) return [];
    const saved = localStorage.getItem('luthier_clients');
    return saved ? JSON.parse(saved) : INITIAL_CLIENTS;
  });

  const [instruments, setInstruments] = useState<Instrument[]>(() => {
    if (USE_BACKEND) return [];
    const saved = localStorage.getItem('luthier_instruments');
    return saved ? JSON.parse(saved) : INITIAL_INSTRUMENTS;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    if (USE_BACKEND) return [];
    const saved = localStorage.getItem('luthier_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [stock, setStock] = useState<StockItem[]>(() => {
    if (USE_BACKEND) return [];
    const saved = localStorage.getItem('luthier_stock');
    return saved ? JSON.parse(saved) : INITIAL_STOCK;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    if (USE_BACKEND) return [];
    const saved = localStorage.getItem('luthier_payments');
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    if (USE_BACKEND) return [];
    const saved = localStorage.getItem('luthier_movements');
    return saved ? JSON.parse(saved) : INITIAL_MOVEMENTS;
  });

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
    return localStorage.getItem('luthier_dark_mode') === 'true';
  });

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraCallback, setCameraCallback] = useState<((photoUrl: string, caption?: string) => void) | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [barcodeCallback, setBarcodeCallback] = useState<((code: string) => void) | null>(null);

  // Sync to localStorage
  useEffect(() => {
    if (!USE_BACKEND) localStorage.setItem('luthier_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    if (!USE_BACKEND) localStorage.setItem('luthier_instruments', JSON.stringify(instruments));
  }, [instruments]);

  useEffect(() => {
    if (!USE_BACKEND) localStorage.setItem('luthier_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!USE_BACKEND) localStorage.setItem('luthier_stock', JSON.stringify(stock));
  }, [stock]);

  useEffect(() => {
    if (!USE_BACKEND) localStorage.setItem('luthier_payments', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    if (!USE_BACKEND) localStorage.setItem('luthier_movements', JSON.stringify(stockMovements));
  }, [stockMovements]);

  useEffect(() => {
    localStorage.setItem('luthier_dark_mode', String(isDarkMode));
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

  // ---------- Backend real (srv-lutheria) ----------
  const { user: authUser } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  const showApiError = useCallback(
    (err: unknown, title = 'Falha na API') => {
      showToast({
        title,
        description: err instanceof Error ? err.message : String(err),
        type: 'error',
        duration: 7000,
      });
    },
    [showToast]
  );

  /** Pagamentos vêm embutidos na OS; precisamos de cliente/instrumento para exibir. */
  const derivePayments = useCallback(
    (dtos: OrderDto[], clientList: Client[], instrumentList: Instrument[]) =>
      dtos
        .flatMap((o) => {
          const client = clientList.find((c) => c.id === o.clientId);
          const inst = instrumentList.find((i) => i.id === o.instrumentId);
          return paymentsFromOrder(o, client?.name || 'Cliente', inst ? `${inst.brand} ${inst.model}` : '');
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    []
  );

  const reloadStock = useCallback(async () => {
    const products = (await backendApi.listProducts()).map(toStockItem);
    setStock(products);
    const movements = await Promise.all(
      products.map(async (p) =>
        (await backendApi.listMovements(p.id)).content.map((m) => toStockMovement(m, p.name))
      )
    );
    setStockMovements(movements.flat().sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const reloadData = useCallback(async () => {
    if (!USE_BACKEND) return;
    setIsLoadingData(true);
    try {
      const customers = await backendApi.listCustomers();
      const clientList = customers.map(toClient);
      const instrumentList = (
        await Promise.all(customers.map((c) => backendApi.listInstruments(c.id)))
      )
        .flat()
        .map(toInstrument);
      const orderDtos = await backendApi.listOrders();

      setClients(clientList);
      setInstruments(instrumentList);
      setOrders((prev) =>
        orderDtos.map((o) => toOrder(o, prev.find((p) => p.id === o.id)))
      );
      setPayments(derivePayments(orderDtos, clientList, instrumentList));
      await reloadStock();
    } catch (err) {
      showApiError(err, 'Não foi possível carregar os dados da oficina');
    } finally {
      setIsLoadingData(false);
    }
  }, [derivePayments, reloadStock, showApiError]);

  // Carrega ao entrar / trocar de conta; limpa ao sair
  useEffect(() => {
    if (!USE_BACKEND) return;
    if (authUser) {
      reloadData();
    } else {
      setClients([]);
      setInstruments([]);
      setOrders([]);
      setStock([]);
      setPayments([]);
      setStockMovements([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  /** Token do portal: a listagem não traz, então busca o detalhe se preciso. */
  const portalToken = useCallback(
    async (order: Order) =>
      order.clientTrackingToken || (await backendApi.getOrder(order.id)).clientTrackingToken,
    []
  );

  /** Substitui a OS local pela resposta da API (mantém as fotos, que só existem no front). */
  const applyOrderDto = useCallback(
    (dto: OrderDto): Order => {
      let mapped = toOrder(dto);
      setOrders((prev) => {
        const previous = prev.find((o) => o.id === dto.id);
        mapped = toOrder(dto, previous);
        return previous ? prev.map((o) => (o.id === dto.id ? mapped : o)) : [mapped, ...prev];
      });
      const client = clients.find((c) => c.id === dto.clientId);
      const inst = instruments.find((i) => i.id === dto.instrumentId);
      const orderPayments = paymentsFromOrder(
        dto,
        client?.name || 'Cliente',
        inst ? `${inst.brand} ${inst.model}` : ''
      );
      setPayments((prev) =>
        [...prev.filter((p) => p.orderId !== dto.id), ...orderPayments].sort((a, b) =>
          b.date.localeCompare(a.date)
        )
      );
      return mapped;
    },
    [clients, instruments]
  );

  // Ao abrir uma OS, busca o detalhe (traz o token do portal e o estado mais recente)
  useEffect(() => {
    if (!USE_BACKEND || !activeOrderId) return;
    backendApi
      .getOrder(activeOrderId)
      .then(applyOrderDto)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrderId]);

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
      if (USE_BACKEND) {
        if (delta === 0) return;
        const item = stock.find((s) => s.id === stockItemId);
        backendApi
          .createMovement(stockItemId, {
            type: delta > 0 ? 'entrada' : 'saida',
            quantity: Math.abs(delta),
            reason,
            orderId,
          })
          .then((m) => {
            setStock((prev) =>
              prev.map((s) => (s.id === stockItemId ? { ...s, currentQuantity: m.balanceAfter } : s))
            );
            setStockMovements((prev) => [toStockMovement(m, item?.name || ''), ...prev]);
          })
          .catch((err) => showApiError(err, 'Falha ao movimentar o estoque'));
        return;
      }

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
    [stock, showApiError]
  );

  // Advance Order Status
  const advanceOrderStatus = useCallback(
    (orderId: string, specificStatus?: OrderStatus, note?: string) => {
      triggerHaptic();

      if (USE_BACKEND) {
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;
        let next = specificStatus;
        if (!next) {
          const idx = STATUS_FLOW.indexOf(order.status);
          if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
          next = STATUS_FLOW[idx + 1];
        }
        const target = next;
        // Na API, "aguardando_aprovacao" só via envio do orçamento e "em_execucao" só via aprovação
        const call =
          target === 'aguardando_aprovacao'
            ? backendApi.sendQuote(orderId)
            : target === 'em_execucao' && order.status === 'aguardando_aprovacao'
            ? backendApi.approveQuote(orderId)
            : backendApi.changeStatus(orderId, target, note);
        call
          .then((dto) => {
            applyOrderDto(dto);
            if (target === 'pronto' || target === 'entregue') {
              try {
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
              } catch {
                // ignore
              }
            }
            // A baixa de estoque ao ficar "pronto" é assíncrona (evento no backend)
            if (target === 'pronto') {
              setTimeout(() => reloadStock().catch(() => undefined), 1500);
            }
            showToast({
              title: `OS #${order.orderNumber} avançou para ${dto.status}`,
              description: 'Alteração registrada na API.',
              type: 'success',
            });
          })
          .catch((err) => showApiError(err, `Não foi possível mover a OS #${order.orderNumber}`));
        return;
      }

      setOrders((prev) => {
        const order = prev.find((o) => o.id === orderId);
        if (!order) return prev;

        const previousOrder = { ...order };
        let nextStatus: OrderStatus;

        if (specificStatus) {
          nextStatus = specificStatus;
        } else {
          const currentIndex = STATUS_FLOW.indexOf(order.status);
          if (currentIndex < 0 || currentIndex >= STATUS_FLOW.length - 1) {
            return prev; // already delivered or invalid
          }
          nextStatus = STATUS_FLOW[currentIndex + 1];
        }

        // Business rule: Can only go to 'em_execucao' if quote is approved or no quote needed
        if (nextStatus === 'em_execucao' && order.quote && order.quote.status !== 'aprovado') {
          showToast({
            title: 'Orçamento Pendente',
            description: 'A OS só pode ir para execução após a aprovação formal do cliente.',
            type: 'warning',
          });
          return prev;
        }

        // Timeline event title & user description
        const userLabel =
          currentRole === 'luthier'
            ? 'Armando (Luthier)'
            : currentRole === 'atendente'
            ? 'Mariana (Balcão)'
            : 'Cliente';

        const statusDescriptions: Record<OrderStatus, string> = {
          recebido: 'Instrumento acolhido na recepção',
          diagnostico: 'Instrumento posicionado na bancada para diagnóstico',
          orcamento: 'Orçamento detalhado elaborado',
          aguardando_aprovacao: 'Orçamento encaminhado para aprovação do cliente',
          em_execucao: 'Mãos à obra! Serviços iniciados na bancada',
          pronto: 'Serviços finalizados, instrumento limpo e pronto para retirada',
          entregue: 'Instrumento entregue ao músico com sucesso',
          cancelado: 'Ordem de serviço cancelada',
        };

        const newTimelineEvent = {
          id: 'tl-' + Date.now(),
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'status_change' as const,
          title: `Status alterado para ${nextStatus.toUpperCase()}`,
          description: note || statusDescriptions[nextStatus],
          user: userLabel,
        };

        // If completed or delivered, set dates
        const completedDate = nextStatus === 'pronto' ? new Date().toISOString().substring(0, 10) : order.completedDate;
        const deliveredDate = nextStatus === 'entregue' ? new Date().toISOString().substring(0, 10) : order.deliveredDate;

        // If moving to 'em_execucao', automatically deduct parts used from stock
        if (nextStatus === 'em_execucao') {
          order.services.forEach((service) => {
            service.partsUsed.forEach((part) => {
              updateStockQuantity(
                part.stockItemId,
                -part.quantity,
                `Baixa automática: OS #${order.orderNumber} em execução`,
                order.id
              );
            });
          });
        }

        // If delivered, play celebratory confetti
        if (nextStatus === 'pronto' || nextStatus === 'entregue') {
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.8 },
            });
          } catch {
            // ignore
          }
        }

        // Setup undo toast
        showToast({
          title: `OS #${order.orderNumber} avançou para ${nextStatus}`,
          description: 'Alteração registrada na linha do tempo.',
          type: 'success',
          undoLabel: 'Desfazer',
          undoAction: () => {
            setOrders((current) =>
              current.map((item) => (item.id === orderId ? previousOrder : item))
            );
            showToast({
              title: `OS #${order.orderNumber} restaurada`,
              description: `Status voltou para ${previousOrder.status}`,
              type: 'info',
            });
          },
        });

        if (syncStatus === 'offline') {
          setOfflineQueueCount((c) => c + 1);
        }

        return prev.map((item) =>
          item.id === orderId
            ? {
                ...item,
                status: nextStatus,
                completedDate,
                deliveredDate,
                timeline: [newTimelineEvent, ...item.timeline],
              }
            : item
        );
      });
    },
    [currentRole, triggerHaptic, showToast, updateStockQuantity, syncStatus, orders, applyOrderDto,
      reloadStock, showApiError]
  );

  const updateOrder = useCallback(
    (orderId: string, updates: Partial<Order>) => {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
      if (USE_BACKEND) {
        backendApi
          .updateOrder(orderId, {
            priority: updates.priority,
            diagnosisNotes: updates.diagnosisNotes,
            technicianNotes: updates.technicianNotes,
            estimatedDeliveryDate: updates.estimatedDeliveryDate,
            discount: updates.quote?.discount,
            paymentTerms: updates.quote?.paymentTerms,
          })
          .then(applyOrderDto)
          .catch((err) => showApiError(err, 'Não foi possível atualizar a OS'));
      }
    },
    [applyOrderDto, showApiError]
  );

  const addServiceItem = useCallback(
    (orderId: string, serviceData: Omit<ServiceItem, 'id'>) => {
      if (USE_BACKEND) {
        backendApi
          .addService(orderId, {
            title: serviceData.title,
            description: serviceData.description,
            laborPrice: serviceData.laborPrice,
          })
          .then(async (dto) => {
            for (const part of serviceData.partsUsed) {
              dto = await backendApi.addPart(orderId, part.stockItemId, part.quantity);
            }
            applyOrderDto(dto);
          })
          .catch((err) => showApiError(err, 'Não foi possível adicionar o serviço'));
        return;
      }

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
    [applyOrderDto, showApiError]
  );

  const toggleServiceDone = useCallback(
    (orderId: string, serviceId: string) => {
      triggerHaptic();
      if (USE_BACKEND) {
        const service = orders
          .find((o) => o.id === orderId)
          ?.services.find((s) => s.id === serviceId);
        if (!service || service.id === PARTS_ONLY_SERVICE_ID) return;
        if (service.done) {
          showToast({
            title: 'Serviço já concluído',
            description: 'A API não permite reabrir um serviço concluído.',
            type: 'info',
          });
          return;
        }
        backendApi
          .markServiceDone(orderId, serviceId)
          .then(applyOrderDto)
          .catch((err) => showApiError(err, 'Não foi possível concluir o serviço'));
        return;
      }
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
    [triggerHaptic, orders, applyOrderDto, showApiError, showToast]
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
      if (USE_BACKEND) {
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;
        // Persona cliente aprova pelo portal público (token da OS), como o cliente real faria
        const call =
          currentRole === 'cliente'
            ? portalToken(order)
                .then((token) => backendApi.portalApprove(token))
                .then(() => backendApi.getOrder(orderId))
            : backendApi.approveQuote(orderId);
        call
          .then((dto) => {
            applyOrderDto(dto);
            try {
              confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
            } catch {
              // ignore
            }
            showToast({
              title: 'Orçamento Aprovado!',
              description: 'Status avançado para Em Execução.',
              type: 'success',
            });
          })
          .catch((err) => showApiError(err, 'Não foi possível aprovar o orçamento'));
        return;
      }
      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

          // Deduct parts
          order.services.forEach((service) => {
            service.partsUsed.forEach((part) => {
              updateStockQuantity(
                part.stockItemId,
                -part.quantity,
                `Aprovação de orçamento OS #${order.orderNumber}`,
                order.id
              );
            });
          });

          return {
            ...order,
            status: 'em_execucao',
            quote: order.quote
              ? {
                  ...order.quote,
                  status: 'aprovado',
                  answeredAt: timestamp,
                }
              : undefined,
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
        })
      );

      showToast({
        title: 'Orçamento Aprovado!',
        description: 'Status avançado para Em Execução e peças reservadas.',
        type: 'success',
      });
    },
    [triggerHaptic, updateStockQuantity, currentRole, showToast, orders, applyOrderDto, showApiError,
      portalToken]
  );

  const rejectQuote = useCallback(
    (orderId: string, reason: string) => {
      triggerHaptic();
      if (USE_BACKEND) {
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;
        const call =
          currentRole === 'cliente'
            ? portalToken(order)
                .then((token) => backendApi.portalReject(token, reason))
                .then(() => backendApi.getOrder(orderId))
            : backendApi.rejectQuote(orderId, reason);
        call
          .then((dto) => {
            applyOrderDto(dto);
            showToast({
              title: 'Recusa registrada',
              description: 'Você pode reajustar o orçamento com o cliente.',
              type: 'warning',
            });
          })
          .catch((err) => showApiError(err, 'Não foi possível recusar o orçamento'));
        return;
      }
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
    [triggerHaptic, currentRole, showToast, orders, applyOrderDto, showApiError, portalToken]
  );

  const createOrder = useCallback(
    async (orderData: Partial<Order>, clientId: string, instrumentId: string): Promise<Order> => {
      triggerHaptic();
      if (USE_BACKEND) {
        try {
          const dto = await backendApi.createOrder({
            customerId: clientId,
            instrumentId,
            priority: orderData.priority,
            reportedIssue: orderData.reportedIssue || 'Revisão e regulagem geral',
            estimatedDeliveryDate: orderData.estimatedDeliveryDate,
            services: (orderData.services || []).map((s) => ({
              title: s.title,
              description: s.description,
              laborPrice: s.laborPrice,
            })),
          });
          const created = { ...toOrder(dto), photos: orderData.photos || [] };
          setOrders((prev) => [created, ...prev.filter((o) => o.id !== created.id)]);
          showToast({
            title: `OS #${created.orderNumber} aberta com sucesso!`,
            description: `Link do portal: ${created.clientTrackingToken}`,
            type: 'success',
          });
          return created;
        } catch (err) {
          showApiError(err, 'Não foi possível abrir a OS');
          throw err;
        }
      }
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
    [orders, clients, currentRole, syncStatus, triggerHaptic, showToast, showApiError]
  );

  const createClient = useCallback(
    async (clientData: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
      triggerHaptic();
      if (USE_BACKEND) {
        try {
          const created = toClient(await backendApi.createCustomer(clientData));
          setClients((prev) => [created, ...prev]);
          showToast({ title: `Cliente ${created.name} cadastrado`, type: 'success' });
          return created;
        } catch (err) {
          showApiError(err, 'Não foi possível cadastrar o cliente');
          throw err;
        }
      }
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
    [triggerHaptic, showToast, showApiError]
  );

  const createInstrument = useCallback(
    async (
      instrumentData: Omit<Instrument, 'id' | 'createdAt' | 'photos'>,
      photos: Photo[] = []
    ): Promise<Instrument> => {
      triggerHaptic();
      if (USE_BACKEND) {
        try {
          const created = {
            ...toInstrument(await backendApi.createInstrument(instrumentData)),
            photos,
          };
          setInstruments((prev) => [created, ...prev]);
          showToast({ title: `${created.brand} ${created.model} registrado`, type: 'success' });
          return created;
        } catch (err) {
          showApiError(err, 'Não foi possível cadastrar o instrumento');
          throw err;
        }
      }
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
    [triggerHaptic, showToast, showApiError]
  );

  const recordPayment = useCallback(
    async (paymentData: Omit<Payment, 'id' | 'receiptNumber'>): Promise<Payment> => {
      triggerHaptic();
      if (USE_BACKEND) {
        try {
          const dto = await backendApi.receivePayment(
            paymentData.orderId,
            paymentData.amount,
            paymentData.method
          );
          applyOrderDto(dto);
          const [created] = paymentsFromOrder(
            dto,
            paymentData.clientName,
            paymentData.instrumentDescription
          ).sort((a, b) => b.date.localeCompare(a.date));
          try {
            confetti({ particleCount: 40, spread: 50, origin: { y: 0.7 } });
          } catch {
            // ignore
          }
          showToast({
            title: `Pagamento de R$ ${paymentData.amount.toFixed(2)} registrado!`,
            description: `Recibo #${created?.receiptNumber} pronto para envio.`,
            type: 'success',
          });
          return created;
        } catch (err) {
          showApiError(err, 'Não foi possível registrar o pagamento');
          throw err;
        }
      }
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
    [payments.length, currentRole, triggerHaptic, showToast, applyOrderDto, showApiError]
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
    if (USE_BACKEND) {
      reloadData().then(() => showToast({ title: 'Dados recarregados da API', type: 'info' }));
      return;
    }
    localStorage.removeItem('luthier_clients');
    localStorage.removeItem('luthier_instruments');
    localStorage.removeItem('luthier_orders');
    localStorage.removeItem('luthier_stock');
    localStorage.removeItem('luthier_payments');
    localStorage.removeItem('luthier_movements');
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
  }, [showToast, reloadData]);

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
        isBackendMode: USE_BACKEND,
        isLoadingData,
        reloadData,
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
