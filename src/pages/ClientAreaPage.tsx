import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2, LogOut, MessageCircle } from 'lucide-react';
import { Field, PublicLayout, inputClass, primaryButton } from './PublicLayout';
import { OrderStatusView } from './OrderStatusView';
import { isApiMode } from '../config/env';
import { api, ApiError } from '../services/api';
import type { PortalOrderDto } from '../services/api';

const storageKey = (workshop: string) => `luthier_client_session:${workshop}`;

interface ClientSession {
  token: string;
  expiresAt: number;
}

function loadSession(workshop: string): ClientSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(storageKey(workshop)) ?? 'null') as ClientSession | null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/**
 * Área do cliente: /cliente/{oficina}. Link enviado automaticamente pelo WhatsApp quando a OS é
 * aberta, junto com o código de acesso. Login = telefone + código (sem senha).
 */
export const ClientAreaPage: React.FC<{ workshop: string }> = ({ workshop }) => {
  const [session, setSession] = useState<ClientSession | null>(() => loadSession(workshop));

  const logout = useCallback(() => {
    localStorage.removeItem(storageKey(workshop));
    setSession(null);
  }, [workshop]);

  if (!isApiMode) {
    return (
      <PublicLayout width="sm">
        <p className="text-sm text-base-400">A área do cliente requer a API configurada (VITE_API_URL).</p>
      </PublicLayout>
    );
  }

  return session ? (
    <ClientOrders token={session.token} onLogout={logout} />
  ) : (
    <ClientLogin
      workshop={workshop}
      onLogin={(s) => {
        localStorage.setItem(storageKey(workshop), JSON.stringify(s));
        setSession(s);
      }}
    />
  );
};

const ClientLogin: React.FC<{ workshop: string; onLogin: (s: ClientSession) => void }> = ({ workshop, onLogin }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const t = await api.client.login(workshop, phone, code);
      onLogin({ token: t.accessToken, expiresAt: Date.now() + t.expiresIn * 1000 });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Código inválido ou expirado. Peça um novo código abaixo.'
          : (err as Error).message
      );
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    setError(null);
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Informe o telefone com DDD.');
      return;
    }
    setBusy(true);
    try {
      await api.client.requestCode(workshop, phone);
      setInfo('Se o telefone estiver cadastrado na oficina, você vai receber um novo código no WhatsApp em instantes (válido por 10 minutos).');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout width="sm">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-base-50">Acompanhe seus instrumentos</h1>
          <p className="text-sm text-base-400 mt-1">
            Use o telefone cadastrado na oficina e o código que enviamos pelo WhatsApp.
          </p>
        </div>
        <Field label="Telefone (WhatsApp)">
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className={inputClass}
            placeholder="(11) 98765-4321"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            required
          />
        </Field>
        <Field label="Código de acesso" error={error ?? undefined}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${inputClass} tracking-[0.4em] font-mono text-lg`}
            placeholder="••••••"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
          />
        </Field>
        {info && <p className="text-sm text-emerald-400">{info}</p>}
        <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
        </button>
        <button
          type="button"
          onClick={requestCode}
          disabled={busy}
          className="w-full h-11 rounded-xl border border-base-700 text-sm text-base-200 hover:bg-base-900 flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" /> Receber novo código
        </button>
      </form>
    </PublicLayout>
  );
};

const ClientOrders: React.FC<{ token: string; onLogout: () => void }> = ({ token, onLogout }) => {
  const [orders, setOrders] = useState<PortalOrderDto[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.client
      .orders(token)
      .then((list) => {
        setOrders(list);
        if (list.length === 1) setSelected(list[0].id);
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) onLogout();
        else setError((e as Error).message);
      });
  }, [token, onLogout]);

  const replace = (o: PortalOrderDto) => setOrders((prev) => prev?.map((x) => (x.id === o.id ? o : x)) ?? null);
  const current = orders?.find((o) => o.id === selected);

  return (
    <PublicLayout>
      <div className="flex items-center justify-between mb-6">
        {current && orders && orders.length > 1 ? (
          <button type="button" onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-sm text-base-400 hover:text-base-200">
            <ArrowLeft className="w-4 h-4" /> Minhas OS
          </button>
        ) : (
          <h1 className="text-lg font-semibold text-base-50">
            {orders?.[0]?.customerFirstName ? `Olá, ${orders[0].customerFirstName}` : 'Minhas ordens de serviço'}
          </h1>
        )}
        <button type="button" onClick={onLogout} className="flex items-center gap-1.5 text-sm text-base-400 hover:text-base-200">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!orders && !error && (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="w-6 h-6 text-base-500 animate-spin" />
        </div>
      )}
      {orders && orders.length === 0 && <p className="text-sm text-base-400">Nenhuma ordem de serviço por aqui ainda.</p>}

      {current ? (
        <OrderStatusView
          order={current}
          showGreeting={false}
          onApprove={async () => replace(await api.client.approve(token, current.id))}
          onReject={async (reason) => replace(await api.client.reject(token, current.id, reason))}
        />
      ) : (
        <ul className="space-y-2">
          {orders?.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelected(o.id)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-base-800 bg-base-900 hover:border-base-700 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-base-50 truncate">{o.instrument ?? `OS #${o.orderNumber}`}</span>
                  <span className="block text-xs text-base-400">
                    OS #{o.orderNumber} · {o.statusLabel}
                  </span>
                </span>
                {o.status === 'aguardando_aprovacao' && o.quote.status === 'pendente' && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent-500/15 text-accent-400">Aprovar</span>
                )}
                <ChevronRight className="w-4 h-4 text-base-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </PublicLayout>
  );
};
