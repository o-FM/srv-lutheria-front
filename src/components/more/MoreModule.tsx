import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { isApiMode } from '../../config/env';
import { AppearanceSettings } from '../settings/AppearanceSettings';
import {
  Calendar,
  DollarSign,
  MessageCircle,
  Settings,
  Share2,
  Clock,
  CheckCircle2,
  Phone,
  FileText,
  RotateCcw,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export const MoreModule: React.FC = () => {
  const {
    orders,
    payments,
    clients,
    instruments,
    currentRole,
    setActiveOrderId,
    resetToDefaults,
    triggerHaptic,
    showToast,
  } = useApp();

  const [subSection, setSubSection] = useState<'agenda' | 'financeiro' | 'mensagens' | 'config'>(
    'agenda'
  );

  // If Atendente tries to access financial or config tabs, redirect to agenda
  const activeSubSection =
    currentRole === 'atendente' && (subSection === 'financeiro' || subSection === 'config')
      ? 'agenda'
      : subSection;

  // Agenda Filter
  const [agendaFilter, setAgendaFilter] = useState<'hoje' | 'semana' | 'todos'>('semana');

  // WhatsApp Message Templates
  const [selectedTemplateOrder, setSelectedTemplateOrder] = useState<string>(orders[0]?.id || '');
  const activeOrder = orders.find((o) => o.id === selectedTemplateOrder) || orders[0];
  const orderClient = clients.find((c) => c.id === activeOrder?.clientId);
  const orderInst = instruments.find((i) => i.id === activeOrder?.instrumentId);

  const totalRevenue = payments.reduce((acc, p) => acc + p.amount, 0);

  const getTemplateMessage = (type: 'entrada' | 'orcamento' | 'pronto') => {
    if (!activeOrder) return '';
    const name = orderClient?.name || 'Cliente';
    const instName = `${orderInst?.brand || ''} ${orderInst?.model || 'Instrumento'}`;
    const token = activeOrder.clientTrackingToken;

    switch (type) {
      case 'entrada':
        return `Olá ${name}! Seu instrumento (${instName}) deu entrada na Oficina Luthier com a OS #${activeOrder.orderNumber}. Você pode acompanhar o andamento e fotos pelo link:\nhttps://luthieria.app/os/${token}`;
      case 'orcamento':
        return `Olá ${name}! O orçamento técnico da OS #${activeOrder.orderNumber} (${instName}) está pronto para sua aprovação. Total: R$ ${activeOrder.totalAmount.toFixed(2)}. Acesse para aprovar em 1 toque:\nhttps://luthieria.app/os/${token}`;
      case 'pronto':
        return `Boas notícias, ${name}! Seu ${instName} (OS #${activeOrder.orderNumber}) está pronto, regulado e higienizado para retirada na bancada! Aguardamos sua visita.`;
    }
  };

  const handleSendWhatsApp = (text: string) => {
    triggerHaptic();
    const phoneClean = orderClient?.phone.replace(/\D/g, '') || '';
    window.open(`https://wa.me/55${phoneClean}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyText = (text: string) => {
    triggerHaptic();
    navigator.clipboard?.writeText(text);
    showToast({
      title: 'Mensagem copiada!',
      description: 'Pronta para colar em qualquer canal.',
      type: 'success',
    });
  };

  const navItems = [
    { id: 'agenda' as const, label: 'Agenda', icon: Calendar },
    ...(currentRole === 'luthier'
      ? [{ id: 'financeiro' as const, label: 'Financeiro', icon: DollarSign }]
      : []),
    { id: 'mensagens' as const, label: 'Mensagens', icon: MessageCircle },
    ...(currentRole === 'luthier'
      ? [{ id: 'config' as const, label: 'Config', icon: Settings }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* Section Header with role context */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-base-50">
            {currentRole === 'luthier' ? 'Central de Gestão & Oficina (Admin)' : 'Recepção · Prazos & Mensagens'}
          </h2>
          <p className="text-[11px] text-base-400">
            {currentRole === 'luthier'
              ? 'Acesso total a relatórios financeiros, agenda, avisos e configurações'
              : 'Agenda de entregas e modelos de notificação para o balcão'}
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
          currentRole === 'luthier'
            ? 'bg-accent-950 text-accent-300 border border-accent-800'
            : 'bg-sky-950 text-sky-300 border border-sky-800'
        }`}>
          {currentRole === 'luthier' ? 'Admin' : 'Balcão'}
        </span>
      </div>

      {/* Sub-navigation tabs */}
      <div className={`grid gap-1.5 bg-base-900 p-1 rounded-2xl border border-base-800 ${
        navItems.length === 2 ? 'grid-cols-2' : 'grid-cols-4'
      }`}>
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
                isActive
                  ? 'bg-accent-950 text-accent-200 border border-accent-800/80 shadow-sm'
                  : 'text-base-400 hover:text-base-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. AGENDA MODULE */}
      {activeSubSection === 'agenda' && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-base-400 uppercase tracking-wider">
              Prazos de Entrega e Retiradas
            </span>
            <div className="flex gap-1">
              {(['hoje', 'semana', 'todos'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAgendaFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize border ${
                    agendaFilter === f
                      ? 'bg-accent-600 text-on-accent border-accent-500'
                      : 'bg-base-900 border-base-800 text-base-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {orders.map((ord) => {
              const inst = instruments.find((i) => i.id === ord.instrumentId);
              const client = clients.find((c) => c.id === ord.clientId);
              return (
                <div
                  key={ord.id}
                  onClick={() => {
                    triggerHaptic();
                    setActiveOrderId(ord.id);
                  }}
                  className="p-3.5 rounded-2xl bg-base-900 border border-base-800 hover:border-accent-600/60 cursor-pointer flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent-950 text-accent-400 border border-accent-800 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold uppercase leading-none">
                        OUT
                      </span>
                      <span className="text-sm font-semibold font-mono leading-tight">
                        {ord.estimatedDeliveryDate.substring(8)}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-base-50 truncate">
                          {inst?.brand} {inst?.model}
                        </span>
                        <span className="font-mono text-[10px] text-accent-400">
                          OS #{ord.orderNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-base-400 truncate mt-0.5">
                        {client?.name} · {ord.reportedIssue}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase shrink-0 ${
                      ord.status === 'pronto'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-base-800 text-base-300'
                    }`}
                  >
                    {ord.status.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. FINANCEIRO MODULE (Exclusive for Luthier/Dono) */}
      {currentRole === 'luthier' && activeSubSection === 'financeiro' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Revenue Card */}
          <div className="p-4 rounded-2xl bg-base-900 border border-base-800 space-y-3">
            <span className="text-[11px] font-semibold text-base-400 uppercase tracking-wider block">
              Receitas Realizadas (Mês Atual)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-semibold font-mono text-base-50">
                R$ {totalRevenue.toFixed(2)}
              </span>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> +18% vs mês anterior
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-base-800 text-xs">
              <div>
                <span className="text-[10px] text-base-400 block">Ticket Médio por OS</span>
                <span className="font-mono font-semibold text-base-200">R$ 483,00</span>
              </div>
              <div>
                <span className="text-[10px] text-base-400 block">Forma Mais Usada</span>
                <span className="font-semibold text-accent-400">Pix (72%)</span>
              </div>
            </div>
          </div>

          {/* Payments List */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-base-400 block">
              Últimos Pagamentos Recebidos
            </span>
            <div className="space-y-2">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-base-900 border border-base-800 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-base-50">{p.clientName}</span>
                      <span className="font-mono text-[10px] text-base-400">
                        {p.receiptNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-base-400 mt-0.5">
                      {p.instrumentDescription} · OS #{p.orderNumber}
                    </p>
                    <span className="text-[10px] text-base-500">{p.date}</span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-sm font-semibold text-emerald-400">
                      R$ {p.amount.toFixed(2)}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-base-400 block mt-0.5">
                      {p.method.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. MENSAGENS WHATSAPP MODULE */}
      {activeSubSection === 'mensagens' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Pick Order */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-base-400 uppercase tracking-wider block">
              Selecione a Ordem de Serviço para Notificar:
            </label>
            <select
              value={selectedTemplateOrder}
              onChange={(e) => setSelectedTemplateOrder(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-base-900 border border-base-800 text-xs text-base-50"
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

          {/* Pre-made Templates */}
          <div className="space-y-3">
            {[
              {
                id: 'entrada' as const,
                title: '1. Aviso de Entrada do Instrumento',
                desc: 'Com link do portal de acompanhamento para o músico.',
              },
              {
                id: 'orcamento' as const,
                title: '2. Envio de Orçamento Pronto',
                desc: 'Com link para aprovação em 1 toque no celular.',
              },
              {
                id: 'pronto' as const,
                title: '3. Instrumento Pronto para Retirada',
                desc: 'Avisa que a regulagem terminou e pode buscar na bancada.',
              },
            ].map((tmpl) => {
              const text = getTemplateMessage(tmpl.id);
              return (
                <div
                  key={tmpl.id}
                  className="p-3.5 rounded-2xl bg-base-900 border border-base-800 space-y-2.5"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-base-50">{tmpl.title}</h4>
                    <p className="text-[11px] text-base-400">{tmpl.desc}</p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-base-950 border border-base-800 font-mono text-[11px] text-base-300 whitespace-pre-line">
                    {text}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(text)}
                      className="flex-1 py-2 px-3 rounded-xl bg-base-800 hover:bg-base-700 text-base-200 text-xs font-semibold"
                    >
                      Copiar Texto
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(text)}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Enviar no WhatsApp
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. CONFIGURAÇÕES MODULE */}
      {subSection === 'config' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-4 rounded-2xl bg-base-900 border border-base-800 space-y-4">
            <h3 className="font-semibold text-sm text-base-50">Aparência</h3>
            <AppearanceSettings />
          </div>

          <div className="p-4 rounded-2xl bg-base-900 border border-base-800 space-y-3">
            <h3 className="font-semibold text-sm text-base-50">Dados da Oficina</h3>
            <div className="space-y-2 text-xs text-base-300">
              <p>
                <strong className="text-base-400">Nome:</strong> Luthieria Artesanal & Oficina de Cordas
              </p>
              <p>
                <strong className="text-base-400">Responsável Técnico:</strong> Armando Luthier (20 anos de bancada)
              </p>
              <p>
                <strong className="text-base-400">Endereço:</strong> Rua Harmonia, Pinheiros - São Paulo, SP
              </p>
              <p>
                <strong className="text-base-400">Dados:</strong> {isApiMode ? 'Servidor (API srv-luthieria)' : 'Demonstração local (navegador)'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-base-900 border border-base-800 space-y-2">
            <h3 className="font-semibold text-sm text-base-50">{isApiMode ? 'Sincronização' : 'Demonstração & Testes'}</h3>
            <p className="text-xs text-base-400">
              {isApiMode
                ? 'Recarrega clientes, estoque e ordens de serviço do servidor.'
                : 'Caso queira reiniciar o banco de dados com os dados padrão originais:'}
            </p>
            <button
              type="button"
              onClick={resetToDefaults}
              className="py-2.5 px-4 rounded-xl bg-base-800 hover:bg-base-700 text-accent-400 text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              {isApiMode ? 'Recarregar dados' : 'Restaurar Dados Iniciais'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
