import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Phone,
  MessageCircle,
  Camera,
  CheckCircle2,
  Clock,
  Calendar,
  Share2,
  Plus,
  DollarSign,
  User,
  Guitar,
  AlertCircle,
  FileText,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Layers,
  Hammer,
  ShieldAlert,
} from 'lucide-react';
import { OrderStatus, ServiceItem } from '../../types';

const STATUS_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'recebido', label: 'Recebido' },
  { status: 'diagnostico', label: 'Diagnóstico' },
  { status: 'orcamento', label: 'Orçamento' },
  { status: 'aguardando_aprovacao', label: 'Aprovação' },
  { status: 'em_execucao', label: 'Em Execução' },
  { status: 'pronto', label: 'Pronto' },
  { status: 'entregue', label: 'Entregue' },
];

export const OrderDetailSheet: React.FC = () => {
  const {
    activeOrderId,
    setActiveOrderId,
    orders,
    instruments,
    clients,
    stock,
    currentRole,
    advanceOrderStatus,
    toggleServiceDone,
    addServiceItem,
    openCamera,
    addOrderPhoto,
    approveQuote,
    recordPayment,
    triggerHaptic,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'servicos' | 'fotos' | 'orcamento' | 'historico'>('servicos');
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceTitle, setNewServiceTitle] = useState('');
  const [newServiceLabor, setNewServiceLabor] = useState('120');

  // Payment inline modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao_credito' | 'dinheiro'>('pix');

  if (!activeOrderId) return null;

  const order = orders.find((o) => o.id === activeOrderId);
  if (!order) return null;

  const instrument = instruments.find((i) => i.id === order.instrumentId);
  const client = clients.find((c) => c.id === order.clientId);

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceTitle.trim()) return;
    triggerHaptic();
    addServiceItem(order.id, {
      title: newServiceTitle.trim(),
      laborPrice: parseFloat(newServiceLabor) || 0,
      done: false,
      partsUsed: [],
    });
    setNewServiceTitle('');
    setIsAddingService(false);
    showToast({
      title: 'Serviço adicionado à OS',
      type: 'success',
    });
  };

  const handleAddPhoto = () => {
    triggerHaptic();
    const isAtendente = currentRole === 'atendente';
    const tag = isAtendente ? 'entrada' : 'bancada';
    const defaultCaption = isAtendente
      ? 'Foto de entrada / avarias no balcão'
      : 'Foto registrada na bancada';

    openCamera((url, caption) => {
      addOrderPhoto(order.id, {
        url,
        tag,
        caption: caption || defaultCaption,
      });
    });
  };

  const handleStepClick = (targetStatus: OrderStatus) => {
    triggerHaptic();
    if (currentRole === 'luthier') {
      advanceOrderStatus(order.id, targetStatus);
      return;
    }

    // Atendente: Allowed to deliver when ready
    if (targetStatus === 'entregue' && order.status === 'pronto') {
      advanceOrderStatus(order.id, 'entregue', 'Entregue ao cliente no balcão de recepção');
      showToast({
        title: 'Entrega Registrada!',
        description: 'Instrumento entregue ao cliente com sucesso.',
        type: 'success',
      });
      if (remainingBalance > 0) {
        setIsPaymentModalOpen(true);
      }
      return;
    }

    showToast({
      title: 'Etapa Técnica Reservada',
      description: 'Diagnóstico e execução de bancada são exclusivas do Luthier / Dono.',
      type: 'info',
    });
  };

  const handleShareWhatsApp = () => {
    triggerHaptic();
    const phoneClean = client?.phone.replace(/\D/g, '') || '';
    const message = encodeURIComponent(
      `Olá ${client?.name}! Aqui é da Oficina Luthier.\n\nAtualização sobre seu ${instrument?.brand} ${instrument?.model} (OS #${order.orderNumber}):\nStatus atual: *${order.status.toUpperCase().replace('_', ' ')}*.\n\nAcompanhe fotos e detalhes pelo link do portal:\nhttps://luthieria.app/os/${order.clientTrackingToken}\n\nQualquer dúvida, estamos à disposição na bancada!`
    );
    window.open(`https://wa.me/55${phoneClean}?text=${message}`, '_blank');
  };

  const handleSavePayment = async () => {
    const val = parseFloat(paymentAmount);
    if (!val || val <= 0) {
      showToast({ title: 'Informe um valor válido', type: 'warning' });
      return;
    }
    try {
      await recordPayment({
        orderId: order.id,
        clientId: order.clientId,
        orderNumber: order.orderNumber,
        clientName: client?.name || 'Cliente',
        instrumentDescription: `${instrument?.brand} ${instrument?.model}`,
        amount: val,
        method: paymentMethod,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        status: 'concluido',
      });
    } catch {
      return; // erro já exibido em toast; mantém o formulário aberto para corrigir o valor
    }
    setIsPaymentModalOpen(false);
    setPaymentAmount('');
  };

  const remainingBalance = Math.max(0, order.totalAmount - (order.paidAmount || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-black/60 animate-in fade-in">
      <div className="w-full max-w-2xl bg-base-900 border-t sm:border border-base-800 rounded-t-2xl sm:rounded-2xl max-h-[95dvh] h-[95dvh] sm:h-[90dvh] flex flex-col overflow-hidden text-base-100 shadow-lg">
        {/* Header */}
        <div className="px-4 py-3 bg-base-950/90 border-b border-base-800 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-accent-500">
                OS #{order.orderNumber}
              </span>
              <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-base-800 text-base-300 border border-base-700">
                {order.priority}
              </span>
              {currentRole === 'atendente' ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                  Recepção · Balcão
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-950 text-accent-300 border border-accent-800">
                  Bancada & Dono (Admin)
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-base-50 truncate mt-0.5">
              {instrument?.brand} {instrument?.model}
            </h2>
            <p className="text-xs text-base-400 truncate">
              Cliente: {client?.name} · {client?.phone}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
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
              className="p-2 rounded-xl text-base-400 hover:text-base-50 hover:bg-base-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Stepper Scrollable */}
        <div className="px-4 py-2.5 bg-base-950/50 border-b border-base-800 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {STATUS_STEPS.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div key={step.status} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStepClick(step.status)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      isCurrent
                        ? 'bg-accent-600 text-on-accent '
                        : isPast
                        ? 'bg-base-800 text-base-400 hover:text-base-200'
                        : 'bg-base-900/60 text-base-600'
                    }`}
                  >
                    {isPast && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    <span>{step.label}</span>
                  </button>
                  {idx < STATUS_STEPS.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-base-700 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs Segmented Control */}
        <div className="px-4 pt-2 pb-1 bg-base-900 border-b border-base-800 flex gap-1">
          {[
            { id: 'servicos', label: 'Serviços' },
            { id: 'fotos', label: `Fotos (${order.photos.length})` },
            { id: 'orcamento', label: 'Orçamento' },
            { id: 'historico', label: 'Linha do Tempo' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                triggerHaptic();
                setActiveTab(tab.id as any);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors text-center ${
                activeTab === tab.id
                  ? 'bg-accent-950 text-accent-200 border border-accent-800/80 shadow-sm'
                  : 'text-base-400 hover:text-base-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: SERVIÇOS & CHECKLIST */}
          {activeTab === 'servicos' && (
            <div className="space-y-4">
              {/* Defect Overview */}
              <div className="p-3.5 rounded-2xl bg-base-950 border border-base-800 space-y-1">
                <span className="text-[11px] font-semibold text-base-400 uppercase tracking-wider">
                  Defeito Relatado / Queixa
                </span>
                <p className="text-xs text-base-200 font-medium">
                  {order.reportedIssue}
                </p>
                {order.diagnosisNotes && (
                  <div className="pt-2 border-t border-base-800 mt-2">
                    <span className="text-[10px] font-semibold text-accent-400 uppercase tracking-wider">
                      Diagnóstico do Luthier:
                    </span>
                    <p className="text-xs text-base-300 mt-0.5">{order.diagnosisNotes}</p>
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-base-300">
                    Checklist de Serviços ({order.services.filter((s) => s.done).length}/{order.services.length})
                  </span>
                  {currentRole === 'luthier' ? (
                    <button
                      type="button"
                      onClick={() => setIsAddingService(!isAddingService)}
                      className="text-xs text-accent-400 font-semibold flex items-center gap-1 hover:text-accent-300"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Serviço
                    </button>
                  ) : (
                    <span className="text-[10px] text-base-400 font-medium bg-base-950 px-2 py-0.5 rounded-md border border-base-800">
                      Bancada Luthier
                    </span>
                  )}
                </div>

                {isAddingService && currentRole === 'luthier' && (
                  <form
                    onSubmit={handleAddService}
                    className="p-3 rounded-2xl bg-base-950 border border-base-800 space-y-2"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Descrição do serviço (ex: Troca de captador ponte)..."
                      value={newServiceTitle}
                      onChange={(e) => setNewServiceTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-base-900 border border-base-700 rounded-xl text-xs text-base-50"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center gap-1 bg-base-900 border border-base-700 rounded-xl px-3 py-1.5 text-xs">
                        <span className="text-base-400">R$</span>
                        <input
                          type="number"
                          placeholder="Mão de obra"
                          value={newServiceLabor}
                          onChange={(e) => setNewServiceLabor(e.target.value)}
                          className="w-full bg-transparent text-base-50 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-accent-600 hover:bg-accent-500 text-on-accent text-xs font-semibold rounded-xl"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {order.services.map((service) => (
                    <div
                      key={service.id}
                      onClick={() => {
                        if (currentRole === 'luthier') {
                          toggleServiceDone(order.id, service.id);
                        } else {
                          triggerHaptic();
                          showToast({
                            title: 'Ação de Bancada',
                            description: 'A execução e marcação dos serviços são realizadas pelo Luthier na bancada.',
                            type: 'info',
                          });
                        }
                      }}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        service.done
                          ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200 opacity-80'
                          : 'bg-base-950/70 border-base-800 text-base-100 hover:border-base-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold leading-snug ${
                            service.done ? 'line-through text-base-400' : 'text-base-100'
                          }`}
                        >
                          {service.title}
                        </p>
                        {service.partsUsed.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {service.partsUsed.map((p, idx) => (
                              <p key={idx} className="text-[10px] text-accent-400/90 font-mono">
                                • {p.quantity}x {p.stockItemName} (+R$ {p.unitPrice * p.quantity})
                              </p>
                            ))}
                          </div>
                        )}
                        <span className="text-[11px] font-semibold text-accent-500 mt-1 block">
                          Mão de obra: R$ {service.laborPrice.toFixed(2)}
                        </span>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${
                          service.done
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-base-600 bg-base-900'
                        }`}
                      >
                        {service.done && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOTOS */}
          {activeTab === 'fotos' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-base-300">
                  Galeria da OS ({order.photos.length} fotos)
                </span>
                <button
                  type="button"
                  onClick={handleAddPhoto}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-on-accent text-xs font-semibold active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  Nova Foto
                </button>
              </div>

              {order.photos.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-base-800 text-center space-y-2">
                  <Camera className="w-8 h-8 text-base-600 mx-auto" />
                  <p className="text-xs text-base-400">Nenhuma foto registrada ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {order.photos.map((ph) => (
                    <div
                      key={ph.id}
                      className="rounded-2xl overflow-hidden border border-base-800 bg-base-950 space-y-1.5"
                    >
                      <div className="aspect-square relative overflow-hidden">
                        <img
                          src={ph.url}
                          alt={ph.caption}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-semibold uppercase text-accent-300">
                          {ph.tag}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-base-200 line-clamp-2">
                          {ph.caption}
                        </p>
                        <span className="text-[10px] text-base-500 block mt-1">
                          {ph.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORÇAMENTO & PAGAMENTOS */}
          {activeTab === 'orcamento' && (
            <div className="space-y-4">
              {/* Quote Breakdown Card */}
              <div className="p-4 rounded-2xl bg-base-950 border border-base-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-base-400">
                    Detalhamento Financeiro
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      order.quote?.status === 'aprovado'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : order.quote?.status === 'rejeitado'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-accent-950 text-accent-300 border border-accent-800'
                    }`}
                  >
                    {order.quote?.status || 'Pendente'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs pt-1 border-t border-base-800">
                  <div className="flex justify-between text-base-300">
                    <span>Mão de Obra ({order.services.length} serviços):</span>
                    <span className="font-semibold">
                      R$ {order.services.reduce((acc, s) => acc + s.laborPrice, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base-300">
                    <span>Peças & Insumos Utilizados:</span>
                    <span className="font-semibold">
                      R${' '}
                      {order.services
                        .reduce(
                          (acc, s) =>
                            acc +
                            s.partsUsed.reduce((pAcc, p) => pAcc + p.unitPrice * p.quantity, 0),
                          0
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                  {order.quote?.discount ? (
                    <div className="flex justify-between text-emerald-400">
                      <span>Desconto Aplicado:</span>
                      <span>- R$ {order.quote.discount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-base font-semibold text-base-50 pt-2 border-t border-base-800">
                    <span>Valor Total da OS:</span>
                    <span className="text-accent-400 font-mono">
                      R$ {order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-base-400 pt-1">
                    <span>Valor Pago até agora:</span>
                    <span className="text-emerald-400 font-mono font-semibold">
                      R$ {(order.paidAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-base-400">
                    <span>Saldo Restante:</span>
                    <span className="text-rose-400 font-mono font-semibold">
                      R$ {remainingBalance.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quote Action Buttons */}
                <div className="pt-2 border-t border-base-800 flex gap-2">
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar Orçamento WhatsApp
                  </button>

                  {order.quote?.status !== 'aprovado' && (
                    <button
                      type="button"
                      onClick={() => approveQuote(order.id)}
                      className="py-2.5 px-3 rounded-xl bg-accent-600 hover:bg-accent-500 text-on-accent text-xs font-semibold flex items-center gap-1 active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprovar
                    </button>
                  )}
                </div>
              </div>

              {/* Payments Section */}
              <div className="p-4 rounded-2xl bg-base-950 border border-base-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-base-400">
                    Pagamentos Registrados
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentAmount(remainingBalance > 0 ? remainingBalance.toString() : '100');
                      setIsPaymentModalOpen(true);
                    }}
                    className="text-xs text-accent-400 font-semibold hover:text-accent-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Registrar Pagamento
                  </button>
                </div>

                {isPaymentModalOpen && (
                  <div className="p-3 rounded-xl bg-base-900 border border-base-700 space-y-2.5 animate-in fade-in">
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-base-400 block mb-1">
                        Valor (R$)
                      </label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full px-3 py-2 bg-base-950 border border-base-700 rounded-xl text-xs text-base-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-base-400 block mb-1">
                        Forma de Pagamento
                      </label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['pix', 'cartao_credito', 'dinheiro'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            className={`py-1.5 text-xs font-semibold rounded-lg capitalize border ${
                              paymentMethod === m
                                ? 'bg-accent-600 text-on-accent border-accent-500'
                                : 'bg-base-950 text-base-400 border-base-800'
                            }`}
                          >
                            {m.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsPaymentModalOpen(false)}
                        className="flex-1 py-2 rounded-lg bg-base-800 text-xs font-semibold text-base-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePayment}
                        className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      >
                        Confirmar Pagamento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: HISTÓRICO & LINHA DO TEMPO */}
          {activeTab === 'historico' && (
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-base-400 block">
                Linha do Tempo de Acontecimentos
              </span>

              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-base-800">
                {order.timeline.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 relative">
                    <div className="w-7 h-7 rounded-full bg-base-800 border-2 border-base-700 flex items-center justify-center shrink-0 z-10 text-accent-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 p-3 rounded-xl bg-base-950 border border-base-800">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-base-50">{event.title}</p>
                        <span className="text-[10px] text-base-500">{event.timestamp}</span>
                      </div>
                      {event.description && (
                        <p className="text-xs text-base-300 mt-0.5">{event.description}</p>
                      )}
                      <span className="text-[10px] text-accent-500/90 font-semibold block mt-1">
                        Responsável: {event.user}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Thumb-Zone Action Bar */}
        <div className="p-3 border-t border-base-800 bg-base-950 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddPhoto}
            className="p-3 rounded-xl bg-base-800 hover:bg-base-700 text-base-200"
            title={currentRole === 'atendente' ? 'Tirar foto de entrada / balcão' : 'Tirar foto rápida da bancada'}
          >
            <Camera className="w-5 h-5 text-accent-400" />
          </button>

          {currentRole === 'luthier' ? (
            <button
              type="button"
              onClick={() => advanceOrderStatus(order.id)}
              className="flex-1 py-3.5 px-4 rounded-xl bg-accent-600 hover:bg-accent-500 text-on-accent text-xs font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <span>AVANÇAR STATUS ({STATUS_STEPS[currentStepIndex + 1]?.label || 'CONCLUÍDO'})</span>
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          ) : (
            /* ATENDENTE / RECEPÇÃO: Foco em Entrada e Entrega */
            order.status === 'pronto' ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  advanceOrderStatus(order.id, 'entregue', 'Entregue ao cliente no balcão de recepção');
                  showToast({
                    title: 'Entrega Registrada!',
                    description: 'Instrumento entregue ao cliente com sucesso.',
                    type: 'success',
                  });
                  if (remainingBalance > 0) {
                    setIsPaymentModalOpen(true);
                  }
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>REGISTRAR ENTREGA AO CLIENTE</span>
              </button>
            ) : order.status === 'entregue' ? (
              <div className="flex-1 py-3 px-4 rounded-xl bg-base-900 border border-base-800 text-base-400 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>INSTRUMENTO JÁ ENTREGUE AO CLIENTE</span>
              </div>
            ) : order.status === 'recebido' ? (
              <div className="flex-1 flex gap-2">
                <div className="flex-1 py-3 px-3 rounded-xl bg-accent-950/40 border border-accent-800/60 text-accent-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-accent-400 shrink-0" />
                  <span className="truncate">ENTRADA REGISTRADA · BANCADA PENDENTE</span>
                </div>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="px-3 py-3 rounded-xl bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 text-xs font-semibold flex items-center gap-1 shrink-0"
                  title="Avisar cliente pelo WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            ) : order.status === 'aguardando_aprovacao' ? (
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>NOTIFICAR ORÇAMENTO VIA WHATSAPP</span>
              </button>
            ) : (
              <div className="flex-1 flex gap-2">
                <div className="flex-1 py-3 px-3 rounded-xl bg-base-900 border border-base-800 text-base-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 truncate">
                  <Hammer className="w-3.5 h-3.5 text-accent-400 shrink-0" />
                  <span className="truncate">EM ANDAMENTO NA BANCADA (LUTHIER)</span>
                </div>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="px-3 py-3 rounded-xl bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800 text-xs font-semibold flex items-center gap-1 shrink-0"
                  title="Atualizar cliente pelo WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
