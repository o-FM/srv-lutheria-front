import React from 'react';
import { Hammer, Moon, RefreshCw, Search, Sun, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { navShortTitle, navTitle } from '../../config/navigation';
import { isApiMode } from '../../config/env';
import { getRolePermissions } from '../../utils/permissions';
import { BrandMark } from './BrandMark';
import { UserMenu } from './UserMenu';

/**
 * Cabeçalho enxuto. Celular: marca + título da seção + ações essenciais em ícones.
 * Desktop: a marca e a navegação ficam na barra lateral; aqui só título e ações.
 */
export const Header: React.FC<{ onOpenAppearance: () => void }> = ({ onOpenAppearance }) => {
  const {
    activeTab,
    currentRole,
    syncStatus,
    toggleSyncStatus,
    offlineQueueCount,
    setIsSearchOpen,
    setIsWorkbenchModeOpen,
    isLoadingData,
  } = useApp();
  const { resolvedMode, toggleMode } = useTheme();
  const permissions = getRolePermissions(currentRole);
  const isStaff = currentRole !== 'cliente';
  const iconButton =
    'w-9 h-9 flex items-center justify-center rounded-lg text-base-400 hover:text-base-100 hover:bg-base-800 transition-colors';

  return (
    <header className="sticky top-0 z-20 bg-base-950/90 backdrop-blur-sm border-b border-base-800 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-3 h-14 lg:h-16 px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden">
          <BrandMark size="sm" />
        </div>

        <h1 className="flex-1 min-w-0 text-base lg:text-lg font-semibold text-base-50 truncate">
          {isStaff ? (
            <>
              <span className="sm:hidden">{navShortTitle(activeTab)}</span>
              <span className="hidden sm:inline">{navTitle(activeTab)}</span>
            </>
          ) : (
            'Acompanhe seu instrumento'
          )}
        </h1>

        {isLoadingData && <RefreshCw className="w-4 h-4 text-base-500 animate-spin" aria-label="Carregando" />}

        {isStaff && (
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-2 h-9 w-56 px-3 rounded-lg bg-base-900 border border-base-800 text-sm text-base-500 hover:border-base-700 transition-colors"
          >
            <Search className="w-4 h-4" />
            Buscar…
          </button>
        )}
        {isStaff && (
          <button type="button" onClick={() => setIsSearchOpen(true)} className={`md:hidden ${iconButton}`} aria-label="Buscar">
            <Search className="w-[18px] h-[18px]" />
          </button>
        )}

        {/* Simulador offline: só existe no modo demonstração */}
        {isStaff && !isApiMode && (
          <button
            type="button"
            onClick={toggleSyncStatus}
            className={`hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-xs border transition-colors ${
              syncStatus === 'online'
                ? 'border-base-800 text-base-400 hover:text-base-200'
                : syncStatus === 'sincronizando'
                ? 'border-sky-800/60 text-sky-400'
                : 'border-rose-800/60 text-rose-400'
            }`}
            title="Simular perda de conexão (demonstração)"
          >
            {syncStatus === 'online' && <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
            {syncStatus === 'sincronizando' && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {syncStatus === 'offline' && <WifiOff className="w-3.5 h-3.5" />}
            <span className="capitalize">
              {syncStatus}
              {syncStatus === 'offline' && offlineQueueCount > 0 && ` (${offlineQueueCount})`}
            </span>
          </button>
        )}

        {permissions.canAccessWorkbench && (
          <button type="button" onClick={() => setIsWorkbenchModeOpen(true)} className={iconButton} title="Modo bancada" aria-label="Modo bancada">
            <Hammer className="w-[18px] h-[18px]" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleMode}
          className={iconButton}
          aria-label={resolvedMode === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          title="Alternar claro/escuro"
        >
          {resolvedMode === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
        </button>

        <div className="lg:hidden">
          <UserMenu onOpenAppearance={onOpenAppearance} compact />
        </div>
      </div>
    </header>
  );
};
