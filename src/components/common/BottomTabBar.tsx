import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Home,
  ClipboardList,
  Plus,
  Users,
  Package,
  Calendar,
  MoreHorizontal,
} from 'lucide-react';

export const BottomTabBar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    orders,
    stock,
    setIsNewOrderWizardOpen,
    triggerHaptic,
    currentRole,
  } = useApp();

  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'entregue' && o.status !== 'cancelado'
  ).length;

  const lowStockCount = stock.filter((s) => s.currentQuantity <= s.minQuantity).length;

  return (
    <nav
      aria-label="Navegação Principal"
      className="fixed bottom-0 left-0 right-0 z-40 bg-stone-900/95 dark:bg-stone-950/95 backdrop-blur-md border-t border-stone-800 text-stone-400 pb-safe shadow-2xl"
    >
      <div className="max-w-md mx-auto px-2 flex items-center justify-between h-16 relative">
        {/* Tab 1: Hoje */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setActiveTab('hoje');
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] transition-colors relative ${
            activeTab === 'hoje' ? 'text-amber-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight tracking-tight">Hoje</span>
          {activeTab === 'hoje' && (
            <span className="absolute bottom-1 w-6 h-0.5 bg-amber-400 rounded-full" />
          )}
        </button>

        {/* Tab 2: OS (Ordens de Serviço) */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setActiveTab('os');
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] transition-colors relative ${
            activeTab === 'os' ? 'text-amber-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className="relative">
            <ClipboardList className="w-5 h-5 mb-0.5" />
            {activeOrdersCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-bold flex items-center justify-center">
                {activeOrdersCount}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight tracking-tight">OS</span>
          {activeTab === 'os' && (
            <span className="absolute bottom-1 w-6 h-0.5 bg-amber-400 rounded-full" />
          )}
        </button>

        {/* Central FAB: Nova OS (Zone of maximum thumb reach) */}
        <div className="flex-1 flex justify-center items-center relative -top-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setIsNewOrderWizardOpen(true);
            }}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 text-stone-950 flex flex-col items-center justify-center shadow-lg shadow-amber-900/40 hover:scale-105 active:scale-95 transition-all ring-4 ring-stone-900 dark:ring-stone-950 focus:outline-none"
            title="Abrir Nova Ordem de Serviço em 3 passos"
            aria-label="Nova Ordem de Serviço"
          >
            <Plus className="w-7 h-7 stroke-[2.75]" />
          </button>
        </div>

        {/* Tab 3: Clientes */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setActiveTab('clientes');
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] transition-colors relative ${
            activeTab === 'clientes' ? 'text-amber-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight tracking-tight">Clientes</span>
          {activeTab === 'clientes' && (
            <span className="absolute bottom-1 w-6 h-0.5 bg-amber-400 rounded-full" />
          )}
        </button>

        {/* Tab 4: Estoque (Only for Luthier/Admin) OR Agenda (for Atendente) */}
        {currentRole === 'luthier' ? (
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab('estoque');
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] transition-colors relative ${
              activeTab === 'estoque' ? 'text-amber-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className="relative">
              <Package className="w-5 h-5 mb-0.5" />
              {lowStockCount > 0 && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-stone-900" />
              )}
            </div>
            <span className="text-[11px] leading-tight tracking-tight">Estoque</span>
            {activeTab === 'estoque' && (
              <span className="absolute bottom-1 w-6 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        ) : (
          /* For Atendente: Agenda de Entregas & Avisos */
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab('mais');
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] transition-colors relative ${
              activeTab === 'mais' ? 'text-amber-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-tight tracking-tight">Agenda</span>
            {activeTab === 'mais' && (
              <span className="absolute bottom-1 w-6 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        )}

        {/* Tab 5: Mais (Only for Luthier/Admin) */}
        {currentRole === 'luthier' && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              setActiveTab('mais');
            }}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] transition-colors relative ${
              activeTab === 'mais' ? 'text-amber-400 font-semibold' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <MoreHorizontal className="w-5 h-5 mb-0.5" />
            <span className="text-[11px] leading-tight tracking-tight">Mais</span>
            {activeTab === 'mais' && (
              <span className="absolute bottom-1 w-6 h-0.5 bg-amber-400 rounded-full" />
            )}
          </button>
        )}
      </div>
    </nav>
  );
};
