import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Guitar,
  Clock,
  CheckCircle2,
  Camera,
  MessageCircle,
  ThumbsUp,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { OrderStatus } from '../../types';

export const ClientPortalView: React.FC = () => {
  const { user, requestReauthentication } = useAuth();
  const {
    orders,
    instruments,
    clients,
    approveQuote,
    rejectQuote,
    setRole,
    triggerHaptic,
    showToast,
  } = useApp();

  // Strictly isolate orders to the logged-in client (e.g. Lucas Silveira)
  const currentClient =
    (user && clients.find((c) => c.email.toLowerCase() === user.email.toLowerCase())) ||
    clients.find((c) => c.id === 'cli-1') ||
    clients[0];

  const clientOrders = orders.filter((o) => o.clientId === currentClient.id);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    clientOrders[0]?.id || ''
  );

  const activeOrderId = clientOrders.some((o) => o.id === selectedOrderId)
    ? selectedOrderId
    : clientOrders[0]?.id;

  const order = clientOrders.find((o) => o.id === activeOrderId) || clientOrders[0];
  const instrument = instruments.find((i) => i.id === order?.instrumentId);
  const client = currentClient;

  if (!order) {
    return (
      <div className="p-8 text-center text-stone-400">
        Nenhum instrumento em ordem de serviço no momento.
      </div>
    );
  }

  const steps: { status: OrderStatus; label: string; desc: string }[] = [
    { status: 'recebido', label: 'Recebido', desc: 'Chegada na oficina' },
    { status: 'diagnostico', label: 'Diagnóstico', desc: 'Análise na bancada' },
    { status: 'aguardando_aprovacao', label: 'Orçamento', desc: 'Aguardando aprovação' },
    { status: 'em_execucao', label: 'Em Execução', desc: 'Serviços em andamento' },
    { status: 'pronto', label: 'Pronto', desc: 'Disponível para retirada' },
  ];

  const currentStepIdx = steps.findIndex((s) => s.status === order.status);

  const handleApprove = () => {
    triggerHaptic();
    approveQuote(order.id);
  };

  const handleContactWhatsApp = () => {
    triggerHaptic();
    const msg = encodeURIComponent(
      `Olá luthier! Sou ${client?.name}, sobre a OS #${order.orderNumber} do meu ${instrument?.brand} ${instrument?.model}. Poderiam tirar uma dúvida?`
    );
    window.open(`https://wa.me/5511987654321?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-4 pb-24 max-w-xl mx-auto">
      {/* Return to Admin Switcher Banner */}
      <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between text-xs text-amber-200">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          Você está vendo o Portal do Cliente (sem senha)
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await requestReauthentication({
                actionType: 'SWITCH_PROFILE',
                targetRole: 'luthier',
                title: 'Acesso Restrito - Luthier Dono',
                description: 'Para retornar ao painel do Luthier, informe as credenciais de acesso da oficina.',
              });
            } catch {
              // Canceled by user
            }
          }}
          className="px-2.5 py-1 rounded-lg bg-amber-800 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 active:scale-95 transition-all"
        >
          Voltar p/ Luthier
        </button>
      </div>

      {/* Switch between client's own instruments if they have multiple */}
      {clientOrders.length > 1 && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
            Meus Instrumentos na Oficina:
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {clientOrders.map((ord) => {
              const inst = instruments.find((i) => i.id === ord.instrumentId);
              const isSelected = ord.id === order.id;
              return (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setSelectedOrderId(ord.id);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border ${
                    isSelected
                      ? 'bg-amber-950 border-amber-600 text-amber-200 shadow-md ring-1 ring-amber-500'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <span className="font-mono text-amber-400 font-bold mr-1">OS #{ord.orderNumber}</span>
                  <span>{inst?.brand} {inst?.model}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Instrument Card */}
      <div className="p-5 rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <span className="font-mono text-xs font-bold text-amber-400">
              CÓDIGO DE ACOMPANHAMENTO: {order.clientTrackingToken}
            </span>
            <h1 className="text-xl font-black text-white mt-0.5">
              {instrument?.brand} {instrument?.model}
            </h1>
            <p className="text-xs text-stone-400 mt-0.5">
              Proprietário: <span className="text-stone-200 font-semibold">{client?.name}</span>
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
              order.status === 'em_execucao'
                ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                : order.status === 'pronto'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-stone-800 text-stone-300'
            }`}
          >
            {order.status.replace('_', ' ')}
          </span>
        </div>

        {/* Estimated Date */}
        <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-stone-300">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Previsão de Entrega:</span>
          </div>
          <span className="font-bold text-white font-mono">
            {order.estimatedDeliveryDate}
          </span>
        </div>

        {/* Status Timeline */}
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
            Progresso do Instrumento na Oficina
          </span>
          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-800">
            {steps.map((st, idx) => {
              const isDone = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={st.status} className="flex items-start gap-3 relative">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 text-[10px] font-bold ${
                      isDone
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-amber-600 border-amber-500 text-white animate-pulse'
                        : 'bg-stone-900 border-stone-700 text-stone-500'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div>
                    <p
                      className={`text-xs font-bold ${
                        isCurrent ? 'text-amber-400' : isDone ? 'text-stone-200' : 'text-stone-500'
                      }`}
                    >
                      {st.label}
                    </p>
                    <p className="text-[11px] text-stone-400">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quote Approval Box (Huge Thumb Action if Waiting Approval) */}
      {order.status === 'aguardando_aprovacao' && (
        <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/80 via-stone-900 to-stone-950 border-2 border-amber-600 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-sm text-white uppercase tracking-tight">
              Aprovação de Orçamento Pendente
            </h3>
          </div>
          <p className="text-xs text-stone-300">
            O diagnóstico técnico da bancada foi concluído. Confira os serviços recomendados e autorize em 1 toque:
          </p>

          <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-2 text-xs">
            {order.services.map((s) => (
              <div key={s.id} className="flex justify-between text-stone-300">
                <span className="truncate pr-2">• {s.title}</span>
                <span className="font-semibold text-white">R$ {s.laborPrice.toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-stone-800 flex justify-between font-black text-sm text-white">
              <span>Total Orçado:</span>
              <span className="text-amber-400 font-mono">
                R$ {order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 1-Touch Approve Button */}
          <button
            type="button"
            onClick={handleApprove}
            className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/80 active:scale-95 transition-all"
          >
            <ThumbsUp className="w-5 h-5" />
            APROVAR ORÇAMENTO EM 1 TOQUE
          </button>
        </div>
      )}

      {/* Photos Timeline for Client */}
      {order.photos.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
            Fotos do seu Instrumento na Oficina ({order.photos.length})
          </span>
          <div className="grid grid-cols-2 gap-3">
            {order.photos.map((ph) => (
              <div
                key={ph.id}
                className="rounded-2xl overflow-hidden border border-stone-800 bg-stone-900 space-y-1.5 shadow-md"
              >
                <div className="aspect-square relative overflow-hidden">
                  <img
                    src={ph.url}
                    alt={ph.caption}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-bold uppercase text-amber-300">
                    {ph.tag}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs text-stone-200 line-clamp-2">{ph.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Direct Contact with Workshop */}
      <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-white">Dúvidas sobre o reparo?</p>
          <p className="text-[11px] text-stone-400">Fale direto com o luthier da sua OS.</p>
        </div>
        <button
          type="button"
          onClick={handleContactWhatsApp}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp da Oficina
        </button>
      </div>
    </div>
  );
};
