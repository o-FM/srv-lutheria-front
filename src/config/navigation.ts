import { ClipboardList, Home, LucideIcon, MoreHorizontal, Package, Users } from 'lucide-react';
import type { UserRole } from '../types';
import { getRolePermissions } from '../utils/permissions';

export type TabId = 'hoje' | 'os' | 'clientes' | 'estoque' | 'mais';

export interface NavItem {
  id: TabId;
  label: string;
  title: string;
  icon: LucideIcon;
}

const ALL: NavItem[] = [
  { id: 'hoje', label: 'Hoje', title: 'Hoje', icon: Home },
  { id: 'os', label: 'OS', title: 'Ordens de serviço', icon: ClipboardList },
  { id: 'clientes', label: 'Clientes', title: 'Clientes e instrumentos', icon: Users },
  { id: 'estoque', label: 'Estoque', title: 'Estoque', icon: Package },
  { id: 'mais', label: 'Mais', title: 'Agenda e gestão', icon: MoreHorizontal },
];

/** Abas visíveis para o papel (mesma regra no menu lateral e na barra inferior). */
export function navItemsFor(role: UserRole): NavItem[] {
  const p = getRolePermissions(role);
  return ALL.filter((item) => {
    switch (item.id) {
      case 'hoje': return p.canAccessToday;
      case 'os': return p.canAccessOrders;
      case 'clientes': return p.canAccessClients;
      case 'estoque': return p.canAccessStock;
      case 'mais': return p.canAccessAgenda || p.canAccessFinancials || p.canAccessMessages;
    }
  });
}

export function navTitle(tab: string): string {
  return ALL.find((i) => i.id === tab)?.title ?? '';
}

/** Título curto para telas pequenas (cabeçalho do celular). */
export function navShortTitle(tab: string): string {
  return ALL.find((i) => i.id === tab)?.label ?? '';
}
