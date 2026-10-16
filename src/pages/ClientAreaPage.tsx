import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2, LogOut } from 'lucide-react';
import { Field, PublicLayout, inputClass, primaryButton } from './PublicLayout';
import { OrderStatusView } from './OrderStatusView';
import { isApiMode } from '../config/env';
import { api, ApiError } from '../services/api';
import type { PortalOrderDto } from '../services/api';

const STORAGE_KEY = 'luthier_client_session';

/** Mesmo alfabeto do backend: sem 0/O, 1/I/L e U, para não confundir ao digitar. */
const CODE_CHARS = /[^23456789ABCDEFGHJKMNPQRSTVWXYZ]/g;
const CODE_LENGTH = 8;

interface ClientSession {
  token: string;
  expiresAt: number;
}

function loadSession(): ClientSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ClientSession | null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

/** "k7qm4xpa" → "K7QM-4XPA" (aceita colar com espaço, traço ou minúsculas). */
export function formatAccessCode(value: string): string {
  const raw = value.toUpperCase().replace(CODE_CHARS, '').slice(0, CODE_LENGTH);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

/**
 * Área do cliente: /cliente. Link enviado automaticamente pelo WhatsApp quando a OS é aberta,
 * junto com o código de acesso. Login = só o código (XXXX-XXXX), sem telefone nem senha.
 */
export const ClientAreaPage: React.FC = () => {
  const [session, setSession] = useState<ClientSession | null>(loadSession);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

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
      onLogin={(s) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        setSession(s);
      }}
    />
  );
};

const ClientLogin: React.FC<{ onLogin: (s: ClientSession) => void }> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = code.replace('-', '').length === CODE_LENGTH;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      const t = await api.client.login(code);
      onLogin({ token: t.accessToken, expiresAt: Date.now() + t.expiresIn * 1000 });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Código inválido ou expirado. Confira a última mensagem da oficina no WhatsApp.'
          : (err as Error).message
      );
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
            Digite o código de acesso que a oficina enviou pelo WhatsApp.
          </p>
        </div>
        <Field label="Código de acesso" error={error ?? undefined}>
          <input
            autoFocus
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Código de acesso"
            className={`${inputClass} text-center tracking-[0.3em] font-mono text-xl uppercase`}
            placeholder="XXXX-XXXX"
            maxLength={CODE_LENGTH + 1}
            value={code}
            onChange={(e) => {
              setError(null);
              setCode(formatAccessCode(e.target.value));
            }}
            required
          />
        </Field>
        <button type="submit" disabled={busy || !complete} className={primaryButton}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
        </button>
        <p className="text-xs text-base-500 text-center">
          O código vale por 90 dias e muda a cada nova OS. Perdeu? Peça à oficina para reenviar.
        </p>
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
