import { isApiMode } from '../config/env';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

/**
 * Dono da oficina (perfil ADMIN): único que vê faturamento e cadastra a equipe.
 * No modo demonstração, a persona "Luthier / Dono" faz esse papel.
 */
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  const { currentRole } = useApp();
  return isApiMode ? !!user?.isAdmin : currentRole === 'luthier';
}
