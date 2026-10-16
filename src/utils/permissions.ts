import { UserRole } from '../types';

export interface RolePermissions {
  role: UserRole;
  roleLabel: string;
  roleBadge: string;
  roleDescription: string;

  // Sections (Tabs)
  canAccessToday: boolean;
  canAccessOrders: boolean;
  canAccessClients: boolean;
  canAccessStock: boolean;
  canAccessAgenda: boolean;
  canAccessFinancials: boolean;
  canAccessMessages: boolean;
  canAccessConfig: boolean;
  canAccessWorkbench: boolean;
  canAccessClientPortal: boolean;

  // Domain Actions
  canOpenOrder: boolean;
  canRegisterClient: boolean;
  canRegisterEntryPhoto: boolean;
  canRegisterDelivery: boolean;
  canExecuteBenchDiagnosis: boolean;
  canExecuteBenchLabor: boolean;
  canModifyPricingAndParts: boolean;
  canApproveClientQuote: boolean;
  canManageInventory: boolean;
  canViewFinancialTotals: boolean;
  canViewAuditLogs: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  luthier: {
    role: 'luthier',
    roleLabel: 'Luthier / Dono',
    roleBadge: 'ADMIN',
    roleDescription: 'Acesso total a todas as seções: bancada, estoque, financeiro e configurações.',

    // All sections visible to Admin/Dono
    canAccessToday: true,
    canAccessOrders: true,
    canAccessClients: true,
    canAccessStock: true,
    canAccessAgenda: true,
    canAccessFinancials: true,
    canAccessMessages: true,
    canAccessConfig: true,
    canAccessWorkbench: true,
    canAccessClientPortal: true,

    // All actions permitted
    canOpenOrder: true,
    canRegisterClient: true,
    canRegisterEntryPhoto: true,
    canRegisterDelivery: true,
    canExecuteBenchDiagnosis: true,
    canExecuteBenchLabor: true,
    canModifyPricingAndParts: true,
    canApproveClientQuote: true,
    canManageInventory: true,
    canViewFinancialTotals: true,
    canViewAuditLogs: true,
  },

  atendente: {
    role: 'atendente',
    roleLabel: 'Atendente / Recepção',
    roleBadge: 'BALCÃO',
    roleDescription: 'Recepção de instrumentos: cadastra clientes, abre OS, registra entrada e entrega.',

    // Permitted sections
    canAccessToday: true,
    canAccessOrders: true,
    canAccessClients: true,
    canAccessStock: false, // RESTRICTED
    canAccessAgenda: true, // for scheduled pickups & entries
    canAccessFinancials: false, // RESTRICTED (Dono only)
    canAccessMessages: true, // WhatsApp notices
    canAccessConfig: false, // RESTRICTED (Dono only)
    canAccessWorkbench: false, // RESTRICTED (Dono only)
    canAccessClientPortal: false, // Internal staff

    // Permitted actions: cadastra cliente, abre OS, registra entrada e entrega
    canOpenOrder: true,
    canRegisterClient: true,
    canRegisterEntryPhoto: true,
    canRegisterDelivery: true,
    canExecuteBenchDiagnosis: false, // Bench work is Luthier only
    canExecuteBenchLabor: false, // Bench work is Luthier only
    canModifyPricingAndParts: false, // Reserved for Luthier/Admin
    canApproveClientQuote: false, // Performed by client or admin
    canManageInventory: false, // Reserved for Luthier/Admin
    canViewFinancialTotals: false, // Reserved for Luthier/Admin
    canViewAuditLogs: false,
  },
};

export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.atendente;
}
