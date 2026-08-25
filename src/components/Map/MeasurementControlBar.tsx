import React from 'react';
import {
  Ruler,
  MapPin,
  Flag,
  AlertTriangle,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Crosshair,
  X,
  Camera,
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
  currentType,
  setCurrentType,
  totalDistanceMeters,
  onAddCurrentGpsPoint,
  onUndoLastPoint,
  onClearMeasurement,
  onCloseLoop,
  onFinishMeasurement,
  onClose,
}) => {
  const safeTotalDist = typeof totalDistanceMeters === 'number' && !isNaN(totalDistanceMeters) ? totalDistanceMeters : 0;
  const formattedDist =
    safeTotalDist >= 1000
      ? `${(safeTotalDist / 1000).toFixed(3)} km`
      : `${safeTotalDist.toFixed(1)} m`;

  const validPoints = Array.isArray(points) ? points : [];
  const stopsCount = validPoints.filter((p) => p && p.type === 'stop').length;
  const hazardsCount = validPoints.filter((p) => p && p.type === 'hazard').length;

  const isClosed =
    validPoints.length >= 3 &&
    validPoints[0]?.lat === validPoints[validPoints.length - 1]?.lat &&
    validPoints[0]?.lng === validPoints[validPoints.length - 1]?.lng;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-3 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-rose-500/60 rounded-2xl p-3 sm:p-4 shadow-2xl text-slate-100 flex flex-col gap-3">
        {/* Top bar header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
              <Ruler className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Régua Geodésica de Medição
                </h4>
                {isClosed ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                    Perímetro Fechado
                  </span>
                ) : (
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/30">
                    Clique no mapa ou no Ponto 1 para fechar
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {points.length === 0
                  ? 'Clique no mapa ou adicione sua posição GPS para iniciar'
                  : `${points.length} pontos • ${stopsCount} paradas • ${hazardsCount} alertas`}
              </p>
            </div>
          </div>

          {/* Real-time Distance Pill */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-950 border border-rose-500/40 px-3 py-1.5 rounded-xl text-right">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                {isClosed ? 'Perímetro Total' : 'Distância Total'}
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-rose-400">
                {formattedDist}
              </div>
            </div>

            <button
              onClick={onClose}
              title="Fechar medição"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Selector & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Point Type Switches */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setCurrentType('standard')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                currentType === 'standard'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Vértice Padrão</span>
            </button>

            <button
              onClick={() => setCurrentType('stop')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                currentType === 'stop'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flag className="w-3.5 h-3.5 text-emerald-300" />
              <span>Ponto de Parada</span>
            </button>

            <button
              onClick={() => setCurrentType('hazard')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                currentType === 'hazard'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
              <span>Atenção / Risco</span>
            </button>

            <button
              onClick={() => setCurrentType('woodpile')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                currentType === 'woodpile'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-xs">🪵</span>
              <span>Pilha Madeira</span>
            </button>
          </div>

          {/* Controls: Close Loop, Add GPS, Undo, Clear, Finish */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
            {/* Fechar no Ponto 1 */}
            {points.length >= 2 && !isClosed && onCloseLoop && (
              <button
                onClick={onCloseLoop}
                title="Conectar diretamente ao ponto inicial sem perder metros"
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-black shadow-md border border-amber-400/40 transition-all active:scale-95 animate-pulse"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Fechar no Início</span>
              </button>
            )}

            <button
              onClick={onAddCurrentGpsPoint}
              title="Adicionar ponto na coordenada GPS atual"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold border border-slate-700 transition-all active:scale-95"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">GPS Atual</span>
            </button>

            <button
              disabled={points.length === 0}
              onClick={onUndoLastPoint}
              title="Desfazer último vértice"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              disabled={points.length === 0}
              onClick={onClearMeasurement}
              title="Limpar todos os pontos"
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/80 text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              disabled={points.length < 2}
              onClick={onFinishMeasurement}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 border border-emerald-400/40"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Concluir & Relatório</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
