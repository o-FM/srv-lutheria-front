import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QrCode, X } from 'lucide-react';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;

/**
 * Leitura pela câmera com a BarcodeDetector API (Chrome/Android). Onde ela não existe (iOS)
 * fica a digitação, que também funciona com leitor USB/Bluetooth (ele "digita" e envia Enter).
 */
export const BarcodeScannerModal: React.FC = () => {
  const { isBarcodeModalOpen, closeBarcodeScanner, barcodeCallback, triggerHaptic } = useApp();
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch {
      // AudioContext indisponível
    }
  };

  const handleScanCode = (code: string) => {
    triggerHaptic();
    playBeep();
    barcodeCallback?.(code);
    setManualCode('');
    closeBarcodeScanner();
  };

  useEffect(() => {
    if (!isBarcodeModalOpen) return;
    setCameraError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Leitura pela câmera indisponível neste navegador. Digite o código ou use um leitor USB.');
      return;
    }

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] });

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => undefined);
        }
        timer = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue && !stopped) {
              stopped = true;
              handleScanCode(codes[0].rawValue);
            }
          } catch {
            // quadro ainda sem imagem
          }
        }, 300);
      })
      .catch(() => setCameraError('Sem acesso à câmera. Digite o código abaixo.'));

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBarcodeModalOpen]);

  if (!isBarcodeModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl text-stone-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/70">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-amber-500" />
            <span className="font-bold text-sm">Leitor de código de barras / QR</span>
          </div>
          <button type="button" onClick={closeBarcodeScanner} className="p-1 text-stone-400 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="relative aspect-square max-w-[260px] mx-auto bg-stone-950 rounded-2xl overflow-hidden border-2 border-stone-800 flex items-center justify-center">
            {cameraError ? (
              <div className="text-center p-4">
                <QrCode className="w-16 h-16 text-stone-700 mx-auto stroke-1" />
                <p className="text-[11px] text-stone-400 mt-2">{cameraError}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-6 border-2 border-dashed border-amber-500/60 rounded-xl pointer-events-none" />
              </>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualCode.trim()) handleScanCode(manualCode.trim());
            }}
            className="pt-2 border-t border-stone-800 flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Digitar ou bipar o código..."
              className="flex-1 px-3 py-2 bg-stone-950 border border-stone-700 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
            >
              OK
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
