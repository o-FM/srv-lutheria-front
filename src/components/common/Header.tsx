import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  Sun,
  Moon,
  Hammer,
  UserCheck,
  ChevronDown,
  RotateCcw,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { UserRole } from '../../types';

export const Header: React.FC = () => {
  const { user, logout, requestReauthentication, setIsAccountSettingsOpen } = useAuth();
  const {
    currentRole,
    setRole,
    syncStatus,
    toggleSyncStatus,
    offlineQueueCount,
    setIsSearchOpen,
    isDarkMode,
    toggleDarkMode,
    setIsWorkbenchModeOpen,
    resetToDefaults,
  } = useApp();

  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);

  const roleLabels: Record<UserRole, { title: string; subtitle: string; icon: string; badge: string }> = {
    luthier: {
      title: 'Armando (Dono)',
      subtitle: 'Admin · Visão Total',
      icon: '🪵',
      badge: 'ADMIN',
    },
    atendente: {
      title: 'Mariana (Recepção)',
      subtitle: 'Balcão · Entrada & Entrega',
      icon: '📋',
      badge: 'BALCÃO',
    },
    cliente: {
      title: 'Lucas Silveira',
      subtitle: 'Músico · Portal do Instrumento',
      icon: '🎸',
      badge: 'CLIENTE',
    },
  };

  return (
    <header className="sticky top-0 z-30 bg-stone-900 text-stone-100 shadow-md border-b border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3.5 py-2.5 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-inner text-white font-black text-lg shrink-0">
              <span className="leading-none tracking-tighter">OS</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-amber-100 truncate">
                  Oficina Luthier
                </span>
                <span className="hidden xs:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                  Mobile
                </span>
              </div>
              <p className="text-[11px] text-stone-400 truncate">
                Gestão & Bancada Artesanal
              </p>
            </div>
          </div>

          {/* Quick Actions & Status */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Global Search Button (Only for staff: luthier and atendente) */}
            {currentRole !== 'cliente' && (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700/60 transition-colors active:scale-95"
                title="Buscar (Clientes, Instrumentos, OS)"
                aria-label="Buscar"
              >
                <Search className="w-3.5 h-3.5 text-stone-400" />
                <span className="hidden md:inline text-stone-300">Buscar...</span>
              </button>
            )}

            {/* Sync / Offline Simulator Pill (Staff only: Luthier & Atendente) */}
            {currentRole !== 'cliente' && (
              <button
                type="button"
                onClick={toggleSyncStatus}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 border ${
                  syncStatus === 'online'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60'
                    : syncStatus === 'sincronizando'
                    ? 'bg-blue-950/60 text-blue-300 border-blue-800/60 hover:bg-blue-900/60'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800/60 hover:bg-rose-900/60 animate-pulse'
                }`}
                title="Clique para alternar o modo online/offline para testes"
              >
                {syncStatus === 'online' && <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                {syncStatus === 'sincronizando' && (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
                )}
                {syncStatus === 'offline' && <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                <span className="hidden sm:inline capitalize">
                  {syncStatus}
                  {syncStatus === 'offline' && offlineQueueCount > 0 && ` (${offlineQueueCount})`}
                </span>
              </button>
            )}

            {/* Modo Bancada Fast Toggle (Exclusive for Luthier / Dono at workbench) */}
            {currentRole === 'luthier' && (
              <button
                type="button"
                onClick={() => setIsWorkbenchModeOpen(true)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800/70 text-amber-200 border border-amber-700/60 text-xs font-semibold active:scale-95 transition-all shadow-sm"
                title="Abrir Modo Bancada (Botões gigantes para mãos de oficina)"
              >
                <Hammer className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Bancada</span>
              </button>
            )}

            {/* Dark Mode */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
              title="Alternar Tema Claro / Escuro"
              aria-label="Alternar tema"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-300" />}
            </button>

            {/* Persona Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700/80 border border-stone-700/70 text-xs text-stone-200 transition-colors"
                title="Perfil ativo e troca com autenticação"
              >
                <span className="text-sm leading-none">{roleLabels[currentRole].icon}</span>
                <span className="hidden md:inline font-semibold">{roleLabels[currentRole].title}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  currentRole === 'luthier'
                    ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                    : currentRole === 'atendente'
                    ? 'bg-sky-950 text-sky-300 border border-sky-700/60'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                }`}>
                  {roleLabels[currentRole].badge}
                </span>
                <ChevronDown className="w-3 h-3 text-stone-400" />
              </button>

              {isRoleMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsRoleMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-64 bg-stone-900 text-stone-100 rounded-xl shadow-2xl border border-stone-700 p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1.5 mb-1 border-b border-stone-800">
                      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                        Alternar Persona de Teste
                      </p>
                    </div>

                    {(['luthier', 'atendente', 'cliente'] as UserRole[]).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={async () => {
                          setIsRoleMenuOpen(false);
                          if (currentRole === role) {
                            setIsAccountSettingsOpen(true);
                            return;
                          }
                          try {
                            await requestReauthentication({
                              actionType: 'SWITCH_PROFILE',
                              targetRole: role,
                              title: `Alternar para ${roleLabels[role].title}`,
                              description: `Para assumir a sessão de ${roleLabels[role].title}, confirme as credenciais (E-mail ou CPF e Senha) da conta.`,
                            });
                          } catch {
                            // Canceled by user
                          }
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                          currentRole === role
                            ? 'bg-amber-900/50 text-amber-200 font-semibold border border-amber-700/50'
                            : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                        }`}
                      >
                        <span className="text-base">{roleLabels[role].icon}</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-stone-100">{roleLabels[role].title}</p>
                          <p className="text-[10px] text-stone-400">{roleLabels[role].subtitle}</p>
                        </div>
                      </button>
                    ))}

                    <div className="mt-2 pt-2 border-t border-stone-800 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRoleMenuOpen(false);
                          setIsAccountSettingsOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Minha Conta & Segurança</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRoleMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-rose-300 hover:bg-rose-950/60 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>Sair / Encerrar Sessão</span>
                      </button>
                    </div>

                    {currentRole === 'luthier' && (
                      <div className="mt-1 pt-1 border-t border-stone-800/60 flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={() => {
                            resetToDefaults();
                            setIsRoleMenuOpen(false);
                          }}
                          className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-amber-400 transition-colors py-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Restaurar Dados Demo
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
