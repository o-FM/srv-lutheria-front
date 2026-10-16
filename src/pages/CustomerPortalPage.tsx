import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { PublicLayout, inputClass, primaryButton } from './PublicLayout';
import { isApiMode } from '../config/env';
import { api, ApiError } from '../services/api';
import type { PortalOrderDto } from '../services/api';
import { toLocalDateTime } from '../services/api/mappers';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STEPS = ['recebido', 'diagnostico', 'orcamento', 'aguardando_aprovacao', 'em_execucao', 'pronto', 'entregue'];

/**
 * Portal do cliente (link enviado por e-mail/WhatsApp): /acompanhar/{token}. Sem login; o
 * token aleatório da OS é a credencial. Mostra andamento, orçamento e permite aprovar/recusar.
 */
export const CustomerPortalPage: React.FC<{ token: string }> = ({ token }) => {
  const [order, setOrder] = useState<PortalOrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

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

  const act = async (fn: () => Promise<PortalOrderDto>) => {
    setBusy(true);
    try {
      setOrder(await fn());
      setRejecting(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!isApiMode) {
    return (
      <PublicLayout>
        <p className="text-sm text-base-400">O portal do cliente requer a API configurada (VITE_API_URL).</p>
      </PublicLayout>
    );
  }

  if (error && !order) {
    return (
      <PublicLayout>
        <div className="text-center space-y-2 py-12">
          <XCircle className="w-8 h-8 text-base-500 mx-auto" />
          <p className="text-base-200">{error}</p>
        </div>
      </PublicLayout>
    );
  }

  if (!order) {
    return (
      <PublicLayout>
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 text-base-500 animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  const step = STEPS.indexOf(order.status);
  const awaiting = order.status === 'aguardando_aprovacao' && order.quote.status === 'pendente';

  return (
    <PublicLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-base-400">
            {order.customerFirstName ? `Olá, ${order.customerFirstName}` : 'Olá'} · OS #{order.orderNumber}
          </p>
          <h1 className="text-2xl font-semibold text-base-50 mt-1">{order.instrument ?? 'Seu instrumento'}</h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent-400">
            <Clock className="w-4 h-4" /> {order.statusLabel}
            {order.estimatedDeliveryDate && ` · previsão ${order.estimatedDeliveryDate.split('-').reverse().join('/')}`}
          </p>
        </div>

        {order.status !== 'cancelado' && (
          <ol className="grid grid-cols-7 gap-1" aria-label="Andamento">
            {STEPS.map((s, i) => (
              <li key={s} className={`h-1.5 rounded-full ${i <= step ? 'bg-accent-500' : 'bg-base-800'}`} />
            ))}
          </ol>
        )}

        <section className="rounded-2xl border border-base-800 bg-base-900 divide-y divide-base-800">
          <h2 className="px-4 py-3 text-sm font-medium text-base-200">Orçamento</h2>
          {order.services.map((s) => (
            <div key={s.id} className="px-4 py-3 flex justify-between gap-4 text-sm">
              <span className="text-base-200">{s.title}</span>
              <span className="text-base-300 tabular-nums">{brl(s.laborPrice)}</span>
            </div>
          ))}
          {order.parts.map((p) => (
            <div key={p.id} className="px-4 py-3 flex justify-between gap-4 text-sm">
              <span className="text-base-300">{p.quantity}× {p.stockItemName}</span>
              <span className="text-base-300 tabular-nums">{brl(p.total)}</span>
            </div>
          ))}
          {order.quote.discount > 0 && (
            <div className="px-4 py-3 flex justify-between text-sm text-base-400">
              <span>Desconto</span>
              <span className="tabular-nums">−{brl(order.quote.discount)}</span>
            </div>
          )}
          <div className="px-4 py-3 flex justify-between text-base font-semibold text-base-50">
            <span>Total</span>
            <span className="tabular-nums">{brl(order.quote.grandTotal)}</span>
          </div>
        </section>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        {awaiting && !rejecting && (
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => act(() => api.portal.approve(token))} className={primaryButton}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Aprovar orçamento
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="h-11 rounded-xl border border-base-700 text-base-200 text-sm hover:bg-base-900"
            >
              Recusar
            </button>
          </div>
        )}
        {rejecting && (
          <div className="space-y-2">
            <textarea
              className={`${inputClass} h-24 py-2`}
              placeholder="Conte o motivo (opcional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRejecting(false)} className="h-11 rounded-xl border border-base-700 text-sm text-base-300">
                Voltar
              </button>
              <button type="button" disabled={busy} onClick={() => act(() => api.portal.reject(token, reason))} className={primaryButton}>
                Confirmar recusa
              </button>
            </div>
          </div>
        )}

        <section>
          <h2 className="text-sm font-medium text-base-200 mb-3">Histórico</h2>
          <ol className="space-y-3 border-l border-base-800 pl-4">
            {order.timeline.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-base-600" />
                <p className="text-sm text-base-100">{t.title}</p>
                <p className="text-xs text-base-500">{toLocalDateTime(t.timestamp)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PublicLayout>
  );
};
