import React, { useEffect, useState } from 'react';
import { useApp, STATUS_LABELS } from '../../context/AppContext';
import {
  X,
  MessageCircle,
  Camera,
  CheckCircle2,
  Clock,
  Plus,
  ChevronRight,
  Hammer,
  Trash2,
  Copy,
  Ban,
  Send,
  Package,
} from 'lucide-react';
import { OrderStatus, PaymentMethod } from '../../types';
import { PhotoImage } from '../common/PhotoImage';
import { portalUrl } from '../../services/mappers';

const STATUS_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'recebido', label: 'Recebido' },
  { status: 'diagnostico', label: 'Diagnóstico' },
  { status: 'orcamento', label: 'Orçamento' },
  { status: 'aguardando_aprovacao', label: 'Aprovação' },
  { status: 'em_execucao', label: 'Em Execução' },
  { status: 'pronto', label: 'Pronto' },
  { status: 'entregue', label: 'Entregue' },
];

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao_credito', label: 'Crédito' },
  { id: 'cartao_debito', label: 'Débito' },
  { id: 'transferencia', label: 'Transferência' },
];

const EDITABLE: OrderStatus[] = ['recebido', 'diagnostico', 'orcamento'];
const brl = (v: number) => `R$ ${v.toFixed(2)}`;

