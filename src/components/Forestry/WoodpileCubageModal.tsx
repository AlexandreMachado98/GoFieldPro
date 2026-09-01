import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { WoodpileItem, generateWoodpilePdfReport } from '../../utils/woodpilePdfReport';
import { getUserItem, setUserItem, getUserRawItem } from '../../utils/userStorage';
import {
  Trees,
  Calculator,
  Layers,
  FileDown,
  Plus,
  Trash2,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  X,
  Building2,
  Calendar,
  User,
  Tag,
  ArrowRight,
  TrendingUp,
  Info,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WoodpileCubageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_STACK_FACTORS = [
  { label: 'Eucalipto com Casca (0.65)', value: 0.65 },
  { label: 'Eucalipto Descascado (0.70)', value: 0.70 },
  { label: 'Pinus (0.60)', value: 0.60 },
  { label: 'Nativas / Lenha (0.55)', value: 0.55 },
  { label: 'Cavaco / Resíduos (0.45)', value: 0.45 },
];

export const WoodpileCubageModal: React.FC<WoodpileCubageModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const currentUserId = profile?.uid || '';
  const { notifySuccess, notifyWarning } = useApp();

  const [activeTab, setActiveTab] = useState<'pile' | 'smalian' | 'history'>('pile');

  // Stored Woodpiles list (saved in user-scoped localStorage)
  const [woodpiles, setWoodpiles] = useState<WoodpileItem[]>(() => {
    return getUserItem<WoodpileItem[]>(currentUserId, 'woodpiles', []);
  });

  useEffect(() => {
    setUserItem(currentUserId, 'woodpiles', woodpiles);
  }, [woodpiles, currentUserId]);

  // Form State: Pile Cubage
  const [pileCode, setPileCode] = useState(`PILHA-${(woodpiles.length + 1).toString().padStart(2, '0')}`);
  const [locationName, setLocationName] = useState('Talhão 01');
  const [woodSpecies, setWoodSpecies] = useState('Eucalipto (Eucalyptus urograndis)');
  const [lengthMeters, setLengthMeters] = useState<number>(25.0);
  const [heightMeters, setHeightMeters] = useState<number>(2.4);
  const [logLengthMeters, setLogLengthMeters] = useState<number>(2.2);
  const [stackingFactor, setStackingFactor] = useState<number>(0.65);
  const [pileNotes, setPileNotes] = useState('');
  const [pilePhotos, setPilePhotos] = useState<string[]>([]);

  // Form State: Smalian & Huber Log Cubage
  const [smalianD1, setSmalianD1] = useState<number>(28); // Diâmetro fino cm
  const [smalianD2, setSmalianD2] = useState<number>(36); // Diâmetro grosso cm
  const [smalianLength, setSmalianLength] = useState<number>(6.0); // Comprimento m
  const [huberDm, setHuberDm] = useState<number>(32); // Diâmetro médio cm

  const photoInputRef = useRef<HTMLInputElement>(null);

  // Calculations for Pile
  const calculatedStere = (Number(lengthMeters) || 0) * (Number(heightMeters) || 0) * (Number(logLengthMeters) || 0);
  const calculatedSolid = calculatedStere * (Number(stackingFactor) || 0.65);

  // Calculations for Smalian: V = ((pi * (d1/2)^2) + (pi * (d2/2)^2)) / 2 * L
  const r1 = (Number(smalianD1) || 0) / 200; // to meters
  const r2 = (Number(smalianD2) || 0) / 200;
  const g1 = Math.PI * Math.pow(r1, 2);
  const g2 = Math.PI * Math.pow(r2, 2);
  const smalianVolume = ((g1 + g2) / 2) * (Number(smalianLength) || 0);

  // Calculations for Huber: V = (pi * (dm/2)^2) * L
  const rm = (Number(huberDm) || 0) / 200;
  const gm = Math.PI * Math.pow(rm, 2);
  const huberVolume = gm * (Number(smalianLength) || 0);

  // Handle Photo capture / upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = typeof document !== 'undefined' ? document.createElement('img') : new (globalThis as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setPilePhotos((prev) => [...prev, compressedBase64]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save Woodpile to History
  const handleSaveWoodpile = (e: React.FormEvent) => {
    e.preventDefault();

    const newPile: WoodpileItem = {
      id: `pile_${Date.now()}`,
      pileCode: pileCode.trim() || `PILHA-${woodpiles.length + 1}`,
      locationName: locationName.trim() || 'Talhão Geral',
      woodSpecies: woodSpecies.trim(),
      lengthMeters: Number(lengthMeters),
      heightMeters: Number(heightMeters),
      logLengthMeters: Number(logLengthMeters),
      stackingFactor: Number(stackingFactor),
      stereVolume: Number(calculatedStere.toFixed(2)),
      solidVolumeM3: Number(calculatedSolid.toFixed(2)),
      date: new Date().toISOString(),
      technicianName: profile?.name || 'Operador Florestal',
      notes: pileNotes.trim(),
      photos: pilePhotos,
    };

    setWoodpiles((prev) => [newPile, ...prev]);
    notifySuccess('Pilha Registrada com Sucesso!', `${newPile.pileCode} com ${newPile.solidVolumeM3} m³ de madeira sólida.`);
    confetti({ particleCount: 35, spread: 60 });

    // Reset Form
    setPileCode(`PILHA-${(woodpiles.length + 2).toString().padStart(2, '0')}`);
    setPilePhotos([]);
    setPileNotes('');
    setActiveTab('history');
  };

  const handleDeletePile = (id: string) => {
    setWoodpiles((prev) => prev.filter((p) => p.id !== id));
    notifyWarning('Pilha Removida', 'O registro foi excluído do histórico.');
  };

  const handleExportPDF = (specificPile?: WoodpileItem) => {
    const listToExport = specificPile ? [specificPile] : woodpiles;
    if (listToExport.length === 0) {
      notifyWarning('Nenhuma Pilha', 'Registre pelo menos uma pilha de madeira para emitir o laudo.');
      return;
    }

    const companyLogo = getUserRawItem(currentUserId, 'custom_company_logo', '') || undefined;
    const companyName = getUserRawItem(currentUserId, 'custom_company_name', '') || profile?.company || 'AM TST GESTÃO FLORESTAL';

    generateWoodpilePdfReport(listToExport, profile?.name || 'Técnico Responsável', companyName, companyLogo);
    confetti({ particleCount: 40, spread: 70 });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[min(90dvh,calc(100vh-32px))] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Trees className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-sm sm:text-base text-white truncate flex items-center gap-2">
                <span>Cubagem Florestal & Madeira</span>
                <span className="text-[9px] uppercase font-black px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  m³ & st
                </span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Cálculo de volume estéreo, fator de empilhamento e cubagem rigorosa
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="grid grid-cols-3 p-1.5 sm:p-2 bg-slate-950/60 border-b border-slate-800 text-[11px] sm:text-xs font-bold gap-1 sm:gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('pile')}
            className={`py-2 px-1.5 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'pile'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Pilha</span>
          </button>

          <button
            onClick={() => setActiveTab('smalian')}
            className={`py-2 px-1.5 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'smalian'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Toros (Smalian)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1.5 sm:px-2 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Histórico ({woodpiles.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
          {/* ========================================================================= */}
          {/* TAB 1: CALCULADORA DE PILHA DE MADEIRA                                    */}
          {/* ========================================================================= */}
          {activeTab === 'pile' && (
            <form onSubmit={handleSaveWoodpile} className="space-y-3 animate-in fade-in text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                    Código da Pilha *
                  </label>
                  <input
                    type="text"
                    required
                    value={pileCode}
                    onChange={(e) => setPileCode(e.target.value)}
                    placeholder="Ex: PILHA-01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                    Talhão / Pátio *
                  </label>
                  <input
                    type="text"
                    required
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Ex: Talhão 14"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                    Espécie / Material
                  </label>
                  <input
                    type="text"
                    value={woodSpecies}
                    onChange={(e) => setWoodSpecies(e.target.value)}
                    placeholder="Ex: Eucalipto / Pinus"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Dimensions Section */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Dimensões Geométricas da Pilha:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Comprimento (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={lengthMeters}
                      onChange={(e) => setLengthMeters(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Altura Média (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={heightMeters}
                      onChange={(e) => setHeightMeters(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Comprimento do Toro (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={logLengthMeters}
                      onChange={(e) => setLogLengthMeters(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Stacking Factor Selection */}
                <div className="pt-2 border-t border-slate-850">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-300 uppercase">
                      Fator de Empilhamento (FE):
                    </label>
                    <span className="font-mono font-bold text-emerald-400">{stackingFactor}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {DEFAULT_STACK_FACTORS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setStackingFactor(f.value)}
                        className={`p-1.5 rounded-xl border text-[10px] font-bold text-left transition-all ${
                          stackingFactor === f.value
                            ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instant Calculated Result Card */}
              <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/50 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between shadow-xl">
                <div>
                  <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block">
                    Volume Total Calculado:
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                      {calculatedSolid.toFixed(2)} m³
                    </span>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      (sólido real)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Volume Estéreo: <b className="text-white font-mono">{calculatedStere.toFixed(2)} st</b>
                  </span>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Trees className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </div>

              {/* Photos & Notes */}
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                  Fotos da Pilha de Madeira
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="file" onClick={(e) => e.stopPropagation()}
                    accept="image/*"
                    ref={photoInputRef}
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="bg-slate-950 hover:bg-slate-800 border border-slate-700 text-sky-400 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Tirar Foto / Anexar</span>
                  </button>

                  {pilePhotos.map((p, idx) => (
                    <div key={idx} className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden border border-slate-700 shrink-0">
                      <img src={p} alt="Pilha" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPilePhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-300 mb-1">
                  Observações de Campo
                </label>
                <textarea
                  rows={2}
                  value={pileNotes}
                  onChange={(e) => setPileNotes(e.target.value)}
                  placeholder="Ex: Pilha regular pronta para transporte."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="pt-1 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Medição da Pilha</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CUBAGEM RIGOROSA DE TOROS (SMALIAN & HUBER)                         */}
          {/* ========================================================================= */}
          {activeTab === 'smalian' && (
            <div className="space-y-3.5 animate-in fade-in text-xs">
              <div className="bg-slate-950 p-3 sm:p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-extrabold text-white text-xs sm:text-sm">
                    Fórmula de Smalian (Ponta Fina & Grossa)
                  </h4>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  Ideal para toros com conicidade natural. V = [(g1 + g2) / 2] × L
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Diâmetro Fino (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={smalianD1}
                      onChange={(e) => setSmalianD1(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Diâmetro Grosso (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={smalianD2}
                      onChange={(e) => setSmalianD2(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Comprimento (m)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={smalianLength}
                      onChange={(e) => setSmalianLength(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300 font-semibold text-[11px]">Volume Smalian:</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {smalianVolume.toFixed(4)} m³
                  </span>
                </div>
              </div>

              {/* Huber Formula */}
              <div className="bg-slate-950 p-3 sm:p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-sky-400" />
                  <h4 className="font-extrabold text-white text-xs sm:text-sm">
                    Fórmula de Huber (Diâmetro Mediano)
                  </h4>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400">
                  Baseada na seção transversal média do toro. V = gm × L
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Diâmetro Médio (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={huberDm}
                      onChange={(e) => setHuberDm(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 mb-1">
                      Comprimento (m)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={smalianLength}
                      onChange={(e) => setSmalianLength(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300 font-semibold text-[11px]">Volume Huber:</span>
                  <span className="text-base sm:text-lg font-black text-sky-400 font-mono">
                    {huberVolume.toFixed(4)} m³
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: HISTÓRICO DE PILHAS & EMISSÃO DE LAUDOS EM LOTE                    */}
          {/* ========================================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-3 animate-in fade-in text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div>
                  <span className="font-extrabold text-white text-xs sm:text-sm">
                    {woodpiles.length} Pilha(s) Registrada(s)
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 block">
                    Total: {woodpiles.reduce((s, p) => s + p.solidVolumeM3, 0).toFixed(2)} m³ sólido / {woodpiles.reduce((s, p) => s + p.stereVolume, 0).toFixed(2)} st
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportPDF()}
                  disabled={woodpiles.length === 0}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Emitir Laudo em Lote (PDF)</span>
                </button>
              </div>

              {woodpiles.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl text-xs">
                  Nenhuma pilha registrada ainda. Use a primeira aba para calcular e registrar sua primeira pilha de madeira.
                </div>
              ) : (
                <div className="space-y-2">
                  {woodpiles.map((pile) => (
                    <div
                      key={pile.id}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:border-emerald-500/40 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-emerald-400 font-mono text-xs sm:text-sm">{pile.pileCode}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.2 rounded-full">
                            {pile.woodSpecies}
                          </span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                          {pile.locationName} • {pile.lengthMeters}m (C) × {pile.heightMeters}m (A) × {pile.logLengthMeters}m (L)
                        </div>
                        <div className="text-xs font-bold text-white mt-0.5">
                          <span className="text-emerald-400 font-mono">{pile.solidVolumeM3} m³ sólido</span>
                          <span className="text-slate-500 mx-1">•</span>
                          <span className="text-slate-300 font-mono">{pile.stereVolume} st</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 shrink-0 border-t sm:border-t-0 border-slate-850 pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleExportPDF(pile)}
                          className="flex-1 sm:flex-initial bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 active:scale-95"
                          title="Baixar Laudo PDF individual"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePile(pile.id)}
                          className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-colors"
                          title="Excluir medição"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
