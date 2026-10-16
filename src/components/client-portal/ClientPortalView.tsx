import React, { useCallback, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Clock, CheckCircle2, ThumbsUp, ThumbsDown, Sparkles, ShieldCheck, AlertCircle } from 'lucide-react';
import { api, PortalOrderDto } from '../../services/api';
import { API_BASE } from '../../services/http';
import { toLocalDate, toLocalTimestamp } from '../../services/mappers';

const STEPS: { status: string; label: string; desc: string }[] = [
  { status: 'recebido', label: 'Recebido', desc: 'Chegada na oficina' },
  { status: 'diagnostico', label: 'Diagnóstico', desc: 'Análise na bancada' },
  { status: 'aguardando_aprovacao', label: 'Orçamento', desc: 'Aguardando sua aprovação' },
  { status: 'em_execucao', label: 'Em execução', desc: 'Serviços em andamento' },
  { status: 'pronto', label: 'Pronto', desc: 'Disponível para retirada' },
  { status: 'entregue', label: 'Entregue', desc: 'Instrumento devolvido' },
];

/** Posição no passo a passo (orçamento interno conta como diagnóstico). */
function stepIndex(status: string) {
  if (status === 'orcamento') return 1;
  return STEPS.findIndex((s) => s.status === status);
}

const brl = (v: number) => `R$ ${Number(v).toFixed(2)}`;

/**
 * Portal do cliente, sem senha: o token aleatório da OS no link é a credencial. Mostra o
 * mínimo de dados pessoais (só o primeiro nome) e permite aprovar ou recusar o orçamento.
 */
