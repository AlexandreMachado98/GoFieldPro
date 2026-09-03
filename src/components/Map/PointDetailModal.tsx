import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MapPin,
  Flag,
  AlertTriangle,
  Camera,
  Upload,
  Trash2,
  Check,
} from 'lucide-react';
import { MeasurementPoint, MeasurementPointType } from '../../types';
import { latLngToUTM } from '../../utils/geoUtils';

interface PointDetailModalProps {
  point: MeasurementPoint | null;
  pointIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPoint: MeasurementPoint) => void;
  onDeletePoint?: (pointId: string) => void;
}

export const PointDetailModal: React.FC<PointDetailModalProps> = ({
  point,
  pointIndex,
  isOpen,
  onClose,
  onSave,
  onDeletePoint,
}) => {
  if (!isOpen || !point) return null;

  const [label, setLabel] = useState(point.label || `Ponto ${pointIndex + 1}`);
  const [type, setType] = useState<MeasurementPointType>(point.type);
  const [notes, setNotes] = useState(point.notes || '');
  const [photos, setPhotos] = useState<string[]>(point.photos || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setPhotos((prev) => [...prev, ev.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    onSave({
      ...point,
      label: label.trim() || `Ponto ${pointIndex + 1}`,
      type,
      notes: notes.trim(),
      photos: Array.isArray(photos) ? photos : [],
    });
    onClose();
  };

  const safeLat = typeof point.lat === 'number' && !isNaN(point.lat) ? point.lat : 0;
  const safeLng = typeof point.lng === 'number' && !isNaN(point.lng) ? point.lng : 0;
  const utm = latLngToUTM(safeLat, safeLng);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-32px))] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                type === 'stop'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : type === 'hazard'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-sky-500/20 text-sky-400'
              }`}
            >
              {type === 'stop' ? (
                <Flag className="w-4 h-4" />
              ) : type === 'hazard' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Editar Vértice #{pointIndex + 1}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {safeLat.toFixed(5)}°, {safeLng.toFixed(5)}° • UTM: E {utm.easting} N {utm.northing}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-200">
          {/* Classification / Type Selector */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1.5 text-[10px]">
              Classificação do Ponto
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setType('standard')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  type === 'standard'
                    ? 'bg-sky-950/80 border-sky-500 text-sky-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span className="font-bold">Padrão</span>
              </button>

              <button
                type="button"
                onClick={() => setType('stop')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  type === 'stop'
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Flag className="w-4 h-4" />
                <span className="font-bold">Parada</span>
              </button>

              <button
                type="button"
                onClick={() => setType('hazard')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  type === 'hazard'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="font-bold">Atenção</span>
              </button>

              <button
                type="button"
                onClick={() => setType('woodpile')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  type === 'woodpile'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="text-base leading-none">🪵</span>
                <span className="font-bold">Pilha Madeira</span>
              </button>
            </div>
          </div>

          {/* Point Label / Name */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[10px]">
              Identificador / Nome do Ponto
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-sky-500"
              placeholder="Ex: Parada 01 - Marco Divisório"
            />
          </div>

          {/* Notes / Technical Description */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1 text-[10px]">
              Observações Técnicas de Campo
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-sky-500"
              placeholder="Descreva particularidades do relevo, acesso, condições de segurança ou anotações topográficas..."
            />
          </div>

          {/* Photo Evidences */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                Evidências Fotográficas ({photos.length})
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Adicionar Foto</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file" onClick={(e) => e.stopPropagation()}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />

            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-950/40"
              >
                <Upload className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                <p className="text-slate-400 text-xs">Clique para anexar fotos ou capturar da câmera</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 group"
                  >
                    <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-600/90 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          {onDeletePoint ? (
            <button
              type="button"
              onClick={() => {
                onDeletePoint(point.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-400 hover:bg-red-950/50 transition-colors font-bold text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remover Ponto</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
