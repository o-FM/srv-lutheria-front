import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PhotoImage } from '../common/PhotoImage';
import {
  ClipboardList,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  MessageCircle,
  Kanban,
  List,
  Plus,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { OrderStatus } from '../../types';

export const OrdersModule: React.FC = () => {
  const {
    orders,
    instruments,
    clients,
    currentRole,
    setActiveOrderId,
    advanceOrderStatus,
    setIsNewOrderWizardOpen,
    triggerHaptic,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [searchFilter, setSearchFilter] = useState('');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');

  const statusOptions: { id: string; label: string }[] = [
    { id: 'todos', label: 'Todas' },
    { id: 'recebido', label: 'Recebido' },
    { id: 'diagnostico', label: 'Diagnóstico' },
    { id: 'orcamento', label: 'Orçamento' },
    { id: 'aguardando_aprovacao', label: 'Aprovação' },
    { id: 'em_execucao', label: 'Em Execução' },
    { id: 'pronto', label: 'Pronto' },
    { id: 'entregue', label: 'Entregue' },
  ];

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'todos' && o.status !== statusFilter) return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const client = clients.find((c) => c.id === o.clientId);
      const inst = instruments.find((i) => i.id === o.instrumentId);
      const matchesNum = o.orderNumber.toString().includes(q);
      const matchesClient = client?.name.toLowerCase().includes(q);
      const matchesInst =
        inst?.brand.toLowerCase().includes(q) || inst?.model.toLowerCase().includes(q);
      const matchesIssue = o.reportedIssue.toLowerCase().includes(q);
      return matchesNum || matchesClient || matchesInst || matchesIssue;
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-24 max-w-5xl mx-auto">
      {/* Top Bar with Search & View Mode */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrar por nº de OS, cliente ou instrumento..."
            className="w-full pl-9 pr-3 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 justify-between sm:justify-end">
          {/* View toggle (List vs Kanban) */}
          <div className="flex items-center bg-stone-900 border border-stone-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'lista'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Visualização em lista corrida"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
              title="Visualização Kanban por colunas de status"
            >
              <Kanban className="w-4 h-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsNewOrderWizardOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova OS
          </button>
        </div>
      </div>

      {/* Filter Horizontal Chips (Zero pill discipline: clean segmented buttons) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {statusOptions.map((opt) => {
          const count =
            opt.id === 'todos'
              ? orders.length
              : orders.filter((o) => o.status === opt.id).length;
          const isActive = statusFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                triggerHaptic();
                setStatusFilter(opt.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border ${
                isActive
                  ? 'bg-amber-950 border-amber-600 text-amber-200 shadow-sm'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              {opt.label} <span className="opacity-75 font-mono ml-0.5">({count})</span>
            </button>
          );
        })}
      </div>

      {/* LIST VIEW */}
      {viewMode === 'lista' ? (
        <div className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center bg-stone-900/40 rounded-2xl border border-stone-800 space-y-2">
              <ClipboardList className="w-10 h-10 text-stone-600 mx-auto" />
              <p className="text-sm font-semibold text-stone-300">Nenhuma OS encontrada</p>
              <p className="text-xs text-stone-500">Tente ajustar seus filtros ou cadastre uma nova OS.</p>
            </div>
          ) : (
            filteredOrders.map((ord) => {
              const inst = instruments.find((i) => i.id === ord.instrumentId);
              const client = clients.find((c) => c.id === ord.clientId);
              const doneCount = ord.services.filter((s) => s.done).length;
              const totalCount = ord.services.length;
              const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
              const hasPhoto = ord.photos.length > 0;

              return (
                <div
                  key={ord.id}
                  className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 hover:border-stone-700 transition-all shadow-md space-y-3"
                >
                  <div
                    onClick={() => {
                      triggerHaptic();
                      setActiveOrderId(ord.id);
                    }}
                    className="cursor-pointer flex items-start justify-between gap-3"
                  >
                    {/* Left: Thumbnail & Main info */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-stone-950 border border-stone-800 overflow-hidden shrink-0 flex items-center justify-center relative">
                        {hasPhoto ? (
                          <PhotoImage photo={ord.photos[0]}
                              alt="Instrumento"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl">🎸</span>
                        )}
                        <span className="absolute bottom-0 right-0 px-1 py-0.2 bg-black/80 text-[9px] font-mono font-bold text-amber-400">
                          #{ord.orderNumber}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-xs text-white truncate">
                            {inst?.brand} {inst?.model}
                          </h3>
                          <span className="text-[10px] text-stone-400">· {client?.name}</span>
                        </div>
                        <p className="text-xs text-stone-300 line-clamp-1 mt-0.5">
                          {ord.reportedIssue}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Prazo: {ord.estimatedDeliveryDate.substring(5)}
                          </span>
                          <span>·</span>
                          <span className="font-mono text-amber-300 font-semibold">
                            R$ {ord.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status badge */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                          ord.status === 'em_execucao'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                            : ord.status === 'pronto'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : ord.status === 'entregue'
                            ? 'bg-stone-800 text-stone-400'
                            : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        {ord.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Service Progress Bar */}
                  {totalCount > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-stone-400">
                        <span>
                          Checklist: {doneCount}/{totalCount} serviços
                        </span>
                        <span>{Math.round(progressPct)}%</span>
                      </div>
                      <div className="w-full bg-stone-950 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Fast Action Buttons on Card */}
                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setActiveOrderId(ord.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-300 transition-colors"
                    >
                      Ver Detalhes
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const phoneClean = client?.phone.replace(/\D/g, '') || '';
                          window.open(`https://wa.me/55${phoneClean}`, '_blank');
                        }}
                        className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800/60"
                        title="Abrir conversa WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>

                      {currentRole === 'luthier' ? (
                        ord.status !== 'entregue' && (
                          <button
                            type="button"
                            onClick={() => advanceOrderStatus(ord.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
                          >
                            <span>Avançar</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )
                      ) : ord.status === 'pronto' ? (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            advanceOrderStatus(ord.id, 'entregue', 'Entregue no balcão de atendimento');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm active:scale-95 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Entregar</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* KANBAN BOARD VIEW */
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
          {(
            [
              'recebido',
              'diagnostico',
              'aguardando_aprovacao',
              'em_execucao',
              'pronto',
            ] as OrderStatus[]
          ).map((colStatus) => {
            const colOrders = filteredOrders.filter((o) => o.status === colStatus);
            return (
              <div
                key={colStatus}
                className="w-72 shrink-0 bg-stone-900/80 border border-stone-800 rounded-2xl p-3 flex flex-col max-h-[75vh] snap-center"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 capitalize">
                    {colStatus.replace('_', ' ')}
                  </h4>
                  <span className="text-xs font-mono font-bold bg-stone-800 px-2 py-0.5 rounded-full text-stone-300">
                    {colOrders.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {colOrders.map((ord) => {
                    const inst = instruments.find((i) => i.id === ord.instrumentId);
                    const client = clients.find((c) => c.id === ord.clientId);
                    return (
                      <div
                        key={ord.id}
                        onClick={() => {
                          triggerHaptic();
                          setActiveOrderId(ord.id);
                        }}
                        className="p-3 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-600/80 cursor-pointer space-y-2 transition-all shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-[10px] font-bold text-amber-400">
                            OS #{ord.orderNumber}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {ord.estimatedDeliveryDate.substring(5)}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white truncate">
                          {inst?.brand} {inst?.model}
                        </p>
                        <p className="text-[11px] text-stone-400 line-clamp-1">
                          {client?.name} · {ord.reportedIssue}
                        </p>
                        <div className="flex justify-between items-center pt-1 border-t border-stone-900 text-[10px]">
                          <span className="text-amber-400 font-semibold font-mono">
                            R$ {ord.totalAmount.toFixed(2)}
                          </span>
                          <span className="text-stone-500">
                            {ord.services.filter((s) => s.done).length}/{ord.services.length} feitos
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
