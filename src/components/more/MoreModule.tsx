import React, { useEffect, useMemo, useState } from 'react';
import { useApp, STATUS_LABELS } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Calendar, DollarSign, MessageCircle, Settings, Check } from 'lucide-react';
import { api, FinancialDto, NotificationDto } from '../../services/api';
import { portalUrl, todayIso, toLocalTimestamp } from '../../services/mappers';
import { TeamPanel } from './TeamPanel';
import { CatalogPanel } from './CatalogPanel';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  transferencia: 'Transferência',
};
const brl = (v: number) => `R$ ${Number(v).toFixed(2)}`;

export const MoreModule: React.FC = () => {
  const { user } = useAuth();
  const { orders, clients, instruments, currentRole, setActiveOrderId, triggerHaptic, showToast, handleError } = useApp();

  const [subSection, setSubSection] = useState<'agenda' | 'financeiro' | 'mensagens' | 'config'>('agenda');
  const isLuthier = currentRole === 'luthier';
  const activeSubSection = !isLuthier && (subSection === 'financeiro' || subSection === 'config') ? 'agenda' : subSection;

  // ---------------- agenda ----------------
  const [agendaFilter, setAgendaFilter] = useState<'hoje' | 'semana' | 'todos'>('semana');
  const agenda = useMemo(() => {
    const today = todayIso();
    const weekEnd = todayIso(7);
    return orders
      .filter((o) => o.status !== 'entregue' && o.status !== 'cancelado' && o.estimatedDeliveryDate)
      .filter((o) =>
        agendaFilter === 'hoje'
          ? o.estimatedDeliveryDate <= today
          : agendaFilter === 'semana'
          ? o.estimatedDeliveryDate <= weekEnd
          : true
      )
      .sort((a, b) => a.estimatedDeliveryDate.localeCompare(b.estimatedDeliveryDate));
  }, [orders, agendaFilter]);

  // ---------------- financeiro ----------------
  const [financial, setFinancial] = useState<FinancialDto | null>(null);
  useEffect(() => {
    if (activeSubSection !== 'financeiro') return;
    const from = todayIso().substring(0, 8) + '01';
    api.reports
      .financial(from, todayIso())
      .then(setFinancial)
      .catch((e) => handleError(e, 'Falha ao carregar o financeiro'));
  }, [activeSubSection, handleError]);

  const recentPayments = useMemo(
    () =>
      orders
        .flatMap((o) => o.payments.map((p) => ({ ...p, order: o })))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20),
    [orders]
  );

  // ---------------- mensagens ----------------
  const [pending, setPending] = useState<NotificationDto[]>([]);
  useEffect(() => {
    if (activeSubSection !== 'mensagens') return;
    api.notifications
      .list('whatsapp', 'pendente')
      .then((page) => setPending(page.content))
      .catch((e) => handleError(e, 'Falha ao carregar as mensagens'));
  }, [activeSubSection, handleError]);

  const [selectedTemplateOrder, setSelectedTemplateOrder] = useState<string>('');
  const activeOrder = orders.find((o) => o.id === selectedTemplateOrder) || orders[0];
  const orderClient = clients.find((c) => c.id === activeOrder?.clientId);
  const orderInst = instruments.find((i) => i.id === activeOrder?.instrumentId);

  const getTemplateMessage = (type: 'entrada' | 'orcamento' | 'pronto') => {
    if (!activeOrder) return '';
    const name = orderClient?.name.split(' ')[0] || 'Cliente';
    const instName = `${orderInst?.brand || ''} ${orderInst?.model || 'instrumento'}`.trim();
    const link = activeOrder.clientTrackingToken ? portalUrl(activeOrder.clientTrackingToken) : '';
    switch (type) {
      case 'entrada':
        return `Olá ${name}! Seu ${instName} deu entrada na oficina com a OS #${activeOrder.orderNumber}.${
          link ? ` Acompanhe o andamento e as fotos pelo link:\n${link}` : ''
        }`;
      case 'orcamento':
        return `Olá ${name}! O orçamento da OS #${activeOrder.orderNumber} (${instName}) está pronto: ${brl(
          activeOrder.totalAmount
        )}.${link ? ` Para aprovar em 1 toque:\n${link}` : ''}`;
      case 'pronto':
        return `Boas notícias, ${name}! Seu ${instName} (OS #${activeOrder.orderNumber}) está pronto para retirada. Aguardamos sua visita!`;
    }
  };

  const openWhatsApp = (phone: string, text: string) => {
    triggerHaptic();
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyText = (text: string) => {
    triggerHaptic();
    navigator.clipboard?.writeText(text);
    showToast({ title: 'Mensagem copiada!', type: 'success', duration: 2500 });
  };

  const navItems = [
    { id: 'agenda' as const, label: 'Agenda', icon: Calendar },
    ...(isLuthier ? [{ id: 'financeiro' as const, label: 'Financeiro', icon: DollarSign }] : []),
    { id: 'mensagens' as const, label: 'Mensagens', icon: MessageCircle },
    ...(isLuthier ? [{ id: 'config' as const, label: 'Config', icon: Settings }] : []),
  ];

  return (
    <div className="space-y-4 pb-24 max-w-4xl mx-auto">
      <div className="px-1">
        <h2 className="text-sm font-bold text-white">{isLuthier ? 'Gestão da oficina' : 'Recepção · Prazos & Mensagens'}</h2>
        <p className="text-[11px] text-stone-400">
          {isLuthier ? 'Agenda, financeiro, mensagens e configurações' : 'Agenda de entregas e avisos para clientes'}
        </p>
      </div>

      <div className={`grid gap-1.5 bg-stone-900 p-1 rounded-2xl border border-stone-800 ${navItems.length === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSubSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                triggerHaptic();
                setSubSection(item.id);
              }}
              className={`py-2 px-1 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                isActive ? 'bg-amber-950 text-amber-200 border border-amber-800/80 shadow-sm' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {activeSubSection === 'agenda' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Prazos de entrega</span>
            <div className="flex gap-1">
              {(['hoje', 'semana', 'todos'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAgendaFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border ${
                    agendaFilter === f ? 'bg-amber-600 text-white border-amber-500' : 'bg-stone-900 border-stone-800 text-stone-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {agenda.length === 0 && <p className="text-xs text-stone-500 px-1">Nenhuma entrega prevista neste período.</p>}
          <div className="space-y-2.5">
            {agenda.map((ord) => {
              const inst = instruments.find((i) => i.id === ord.instrumentId);
              const client = clients.find((c) => c.id === ord.clientId);
              const late = ord.estimatedDeliveryDate < todayIso();
              return (
                <div
                  key={ord.id}
                  onClick={() => {
                    triggerHaptic();
                    setActiveOrderId(ord.id);
                  }}
                  className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 hover:border-amber-600/60 cursor-pointer flex items-center justify-between gap-3 shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                        late ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-amber-950 text-amber-400 border-amber-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase leading-none">
                        {MONTHS[parseInt(ord.estimatedDeliveryDate.substring(5, 7), 10) - 1]}
                      </span>
                      <span className="text-sm font-black font-mono leading-tight">{ord.estimatedDeliveryDate.substring(8)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white truncate">
                          {inst?.brand} {inst?.model}
                        </span>
                        <span className="font-mono text-[10px] text-amber-400">OS #{ord.orderNumber}</span>
                      </div>
                      <p className="text-[11px] text-stone-400 truncate mt-0.5">
                        {client?.name} · {ord.reportedIssue}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase shrink-0 ${
                      ord.status === 'pronto' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    {STATUS_LABELS[ord.status]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLuthier && activeSubSection === 'financeiro' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 shadow-xl space-y-3">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">Recebido no mês</span>
            <span className="text-2xl sm:text-3xl font-black font-mono text-white block">
              {financial ? brl(financial.received) : '...'}
            </span>
            {financial && (
              <>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-800 text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 block">Ticket médio</span>
                    <span className="font-mono font-bold text-stone-200">{brl(financial.averageTicket)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">OS entregues</span>
                    <span className="font-mono font-bold text-stone-200">{financial.deliveredOrders}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">A receber</span>
                    <span className="font-mono font-bold text-rose-300">{brl(financial.receivable)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(financial.byMethod || {}).map(([method, total]) => (
                    <span key={method} className="px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-[11px] text-stone-300">
                      {METHOD_LABELS[method] || method}: <strong className="text-amber-400">{brl(total.amount)}</strong> ({total.count})
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">Pagamentos recentes (OS em andamento)</span>
            {recentPayments.length === 0 && <p className="text-xs text-stone-500">Nenhum pagamento nas OS carregadas.</p>}
            {recentPayments.map((p) => {
              const client = clients.find((c) => c.id === p.order.clientId);
              return (
                <div
                  key={p.id}
                  onClick={() => setActiveOrderId(p.order.id)}
                  className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{client?.name}</span>
                      <span className="font-mono text-[10px] text-stone-400">{p.receiptNumber}</span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">OS #{p.order.orderNumber}</p>
                    <span className="text-[10px] text-stone-500">{p.date}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-black text-emerald-400">{brl(p.amount)}</span>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block mt-0.5">{METHOD_LABELS[p.method]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubSection === 'mensagens' && (
        <div className="space-y-4 animate-in fade-in">
          {pending.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                Avisos automáticos para enviar ({pending.length})
              </span>
              {pending.map((n) => (
                <div key={n.id} className="p-3.5 rounded-2xl bg-stone-900 border border-amber-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{n.subject}</span>
                    <span className="text-[10px] text-stone-500">{toLocalTimestamp(n.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-stone-300 whitespace-pre-line">{n.body}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openWhatsApp(n.recipient, n.body)}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        api.notifications
                          .markSent(n.id)
                          .then(() => setPending((prev) => prev.filter((x) => x.id !== n.id)))
                          .catch((e) => handleError(e))
                      }
                      className="px-3 py-2 rounded-xl bg-stone-800 text-stone-200 text-xs font-semibold flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" /> Enviado
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {orders.length === 0 ? (
            <p className="text-xs text-stone-500">Abra uma OS para usar os modelos de mensagem.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">Modelos de mensagem para a OS:</label>
                <select
                  value={activeOrder?.id || ''}
                  onChange={(e) => setSelectedTemplateOrder(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white"
                >
                  {orders.map((ord) => {
                    const c = clients.find((cl) => cl.id === ord.clientId);
                    const i = instruments.find((it) => it.id === ord.instrumentId);
                    return (
                      <option key={ord.id} value={ord.id}>
                        OS #{ord.orderNumber} - {c?.name} ({i?.brand} {i?.model})
                      </option>
                    );
                  })}
                </select>
              </div>
              {[
                { id: 'entrada' as const, title: 'Aviso de entrada', desc: 'Com o link do portal de acompanhamento.' },
                { id: 'orcamento' as const, title: 'Orçamento pronto', desc: 'Com o link para aprovar em 1 toque.' },
                { id: 'pronto' as const, title: 'Pronto para retirada', desc: 'Avisa que pode buscar na oficina.' },
              ].map((tmpl) => {
                const text = getTemplateMessage(tmpl.id);
                return (
                  <div key={tmpl.id} className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 space-y-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-white">{tmpl.title}</h4>
                      <p className="text-[11px] text-stone-400">{tmpl.desc}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-300 whitespace-pre-line">
                      {text}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyText(text)}
                        className="flex-1 py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold"
                      >
                        Copiar texto
                      </button>
                      <button
                        type="button"
                        onClick={() => openWhatsApp(orderClient?.phone || '', text)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar no WhatsApp
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {isLuthier && activeSubSection === 'config' && (
        <div className="space-y-4 animate-in fade-in">
          <CatalogPanel />
          {user?.isAdmin && <TeamPanel />}
          <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 space-y-1 text-xs text-stone-400">
            <p>
              <strong className="text-stone-300">Conectado como:</strong> {user?.name} ({user?.email})
            </p>
            <p>Os dados ficam no servidor da oficina; backups diários do banco incluem as fotos.</p>
          </div>
        </div>
      )}
    </div>
  );
};
