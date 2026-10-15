import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Camera,
  Mic,
  CheckCircle2,
  ChevronRight,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  Guitar,
} from 'lucide-react';
import { Order } from '../../types';

export const WorkbenchModeModal: React.FC = () => {
  const {
    isWorkbenchModeOpen,
    setIsWorkbenchModeOpen,
    currentRole,
    orders,
    instruments,
    clients,
    advanceOrderStatus,
    toggleServiceDone,
    openCamera,
    addOrderPhoto,
    triggerHaptic,
    showToast,
  } = useApp();

  if (!isWorkbenchModeOpen || currentRole !== 'luthier') return null;

  // Find active orders on bench (em_execucao, diagnostico, recebido)
  const benchOrders = orders.filter(
    (o) => o.status === 'em_execucao' || o.status === 'diagnostico' || o.status === 'recebido'
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    benchOrders[0]?.id || orders[0]?.id || ''
  );

  // Bench Timer state (e.g. for clamp pressure / glue drying)
  const [timerSeconds, setTimerSeconds] = useState(1800); // 30 min default for Titebond
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerPreset, setTimerPreset] = useState<'30m' | '60m' | '10m'>('30m');

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      triggerHaptic();
      showToast({
        title: 'Tempo de prensa / secagem esgotado!',
        description: 'Verifique a cola ou acabamento do instrumento na bancada.',
        type: 'warning',
        duration: 8000,
      });
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, triggerHaptic, showToast]);

  if (!isWorkbenchModeOpen) return null;

  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const instrument = instruments.find((i) => i.id === currentOrder?.instrumentId);
  const client = clients.find((c) => c.id === currentOrder?.clientId);

  const formatTimer = (total: number) => {
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTakePhoto = () => {
    triggerHaptic();
    openCamera((url, caption) => {
      if (currentOrder) {
        addOrderPhoto(currentOrder.id, {
          url,
          tag: 'bancada',
          caption: caption || 'Registro rápido na bancada de trabalho',
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-stone-950 text-stone-100 p-2 sm:p-4 select-none animate-in fade-in">
      {/* Top Bar with Big Exit Touch Target */}
      <div className="flex items-center justify-between p-2 pb-3 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
          <h1 className="text-base sm:text-lg font-black tracking-tight text-amber-200 uppercase">
            Modo Bancada Luthier
          </h1>
          <span className="text-[11px] font-semibold text-stone-400 bg-stone-800 px-2 py-0.5 rounded-full">
            Toques Grandes
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            setIsWorkbenchModeOpen(false);
          }}
          className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 flex items-center gap-1.5 active:scale-95"
        >
          <X className="w-4 h-4" />
          Sair do Modo
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto space-y-4 py-3 max-w-2xl mx-auto w-full">
        {/* Instrument Selector on Bench */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
            Instrumento Atual na Bancada:
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {orders.slice(0, 5).map((ord) => {
              const inst = instruments.find((i) => i.id === ord.instrumentId);
              const isSelected = ord.id === selectedOrderId;
              return (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    setSelectedOrderId(ord.id);
                  }}
                  className={`px-3 py-2.5 rounded-xl border text-left shrink-0 transition-all ${
                    isSelected
                      ? 'bg-amber-900/60 border-amber-500 text-amber-100 shadow-md ring-2 ring-amber-500/30'
                      : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      OS #{ord.orderNumber}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-stone-400">
                      · {ord.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs font-semibold truncate max-w-[160px]">
                    {inst?.brand} {inst?.model}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Big Instrument Card with Setup Specs */}
        {currentOrder && (
          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-amber-500">
                  OS #{currentOrder.orderNumber}
                </span>
                <h2 className="text-lg font-black text-white">
                  {instrument?.brand} {instrument?.model}
                </h2>
                <p className="text-xs text-stone-400">
                  Cliente: <span className="text-stone-200 font-semibold">{client?.name}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800">
                  {currentOrder.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Setup specs reminder */}
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-stone-950/70 border border-stone-800 text-xs">
              <div>
                <span className="text-[10px] text-stone-400 block">Cordas / Calibre:</span>
                <span className="font-semibold text-stone-200">{instrument?.stringsGauge || 'Padrão'}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 block">Afinação:</span>
                <span className="font-semibold text-stone-200">{instrument?.tuningPreference || 'E Standard'}</span>
              </div>
            </div>

            {/* Checklist de Serviços (GIANT TOUCH CHECKBOXES) */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Serviços a Realizar (Toque para marcar):
              </span>
              <div className="space-y-2">
                {currentOrder.services.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleServiceDone(currentOrder.id, service.id)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all min-h-[58px] active:scale-98 ${
                      service.done
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200 line-through opacity-75'
                        : 'bg-stone-950 border-stone-700/80 text-stone-100 hover:border-amber-500'
                    }`}
                  >
                    <span className="text-sm font-semibold pr-3 leading-snug">
                      {service.title}
                    </span>
                    <div
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                        service.done
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-stone-500 bg-stone-900'
                      }`}
                    >
                      {service.done && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Big Action Buttons for Bench (Photograph & Status Advance) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Big Photo Button */}
          <button
            type="button"
            onClick={handleTakePhoto}
            className="flex flex-col items-center justify-center gap-1.5 p-5 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 border border-amber-600/60 text-white shadow-xl hover:brightness-110 active:scale-95 transition-all min-h-[90px]"
          >
            <Camera className="w-8 h-8 text-amber-300" />
            <span className="text-sm font-black tracking-tight">FOTO DA BANCADA</span>
            <span className="text-[10px] text-amber-200/80">Entrada ou Antes/Depois</span>
          </button>

          {/* Big Advance Status Button */}
          <button
            type="button"
            onClick={() => {
              if (currentOrder) {
                advanceOrderStatus(currentOrder.id);
              }
            }}
            className="flex flex-col items-center justify-center gap-1.5 p-5 rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 border border-emerald-600/60 text-white shadow-xl hover:brightness-110 active:scale-95 transition-all min-h-[90px]"
          >
            <ChevronRight className="w-8 h-8 text-emerald-300" />
            <span className="text-sm font-black tracking-tight">AVANÇAR STATUS</span>
            <span className="text-[10px] text-emerald-200/80">1 Toque no Fluxo</span>
          </button>
        </div>

        {/* Bench Stopwatch / Clamp Timer */}
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-stone-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Timer de Prensa / Secagem
              </span>
            </div>
            <span className="text-xl font-mono font-black text-amber-400">
              {formatTimer(timerSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsTimerRunning(!isTimerRunning);
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                isTimerRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isTimerRunning ? (
                <>
                  <Pause className="w-4 h-4" /> Pausar
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Iniciar Cronômetro
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setIsTimerRunning(false);
                setTimerSeconds(1800);
              }}
              className="p-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300"
              title="Reiniciar timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            {[
              { label: 'Titebond (30m)', sec: 1800 },
              { label: 'Verniz Secagem (60m)', sec: 3600 },
              { label: 'Cianoacrilato (10m)', sec: 600 },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setIsTimerRunning(false);
                  setTimerSeconds(p.sec);
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[10px] text-stone-300 truncate"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
