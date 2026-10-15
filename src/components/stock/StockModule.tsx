import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Package,
  Search,
  Plus,
  Minus,
  QrCode,
  AlertTriangle,
  Layers,
  History,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { StockCategory, StockItem } from '../../types';

export const StockModule: React.FC = () => {
  const {
    stock,
    stockMovements,
    currentRole,
    setActiveTab: setAppActiveTab,
    updateStockQuantity,
    openBarcodeScanner,
    triggerHaptic,
    showToast,
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'itens' | 'historico'>('itens');

  // Strict role check: Stock is exclusive to Luthier/Admin
  if (currentRole !== 'luthier') {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-xl">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white">Módulo de Estoque Restrito</h2>
        <p className="text-xs text-stone-300 leading-relaxed">
          O controle de peças, madeiras e insumos é de acesso exclusivo do <strong>Luthier / Dono (Admin)</strong>.
          O perfil de Recepção possui acesso a Clientes, OS e Agenda.
        </p>
        <button
          type="button"
          onClick={() => setAppActiveTab('os')}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md"
        >
          Voltar para Ordens de Serviço
        </button>
      </div>
    );
  }

  const categories: { id: string; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'pecas', label: 'Peças' },
    { id: 'cordas', label: 'Cordas' },
    { id: 'madeiras', label: 'Madeiras' },
    { id: 'insumos', label: 'Insumos' },
  ];

  const filteredStock = stock.filter((item) => {
    if (categoryFilter !== 'todos' && item.category !== categoryFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.barcode.includes(q)
      );
    }
    return true;
  });

  const lowStockItems = stock.filter((item) => item.currentQuantity <= item.minQuantity);

  const handleScanBarcode = () => {
    triggerHaptic();
    openBarcodeScanner((code) => {
      const matched = stock.find((s) => s.barcode === code);
      if (matched) {
        setSearchTerm(matched.name);
        showToast({
          title: `Item Encontrado: ${matched.name}`,
          description: `Estoque atual: ${matched.currentQuantity} ${matched.unit}`,
          type: 'success',
        });
      } else {
        showToast({
          title: 'Código não cadastrado',
          description: `Código escaneado: ${code}`,
          type: 'warning',
        });
      }
    });
  };

  return (
    <div className="space-y-4 pb-24 max-w-4xl mx-auto">
      {/* Header Search & QR Scanner */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar peça, corda, madeira ou SKU..."
            className="w-full pl-9 pr-3 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={handleScanBarcode}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-md active:scale-95 transition-all shrink-0"
          title="Ler Código de Barras / QR Code pela câmera"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">Escanear</span>
        </button>
      </div>

      {/* Critical Stock Warning Alert */}
      {lowStockItems.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">
                {lowStockItems.length} produto(s) abaixo do estoque mínimo
              </p>
              <p className="text-[11px] text-rose-300">
                Necessário repor pedidos com distribuidores musicais.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('todos');
              setSearchTerm('');
            }}
            className="text-[11px] font-bold text-amber-400 hover:underline shrink-0"
          >
            Ver Itens
          </button>
        </div>
      )}

      {/* Category Tabs (Clean Segmented) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const count =
            cat.id === 'todos'
              ? stock.length
              : stock.filter((s) => s.category === cat.id).length;
          const isActive = categoryFilter === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                triggerHaptic();
                setCategoryFilter(cat.id);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border ${
                isActive
                  ? 'bg-amber-950 border-amber-600 text-amber-200 shadow-sm'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              {cat.label} <span className="opacity-75 font-mono ml-0.5">({count})</span>
            </button>
          );
        })}
      </div>

      {/* View Selector (Itens vs Movimentações) */}
      <div className="flex gap-1 bg-stone-900 p-1 rounded-xl border border-stone-800">
        <button
          type="button"
          onClick={() => setActiveTab('itens')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'itens' ? 'bg-amber-950 text-amber-200 border border-amber-800' : 'text-stone-400'
          }`}
        >
          Catálogo de Itens ({filteredStock.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'historico'
              ? 'bg-amber-950 text-amber-200 border border-amber-800'
              : 'text-stone-400'
          }`}
        >
          Histórico de Baixas ({stockMovements.length})
        </button>
      </div>

      {/* Items List */}
      {activeTab === 'itens' ? (
        <div className="space-y-2.5">
          {filteredStock.map((item) => {
            const isLow = item.currentQuantity <= item.minQuantity;

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl bg-stone-900 border transition-all shadow-md space-y-2 ${
                  isLow ? 'border-rose-700/80 bg-rose-950/20' : 'border-stone-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-white truncate">
                        {item.name}
                      </span>
                      {isLow && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold uppercase shrink-0">
                          Estoque Baixo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {item.brand} · {item.location} · SKU: <span className="font-mono">{item.sku}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      R$ {item.salePrice.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-stone-500 block">
                      Custo: R$ {item.costPrice.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Stock Level & Thumb Touch Stepper */}
                <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-stone-400">Em estoque: </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isLow ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {item.currentQuantity} {item.unit}
                    </span>
                    <span className="text-[10px] text-stone-500 ml-1">
                      (mínimo: {item.minQuantity})
                    </span>
                  </div>

                  {/* 48px Touch Steppers */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={item.currentQuantity <= 0}
                      onClick={() =>
                        updateStockQuantity(item.id, -1, 'Ajuste manual rápido na oficina')
                      }
                      className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 flex items-center justify-center font-bold active:scale-95 transition-all"
                      title="Dar baixa em 1 unidade"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateStockQuantity(item.id, 1, 'Entrada rápida na oficina')
                      }
                      className="w-10 h-10 rounded-xl bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center font-bold active:scale-95 transition-all shadow-sm"
                      title="Adicionar 1 unidade"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Movements Log */
        <div className="space-y-2">
          {stockMovements.map((mov) => (
            <div
              key={mov.id}
              className="p-3 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  {mov.type === 'entrada' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <p className="text-xs font-bold text-white truncate">
                    {mov.stockItemName}
                  </p>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">{mov.reason}</p>
                <span className="text-[10px] text-stone-500">{mov.date}</span>
              </div>
              <span
                className={`font-mono text-xs font-bold shrink-0 ${
                  mov.type === 'entrada' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {mov.type === 'entrada' ? '+' : '-'}
                {mov.quantity} un
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
