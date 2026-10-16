import React from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { navItemsFor } from '../../config/navigation';
import { getRolePermissions } from '../../utils/permissions';

/** Navegação do celular/tablet (zona do polegar). Escondida em telas grandes. */
export const BottomTabBar: React.FC = () => {
  const { activeTab, setActiveTab, orders, stock, setIsNewOrderWizardOpen, triggerHaptic, currentRole } = useApp();

  if (currentRole === 'cliente') return null;

  const items = navItemsFor(currentRole);
  const canOpenOrder = getRolePermissions(currentRole).canOpenOrder;
  const openOrders = orders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado').length;
  const lowStock = stock.some((s) => s.currentQuantity <= s.minQuantity);

  // Botão "Nova OS" no centro: metade das abas de cada lado
  const middle = Math.ceil(items.length / 2);
  const tab = (item: (typeof items)[number]) => {
    const active = activeTab === item.id;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          triggerHaptic();
          setActiveTab(item.id);
        }}
        aria-current={active ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full min-w-12 transition-colors ${
          active ? 'text-accent-400' : 'text-base-500 hover:text-base-300'
        }`}
      >
        <span className="relative">
          <Icon className="w-5 h-5" />
          {item.id === 'os' && openOrders > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-base-700 text-base-100 text-[10px] font-medium flex items-center justify-center">
              {openOrders}
            </span>
          )}
          {item.id === 'estoque' && lowStock && (
            <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-rose-500" />
          )}
        </span>
        <span className={`text-[11px] ${active ? 'font-medium' : ''}`}>{item.label}</span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-base-950/95 backdrop-blur-sm border-t border-base-800 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-xl mx-auto flex items-center h-16 px-2">
        {items.slice(0, middle).map(tab)}
        {canOpenOrder && (
          <div className="flex-1 flex justify-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsNewOrderWizardOpen(true);
              }}
              className="w-12 h-12 rounded-2xl bg-accent-600 hover:bg-accent-500 text-on-accent flex items-center justify-center transition-colors active:scale-95"
              aria-label="Nova ordem de serviço"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        )}
        {items.slice(middle).map(tab)}
      </div>
    </nav>
  );
};
