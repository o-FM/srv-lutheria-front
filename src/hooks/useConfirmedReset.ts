import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

/**
 * "Restaurar dados" apaga OS, clientes e movimentos do aparelho: exige
 * reautenticação (mesmo fluxo das ações sensíveis). Cancelar não apaga nada.
 */
export function useConfirmedReset(): () => Promise<void> {
  const { requestReauthentication } = useAuth();
  const { resetToDefaults } = useApp();

  return useCallback(async () => {
    try {
      await requestReauthentication({
        actionType: 'SENSITIVE_UPDATE',
        title: 'Restaurar dados de demonstração',
        description:
          'Isso apaga as OS, clientes, estoque e pagamentos deste aparelho e volta aos dados de exemplo. Confirme sua senha para continuar.',
      });
    } catch {
      return; // cancelado pelo usuário
    }
    resetToDefaults();
  }, [requestReauthentication, resetToDefaults]);
}
