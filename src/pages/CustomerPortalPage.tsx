import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import { OrderStatusView } from './OrderStatusView';
import { isApiMode } from '../config/env';
import { api, ApiError } from '../services/api';
import type { PortalOrderDto } from '../services/api';

/**
 * Link avulso de uma OS (/acompanhar/{token}), sem login: o token aleatório da OS é a
 * credencial. Para ver todas as OS, o cliente usa a área do cliente (/cliente/{oficina}).
 */
export const CustomerPortalPage: React.FC<{ token: string }> = ({ token }) => {
  const [order, setOrder] = useState<PortalOrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await api.portal.view(token));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'Link inválido ou expirado.' : (e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (isApiMode) load();
  }, [load]);

  return (
    <PublicLayout>
      {!isApiMode ? (
        <p className="text-sm text-base-400">O portal do cliente requer a API configurada (VITE_API_URL).</p>
      ) : error && !order ? (
        <div className="text-center space-y-2 py-12">
          <XCircle className="w-8 h-8 text-base-500 mx-auto" />
          <p className="text-base-200">{error}</p>
        </div>
      ) : !order ? (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 text-base-500 animate-spin" />
        </div>
      ) : (
        <OrderStatusView
          order={order}
          onApprove={async () => setOrder(await api.portal.approve(token))}
          onReject={async (reason) => setOrder(await api.portal.reject(token, reason))}
        />
      )}
    </PublicLayout>
  );
};
