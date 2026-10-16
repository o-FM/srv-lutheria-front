import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  User,
  Guitar,
  Camera,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Mic,
  Clock,
  Sparkles,
  Phone,
  Tag,
} from 'lucide-react';
import { InstrumentType, Photo } from '../../types';


export const NewOrderWizardModal: React.FC = () => {
  const {
    isNewOrderWizardOpen,
    setIsNewOrderWizardOpen,
    clients,
    createClient,
    instruments,
    createInstrument,
    createOrder,
    catalog,
    openCamera,
    setActiveOrderId,
    triggerHaptic,
    showToast,
  } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Client Selection / Quick Add
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Instrument Selection / Quick Add
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>('');
  const [isAddingNewInstrument, setIsAddingNewInstrument] = useState(false);
  const [instType, setInstType] = useState<InstrumentType>('guitarra');
  const [instBrand, setInstBrand] = useState('');
  const [instModel, setInstModel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Issue & Voice
  const [reportedIssue, setReportedIssue] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Services & Timeline
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<{ title: string; laborPrice: number }[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState(5);
  const [priority, setPriority] = useState<'normal' | 'alta' | 'urgente'>('normal');

  // Load draft from localStorage on mount
  useEffect(() => {
    if (isNewOrderWizardOpen) {
      const draft = localStorage.getItem('luthier_os_wizard_draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.reportedIssue) setReportedIssue(parsed.reportedIssue);
          if (parsed.selectedClientId) setSelectedClientId(parsed.selectedClientId);
        } catch {
          // ignore
        }
      }
    }
  }, [isNewOrderWizardOpen]);

  // Auto-save draft
  useEffect(() => {
    if (isNewOrderWizardOpen) {
      localStorage.setItem(
        'luthier_os_wizard_draft',
        JSON.stringify({ reportedIssue, selectedClientId })
      );
    }
  }, [reportedIssue, selectedClientId, isNewOrderWizardOpen]);

  if (!isNewOrderWizardOpen) return null;

  // Filter instruments belonging to selected client
  const clientInstruments = instruments.filter(
    (i) => i.clientId === selectedClientId
  );

  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length > 7) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setNewClientPhone(formatted);
  };

  const handleVoiceDictation = () => {
    triggerHaptic();
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      showToast({
        title: 'Ditado por voz indisponível',
        description: 'Este navegador não oferece reconhecimento de voz. Digite o defeito.',
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
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setReportedIssue((prev) => (prev ? `${prev}. ${transcript}` : transcript));
        triggerHaptic();
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleTakePhoto = () => {
    triggerHaptic();
    openCamera((url, caption, tag) => {
      const newPh: Photo = {
        id: 'ph-' + Date.now(),
        url,
        tag: tag || 'entrada',
        caption: caption || 'Foto de entrada na oficina',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      setPhotos((prev) => [newPh, ...prev]);
    }, 'entrada');
  };

  const handleNextStep = async () => {
    triggerHaptic();
    if (isSaving) return;
    if (step === 1) {
      if (isAddingNewClient) {
        if (!newClientName.trim()) {
          showToast({ title: 'Informe o nome do cliente', type: 'warning' });
          return;
        }
        if (newClientPhone.replace(/\D/g, '').length < 10) {
          showToast({ title: 'Informe o WhatsApp com DDD', type: 'warning' });
          return;
        }
        setIsSaving(true);
        const created = await createClient({ name: newClientName.trim(), phone: newClientPhone.trim() });
        setIsSaving(false);
        if (!created) return;
        setSelectedClientId(created.id);
        setSelectedInstrumentId('');
        setIsAddingNewClient(false);
      } else if (!selectedClientId) {
        showToast({ title: 'Selecione ou cadastre um cliente', type: 'warning' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!reportedIssue.trim()) {
        showToast({ title: 'Informe o defeito relatado ou serviço', type: 'warning' });
        return;
      }
      if (isAddingNewInstrument || !selectedInstrumentId) {
        if (!instBrand.trim() || !instModel.trim()) {
          showToast({ title: 'Informe marca e modelo do instrumento', type: 'warning' });
          return;
        }
        setIsSaving(true);
        const createdInst = await createInstrument(selectedClientId, {
          type: instType,
          brand: instBrand.trim(),
          model: instModel.trim(),
          conditionNotes: reportedIssue.trim(),
        });
        setIsSaving(false);
        if (!createdInst) return;
        setSelectedInstrumentId(createdInst.id);
        setIsAddingNewInstrument(false);
      }
      setStep(3);
    }
  };

  const addCustomService = () => {
    const price = parseFloat(customPrice.replace(',', '.'));
    if (!customTitle.trim() || !(price >= 0)) {
      showToast({ title: 'Informe descrição e valor do serviço', type: 'warning' });
      return;
    }
    setCustomServices((prev) => [...prev, { title: customTitle.trim(), laborPrice: price }]);
    setCustomTitle('');
    setCustomPrice('');
  };

  const handleFinishOrder = async () => {
    triggerHaptic();
    if (isSaving) return;

    const estimatedDate = new Date(Date.now() + estimatedDeliveryDays * 24 * 3600 * 1000)
      .toISOString()
      .substring(0, 10);

    setIsSaving(true);
    const created = await createOrder(
      {
        priority,
        reportedIssue: reportedIssue.trim(),
        estimatedDeliveryDate: estimatedDate,
        services: [
          ...selectedCatalogIds.map((catalogId) => ({ catalogId })),
          ...customServices,
        ],
        photos,
      },
      selectedClientId,
      selectedInstrumentId
    );
    setIsSaving(false);
    if (!created) return;

    localStorage.removeItem('luthier_os_wizard_draft');
    setStep(1);
    setPhotos([]);
    setReportedIssue('');
    setSelectedCatalogIds([]);
    setCustomServices([]);
    setSelectedClientId('');
    setSelectedInstrumentId('');
    setIsNewOrderWizardOpen(false);
    setActiveOrderId(created.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-t-3xl sm:rounded-2xl max-h-[94vh] flex flex-col overflow-hidden text-stone-100 shadow-2xl">
        {/* Header with 60-Second Badge */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Nova Ordem de Serviço</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" /> &lt; 60 segundos
              </span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Passo {step} de 3 · {step === 1 ? 'Cliente' : step === 2 ? 'Instrumento & Foto' : 'Serviços & Prazo'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsNewOrderWizardOpen(false)}
            className="p-1 text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="w-full bg-stone-800 h-1">
          <div
            className="bg-amber-500 h-1 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Step Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: CLIENTE */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  1. Quem é o Músico / Cliente?
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewClient(!isAddingNewClient)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingNewClient ? 'Escolher Existente' : 'Cadastrar Novo'}
                </button>
              </div>

              {isAddingNewClient ? (
                <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Ex: João Silva ou Banda Sol"
                      className="w-full px-3 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                      WhatsApp / Celular
                    </label>
                    <input
                      type="tel"
                      value={newClientPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="w-full px-3 py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-stone-400">
                    Selecione o cliente que está na oficina:
                  </p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {clients.map((cli) => {
                      const isSelected = cli.id === selectedClientId;
                      return (
                        <button
                          key={cli.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setSelectedClientId(cli.id);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-amber-950/60 border-amber-500 text-amber-100 shadow-md ring-1 ring-amber-500'
                              : 'bg-stone-800/80 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{cli.name}</p>
                            <p className="text-[11px] text-stone-400">{cli.phone}{cli.address ? ` · ${cli.address}` : ''}</p>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: INSTRUMENTO & FOTOS & DEFEITO */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
                  2. Instrumento & Fotos de Entrada
                </span>
                {clientInstruments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAddingNewInstrument(!isAddingNewInstrument)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isAddingNewInstrument ? 'Instrumento Salvo' : 'Outro Instrumento'}
                  </button>
                )}
              </div>

              {/* Existing instrument of this client or create */}
              {!isAddingNewInstrument && clientInstruments.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-stone-400">Instrumentos deste cliente:</p>
                  <div className="space-y-2">
                    {clientInstruments.map((inst) => {
                      const isSelected = inst.id === selectedInstrumentId;
                      return (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic();
                            setSelectedInstrumentId(inst.id);
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-amber-950/60 border-amber-500 text-amber-100 ring-1 ring-amber-500'
                              : 'bg-stone-800/80 border-stone-700/60 text-stone-300'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold text-white">
                              {inst.brand} {inst.model}
                            </p>
                            <p className="text-[11px] text-stone-400 capitalize">
                              {inst.type.replace('_', ' ')} · {inst.finishColor || 'Original'}
                            </p>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
                      Tipo de Instrumento
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'guitarra', label: 'Guitarra' },
                          { id: 'violao_aco', label: 'Violão Aço' },
                          { id: 'violao_nylon', label: 'Violão Nylon' },
                          { id: 'baixo', label: 'Baixo' },
                          { id: 'cavaquinho', label: 'Cavaquinho' },
                          { id: 'violino', label: 'Violino' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setInstType(t.id)}
                          className={`py-2 px-1 text-[11px] font-semibold rounded-lg border text-center transition-colors ${
                            instType === t.id
                              ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                        Marca
                      </label>
                      <input
                        type="text"
                        value={instBrand}
                        onChange={(e) => setInstBrand(e.target.value)}
                        placeholder="Ex: Fender, Martin, Rozini"
                        className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                        Modelo
                      </label>
                      <input
                        type="text"
                        value={instModel}
                        onChange={(e) => setInstModel(e.target.value)}
                        placeholder="Ex: Stratocaster, D-28"
                        className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Photos Capture (Fluxo Foto Primeiro) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Fotos de Entrada ({photos.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleTakePhoto}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-950/70 px-2.5 py-1 rounded-lg border border-amber-800"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Fotografar Agora
                  </button>
                </div>

                {photos.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((ph, idx) => (
                      <div
                        key={idx}
                        className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-700 shrink-0"
                      >
                        <img
                          src={ph.url}
                          alt="Foto OS"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPhotos((p) => p.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    onClick={handleTakePhoto}
                    className="p-4 rounded-xl border border-dashed border-stone-700 bg-stone-950/40 text-center cursor-pointer hover:border-amber-500 transition-colors"
                  >
                    <Camera className="w-6 h-6 text-stone-500 mx-auto mb-1" />
                    <p className="text-xs text-stone-400">
                      Toque para registrar fotos do estado de entrada
                    </p>
                  </div>
                )}
              </div>

              {/* Defeito Relatado with Voice Dictation */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    Defeito Relatado / Queixa do Cliente *
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
                    {isListening ? 'Ouvindo...' : 'Falar'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={reportedIssue}
                  onChange={(e) => setReportedIssue(e.target.value)}
                  placeholder="Ex: Trastejando na 7ª casa, ação muito alta, ruído no jack..."
                  className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* STEP 3: SERVIÇOS & PRAZO & CONFIRMAÇÃO */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-300 block">
                3. Serviços & Prazo de Entrega
              </span>

              {/* Serviços do catálogo da oficina + avulsos */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                  Serviços do catálogo (selecione os aplicáveis):
                </label>
                {catalog.length === 0 && (
                  <p className="text-[11px] text-stone-500">
                    Nenhum serviço no catálogo ainda. Cadastre em Mais → Config, ou adicione um avulso abaixo.
                  </p>
                )}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {catalog.map((svc) => {
                    const selected = selectedCatalogIds.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic();
                          setSelectedCatalogIds((prev) =>
                            selected ? prev.filter((id) => id !== svc.id) : [...prev, svc.id]
                          );
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-colors ${
                          selected
                            ? 'bg-amber-950/60 border-amber-500 text-amber-100'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:bg-stone-900'
                        }`}
                      >
                        <span className="truncate pr-2 font-medium">{svc.title}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-amber-400">R$ {svc.laborPrice.toFixed(2)}</span>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              selected ? 'bg-amber-600 border-amber-500 text-white' : 'border-stone-600'
                            }`}
                          >
                            {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {customServices.map((svc, idx) => (
                    <div
                      key={`custom-${idx}`}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border bg-amber-950/60 border-amber-500 text-amber-100 text-xs"
                    >
                      <span className="truncate pr-2 font-medium">{svc.title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-amber-400">R$ {svc.laborPrice.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => setCustomServices((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-0.5 rounded bg-black/40 text-stone-300"
                          aria-label="Remover serviço"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Serviço avulso"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="R$"
                    className="w-20 px-2 py-2 rounded-xl bg-stone-950 border border-stone-700 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={addCustomService}
                    className="px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400"
                    aria-label="Adicionar serviço avulso"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Delivery Days & Priority */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                    Prazo Estimado
                  </label>
                  <div className="flex items-center gap-1">
                    {[3, 5, 10].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setEstimatedDeliveryDays(days)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border ${
                          estimatedDeliveryDays === days
                            ? 'bg-amber-600 text-white border-amber-500'
                            : 'bg-stone-900 border-stone-800 text-stone-400'
                        }`}
                      >
                        {days} dias
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                    Prioridade
                  </label>
                  <div className="flex items-center gap-1">
                    {(['normal', 'alta', 'urgente'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2 text-[10px] uppercase font-bold rounded-lg border capitalize ${
                          priority === p
                            ? p === 'urgente'
                              ? 'bg-rose-600 text-white border-rose-500'
                              : 'bg-amber-600 text-white border-amber-500'
                            : 'bg-stone-900 border-stone-800 text-stone-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-3 border-t border-stone-800 bg-stone-950/90 flex items-center gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setStep((s) => (s - 1) as any);
              }}
              className="py-3 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={isSaving}
              className="disabled:opacity-60 flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              {isSaving ? 'Salvando...' : `Avançar para Passo ${step + 1}`}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOrder}
              disabled={isSaving}
              className="disabled:opacity-60 flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              {isSaving ? 'ABRINDO OS...' : 'ABRIR ORDEM DE SERVIÇO AGORA'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
