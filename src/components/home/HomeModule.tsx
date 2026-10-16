import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  Plus,
  Camera,
  Hammer,
  ArrowRight,
  TrendingUp,
  ChevronRight,
  DollarSign,
  Users,
  MessageCircle,
  Guitar,
} from 'lucide-react';

export const HomeModule: React.FC = () => {
  const {
    orders,
    stock,
    clients,
    instruments,
    currentRole,
    setActiveTab,
    setActiveOrderId,
    setIsNewOrderWizardOpen,
    setIsWorkbenchModeOpen,
    openCamera,
    addOrderPhoto,
    advanceOrderStatus,
    triggerHaptic,
  } = useApp();

  // Metrics
  const activeOrders = orders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado');
  const onBench = orders.filter((o) => o.status === 'em_execucao').length;
  const pendingApprovals = orders.filter((o) => o.status === 'aguardando_aprovacao').length;
  const readyForDelivery = orders.filter((o) => o.status === 'pronto').length;
  const lowStockItems = stock.filter((s) => s.currentQuantity <= s.minQuantity);

  const totalMonthlyBilling = orders
    .filter((o) => o.status === 'pronto' || o.status === 'entregue' || o.paidAmount > 0)
    .reduce((acc, o) => acc + (o.paidAmount || 0), 0);

  const handleQuickPhoto = () => {
    triggerHaptic();
    const firstActive = activeOrders[0];
    if (!firstActive) {
      setIsNewOrderWizardOpen(true);
      return;
    }
    openCamera((url, caption) => {
      addOrderPhoto(firstActive.id, {
        url,
        tag: 'bancada',
        caption: caption || 'Foto rápida da bancada',
      });
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Banner / Greeting */}
      <div className="p-4 rounded-2xl bg-base-900 border border-base-800 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold text-base-50 tracking-tight">
                {currentRole === 'luthier'
                  ? 'Bancada e gestão'
                  : 'Recepção'}
              </h1>
            </div>
            <p className="text-xs text-base-300 mt-0.5">
              {currentRole === 'luthier'
                ? `${activeOrders.length} instrumentos em fluxo · Visão completa de bancada, prazos e faturamento`
                : `${activeOrders.length} instrumentos cadastrados · Foco em entrada rápida e entregas de hoje`}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-accent-400 bg-accent-950/80 px-2.5 py-1 rounded-xl border border-accent-800">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* 4 Quick Stat Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div
            onClick={() => setActiveTab('os')}
            className="p-3 rounded-2xl bg-base-950/60 border border-base-800 cursor-pointer hover:border-accent-500/50 transition-colors"
          >
            <span className="text-[10px] text-base-400 block font-semibold uppercase">Na Bancada</span>
            <span className="text-xl font-mono font-semibold text-accent-400">{onBench}</span>
            <span className="text-[10px] text-base-500 block">em execução</span>
          </div>

          <div
            onClick={() => setActiveTab('os')}
            className="p-3 rounded-2xl bg-base-950/60 border border-base-800 cursor-pointer hover:border-accent-500/50 transition-colors"
          >
            <span className="text-[10px] text-base-400 block font-semibold uppercase">Prontos</span>
            <span className="text-xl font-mono font-semibold text-emerald-400">{readyForDelivery}</span>
            <span className="text-[10px] text-base-500 block">p/ retirada</span>
          </div>

          <div
            onClick={() => setActiveTab('os')}
            className="p-3 rounded-2xl bg-base-950/60 border border-base-800 cursor-pointer hover:border-accent-500/50 transition-colors"
          >
            <span className="text-[10px] text-base-400 block font-semibold uppercase">Orçamentos</span>
            <span className="text-xl font-mono font-semibold text-accent-300">{pendingApprovals}</span>
            <span className="text-[10px] text-base-500 block">aguardando</span>
          </div>

          {currentRole === 'luthier' ? (
            <div
              onClick={() => setActiveTab('mais')}
              className="p-3 rounded-2xl bg-base-950/60 border border-base-800 cursor-pointer hover:border-accent-500/50 transition-colors"
            >
              <span className="text-[10px] text-base-400 block font-semibold uppercase">Faturamento</span>
              <span className="text-base sm:text-lg font-mono font-semibold text-base-200">
                R$ {totalMonthlyBilling.toFixed(0)}
              </span>
              <span className="text-[10px] text-emerald-400 block">mês vigente</span>
            </div>
          ) : (
            <div
              onClick={() => setActiveTab('clientes')}
              className="p-3 rounded-2xl bg-base-950/60 border border-base-800 cursor-pointer hover:border-accent-500/50 transition-colors"
            >
              <span className="text-[10px] text-base-400 block font-semibold uppercase">Clientes</span>
              <span className="text-xl font-mono font-semibold text-accent-400">
                {clients.length}
              </span>
              <span className="text-[10px] text-base-500 block">cadastrados</span>
            </div>
          )}
        </div>
      </div>

      {/* Critical Stock Alert Banner (Only for Luthier/Admin) */}
      {currentRole === 'luthier' && lowStockItems.length > 0 && (
        <div
          onClick={() => setActiveTab('estoque')}
          className="p-3.5 rounded-2xl bg-rose-950/50 border border-rose-800/80 text-rose-200 flex items-center justify-between cursor-pointer hover:bg-rose-950/70 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-base-50 truncate">
                {lowStockItems.length} itens abaixo do estoque mínimo
              </p>
              <p className="text-[11px] text-rose-300 truncate">
                {lowStockItems.map((i) => i.name).slice(0, 2).join(', ')}...
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
        </div>
      )}

      {/* Thumb-Zone Quick Shortcuts Grid */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-base-400 uppercase tracking-wider block">
          Ações rápidas
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Quick Order Button (Both Luthier and Atendente) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setIsNewOrderWizardOpen(true);
            }}
            className="p-3.5 rounded-2xl bg-accent-600 hover:bg-accent-500 text-on-accent flex flex-col items-start gap-1.5 active:scale-95 transition-all text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center">
              <Plus className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-tight">NOVA OS</p>
              <span className="text-[11px] text-on-accent/80">Cliente, instrumento e defeito</span>
            </div>
          </button>

          {currentRole === 'luthier' ? (
            <>
              {/* Quick Photo Button */}
              <button
                type="button"
                onClick={handleQuickPhoto}
                className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-accent-500/50 text-base-50 flex flex-col items-start gap-1.5 shadow-sm active:scale-95 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-accent-950 text-accent-400 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Foto da Bancada</p>
                  <span className="text-[10px] text-base-400">Antes / depois rápido</span>
                </div>
              </button>

              {/* Workbench Mode */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setIsWorkbenchModeOpen(true);
                }}
                className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-accent-500/50 text-base-50 flex flex-col items-start gap-1.5 shadow-sm active:scale-95 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-accent-950 text-accent-400 flex items-center justify-center">
                  <Hammer className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Modo Bancada</p>
                  <span className="text-[10px] text-base-400">Botões gigantes</span>
                </div>
              </button>

              {/* Stock */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveTab('estoque');
                }}
                className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-accent-500/50 text-base-50 flex flex-col items-start gap-1.5 shadow-sm active:scale-95 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-accent-950 text-accent-400 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Peças & Cordas</p>
                  <span className="text-[10px] text-base-400">Leitor QR / Estoque</span>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Atendente: Cadastrar Cliente */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveTab('clientes');
                }}
                className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-accent-500/50 text-base-50 flex flex-col items-start gap-1.5 shadow-sm active:scale-95 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-accent-950 text-accent-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Cadastrar Cliente</p>
                  <span className="text-[10px] text-base-400">Balcão de entrada</span>
                </div>
              </button>

              {/* Atendente: Consultar Entregas */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveTab('os');
                }}
                className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-accent-500/50 text-base-50 flex flex-col items-start gap-1.5 shadow-sm active:scale-95 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Prontos p/ Retirada</p>
                  <span className="text-[10px] text-base-400">{readyForDelivery} aguardando</span>
                </div>
              </button>

              {/* Atendente: Avisos WhatsApp */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setActiveTab('mais');
                }}
                className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-accent-500/50 text-base-50 flex flex-col items-start gap-1.5 shadow-sm active:scale-95 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-950 text-emerald-400 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Avisos no WhatsApp</p>
                  <span className="text-[10px] text-base-400">Notificar clientes</span>
                </div>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Priority Instruments for Today */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-base-400 uppercase tracking-wider">
            Prazos da semana ({activeOrders.length})
          </span>
          <button
            type="button"
            onClick={() => setActiveTab('os')}
            className="text-xs text-accent-400 hover:text-accent-300 font-semibold flex items-center gap-1"
          >
            Ver Todas
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {activeOrders.slice(0, 4).map((ord) => {
            const inst = instruments.find((i) => i.id === ord.instrumentId);
            const client = clients.find((c) => c.id === ord.clientId);
            const doneServices = ord.services.filter((s) => s.done).length;

            return (
              <div
                key={ord.id}
                className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-base-700 transition-all space-y-2.5"
              >
                <div
                  onClick={() => {
                    triggerHaptic();
                    setActiveOrderId(ord.id);
                  }}
                  className="cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-base-950 border border-base-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {ord.photos[0] ? (
                        <img
                          src={ord.photos[0].url}
                          alt="Foto"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Guitar className="w-5 h-5 text-base-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-accent-400">
                          OS #{ord.orderNumber}
                        </span>
                        <span className="text-xs font-semibold text-base-50 truncate">
                          {inst?.brand} {inst?.model}
                        </span>
                      </div>
                      <p className="text-xs text-base-400 truncate mt-0.5">
                        {client?.name} · {ord.reportedIssue}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase ${
                      ord.status === 'em_execucao'
                        ? 'bg-accent-950 text-accent-300 border border-accent-800'
                        : ord.status === 'pronto'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-base-800 text-base-300'
                    }`}
                  >
                    {ord.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Footer with 1-touch advance */}
                <div className="pt-2 border-t border-base-800/80 flex items-center justify-between text-xs">
                  <span className="text-base-400 text-[11px] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-accent-400" />
                    Prazo: {ord.estimatedDeliveryDate.substring(5)} · {doneServices}/{ord.services.length} serviços
                  </span>

                  {currentRole === 'luthier' ? (
                    <button
                      type="button"
                      onClick={() => advanceOrderStatus(ord.id)}
                      className="px-3 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-on-accent font-semibold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                    >
                      <span>Avançar</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : ord.status === 'pronto' ? (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        advanceOrderStatus(ord.id, 'entregue', 'Entregue no balcão de atendimento');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Entregar</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setActiveOrderId(ord.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-base-800 hover:bg-base-700 text-base-200 font-semibold text-xs flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span>Detalhes</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
