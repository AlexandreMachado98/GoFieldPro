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
  positionClassName?: string;
}

export const MeasurementControlBar: React.FC<MeasurementControlBarProps> = ({
  points,
  totalDistanceMeters,
  onAddCurrentGpsPoint,
  onUndoLastPoint,
  onClearMeasurement,
  onFinishMeasurement,
  onClose,
  positionClassName,
}) => {
  const safeTotalDist = typeof totalDistanceMeters === 'number' && !isNaN(totalDistanceMeters) ? totalDistanceMeters : 0;
  const formattedDist =
    safeTotalDist >= 1000
      ? `${(safeTotalDist / 1000).toFixed(2)} km`
      : `${safeTotalDist.toFixed(0)} m`;

  const validPoints = Array.isArray(points) ? points : [];

  return (
    <div className={positionClassName || "absolute bottom-0 left-0 right-0 z-40 w-full pointer-events-none animate-in slide-in-from-bottom duration-300"}>
      <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom,4rem))] sm:pb-3 shadow-2xl flex items-center justify-between gap-2 text-white w-full">
        {/* Left Side (Icon + Text) */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <Ruler className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-mono font-bold text-amber-400 text-sm">{formattedDist}</span>
            <span className="text-[10px] text-slate-400 font-semibold">{validPoints.length} vértices</span>
          </div>
        </div>

        {/* Right Side (Actions) */}
        <div className="flex items-center gap-2">
          <button
            onClick={onAddCurrentGpsPoint}
            title="Ponto no GPS"
            className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            <Crosshair className="w-5 h-5" />
          </button>

          {validPoints.length > 0 && (
            <>
              <button
                onClick={onUndoLastPoint}
                title="Desfazer"
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onClearMeasurement}
                title="Limpar"
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 text-rose-400 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={onFinishMeasurement}
                className="flex items-center gap-1.5 px-4 h-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full text-xs font-black uppercase tracking-wider shadow cursor-pointer active:scale-95 transition-transform"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ver</span>
              </button>
            </>
          )}

          <div className="h-6 w-px bg-slate-700 mx-1 shrink-0" />

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            aria-label="Fechar Régua"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
