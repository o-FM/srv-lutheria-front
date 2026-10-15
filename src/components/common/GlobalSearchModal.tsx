import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Search,
  X,
  History,
  ClipboardList,
  Users,
  Guitar,
  Package,
  ArrowRight,
} from 'lucide-react';

export const GlobalSearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    clients,
    instruments,
    orders,
    stock,
    currentRole,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    setActiveOrderId,
    setActiveTab,
    triggerHaptic,
  } = useApp();

  const [term, setTerm] = useState('');

  const searchResults = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return null;

    const matchedOrders = orders.filter((o) => {
      const client = clients.find((c) => c.id === o.clientId);
      const inst = instruments.find((i) => i.id === o.instrumentId);
      return (
        o.orderNumber.toString().includes(q) ||
        o.reportedIssue.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q) ||
        client?.name.toLowerCase().includes(q) ||
        inst?.brand.toLowerCase().includes(q) ||
        inst?.model.toLowerCase().includes(q)
      );
    });

    const matchedClients = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.cpf && c.cpf.includes(q))
    );

    const matchedInstruments = instruments.filter(
      (i) =>
        i.brand.toLowerCase().includes(q) ||
        i.model.toLowerCase().includes(q) ||
        (i.serialNumber && i.serialNumber.toLowerCase().includes(q))
    );

    // Stock items are exclusive to Luthier/Admin (hidden from reception)
    const matchedStock =
      currentRole === 'luthier'
        ? stock.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.sku.toLowerCase().includes(q) ||
              s.barcode.includes(q)
          )
        : [];

    return {
      orders: matchedOrders,
      clients: matchedClients,
      instruments: matchedInstruments,
      stock: matchedStock,
      totalCount:
        matchedOrders.length +
        matchedClients.length +
        matchedInstruments.length +
        matchedStock.length,
    };
  }, [term, orders, clients, instruments, stock, currentRole]);

  if (!isSearchOpen) return null;

  const handleSelectOrder = (orderId: string) => {
    triggerHaptic();
    addRecentSearch(term || `OS #${orderId}`);
    setActiveOrderId(orderId);
    setActiveTab('os');
    setIsSearchOpen(false);
  };

  const handleSelectClient = (clientId: string) => {
    triggerHaptic();
    addRecentSearch(term);
    setActiveTab('clientes');
    setIsSearchOpen(false);
  };

  const handleSelectStock = () => {
    triggerHaptic();
    addRecentSearch(term);
    setActiveTab('estoque');
    setIsSearchOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-900/95 backdrop-blur-md text-stone-100 animate-in fade-in">
      {/* Top Search Bar */}
      <div className="p-3 border-b border-stone-800 bg-stone-950 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl focus-within:border-amber-500">
          <Search className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="text"
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar por cliente, OS, instrumento ou peça..."
            className="w-full bg-transparent text-sm text-stone-100 placeholder-stone-500 focus:outline-none"
          />
          {term && (
            <button
              type="button"
              onClick={() => setTerm('')}
              className="p-0.5 text-stone-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsSearchOpen(false)}
          className="px-3 py-2 text-xs font-semibold text-stone-300 hover:text-white"
        >
          Cancelar
        </button>
      </div>

      {/* Body Results */}
      <div className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full space-y-5">
        {!term ? (
          /* Recent searches */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-400 font-semibold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Buscas Recentes
              </span>
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-stone-500 hover:text-stone-300 normal-case"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {recentSearches.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTerm(item)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs border border-stone-700/60 transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-8 p-4 rounded-xl bg-stone-800/40 border border-stone-800 text-xs text-stone-400 space-y-1">
              <p className="font-semibold text-stone-300">Dicas de busca rápida:</p>
              <p>• Digite o número da OS para ir direto ao instrumento (ex: "1042")</p>
              <p>• Digite "cavalete" ou "traste" para ver serviços e peças</p>
              <p>• Digite o nome do músico para ver histórico completo</p>
            </div>
          </div>
        ) : searchResults?.totalCount === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <p className="text-sm font-semibold">Nenhum resultado encontrado para "{term}"</p>
            <p className="text-xs mt-1">Verifique se digitou o nome ou número correto.</p>
          </div>
        ) : (
          /* Matched Results by Group */
          <div className="space-y-5">
            {/* Orders */}
            {searchResults && searchResults.orders.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Ordens de Serviço ({searchResults.orders.length})
                </span>
                <div className="space-y-1.5">
                  {searchResults.orders.map((order) => {
                    const inst = instruments.find((i) => i.id === order.instrumentId);
                    const client = clients.find((c) => c.id === order.clientId);
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => handleSelectOrder(order.id)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700/60 text-left transition-colors group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-white">
                              OS #{order.orderNumber}
                            </span>
                            <span className="text-xs text-amber-300 font-semibold truncate">
                              {inst?.brand} {inst?.model}
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 truncate mt-0.5">
                            {client?.name} · {order.reportedIssue}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clients */}
            {searchResults && searchResults.clients.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Clientes ({searchResults.clients.length})
                </span>
                <div className="space-y-1.5">
                  {searchResults.clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectClient(c.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700/60 text-left transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{c.name}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">{c.phone} · {c.address}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock */}
            {searchResults && searchResults.stock.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  Estoque ({searchResults.stock.length})
                </span>
                <div className="space-y-1.5">
                  {searchResults.stock.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={handleSelectStock}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-stone-800/80 hover:bg-stone-800 border border-stone-700/60 text-left transition-colors group"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{s.name}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          {s.currentQuantity} {s.unit} disponíveis · R$ {s.salePrice.toFixed(2)}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
