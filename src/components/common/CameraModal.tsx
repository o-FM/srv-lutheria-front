import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { shrinkImage } from './PhotoImage';
import {
  Camera,
  X,
  FlipHorizontal,
  Sparkles,
  Check,
  Upload,
  Mic,
  Tag,
  Image as ImageIcon,
} from 'lucide-react';


export const CameraModal: React.FC = () => {
  const { isCameraModalOpen, closeCamera, cameraCallback, cameraDefaultTag, triggerHaptic, showToast } = useApp();

  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [tag, setTag] = useState<'entrada' | 'diagnostico' | 'bancada' | 'finalizado' | 'detalhe_defeito'>('bancada');
  const [isWebcamActive, setIsWebcamActive] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isCameraModalOpen) setTag(cameraDefaultTag);
  }, [isCameraModalOpen, cameraDefaultTag]);

  // Stop webcam on close
  useEffect(() => {
    if (!isCameraModalOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsWebcamActive(false);
      setSelectedPhotoUrl(null);
      setCaption('');
    }
  }, [isCameraModalOpen]);

  if (!isCameraModalOpen) return null;

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsWebcamActive(true);
    } catch {
      showToast({
        title: 'Câmera nativa não disponível',
        description: 'Permita o acesso à câmera ou envie uma foto da galeria.',
        type: 'info',
      });
    }
  };

  const captureWebcamFrame = () => {
    if (!videoRef.current) return;
    triggerHaptic();
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setSelectedPhotoUrl(dataUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsWebcamActive(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerHaptic();
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedPhotoUrl(event.target?.result as string);
        setCaption(`Foto de ${file.name.replace(/\.[^/.]+$/, '')}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVoiceDictation = () => {
    triggerHaptic();
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      showToast({
        title: 'Ditado por voz indisponível',
        description: 'Este navegador não oferece reconhecimento de voz. Digite a legenda.',
        type: 'info',
      });
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCaption((prev) => (prev ? `${prev}. ${transcript}` : transcript));
        triggerHaptic();
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPhotoUrl) return;
    triggerHaptic();
    let url = selectedPhotoUrl;
    try {
      url = await shrinkImage(selectedPhotoUrl);
    } catch {
      showToast({ title: 'Imagem inválida', description: 'Escolha outra foto.', type: 'warning' });
      return;
    }
    if (cameraCallback) {
      cameraCallback(url, caption.trim() || undefined, tag);
    }
    closeCamera();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden text-stone-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/50">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-sm tracking-tight text-white">
              Câmera da Bancada
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCamera}
            className="p-1 text-stone-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Preview Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Main preview or active camera */}
          <div className="relative aspect-[4/3] bg-stone-950 rounded-2xl overflow-hidden border border-stone-800 flex items-center justify-center">
            {selectedPhotoUrl ? (
              <img
                src={selectedPhotoUrl}
                alt="Foto selecionada"
                className="w-full h-full object-cover"
              />
            ) : isWebcamActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="w-16 h-16 rounded-full bg-stone-900 border border-stone-800 mx-auto flex items-center justify-center text-amber-500 shadow-inner">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-200">
                    Pronto para fotografar
                  </p>
                  <p className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
                    Tire uma foto ao vivo ou selecione uma imagem do aparelho.
                  </p>
                </div>
              </div>
            )}

            {/* In-viewport shutter button if webcam active */}
            {isWebcamActive && (
              <button
                type="button"
                onClick={captureWebcamFrame}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white border-4 border-amber-600 shadow-2xl flex items-center justify-center active:scale-95"
              >
                <div className="w-10 h-10 rounded-full bg-amber-600" />
              </button>
            )}
          </div>

          {/* Quick Capture Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {!isWebcamActive ? (
              <button
                type="button"
                onClick={startWebcam}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                Abrir Câmera ao Vivo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((t) => t.stop());
                  }
                  setIsWebcamActive(false);
                }}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold"
              >
                Cancelar Câmera
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 active:scale-95 transition-all"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              Galeria / Arquivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Tags & Caption (Only if photo is chosen) */}
          {selectedPhotoUrl && (
            <div className="space-y-3 pt-2 border-t border-stone-800 animate-in fade-in">
              <div>
                <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                  Etapa / Categoria da Foto
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'entrada', label: 'Entrada' },
                      { id: 'diagnostico', label: 'Diagnóstico' },
                      { id: 'bancada', label: 'Em Andamento' },
                      { id: 'finalizado', label: 'Antes & Depois' },
                      { id: 'detalhe_defeito', label: 'Defeito' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setTag(item.id);
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                        tag === item.id
                          ? 'bg-amber-600 text-white font-semibold shadow-sm'
                          : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Legenda Técnica
                  </label>
                  <button
                    type="button"
                    onClick={handleVoiceDictation}
                    className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                      isListening
                        ? 'bg-rose-900 text-rose-300 animate-pulse'
                        : 'bg-stone-800 text-amber-400 hover:bg-stone-700'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    {isListening ? 'Ouvindo...' : 'Ditado por voz'}
                  </button>
                </div>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Ex: Fissura de 3cm no cavalete após limpeza..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <div className="p-3 border-t border-stone-800 bg-stone-950/80 flex items-center gap-2">
          <button
            type="button"
            onClick={closeCamera}
            className="flex-1 py-3 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedPhotoUrl}
            onClick={handleConfirm}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md ${
              selectedPhotoUrl
                ? 'bg-amber-600 hover:bg-amber-500 text-white active:scale-95'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Salvar Foto na OS
          </button>
        </div>
      </div>
    </div>
  );
};
