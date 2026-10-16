import React from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { navItemsFor } from '../../config/navigation';
import { isApiMode } from '../../config/env';
import { getRolePermissions } from '../../utils/permissions';
import { BrandMark } from './BrandMark';
import { UserMenu } from './UserMenu';

/** Navegação lateral fixa em telas grandes (lg+). No celular a navegação fica na barra inferior. */
export const Sidebar: React.FC<{ onOpenAppearance: () => void }> = ({ onOpenAppearance }) => {
  const { activeTab, setActiveTab, currentRole, orders, stock, setIsNewOrderWizardOpen } = useApp();
  const permissions = getRolePermissions(currentRole);

  const openOrders = orders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado').length;
  const lowStock = stock.filter((s) => s.currentQuantity <= s.minQuantity).length;
  const badge = (id: string) => (id === 'os' ? openOrders : id === 'estoque' ? lowStock : 0);

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-base-800 bg-base-950">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-base-800">
        <BrandMark size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-base-50 leading-tight">Oficina Luthier</p>
          <p className="text-xs text-base-500">{isApiMode ? 'Gestão' : 'Demonstração'}</p>
        </div>
      </div>

      {permissions.canOpenOrder && (
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => setIsNewOrderWizardOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-accent-600 hover:bg-accent-500 text-on-accent text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova OS
          </button>
        </div>
      )}

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItemsFor(currentRole).map(({ id, label, title, icon: Icon }) => {
          const active = activeTab === id;
          const count = badge(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              title={title}
              className={`w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-base-800/80 text-base-50 font-medium'
                  : 'text-base-400 hover:text-base-100 hover:bg-base-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-accent-400' : ''}`} />
              <span className="flex-1 text-left">{label === 'OS' ? 'Ordens de serviço' : label}</span>
              {count > 0 && (
                <span
                  className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-medium flex items-center justify-center ${
                    id === 'estoque' ? 'bg-rose-500/15 text-rose-400' : 'bg-base-800 text-base-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-base-800">
        <UserMenu onOpenAppearance={onOpenAppearance} placement="up" />
      </div>
    </aside>
  );
};
