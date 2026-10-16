import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Palette, RotateCcw, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { isApiMode } from '../../config/env';
import { getRolePermissions } from '../../utils/permissions';
import type { UserRole } from '../../types';

const DEMO_PERSONAS: { role: UserRole; title: string; subtitle: string }[] = [
  { role: 'luthier', title: 'Armando', subtitle: 'Luthier / Dono' },
  { role: 'atendente', title: 'Mariana', subtitle: 'Balcão' },
  { role: 'cliente', title: 'Lucas Silveira', subtitle: 'Cliente (portal)' },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

/**
 * Menu do usuário: conta, aparência e sair. No modo demonstração também troca de persona
 * (com reautenticação, como no servidor mock).
 */
export const UserMenu: React.FC<{ onOpenAppearance: () => void; compact?: boolean; placement?: 'down' | 'up' }> = ({
  onOpenAppearance,
  compact = false,
  placement = 'down',
}) => {
  const { user, logout, requestReauthentication, setIsAccountSettingsOpen } = useAuth();
  const { currentRole, resetToDefaults } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const name = user?.name ?? 'Usuário';
  const roleLabel = user?.isAdmin ? 'Administrador' : getRolePermissions(currentRole).roleLabel;
  const item =
    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm text-base-200 hover:bg-base-800 transition-colors';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-xl hover:bg-base-800 transition-colors ${
          compact ? 'p-1' : 'w-full p-2'
        }`}
      >
        <span className="w-8 h-8 rounded-full bg-base-800 border border-base-700 text-base-100 text-xs font-semibold flex items-center justify-center shrink-0">
          {initials(name)}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-medium text-base-100 truncate">{name}</span>
              <span className="block text-xs text-base-400 truncate">{roleLabel}</span>
            </span>
            <ChevronDown className="w-4 h-4 text-base-500" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-50 w-64 bg-base-900 border border-base-800 rounded-xl shadow-lg p-1.5 animate-in fade-in ${
            placement === 'up' ? 'bottom-full mb-2 left-0' : 'top-full mt-2 right-0'
          }`}
        >
          <div className="px-3 py-2 border-b border-base-800 mb-1">
            <p className="text-sm font-medium text-base-100 truncate">{name}</p>
            <p className="text-xs text-base-400 truncate">{user?.email}</p>
          </div>

          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); setIsAccountSettingsOpen(true); }}>
            <UserCheck className="w-4 h-4 text-base-400" /> Minha conta
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onOpenAppearance(); }}>
            <Palette className="w-4 h-4 text-base-400" /> Aparência
          </button>

          {!isApiMode && (
            <>
              <p className="px-3 pt-3 pb-1 text-[11px] font-medium text-base-500 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Personas de demonstração
              </p>
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.role}
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentRole === p.role}
                  className={`${item} ${currentRole === p.role ? 'bg-base-800' : ''}`}
                  onClick={async () => {
                    setOpen(false);
                    if (currentRole === p.role) return;
                    try {
                      await requestReauthentication({
                        actionType: 'SWITCH_PROFILE',
                        targetRole: p.role,
                        title: `Entrar como ${p.title}`,
                        description: `Confirme as credenciais de ${p.title} (${p.subtitle}).`,
                      });
                    } catch {
                      // cancelado
                    }
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{p.title}</span>
                    <span className="block text-xs text-base-500">{p.subtitle}</span>
                  </span>
                </button>
              ))}
              {currentRole === 'luthier' && (
                <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); resetToDefaults(); }}>
                  <RotateCcw className="w-4 h-4 text-base-400" /> Restaurar dados de exemplo
                </button>
              )}
            </>
          )}

          <div className="border-t border-base-800 mt-1 pt-1">
            <button type="button" role="menuitem" className={`${item} text-rose-400 hover:bg-rose-950/40`} onClick={() => { setOpen(false); logout(); }}>
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
