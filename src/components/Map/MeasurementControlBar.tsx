import React from 'react';
import {
  Ruler,
  RotateCcw,
  Trash2,
  CheckCircle2,
  X,
  Crosshair,
} from 'lucide-react';
import { MeasurementPoint, MeasurementPointType } from '../../types';

interface MeasurementControlBarProps {
  points: MeasurementPoint[];
  currentType: MeasurementPointType;
  setCurrentType: (type: MeasurementPointType) => void;
  totalDistanceMeters: number;
  onAddCurrentGpsPoint: () => void;
  onUndoLastPoint: () => void;
  onClearMeasurement: () => void;
  onCloseLoop?: () => void;
  onFinishMeasurement: () => void;
  onClose: () => void;
}

export const MeasurementControlBar: React.FC<MeasurementControlBarProps> = ({
  points,
  totalDistanceMeters,
  onAddCurrentGpsPoint,
  onUndoLastPoint,
  onClearMeasurement,
  onFinishMeasurement,
  onClose,
}) => {
  const safeTotalDist = typeof totalDistanceMeters === 'number' && !isNaN(totalDistanceMeters) ? totalDistanceMeters : 0;
  const formattedDist =
    safeTotalDist >= 1000
      ? `${(safeTotalDist / 1000).toFixed(2)} km`
      : `${safeTotalDist.toFixed(0)} m`;

  const validPoints = Array.isArray(points) ? points : [];

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-auto max-w-[92vw] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="pointer-events-auto bg-[#0F172A]/95 backdrop-blur-md border border-rose-500/50 rounded-full px-3.5 py-1.5 shadow-2xl flex items-center gap-2 text-white">
        <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
          <Ruler className="w-3.5 h-3.5" />
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono font-black text-rose-400">{formattedDist}</span>
          <span className="text-[10px] text-slate-400 font-semibold">({validPoints.length} pts)</span>
        </div>

        <div className="h-4 w-px bg-slate-700 mx-0.5 shrink-0" />

        <button
          onClick={onAddCurrentGpsPoint}
          title="Adicionar Ponto no GPS Atual"
          className="p-1 text-sky-400 hover:text-sky-300 rounded-full active:scale-95 transition-transform cursor-pointer"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        {validPoints.length > 0 && (
          <>
            <button
              onClick={onUndoLastPoint}
              title="Desfazer Último Ponto"
              className="p-1 text-slate-400 hover:text-white rounded-full active:scale-95 transition-transform cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClearMeasurement}
              title="Limpar Medição"
              className="p-1 text-slate-400 hover:text-rose-400 rounded-full active:scale-95 transition-transform cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onFinishMeasurement}
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full text-[11px] font-black uppercase tracking-wider shadow cursor-pointer active:scale-95 transition-transform"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ver</span>
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-full active:scale-95 transition-transform cursor-pointer ml-0.5"
          aria-label="Fechar Régua"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
