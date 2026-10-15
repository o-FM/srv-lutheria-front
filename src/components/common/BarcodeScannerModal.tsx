import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QrCode, X, Sparkles, Volume2 } from 'lucide-react';

export const BarcodeScannerModal: React.FC = () => {
  const {
    isBarcodeModalOpen,
    closeBarcodeScanner,
    barcodeCallback,
    stock,
    triggerHaptic,
    showToast,
  } = useApp();

  const [manualCode, setManualCode] = useState('');

  if (!isBarcodeModalOpen) return null;

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // High pitch beep
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext unavailable or blocked
    }
  };

  const handleScanCode = (code: string) => {
    triggerHaptic();
    playBeep();
    if (barcodeCallback) {
      barcodeCallback(code);
    }
    showToast({
      title: 'Código escaneado!',
      description: `Código: ${code}`,
      type: 'success',
    });
    closeBarcodeScanner();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl text-stone-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/70">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-sm">Leitor de Código de Barras / QR</span>
          </div>
          <button
            type="button"
            onClick={closeBarcodeScanner}
            className="p-1 text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder simulator */}
        <div className="p-4 space-y-4">
          <div className="relative aspect-square max-w-[240px] mx-auto bg-stone-950 rounded-2xl overflow-hidden border-2 border-stone-800 flex items-center justify-center">
            {/* Viewfinder brackets */}
            <div className="absolute inset-4 border-2 border-dashed border-amber-500/50 rounded-xl pointer-events-none" />
            
            {/* Laser scanning beam animation */}
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-bounce duration-1000" />

            <div className="text-center p-4">
              <QrCode className="w-16 h-16 text-stone-700 mx-auto stroke-1" />
              <p className="text-[11px] text-stone-400 mt-2">
                Aponte a câmera da bancada para a etiqueta do produto
              </p>
            </div>
          </div>

          {/* Quick simulation buttons of existing stock items */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              Simular Leitura Instantânea (1 toque):
            </p>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {stock.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleScanCode(item.barcode)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700/60 text-xs text-left transition-colors"
                >
                  <span className="truncate text-stone-200">{item.name}</span>
                  <span className="text-[10px] font-mono text-amber-400 font-semibold shrink-0 ml-2">
                    {item.barcode.slice(-5)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual input fallback */}
          <div className="pt-2 border-t border-stone-800 flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Digitar código manualmente..."
              className="flex-1 px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              disabled={!manualCode.trim()}
              onClick={() => handleScanCode(manualCode.trim())}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
