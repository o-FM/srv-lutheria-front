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
import { isApiMode } from '../config/env';
import { api, ApiError, mappers } from '../services/api';
import type { OrderDto } from '../services/api';
import { useAuth } from './AuthContext';
import {
  INITIAL_CLIENTS,
  INITIAL_INSTRUMENTS,
  INITIAL_ORDERS,
  INITIAL_STOCK,
  INITIAL_PAYMENTS,
  INITIAL_MOVEMENTS,
} from '../data/seedData';

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
  toasts: ToastMessage[];
  /** Carregando dados da API (modo API). */
  isLoadingData: boolean;

  // Modals & Camera Callbacks
  isCameraModalOpen: boolean;
  cameraCallback: ((photoUrl: string, caption?: string) => void) | null;
  isBarcodeModalOpen: boolean;
  barcodeCallback: ((code: string) => void) | null;

  // Actions
  /** silent: não mostra aviso (sincronização automática com o usuário logado). */
  setRole: (role: UserRole, options?: { silent?: boolean }) => void;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setIsSearchOpen: (open: boolean) => void;
  setActiveOrderId: (id: string | null) => void;
  setIsNewOrderWizardOpen: (open: boolean) => void;
  setIsWorkbenchModeOpen: (open: boolean) => void;
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
  createInstrument: (instrumentData: Omit<Instrument, 'id' | 'createdAt' | 'photos'>, photos?: Photo[]) => Promise<Instrument>;

  updateStockQuantity: (stockItemId: string, delta: number, reason: string, orderId?: string) => void;
  recordPayment: (payment: Omit<Payment, 'id' | 'receiptNumber'>) => Promise<Payment>;

  openCamera: (callback: (photoUrl: string, caption?: string) => void) => void;
  closeCamera: () => void;
  openBarcodeScanner: (callback: (code: string) => void) => void;
  closeBarcodeScanner: () => void;

  /** Modo demonstração: restaura dados de exemplo. Modo API: recarrega do servidor. */
  resetToDefaults: () => void;
  reloadData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/** Modo demonstração: dados locais (localStorage) com seed. Modo API: começa vazio. */
function loadDemo<T>(key: string, seed: T[]): T[] {
  if (isApiMode) return [];
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : seed;
  } catch {
    return seed;
  }
}

