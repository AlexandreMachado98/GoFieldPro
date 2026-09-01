import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Waypoint } from '../../types';
import { latLngToUTM, formatToDMS } from '../../utils/geoUtils';
import {
  X,
  MapPin,
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Compass,
  FileText,
  Upload,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react';

interface AddWaypointModalProps {
  initialCoord?: { lat: number; lng: number; altitude?: number } | null;
  onClose?: () => void;
}

const CATEGORY_CONFIG: { id: Waypoint['category']; label: string; color: string; icon: string }[] = [
  { id: 'checkpoint', label: 'Ponto de Navegação / Marco', color: '#0284c7', icon: '📍' },
  { id: 'hazard', label: 'Perigo / Risco Grave', color: '#ef4444', icon: '⚠️' },
  { id: 'obstacle', label: 'Obstáculo / Bloqueio', color: '#f97316', icon: '🚧' },
  { id: 'inspection', label: 'Inspeção / Vistoria Técnica', color: '#10b981', icon: '🔍' },
  { id: 'geodesic', label: 'Vértice / Marco Geodésico', color: '#8b5cf6', icon: '📐' },
  { id: 'soil_sample', label: 'Amostra de Solo / Minério', color: '#ec4899', icon: '🧪' },
  { id: 'fauna_flora', label: 'Fauna / Flora / Meio Ambiente', color: '#059669', icon: '🌲' },
  { id: 'infrastructure', label: 'Infraestrutura / Instalação', color: '#f59e0b', icon: '🏗️' },
];

export const AddWaypointModal: React.FC<AddWaypointModalProps> = ({
  initialCoord,
  onClose,
}) => {
  const {
    isAddWaypointModalOpen,
    setIsAddWaypointModalOpen,
    pendingWaypointCoord,
    setPendingWaypointCoord,
    currentGps,
    activeProject,
    addWaypoint,
    t,
    e2eeEnabled,
    notifySuccess,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const activeCoord = initialCoord || pendingWaypointCoord;
  const targetLat = activeCoord?.lat ?? currentGps.lat;
  const targetLng = activeCoord?.lng ?? currentGps.lng;
  const targetAlt = activeCoord?.altitude ?? currentGps.altitude ?? 1280;

  const [name, setName] = useState('');
  const [code, setCode] = useState(`ALF-${Math.floor(100 + Math.random() * 900)}`);
  const [category, setCategory] = useState<Waypoint['category']>('checkpoint');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState<number>(targetLat);
  const [lng, setLng] = useState<number>(targetLng);
  const [altitude, setAltitude] = useState<number>(targetAlt);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);

  useEffect(() => {
    const coord = initialCoord || pendingWaypointCoord;
    if (coord) {
      setLat(coord.lat);
      setLng(coord.lng);
      if (coord.altitude) setAltitude(coord.altitude);
    } else {
      setLat(currentGps.lat);
      setLng(currentGps.lng);
      if (currentGps.altitude) setAltitude(currentGps.altitude);
    }
  }, [initialCoord, pendingWaypointCoord, currentGps.lat, currentGps.lng, currentGps.altitude]);

  if (!isAddWaypointModalOpen) return null;

  const handleClose = () => {
    if (onClose) onClose();
    setPendingWaypointCoord(null);
    setIsAddWaypointModalOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPhoto(true);
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = typeof document !== 'undefined' ? document.createElement('img') : new (globalThis as any).Image();
      img.onload = () => {
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.75);
          setPhotos((prev) => [...prev, compressed]);
        }
        setIsProcessingPhoto(false);
      };
      img.onerror = () => setIsProcessingPhoto(false);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => setIsProcessingPhoto(false);
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newWpData: Omit<Waypoint, 'id' | 'createdAt' | 'synced' | 'encrypted'> = {
      projectId: activeProject.id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      category,
      lat: Number(lat),
      lng: Number(lng),
      altitude: Number(altitude),
      accuracy: currentGps.accuracy || 1.0,
      createdBy: 'Operador de Campo',
      notes: notes.trim(),
      status: category === 'hazard' || category === 'obstacle' ? 'alert' : 'verified',
      photos,
      attributes: {
        'Condição': 'Registrado em Campo',
        'Data / Hora': new Date().toLocaleString('pt-BR'),
      },
    };

    addWaypoint(newWpData);
    notifySuccess('Alfinete Fixado no Mapa', `Alfinete "${newWpData.name}" (${newWpData.code}) criado com sucesso.`);
    handleClose();
  };

  const utm = latLngToUTM(Number(lat), Number(lng));
  const selectedCat = CATEGORY_CONFIG.find((c) => c.id === category) || CATEGORY_CONFIG[0];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-32px))] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-xl border flex items-center justify-center text-lg"
              style={{ backgroundColor: `${selectedCat.color}20`, borderColor: `${selectedCat.color}50` }}
            >
              {selectedCat.icon}
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Adicionar Alfinete de Marcação</h2>
              <p className="text-xs text-slate-400">
                Fixe um marco geodésico, perigo, ou vistoria técnica
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-slate-200 text-sm">
          {/* Code and Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Código / ID *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono uppercase focus:outline-none focus:border-sky-500 text-xs shadow-inner"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Nome do Alfinete *</label>
              <input
                type="text"
                required
                placeholder="Ex: Entrada da Mata / Vértice de Cerca / Ponto de Água"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-sky-500 text-xs sm:text-sm shadow-inner"
              />
            </div>
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Categoria do Alfinete</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORY_CONFIG.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`p-2 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                    category === cat.id
                      ? 'bg-slate-800 border-sky-400 ring-2 ring-sky-500/40 shadow-lg scale-102'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{cat.icon}</span>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  </div>
                  <span className="text-[11px] font-bold text-white line-clamp-1">{cat.label.split('/')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* GPS Coordinates Telemetry Box */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between text-xs text-sky-400 font-bold">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-sky-400" />
                Posicionamento no Terreno (WGS84 & UTM)
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {formatToDMS(lat, true)} | {formatToDMS(lng, false)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 font-mono font-bold">LATITUDE</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-mono font-bold">LONGITUDE</label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-mono font-bold">ALTITUDE (m)</label>
                <input
                  type="number"
                  step="any"
                  value={altitude}
                  onChange={(e) => setAltitude(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono bg-slate-900/90 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
              <span><b>UTM {utm.zone}:</b> E {utm.easting} | N {utm.northing}</span>
              <span className="text-[10px] text-slate-500">SIRGAS 2000</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Descrição / Observações de Campo</label>
            <textarea
              rows={3}
              placeholder="Descreva detalhes observados, condições do terreno, tipo de vegetação ou alertas operacionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500 shadow-inner"
            />
          </div>

          {/* Real Attached Photos */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Fotos Georreferenciadas do Alfinete ({photos.length})
            </label>

            {/* Hidden File Inputs */}
            <input
              type="file" onClick={(e) => e.stopPropagation()}
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <input
              type="file" onClick={(e) => e.stopPropagation()}
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />

            <div className="flex gap-2.5 items-center overflow-x-auto pb-1">
              {photos.map((photo, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 shrink-0 group shadow-md">
                  <img src={photo} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {isProcessingPhoto && (
                <div className="w-20 h-20 rounded-xl border border-slate-700 bg-slate-800/80 flex flex-col items-center justify-center shrink-0">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                  <span className="text-[9px] text-slate-400 mt-1">Carregando...</span>
                </div>
              )}

              {/* Camera Button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-700 hover:border-sky-500 flex flex-col items-center justify-center text-slate-400 hover:text-sky-400 bg-slate-800/40 text-[10px] font-bold shrink-0 transition-all hover:scale-102"
              >
                <Camera className="w-5 h-5 mb-1 text-sky-400" />
                <span>Câmera</span>
              </button>

              {/* Gallery Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-400 bg-slate-800/40 text-[10px] font-bold shrink-0 transition-all hover:scale-102"
              >
                <Upload className="w-5 h-5 mb-1 text-emerald-400" />
                <span>Galeria</span>
              </button>
            </div>
          </div>

          {/* E2EE Banner */}
          {e2eeEnabled && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Assinatura Digital e Criptografia AES-256 ativas para este alfinete.</span>
            </div>
          )}
        </div>

        {/* Footer Buttons (Fixo) */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2.5 bg-slate-950/80 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1.5 shadow-xl shadow-sky-900/40 transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Fixar Alfinete no Mapa</span>
          </button>
        </div>
      </form>
    </div>
  </div>
);
};
