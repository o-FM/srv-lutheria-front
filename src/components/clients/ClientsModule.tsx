import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  Guitar,
  ClipboardList,
  ChevronRight,
  ExternalLink,
  X,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Client, Instrument, InstrumentType } from '../../types';

export const ClientsModule: React.FC = () => {
  const {
    clients,
    instruments,
    orders,
    createClient,
    createInstrument,
    setActiveOrderId,
    setActiveTab,
    setIsNewOrderWizardOpen,
    triggerHaptic,
    showToast,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // New Client Form
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // New Instrument Modal for selected client
  const [isNewInstOpen, setIsNewInstOpen] = useState(false);
  const [instType, setInstType] = useState<InstrumentType>('guitarra');
  const [instBrand, setInstBrand] = useState('');
  const [instModel, setInstModel] = useState('');
  const [instSerial, setInstSerial] = useState('');
  const [instGauge, setInstGauge] = useState('0.10');
  const [instNotes, setInstNotes] = useState('');

  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.cpf && c.cpf.includes(q))
    );
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const clientInstruments = instruments.filter((i) => i.clientId === selectedClientId);
  const clientOrders = orders.filter((o) => o.clientId === selectedClientId);

  const handlePhoneFormat = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setPhone(formatted);
  };

  const handleCpfFormat = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 3) formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length > 6) formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    if (digits.length > 9)
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    setCpf(formatted);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({ title: 'Informe o nome do cliente', type: 'warning' });
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      showToast({ title: 'Informe o telefone com DDD', type: 'warning' });
      return;
    }
    triggerHaptic();
    const created = await createClient({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      cpf: cpf.trim(),
      address: address.trim(),
      notes: notes.trim(),
    });
    if (!created) return;
    setName('');
    setPhone('');
    setEmail('');
    setCpf('');
    setAddress('');
    setNotes('');
    setIsNewClientOpen(false);
    setSelectedClientId(created.id);
  };

  const handleCreateInstrument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !instBrand.trim() || !instModel.trim()) {
      showToast({ title: 'Informe a marca e modelo', type: 'warning' });
      return;
    }
    triggerHaptic();
    const created = await createInstrument(selectedClientId, {
      type: instType,
      brand: instBrand.trim(),
      model: instModel.trim(),
      serialNumber: instSerial.trim() || undefined,
      stringsGauge: instGauge.trim() || undefined,
      conditionNotes: instNotes.trim() || undefined,
    });
    if (!created) return;
    setInstBrand('');
    setInstModel('');
    setInstSerial('');
    setInstNotes('');
    setIsNewInstOpen(false);
  };

  return (
    <div className="space-y-4 pb-24 max-w-4xl mx-auto">
      {/* Header with Search and New Client */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou CPF..."
            className="w-full pl-9 pr-3 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsNewClientOpen(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Main Client List or Selected Client View */}
      {!selectedClientId ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              Clientes Cadastrados ({filteredClients.length})
            </span>
          </div>

          <div className="space-y-2">
            {filteredClients.map((client) => {
              const insts = instruments.filter((i) => i.clientId === client.id);
              const osCount = orders.filter((o) => o.clientId === client.id).length;

              return (
                <div
                  key={client.id}
                  className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 hover:border-stone-700 transition-all shadow-md flex items-center justify-between gap-3"
                >
                  <div
                    onClick={() => {
                      triggerHaptic();
                      setSelectedClientId(client.id);
                    }}
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  >
                    <div className="w-11 h-11 rounded-full bg-stone-950 border border-stone-800 overflow-hidden flex items-center justify-center shrink-0 text-amber-500 font-bold">
                      {client.avatarUrl ? (
                        <img
                          src={client.avatarUrl}
                          alt={client.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        client.name[0]
                      )}
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-white truncate">{client.name}</h3>
                      <p className="text-[11px] text-stone-400 truncate mt-0.5">
                        {client.phone} · {client.address || 'São Paulo'}
                      </p>
                      <p className="text-[10px] text-amber-400/90 font-medium mt-0.5">
                        {insts.length} instrumento(s) · {osCount} OS no histórico
                      </p>
                    </div>
                  </div>

                  {/* 1-Touch WhatsApp & Call Quick Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const clean = client.phone.replace(/\D/g, '');
                        window.open(`https://wa.me/55${clean}`, '_blank');
                      }}
                      className="p-2 rounded-xl bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800/80 active:scale-95"
                      title="WhatsApp com 1 toque"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const clean = client.phone.replace(/\D/g, '');
                        window.location.href = `tel:${clean}`;
                      }}
                      className="p-2 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 active:scale-95"
                      title="Ligar com 1 toque"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setSelectedClientId(client.id);
                      }}
                      className="p-2 rounded-xl text-stone-400 hover:text-white"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Selected Client Detail Card */
        selectedClient && (
          <div className="space-y-4 animate-in fade-in">
            {/* Top Back Header */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedClientId(null)}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                ← Voltar para lista de clientes
              </button>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const clean = selectedClient.phone.replace(/\D/g, '');
                    window.open(`https://wa.me/55${clean}`, '_blank');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-semibold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const clean = selectedClient.phone.replace(/\D/g, '');
                    window.location.href = `tel:${clean}`;
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800 text-stone-200 text-xs font-semibold"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Ligar
                </button>
              </div>
            </div>

            {/* Profile Card */}
            <div className="p-4 rounded-3xl bg-stone-900 border border-stone-800 shadow-xl space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-stone-950 border border-stone-800 overflow-hidden flex items-center justify-center text-amber-500 font-bold text-xl">
                    {selectedClient.avatarUrl ? (
                      <img
                        src={selectedClient.avatarUrl}
                        alt={selectedClient.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      selectedClient.name[0]
                    )}
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">{selectedClient.name}</h2>
                    <p className="text-xs text-stone-400">{selectedClient.email}</p>
                    {selectedClient.cpf && (
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                        CPF: {selectedClient.cpf}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {selectedClient.notes && (
                <div className="p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 text-xs text-stone-300">
                  <span className="text-[10px] uppercase font-bold text-amber-400 block mb-0.5">
                    Preferências do Músico:
                  </span>
                  {selectedClient.notes}
                </div>
              )}
            </div>

            {/* Client Instruments Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Instrumentos Registrados ({clientInstruments.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsNewInstOpen(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Instrumento
                </button>
              </div>

              {clientInstruments.map((inst) => (
                <div
                  key={inst.id}
                  className="p-3.5 rounded-2xl bg-stone-900 border border-stone-800 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-xs text-white">
                        {inst.brand} {inst.model}
                      </h4>
                      <p className="text-[11px] text-stone-400 capitalize">
                        {inst.type.replace('_', ' ')} · {inst.year || 'Ano N/I'} · {inst.finishColor || 'Acabamento Original'}
                      </p>
                    </div>
                    {inst.serialNumber && (
                      <span className="font-mono text-[10px] text-amber-400 bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                        S/N: {inst.serialNumber}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-300 pt-1 border-t border-stone-800">
                    <div>
                      <span className="text-stone-500">Calibre:</span> {inst.stringsGauge || 'Padrão'}
                    </div>
                    <div>
                      <span className="text-stone-500">Afinação:</span> {inst.tuningPreference || 'E Standard'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Client OS History Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Histórico de Serviços ({clientOrders.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setIsNewOrderWizardOpen(true);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Abrir Nova OS
                </button>
              </div>

              {clientOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => {
                    triggerHaptic();
                    setActiveOrderId(ord.id);
                  }}
                  className="p-3 rounded-xl bg-stone-900 border border-stone-800 hover:border-amber-600/60 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400">
                        OS #{ord.orderNumber}
                      </span>
                      <span className="text-xs text-white font-semibold">
                        {ord.reportedIssue}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Entrada: {ord.entryDate} · Total: R$ {ord.totalAmount.toFixed(2)}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg bg-stone-800 text-stone-300">
                    {ord.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* New Client Modal */}
      {isNewClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateClient}
            className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-2xl space-y-3 text-stone-100"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <span className="font-bold text-sm text-white">Cadastrar Novo Cliente</span>
              <button
                type="button"
                onClick={() => setIsNewClientOpen(false)}
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Eduardo ou Conservatório Villa-Lobos"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                  Celular / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => handlePhoneFormat(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                  CPF
                </label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => handleCpfFormat(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@dominio.com"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                Bairro / Cidade
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Pinheiros, São Paulo - SP"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                Observações de Músico
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Toca violino em orquestra; afinação barroca..."
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setIsNewClientOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-800 text-xs font-semibold text-stone-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Instrument Modal */}
      {isNewInstOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateInstrument}
            className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-2xl space-y-3 text-stone-100"
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-800">
              <span className="font-bold text-sm text-white">Cadastrar Instrumento</span>
              <button
                type="button"
                onClick={() => setIsNewInstOpen(false)}
                className="p-1 text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                Tipo
              </label>
              <select
                value={instType}
                onChange={(e) => setInstType(e.target.value as any)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
              >
                <option value="guitarra">Guitarra</option>
                <option value="violao_aco">Violão de Aço</option>
                <option value="violao_nylon">Violão de Nylon</option>
                <option value="baixo">Baixo</option>
                <option value="cavaquinho">Cavaquinho</option>
                <option value="violino">Violino</option>
                <option value="viola">Viola Caipira</option>
                <option value="outro">Outro Instrumento</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                  Marca *
                </label>
                <input
                  type="text"
                  required
                  value={instBrand}
                  onChange={(e) => setInstBrand(e.target.value)}
                  placeholder="Ex: Fender, Gibson, Rozini"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                  Modelo *
                </label>
                <input
                  type="text"
                  required
                  value={instModel}
                  onChange={(e) => setInstModel(e.target.value)}
                  placeholder="Ex: Stratocaster, Les Paul"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                  Nº de Série
                </label>
                <input
                  type="text"
                  value={instSerial}
                  onChange={(e) => setInstSerial(e.target.value)}
                  placeholder="Ex: US2109841"
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold text-stone-400 block mb-1">
                  Calibre Cordas
                </label>
                <input
                  type="text"
                  value={instGauge}
                  onChange={(e) => setInstGauge(e.target.value)}
                  placeholder="0.10, 0.11, etc."
                  className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setIsNewInstOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-800 text-xs font-semibold text-stone-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
              >
                Cadastrar Instrumento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