function persistDemo(key: string, value: unknown) {
  if (isApiMode) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // armazenamento cheio/indisponível: segue só em memória
  }
}

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
    return loadDemo('luthier_clients', INITIAL_CLIENTS);
  });

  const [instruments, setInstruments] = useState<Instrument[]>(() => {
    return loadDemo('luthier_instruments', INITIAL_INSTRUMENTS);
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    return loadDemo('luthier_orders', INITIAL_ORDERS);
  });

  const [stock, setStock] = useState<StockItem[]>(() => {
    return loadDemo('luthier_stock', INITIAL_STOCK);
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    return loadDemo('luthier_payments', INITIAL_PAYMENTS);
  });

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    return loadDemo('luthier_movements', INITIAL_MOVEMENTS);
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

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);
  const [cameraCallback, setCameraCallback] = useState<((photoUrl: string, caption?: string) => void) | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState<boolean>(false);
  const [barcodeCallback, setBarcodeCallback] = useState<((code: string) => void) | null>(null);

  // Sync to localStorage
  useEffect(() => {
    persistDemo('luthier_clients', clients);
  }, [clients]);

  useEffect(() => {
    persistDemo('luthier_instruments', instruments);
  }, [instruments]);

  useEffect(() => {
    persistDemo('luthier_orders', orders);
  }, [orders]);

  useEffect(() => {
    persistDemo('luthier_stock', stock);
  }, [stock]);

  useEffect(() => {
    persistDemo('luthier_payments', payments);
  }, [payments]);

  useEffect(() => {
    persistDemo('luthier_movements', stockMovements);
  }, [stockMovements]);


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

  // ---------------------------------------------------------------------------
  // Modo API: carga inicial e helpers
  // ---------------------------------------------------------------------------
  const { isAuthenticated } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  const fail = useCallback(
    (error: unknown, title: string) => {
      const description = error instanceof Error ? error.message : undefined;
      showToast({ title, description, type: 'error' });
    },
    [showToast]
  );

  /** Substitui (ou insere) a OS e seus pagamentos com a resposta do servidor. */
  const applyOrder = useCallback(
    (dto: OrderDto) => {
      const order = mappers.toOrder(dto);
      setOrders((prev) =>
        prev.some((o) => o.id === order.id)
          ? prev.map((o) => (o.id === order.id ? order : o))
          : [order, ...prev]
      );
      setPayments((prev) => [
        ...mappers.paymentsFrom([dto], clients, instruments),
        ...prev.filter((p) => p.orderId !== dto.id),
      ]);
      return order;
    },
    [clients, instruments]
  );

  const reloadData = useCallback(async () => {
    if (!isApiMode || !isAuthenticated) return;
    setIsLoadingData(true);
    try {
      // Cada papel enxerga partes diferentes da API; o que for proibido (403) vira lista vazia.
      const optional = <T,>(p: Promise<T[]>) =>
        p.catch((e) => {
          if (e instanceof ApiError && e.status === 403) return [] as T[];
          throw e;
        });
      const [customerDtos, instrumentDtos, productDtos, orderDtos] = await Promise.all([
        optional(api.customers.all()),
        optional(api.customers.allInstruments()),
        optional(api.products.all()),
        optional(api.orders.all()),
      ]);
      const loadedClients = customerDtos.map(mappers.toClient);
      const loadedInstruments = instrumentDtos.map(mappers.toInstrument);
      setClients(loadedClients);
      setInstruments(loadedInstruments);
      setStock(productDtos.map(mappers.toStockItem));
      setOrders(orderDtos.map(mappers.toOrder));
      setPayments(mappers.paymentsFrom(orderDtos, loadedClients, loadedInstruments));
      setStockMovements([]);
    } catch (e) {
      fail(e, 'Não foi possível carregar os dados da oficina');
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated, fail]);

  useEffect(() => {
    if (isApiMode && isAuthenticated) {
      reloadData();
    }
    if (isApiMode && !isAuthenticated) {
      // Logout: nada de dados de uma luthieria ficar na memória para a próxima sessão
      setClients([]);
      setInstruments([]);
      setOrders([]);
      setStock([]);
      setPayments([]);
      setStockMovements([]);
    }
  }, [isAuthenticated, reloadData]);

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
    (role: UserRole, options?: { silent?: boolean }) => {
      setRoleState(role);
      if (options?.silent) return;
      triggerHaptic();
      const roleLabels: Record<UserRole, string> = {
        luthier: 'Luthier / Dono',
        atendente: 'Atendente / Balcão',
        estoquista: 'Estoquista',
        cliente: 'Visão do Cliente',
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
      if (isApiMode) {
        const item = stock.find((s) => s.id === stockItemId);
        api.products
          .move(stockItemId, {
            type: delta >= 0 ? 'entrada' : 'saida',
            quantity: Math.abs(delta),
            reason,
            orderId,
          })
          .then((movement) => {
            setStock((prev) =>
              prev.map((s) => (s.id === stockItemId ? { ...s, currentQuantity: movement.balanceAfter } : s))
            );
            setStockMovements((prev) => [mappers.toStockMovement(movement, item?.name ?? ''), ...prev]);
          })
          .catch((e) => fail(e, 'Movimentação não registrada'));
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
    [stock, fail]
  );

  // Advance Order Status
  const advanceOrderStatus = useCallback(
    (orderId: string, specificStatus?: OrderStatus, note?: string) => {
      triggerHaptic();

      if (isApiMode) {
        const order = orders.find((o) => o.id === orderId);
        if (!order) return;
        const index = STATUS_FLOW.indexOf(order.status);
        const next = specificStatus ?? STATUS_FLOW[index + 1];
        if (!next) return;
        // Envio e aprovação de orçamento têm endpoints próprios (regras do backend)
        const call =
          next === 'aguardando_aprovacao'
            ? api.orders.sendQuote(orderId)
            : order.status === 'aguardando_aprovacao' && next === 'em_execucao'
            ? api.orders.approveQuote(orderId)
            : api.orders.changeStatus(orderId, next, note);
        call
          .then((dto) => {
            applyOrder(dto);
            showToast({ title: `OS #${dto.orderNumber}: ${dto.status.replace(/_/g, ' ')}`, type: 'success' });
          })
          .catch((e) => fail(e, 'Não foi possível mudar o status'));
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
    [currentRole, triggerHaptic, showToast, updateStockQuantity, syncStatus, orders, applyOrder, fail]
  );

  const updateOrder = useCallback(
    (orderId: string, updates: Partial<Order>) => {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updates } : o)));
      if (isApiMode) {
        const { priority, diagnosisNotes, technicianNotes, estimatedDeliveryDate } = updates;
        if ([priority, diagnosisNotes, technicianNotes, estimatedDeliveryDate].some((v) => v !== undefined)) {
          api.orders
            .update(orderId, { priority, diagnosisNotes, technicianNotes, estimatedDeliveryDate })
            .then(applyOrder)
            .catch((e) => fail(e, 'Alteração não salva'));
        }
      }
    },
    [applyOrder, fail]
  );

  const addServiceItem = useCallback(
    (orderId: string, serviceData: Omit<ServiceItem, 'id'>) => {
      if (isApiMode) {
        (async () => {
          let dto = await api.orders.addService(orderId, {
            title: serviceData.title,
            description: serviceData.description,
            laborPrice: serviceData.laborPrice,
          });
          for (const part of serviceData.partsUsed) {
            dto = await api.orders.addPart(orderId, part.stockItemId, part.quantity);
          }
          applyOrder(dto);
        })().catch((e) => fail(e, 'Serviço não adicionado'));
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
    [applyOrder, fail]
  );

  const toggleServiceDone = useCallback(
    (orderId: string, serviceId: string) => {
      triggerHaptic();
      if (isApiMode) {
        const service = orders.find((o) => o.id === orderId)?.services.find((s) => s.id === serviceId);
        if (service?.done) {
          showToast({ title: 'Serviço já concluído', description: 'A conclusão fica registrada na linha do tempo.', type: 'info' });
          return;
        }
        api.orders.markServiceDone(orderId, serviceId).then(applyOrder).catch((e) => fail(e, 'Não foi possível concluir o serviço'));
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
    [triggerHaptic, orders, showToast, applyOrder, fail]
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
      if (isApiMode) {
        api.orders
          .approveQuote(orderId)
          .then((dto) => {
            applyOrder(dto);
            showToast({ title: 'Orçamento aprovado', description: 'OS liberada para a bancada.', type: 'success' });
          })
          .catch((e) => fail(e, 'Não foi possível aprovar'));
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
    [triggerHaptic, updateStockQuantity, currentRole, showToast, applyOrder, fail]
  );

  const rejectQuote = useCallback(
    (orderId: string, reason: string) => {
      triggerHaptic();
      if (isApiMode) {
        api.orders
          .rejectQuote(orderId, reason)
          .then((dto) => {
            applyOrder(dto);
            showToast({ title: 'Recusa registrada', description: 'OS voltou para orçamento.', type: 'warning' });
          })
          .catch((e) => fail(e, 'Não foi possível registrar a recusa'));
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
    [triggerHaptic, currentRole, showToast, applyOrder, fail]
  );

  const createOrder = useCallback(
    async (orderData: Partial<Order>, clientId: string, instrumentId: string): Promise<Order> => {
      triggerHaptic();
      if (isApiMode) {
        try {
          const dto = await api.orders.create({
            customerId: clientId,
            instrumentId,
            priority: orderData.priority,
            reportedIssue: orderData.reportedIssue || 'Revisão e regulagem geral',
            estimatedDeliveryDate: orderData.estimatedDeliveryDate || undefined,
            services: (orderData.services ?? []).map((s) => ({
              title: s.title,
              description: s.description,
              laborPrice: s.laborPrice,
            })),
          });
          const order = applyOrder(dto);
          showToast({ title: `OS #${dto.orderNumber} aberta`, type: 'success' });
          return order;
        } catch (e) {
          fail(e, 'Não foi possível abrir a OS');
          throw e;
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
    [orders, clients, currentRole, syncStatus, triggerHaptic, showToast, applyOrder, fail]
  );

  const createClient = useCallback(
    async (clientData: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
      triggerHaptic();
      if (isApiMode) {
        try {
          const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);
          const dto = await api.customers.create({
            name: clientData.name,
            phone: clientData.phone,
            email: blank(clientData.email),
            cpf: blank(clientData.cpf),
            address: blank(clientData.address),
            notes: blank(clientData.notes),
          });
          const created = mappers.toClient(dto);
          setClients((prev) => [created, ...prev]);
          showToast({ title: `Cliente ${created.name} cadastrado`, type: 'success' });
          return created;
        } catch (e) {
          fail(e, 'Cliente não cadastrado');
          throw e;
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
    [triggerHaptic, showToast, fail]
  );

  const createInstrument = useCallback(
    async (instrumentData: Omit<Instrument, 'id' | 'createdAt' | 'photos'>, photos: Photo[] = []): Promise<Instrument> => {
      triggerHaptic();
      if (isApiMode) {
        try {
          const { clientId, type, brand, model, ...details } = instrumentData;
          const dto = await api.customers.addInstrument(clientId, { type, brand, model, ...details });
          // Fotos ainda não têm endpoint no backend: ficam só neste dispositivo
          const created = { ...mappers.toInstrument(dto), photos };
          setInstruments((prev) => [created, ...prev]);
          showToast({ title: `${created.brand} ${created.model} registrado`, type: 'success' });
          return created;
        } catch (e) {
          fail(e, 'Instrumento não cadastrado');
          throw e;
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
    [triggerHaptic, showToast, fail]
  );

  const recordPayment = useCallback(
    async (paymentData: Omit<Payment, 'id' | 'receiptNumber'>): Promise<Payment> => {
      triggerHaptic();
      if (isApiMode) {
        try {
          const dto = await api.orders.receivePayment(paymentData.orderId, paymentData.amount, paymentData.method);
          applyOrder(dto);
          const p = dto.payments[dto.payments.length - 1];
          showToast({ title: `Pagamento de R$ ${paymentData.amount.toFixed(2)} registrado`, description: `Recibo ${p.receiptNumber}`, type: 'success' });
          return { ...paymentData, id: p.id, receiptNumber: p.receiptNumber };
        } catch (e) {
          fail(e, 'Pagamento não registrado');
          throw e;
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
    [payments.length, currentRole, triggerHaptic, showToast, applyOrder, fail]
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
    if (isApiMode) {
      reloadData();
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
        toasts,
        isLoadingData,
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
        reloadData,
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