export const OrderDetailSheet: React.FC = () => {
  const {
    activeOrderId,
    setActiveOrderId,
    orders,
    instruments,
    clients,
    stock,
    catalog,
    currentRole,
    loadOrderDetail,
    advanceOrderStatus,
    updateOrder,
    toggleServiceDone,
    addServiceItem,
    removeServiceItem,
    addPart,
    removePart,
    openCamera,
    addOrderPhoto,
    removeOrderPhoto,
    approveQuote,
    rejectQuote,
    addNote,
    recordPayment,
    triggerHaptic,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'servicos' | 'fotos' | 'orcamento' | 'historico'>('servicos');
  const [busy, setBusy] = useState(false);

  const [isAddingService, setIsAddingService] = useState(false);
  const [serviceCatalogId, setServiceCatalogId] = useState('');
  const [newServiceTitle, setNewServiceTitle] = useState('');
  const [newServiceLabor, setNewServiceLabor] = useState('');

  const [isAddingPart, setIsAddingPart] = useState(false);
  const [partProductId, setPartProductId] = useState('');
  const [partQuantity, setPartQuantity] = useState('1');

  const [diagnosis, setDiagnosis] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  const order = orders.find((o) => o.id === activeOrderId);

  // Sempre que a OS abre: detalhe e fotos atualizados do servidor
  useEffect(() => {
    if (activeOrderId) {
      setActiveTab('servicos');
      setIsAddingService(false);
      setIsAddingPart(false);
      setIsPaymentOpen(false);
      loadOrderDetail(activeOrderId);
    }
  }, [activeOrderId, loadOrderDetail]);

  useEffect(() => {
    setDiagnosis(order?.diagnosisNotes || '');
    setDiscount(order?.quote?.discount ? String(order.quote.discount) : '');
  }, [order?.id, order?.diagnosisNotes, order?.quote?.discount]);

  if (!activeOrderId || !order) return null;

  const instrument = instruments.find((i) => i.id === order.instrumentId);
  const client = clients.find((c) => c.id === order.clientId);
  const isLuthier = currentRole === 'luthier';
  const isEditable = EDITABLE.includes(order.status);
  const isClosed = order.status === 'entregue' || order.status === 'cancelado';
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);
  const remainingBalance = Math.max(0, order.balance);
  const link = order.clientTrackingToken ? portalUrl(order.clientTrackingToken) : '';

  const withBusy = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic();
    if (serviceCatalogId) {
      withBusy(async () => {
        if (await addServiceItem(order.id, { catalogId: serviceCatalogId })) {
          setServiceCatalogId('');
          setIsAddingService(false);
        }
      });
      return;
    }
    const price = parseFloat(newServiceLabor.replace(',', '.'));
    if (!newServiceTitle.trim() || !(price >= 0)) {
      showToast({ title: 'Informe descrição e valor do serviço', type: 'warning' });
      return;
    }
    withBusy(async () => {
      if (await addServiceItem(order.id, { title: newServiceTitle.trim(), laborPrice: price })) {
        setNewServiceTitle('');
        setNewServiceLabor('');
        setIsAddingService(false);
      }
    });
  };

  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(partQuantity, 10);
    if (!partProductId || !(qty > 0)) {
      showToast({ title: 'Escolha a peça e a quantidade', type: 'warning' });
      return;
    }
    withBusy(async () => {
      if (await addPart(order.id, partProductId, qty)) {
        setPartProductId('');
        setPartQuantity('1');
        setIsAddingPart(false);
      }
    });
  };

  const handleAddPhoto = () => {
    triggerHaptic();
    const isAtendente = currentRole === 'atendente';
    openCamera((url, caption, tag) => {
      withBusy(() =>
        addOrderPhoto(order.id, {
          url,
          tag: tag || (isAtendente ? 'entrada' : 'bancada'),
          caption: caption || (isAtendente ? 'Foto de entrada / balcão' : 'Foto registrada na bancada'),
        })
      );
    }, isAtendente ? 'entrada' : 'bancada');
  };

  const deliver = () =>
    withBusy(async () => {
      if (await advanceOrderStatus(order.id, 'entregue', 'Entregue ao cliente no balcão')) {
        if (remainingBalance > 0) {
          setPaymentAmount(remainingBalance.toFixed(2));
          setActiveTab('orcamento');
          setIsPaymentOpen(true);
        }
      }
    });

  const handleStepClick = (targetStatus: OrderStatus) => {
    triggerHaptic();
    if (targetStatus === order.status) return;
    if (isLuthier) {
      withBusy(() => advanceOrderStatus(order.id, targetStatus));
      return;
    }
    if (targetStatus === 'entregue' && order.status === 'pronto') {
      deliver();
      return;
    }
    showToast({
      title: 'Etapa técnica reservada',
      description: 'Diagnóstico e execução de bancada são do luthier.',
      type: 'info',
    });
  };

  const handleCancel = () => {
    const reason = window.prompt('Motivo do cancelamento da OS:');
    if (reason === null) return;
    withBusy(() => advanceOrderStatus(order.id, 'cancelado', reason || undefined));
  };

  const handleReject = () => {
    const reason = window.prompt('O que o cliente disse ao recusar o orçamento?');
    if (reason === null) return;
    withBusy(() => rejectQuote(order.id, reason));
  };

  const whatsAppText = () => {
    const status = STATUS_LABELS[order.status];
    const total = order.status === 'aguardando_aprovacao' ? `\nValor do orçamento: ${brl(order.totalAmount)}` : '';
    return `Olá ${client?.name?.split(' ')[0] ?? ''}! Atualização do seu ${instrument?.brand ?? ''} ${
      instrument?.model ?? ''
    } (OS #${order.orderNumber}).\nStatus: *${status}*.${total}${
      link ? `\n\nAcompanhe fotos e detalhes${order.status === 'aguardando_aprovacao' ? ' e aprove o orçamento' : ''}:\n${link}` : ''
    }`;
  };

  const handleShareWhatsApp = () => {
    triggerHaptic();
    const phone = client?.phone.replace(/\D/g, '') || '';
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(whatsAppText())}`, '_blank');
  };

  const handleCopyLink = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link);
    showToast({ title: 'Link do portal copiado', type: 'success', duration: 2500 });
  };

  const handleSavePayment = () => {
    const val = parseFloat(paymentAmount.replace(',', '.'));
    if (!val || val <= 0) {
      showToast({ title: 'Informe um valor válido', type: 'warning' });
      return;
    }
    withBusy(async () => {
      if (await recordPayment(order.id, val, paymentMethod)) {
        setIsPaymentOpen(false);
        setPaymentAmount('');
      }
    });
  };

  const field = 'w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-stone-900 border-t sm:border border-stone-800 rounded-t-3xl sm:rounded-2xl max-h-[95vh] h-[95vh] flex flex-col overflow-hidden text-stone-100 shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-stone-950/90 border-b border-stone-800 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-amber-500">OS #{order.orderNumber}</span>
              <span className="text-xs uppercase font-bold px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                {order.priority}
              </span>
              {order.status === 'cancelado' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800">
                  CANCELADA
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white truncate mt-0.5">
              {instrument?.brand} {instrument?.model}
            </h2>
            <p className="text-xs text-stone-400 truncate">
              Cliente: {client?.name} · {client?.phone}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {link && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700"
                title="Copiar link do portal do cliente"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2 rounded-xl bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900 border border-emerald-800/80"
              title="Conversar no WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveOrderId(null)}
              className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="px-4 py-2.5 bg-stone-950/50 border-b border-stone-800 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {STATUS_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.status} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy || isClosed}
                    onClick={() => handleStepClick(step.status)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isCurrent
                        ? 'bg-amber-600 text-white shadow-md'
                        : isPast
                        ? 'bg-stone-800 text-stone-400 hover:text-stone-200'
                        : 'bg-stone-900/60 text-stone-600'
                    }`}
                  >
                    {isPast && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    <span>{step.label}</span>
                  </button>
                  {idx < STATUS_STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-stone-700 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-2 pb-1 bg-stone-900 border-b border-stone-800 flex gap-1">
          {[
            { id: 'servicos', label: 'Serviços' },
            { id: 'fotos', label: `Fotos (${order.photos.length})` },
            { id: 'orcamento', label: 'Orçamento' },
            { id: 'historico', label: 'Histórico' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic();
                setActiveTab(tab.id as typeof activeTab);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors text-center ${
                activeTab === tab.id
                  ? 'bg-amber-950 text-amber-200 border border-amber-800/80 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!order.detailLoaded && (
            <div className="text-xs text-stone-500 flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-amber-600/30 border-t-amber-500 rounded-full animate-spin" />
              Carregando detalhes...
            </div>
          )}

          {/* SERVIÇOS, PEÇAS E DIAGNÓSTICO */}
          {activeTab === 'servicos' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Defeito relatado</span>
                <p className="text-xs text-stone-200 font-medium">{order.reportedIssue}</p>
                <div className="pt-2 border-t border-stone-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Diagnóstico do luthier</span>
                  {isLuthier && !isClosed ? (
                    <>
                      <textarea
                        rows={2}
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="O que foi encontrado na bancada..."
                        className={field}
                      />
                      {diagnosis !== (order.diagnosisNotes || '') && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => withBusy(() => updateOrder(order.id, { diagnosisNotes: diagnosis }))}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                        >
                          Salvar diagnóstico
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-stone-300">{order.diagnosisNotes || '—'}</p>
                  )}
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                    Serviços ({order.services.filter((s) => s.done).length}/{order.services.length})
                  </span>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => setIsAddingService(!isAddingService)}
                      className="text-xs text-amber-400 font-semibold flex items-center gap-1 hover:text-amber-300"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar serviço
                    </button>
                  )}
                </div>

                {isAddingService && isEditable && (
                  <form onSubmit={handleAddService} className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                    {catalog.length > 0 && (
                      <select value={serviceCatalogId} onChange={(e) => setServiceCatalogId(e.target.value)} className={field}>
                        <option value="">Serviço avulso (digitar abaixo)</option>
                        {catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} — {brl(c.laborPrice)}
                          </option>
                        ))}
                      </select>
                    )}
                    {!serviceCatalogId && (
                      <>
                        <input
                          type="text"
                          autoFocus
                          placeholder="Descrição do serviço"
                          value={newServiceTitle}
                          onChange={(e) => setNewServiceTitle(e.target.value)}
                          className={field}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder="Mão de obra (R$)"
                          value={newServiceLabor}
                          onChange={(e) => setNewServiceLabor(e.target.value)}
                          className={field}
                        />
                      </>
                    )}
                    <button type="submit" disabled={busy} className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl">
                      Salvar serviço
                    </button>
                  </form>
                )}

                {order.services.length === 0 && order.detailLoaded && (
                  <p className="text-xs text-stone-500">Nenhum serviço lançado.</p>
                )}
                {order.services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => {
                      if (!isLuthier) {
                        showToast({ title: 'Ação de bancada', description: 'Os serviços são concluídos pelo luthier.', type: 'info' });
                        return;
                      }
                      if (order.status !== 'em_execucao') {
                        showToast({ title: 'Serviços são concluídos com a OS em execução', type: 'info' });
                        return;
                      }
                      withBusy(() => toggleServiceDone(order.id, service.id));
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                      service.done
                        ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200 opacity-80'
                        : 'bg-stone-950/70 border-stone-800 text-stone-100 hover:border-stone-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold leading-snug ${service.done ? 'line-through text-stone-400' : 'text-stone-100'}`}>
                        {service.title}
                      </p>
                      {service.description && <p className="text-[11px] text-stone-400 mt-0.5">{service.description}</p>}
                      <span className="text-[11px] font-bold text-amber-500 mt-1 block">Mão de obra: {brl(service.laborPrice)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isEditable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            withBusy(() => removeServiceItem(order.id, service.id));
                          }}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-900"
                          aria-label="Remover serviço"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                          service.done ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-stone-600 bg-stone-900'
                        }`}
                      >
                        {service.done && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Peças do estoque */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-300">Peças ({order.parts.length})</span>
                  {isEditable && isLuthier && (
                    <button
                      type="button"
                      onClick={() => setIsAddingPart(!isAddingPart)}
                      className="text-xs text-amber-400 font-semibold flex items-center gap-1 hover:text-amber-300"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Adicionar peça
                    </button>
                  )}
                </div>
                {isAddingPart && (
                  <form onSubmit={handleAddPart} className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                    <select value={partProductId} onChange={(e) => setPartProductId(e.target.value)} className={field}>
                      <option value="">Escolha a peça do estoque</option>
                      {stock.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {brl(s.salePrice)} ({s.currentQuantity} {s.unit})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={partQuantity}
                        onChange={(e) => setPartQuantity(e.target.value)}
                        className={`${field} w-24`}
                      />
                      <button type="submit" disabled={busy} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl">
                        Salvar peça
                      </button>
                    </div>
                    <p className="text-[10px] text-stone-500">A baixa no estoque acontece quando a OS fica pronta.</p>
                  </form>
                )}
                {order.parts.map((p) => (
                  <div key={p.id} className="p-3 rounded-2xl bg-stone-950/70 border border-stone-800 flex items-center justify-between text-xs">
                    <span className="text-stone-200">
                      {p.quantity}x {p.stockItemName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-400">{brl(p.total)}</span>
                      {isEditable && isLuthier && (
                        <button
                          type="button"
                          onClick={() => withBusy(() => removePart(order.id, p.id))}
                          className="p-1 rounded-lg text-stone-500 hover:text-rose-400"
                          aria-label="Remover peça"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FOTOS */}
          {activeTab === 'fotos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">Galeria da OS</span>
                <button
                  type="button"
                  onClick={handleAddPhoto}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  Nova foto
                </button>
              </div>
              {order.photos.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-stone-800 text-center space-y-2">
                  <Camera className="w-8 h-8 text-stone-600 mx-auto" />
                  <p className="text-xs text-stone-400">{order.photosLoaded ? 'Nenhuma foto registrada ainda.' : 'Carregando fotos...'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {order.photos.map((ph) => (
                    <div key={ph.id} className="rounded-2xl overflow-hidden border border-stone-800 bg-stone-950 space-y-1.5">
                      <div className="aspect-square relative overflow-hidden">
                        <PhotoImage photo={ph} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold uppercase text-amber-300">
                          {ph.tag.replace('_', ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Excluir esta foto? Ela some também do portal do cliente.')) {
                              withBusy(() => removeOrderPhoto(order.id, ph.id));
                            }
                          }}
                          className="absolute top-2 right-2 p-1 rounded-md bg-black/70 text-stone-300 hover:text-rose-400"
                          aria-label="Excluir foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-stone-200 line-clamp-2">{ph.caption}</p>
                        <span className="text-[10px] text-stone-500 block mt-1">{ph.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ORÇAMENTO & PAGAMENTOS */}
          {activeTab === 'orcamento' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Orçamento</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      order.quote?.status === 'aprovado'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : order.quote?.status === 'rejeitado'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {order.quote?.status || 'não enviado'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs pt-1 border-t border-stone-800">
                  <div className="flex justify-between text-stone-300">
                    <span>Mão de obra ({order.services.length} serviços):</span>
                    <span className="font-semibold">{brl(order.quote?.laborTotal ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-stone-300">
                    <span>Peças e insumos:</span>
                    <span className="font-semibold">{brl(order.quote?.partsTotal ?? 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>Desconto:</span>
                    {isEditable && isLuthier ? (
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          placeholder="0,00"
                          className="w-24 px-2 py-1 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white text-right"
                        />
                        {(parseFloat(discount || '0') || 0) !== (order.quote?.discount ?? 0) && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => withBusy(() => updateOrder(order.id, { discount: parseFloat(discount || '0') || 0 }))}
                            className="px-2 py-1 rounded-lg bg-amber-600 text-white text-[10px] font-bold"
                          >
                            OK
                          </button>
                        )}
                      </span>
                    ) : (
                      <span>- {brl(order.quote?.discount ?? 0)}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-stone-800">
                    <span>Total da OS:</span>
                    <span className="text-amber-400 font-mono">{brl(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-400 pt-1">
                    <span>Pago até agora:</span>
                    <span className="text-emerald-400 font-mono font-semibold">{brl(order.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-400">
                    <span>Saldo restante:</span>
                    <span className="text-rose-400 font-mono font-semibold">{brl(remainingBalance)}</span>
                  </div>
                  {order.quote?.rejectionReason && (
                    <p className="text-[11px] text-rose-300 pt-1">Recusa: {order.quote.rejectionReason}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-800 flex flex-wrap gap-2">
                  {order.status === 'orcamento' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => withBusy(() => advanceOrderStatus(order.id, 'aguardando_aprovacao'))}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-4 h-4" />
                      Enviar orçamento ao cliente
                    </button>
                  )}
                  {order.status === 'aguardando_aprovacao' && (
                    <>
                      <button
                        type="button"
                        onClick={handleShareWhatsApp}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Mandar link no WhatsApp
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => withBusy(() => approveQuote(order.id))}
                        className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1"
                        title="Cliente aprovou pessoalmente ou por telefone"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprovado
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleReject}
                        className="py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-rose-300 text-xs font-bold"
                      >
                        Recusado
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Pagamentos</span>
                  {order.status !== 'cancelado' && remainingBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmount(remainingBalance.toFixed(2));
                        setIsPaymentOpen(true);
                      }}
                      className="text-xs text-amber-400 font-semibold hover:text-amber-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Registrar pagamento
                    </button>
                  )}
                </div>

                {order.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b border-stone-800/60 pb-1.5">
                    <div>
                      <span className="font-mono text-stone-400">{p.receiptNumber}</span>
                      <span className="text-[10px] text-stone-500 block">{p.date}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400">{brl(p.amount)}</span>
                      <span className="text-[10px] uppercase text-stone-400 block">{p.method.replace('_', ' ')}</span>
                    </div>
                  </div>
                ))}

                {isPaymentOpen && (
                  <div className="p-3 rounded-xl bg-stone-900 border border-stone-700 space-y-2.5 animate-in fade-in">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-400 block mb-1">Valor (R$)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {PAYMENT_METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`py-1.5 text-xs font-semibold rounded-lg border ${
                            paymentMethod === m.id ? 'bg-amber-600 text-white border-amber-500' : 'bg-stone-950 text-stone-400 border-stone-800'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => setIsPaymentOpen(false)} className="flex-1 py-2 rounded-lg bg-stone-800 text-xs font-semibold text-stone-300">
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSavePayment}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Confirmar pagamento
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {!isClosed && order.status !== 'pronto' && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy}
                  className="w-full py-2.5 rounded-xl border border-rose-900 text-rose-400 hover:bg-rose-950/40 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  Cancelar OS
                </button>
              )}
            </div>
          )}

          {/* HISTÓRICO */}
          {activeTab === 'historico' && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  withBusy(async () => {
                    if (await addNote(order.id, note.trim())) setNote('');
                  });
                }}
                className="flex gap-2"
              >
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar observação..." className={field} />
                <button type="submit" disabled={busy} className="px-3 rounded-xl bg-amber-600 text-white text-xs font-bold">
                  Salvar
                </button>
              </form>
              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-800">
                {order.timeline.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 relative">
                    <div className="w-7 h-7 rounded-full bg-stone-800 border-2 border-stone-700 flex items-center justify-center shrink-0 z-10 text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 p-3 rounded-xl bg-stone-950 border border-stone-800">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white">{event.title}</p>
                        <span className="text-[10px] text-stone-500 shrink-0">{event.timestamp}</span>
                      </div>
                      {event.description && <p className="text-xs text-stone-300 mt-0.5">{event.description}</p>}
                      {event.user && <span className="text-[10px] text-amber-500/90 font-semibold block mt-1">{event.user}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Barra de ação (zona do polegar) */}
        <div className="p-3 border-t border-stone-800 bg-stone-950 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddPhoto}
            disabled={busy}
            className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200"
            title="Tirar foto"
          >
            <Camera className="w-5 h-5 text-amber-400" />
          </button>

          {isClosed ? (
            <div className="flex-1 py-3 px-4 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 text-xs font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{order.status === 'entregue' ? 'INSTRUMENTO ENTREGUE' : 'OS CANCELADA'}</span>
            </div>
          ) : order.status === 'pronto' ? (
            <button
              type="button"
              disabled={busy}
              onClick={deliver}
              className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>REGISTRAR ENTREGA AO CLIENTE</span>
            </button>
          ) : order.status === 'aguardando_aprovacao' ? (
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>COBRAR APROVAÇÃO NO WHATSAPP</span>
            </button>
          ) : isLuthier ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => withBusy(() => advanceOrderStatus(order.id))}
              className="flex-1 py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <span>
                {order.status === 'orcamento'
                  ? 'ENVIAR ORÇAMENTO'
                  : `AVANÇAR (${STATUS_STEPS[currentStepIndex + 1]?.label || 'CONCLUÍDO'})`}
              </span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          ) : (
            <div className="flex-1 flex gap-2">
              <div className="flex-1 py-3 px-3 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 text-[11px] font-bold flex items-center justify-center gap-1.5 truncate">
                <Hammer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{STATUS_LABELS[order.status].toUpperCase()} · BANCADA</span>
              </div>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-3 py-3 rounded-xl bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 text-xs font-bold flex items-center gap-1 shrink-0"
                title="Atualizar cliente pelo WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