export const ClientPortalView: React.FC<{ token: string }> = ({ token }) => {
  const [order, setOrder] = useState<PortalOrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setOrder(await api.portal.view(token));
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error && 'status' in e && (e as { status: number }).status === 404
          ? 'Ordem de serviço não encontrada. Confira o link recebido da oficina.'
          : e instanceof Error
          ? e.message
          : 'Não foi possível carregar.'
      );
    }
  }, [token]);

  useEffect(() => {
    document.title = 'Acompanhe seu instrumento · Oficina Luthier';
    load();
  }, [load]);

  const answer = async (approve: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = approve ? await api.portal.approve(token) : await api.portal.reject(token, reason.trim());
      setOrder(updated);
      setIsRejecting(false);
      if (approve) {
        try {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar sua resposta.');
    } finally {
      setBusy(false);
    }
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-6 text-center">
        {error ? (
          <div className="space-y-2 max-w-sm">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm text-stone-300">{error}</p>
          </div>
        ) : (
          <div className="w-6 h-6 border-2 border-amber-600/30 border-t-amber-500 rounded-full animate-spin" />
        )}
      </div>
    );
  }

  const current = stepIndex(order.status);
  const cancelled = order.status === 'cancelado';
  const awaiting = order.status === 'aguardando_aprovacao' && order.quote?.status === 'pendente';

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans">
      <div className="space-y-4 py-6 px-4 max-w-xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white font-black">
            OS
          </div>
          <div>
            <p className="font-bold text-sm text-amber-100">Acompanhamento do seu instrumento</p>
            <p className="text-[11px] text-stone-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Link pessoal, não compartilhe
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs">
            {error}
          </div>
        )}

        <div className="p-5 rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-mono text-xs font-bold text-amber-400">OS #{order.orderNumber}</span>
              <h1 className="text-xl font-black text-white mt-0.5">{order.instrument}</h1>
              {order.customerFirstName && <p className="text-xs text-stone-400 mt-0.5">Olá, {order.customerFirstName}!</p>}
            </div>
            <span
              className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider text-center ${
                cancelled
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : order.status === 'pronto'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {order.statusLabel}
            </span>
          </div>

          {order.estimatedDeliveryDate && !cancelled && (
            <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-stone-300">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Previsão de entrega:</span>
              </div>
              <span className="font-bold text-white font-mono">
                {toLocalDate(order.estimatedDeliveryDate).split('-').reverse().join('/')}
              </span>
            </div>
          )}

          {!cancelled && (
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-800">
              {STEPS.map((st, idx) => {
                const isDone = idx < current;
                const isCurrent = idx === current;
                return (
                  <div key={st.status} className="flex items-start gap-3 relative">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 text-[10px] font-bold ${
                        isDone
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-stone-900 border-stone-700 text-stone-500'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isCurrent ? 'text-amber-400' : isDone ? 'text-stone-200' : 'text-stone-500'}`}>
                        {st.label}
                      </p>
                      <p className="text-[11px] text-stone-400">{st.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Orçamento */}
        {order.quote && (order.services.length > 0 || order.parts.length > 0) && (
          <div
            className={`p-5 rounded-3xl space-y-4 ${
              awaiting
                ? 'bg-gradient-to-br from-amber-950/80 via-stone-900 to-stone-950 border-2 border-amber-600 shadow-2xl'
                : 'bg-stone-900 border border-stone-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="font-black text-sm text-white uppercase tracking-tight">
                {awaiting ? 'Orçamento aguardando sua aprovação' : 'Orçamento'}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 space-y-2 text-xs">
              {order.services.map((s) => (
                <div key={s.id} className="flex justify-between text-stone-300">
                  <span className="pr-2">• {s.title}</span>
                  <span className="font-semibold text-white shrink-0">{brl(s.laborPrice)}</span>
                </div>
              ))}
              {order.parts.map((p) => (
                <div key={p.id} className="flex justify-between text-stone-300">
                  <span className="pr-2">• {p.quantity}x {p.stockItemName}</span>
                  <span className="font-semibold text-white shrink-0">{brl(p.total)}</span>
                </div>
              ))}
              {Number(order.quote.discount) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Desconto</span>
                  <span>- {brl(order.quote.discount)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-stone-800 flex justify-between font-black text-sm text-white">
                <span>Total:</span>
                <span className="text-amber-400 font-mono">{brl(order.quote.grandTotal)}</span>
              </div>
              {order.quote.paymentTerms && <p className="text-[11px] text-stone-400">Pagamento: {order.quote.paymentTerms}</p>}
            </div>

            {awaiting && !isRejecting && (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => answer(true)}
                  className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                >
                  <ThumbsUp className="w-5 h-5" />
                  APROVAR ORÇAMENTO
                </button>
                <button
                  type="button"
                  onClick={() => setIsRejecting(true)}
                  className="w-full py-2.5 rounded-2xl text-stone-400 hover:text-stone-200 text-xs font-semibold"
                >
                  Não quero fazer agora
                </button>
              </div>
            )}
            {awaiting && isRejecting && (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Conte para a oficina o motivo (opcional)"
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsRejecting(false)} className="flex-1 py-2.5 rounded-xl bg-stone-800 text-xs font-semibold text-stone-300">
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => answer(false)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Recusar orçamento
                  </button>
                </div>
              </div>
            )}
            {order.quote.status === 'aprovado' && (
              <p className="text-xs text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Orçamento aprovado. Obrigado!
              </p>
            )}
          </div>
        )}

        {/* Fotos */}
        {order.photos.length > 0 && (
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
              Fotos do seu instrumento ({order.photos.length})
            </span>
            <div className="grid grid-cols-2 gap-3">
              {order.photos.map((ph) => (
                <a
                  key={ph.id}
                  href={`${API_BASE}${api.portal.photoPath(token, ph.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl overflow-hidden border border-stone-800 bg-stone-900 shadow-md block"
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={`${API_BASE}${api.portal.photoPath(token, ph.id)}`}
                      alt={ph.caption || 'Foto da OS'}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 text-[10px] font-bold uppercase text-amber-300">
                      {ph.tag.replace('_', ' ')}
                    </span>
                  </div>
                  {ph.caption && <p className="p-2.5 text-xs text-stone-200 line-clamp-2">{ph.caption}</p>}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Linha do tempo */}
        {order.timeline.length > 0 && (
          <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">Histórico</span>
            {order.timeline.map((t) => (
              <div key={t.id} className="flex justify-between gap-3 text-xs border-b border-stone-800/60 pb-1.5 last:border-0">
                <span className="text-stone-200">{t.title}</span>
                <span className="text-[10px] text-stone-500 shrink-0">{toLocalTimestamp(t.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
