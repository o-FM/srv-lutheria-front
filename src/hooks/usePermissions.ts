import { useApp } from '../context/AppContext';
import { getRolePermissions, RolePermissions } from '../utils/permissions';

/**
 * Permissões do papel atual (tabela única em ROLE_PERMISSIONS).
 * Esconder na interface não é controle de acesso: as ações do contexto
 * e o servidor também validam.
 */
export function usePermissions(): RolePermissions {
  const { currentRole } = useApp();
  return getRolePermissions(currentRole);
}
