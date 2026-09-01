import React, { useState } from 'react';
import {
  Pin,
  Play,
  Square,
  Pause,
  Ruler,
  Layers,
  Crosshair,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
  Download,
  Share2,
  Boxes,
  UploadCloud,
  X,
  MapPin,
  FileText,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { BottomSheet } from '../Common/BottomSheet';

export interface MapToolsControllerProps {
  // Primary FAB Actions
  onMarkWaypoint: () => void;
  onMarkWaypointClickMap?: () => void;
  isRecordingTrack: boolean;
  isRecordingPaused?: boolean;
  onStartTrackRecording: () => void;
  onStopTrackRecording: () => void;
  onPauseTrackRecording?: () => void;
  onResumeTrackRecording?: () => void;
  trackDistanceFormatted?: string;
  trackDurationFormatted?: string;

  // Measurement / Ruler
  isMeasuring: boolean;
  onToggleMeasuring: () => void;
  measurementPointsCount?: number;
  totalDistanceFormatted?: string;
  onClearMeasurement?: () => void;
  onFinishMeasurement?: () => void;

  // Map Controls & Camera
  onRecenterGps: () => void;
  hasGpsLock?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitBounds?: () => void;

  // Tools Menu Dialog Triggers
  onOpenLayers?: () => void;
  onOpenOfflineDownload?: () => void;
  onOpenWoodpileCubage?: () => void;
  onOpenKmlImport?: () => void;
  onOpenPdfExport?: () => void;
  onOpenMapsList?: () => void;

  // Custom Extra Actions
  isPdfMap?: boolean;
  pdfDocName?: string;
}

export const MapToolsController: React.FC<MapToolsControllerProps> = ({
  onMarkWaypoint,
  onMarkWaypointClickMap,
  isRecordingTrack,
  isRecordingPaused,
  onStartTrackRecording,
  onStopTrackRecording,
  onPauseTrackRecording,
  onResumeTrackRecording,
  trackDistanceFormatted = '0.00 km',
  trackDurationFormatted = '00:00',

  isMeasuring,
  onToggleMeasuring,
  measurementPointsCount = 0,
  totalDistanceFormatted = '0.00 m',
  onClearMeasurement,
  onFinishMeasurement,

  onRecenterGps,
  hasGpsLock = true,
  onZoomIn,
  onZoomOut,
  onFitBounds,

  onOpenLayers,
  onOpenOfflineDownload,
  onOpenWoodpileCubage,
  onOpenKmlImport,
  onOpenPdfExport,
  onOpenMapsList,

  isPdfMap = false,
  pdfDocName,
}) => {
  const [isToolsBottomSheetOpen, setIsToolsBottomSheetOpen] = useState(false);
  const [isPinChoiceOpen, setIsPinChoiceOpen] = useState(false);

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* CONTEXTUAL TOP FLOATING PILLS (REC & RULER ONLY WHEN ACTIVE)  */}
      {/* ------------------------------------------------------------- */}

      {/* Track Recording Active Top Pill */}
      {isRecordingTrack && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-auto max-w-[92vw] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-md border border-rose-500/60 rounded-full px-3.5 py-1.5 shadow-2xl flex items-center gap-2.5 text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_#f43f5e]" />
            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <span className="text-rose-400">{trackDistanceFormatted}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">{trackDurationFormatted}</span>
            </div>

            <div className="h-3.5 w-px bg-slate-800 shrink-0" />

            {onPauseTrackRecording && (
              <button
                onClick={isRecordingPaused ? onResumeTrackRecording : onPauseTrackRecording}
                className="p-1 text-amber-400 hover:text-amber-300 active:scale-95 cursor-pointer"
                title={isRecordingPaused ? 'Retomar Gravação' : 'Pausar Gravação'}
              >
                {isRecordingPaused ? <Play className="w-3.5 h-3.5 fill-amber-400" /> : <Pause className="w-3.5 h-3.5 fill-amber-400" />}
              </button>
            )}

            <button
              onClick={onStopTrackRecording}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-[11px] font-black uppercase tracking-wider shadow cursor-pointer active:scale-95 transition-transform"
            >
              <Square className="w-3 h-3 fill-white" />
              <span>Parar</span>
            </button>
          </div>
        </div>
      )}

      {/* Geodesic Ruler Active Top Pill */}
      {isMeasuring && !isRecordingTrack && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-auto max-w-[92vw] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-md border border-amber-500/60 rounded-full px-3.5 py-1.5 shadow-2xl flex items-center gap-2 text-white">
            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Ruler className="w-3 h-3" />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-mono font-black text-amber-400">{totalDistanceFormatted}</span>
              <span className="text-[10px] text-slate-400 font-semibold">({measurementPointsCount} pts)</span>
            </div>

            <div className="h-3.5 w-px bg-slate-800 shrink-0" />

            {onClearMeasurement && measurementPointsCount > 0 && (
              <button
                onClick={onClearMeasurement}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-400 px-1 cursor-pointer"
              >
                Limpar
              </button>
            )}

            {onFinishMeasurement && measurementPointsCount > 0 && (
              <button
                onClick={onFinishMeasurement}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-full text-[11px] font-black uppercase tracking-wider shadow cursor-pointer active:scale-95 transition-transform"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Ver</span>
              </button>
            )}

            <button
              onClick={onToggleMeasuring}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
              title="Fechar Régua"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TOP-RIGHT CORNER: MAP CONTROLS & TOOLS BUTTON STACK          */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute top-3 right-3 z-20 pointer-events-auto flex flex-col gap-2">
        {/* Tools Drawer Button */}
        <button
          onClick={() => setIsToolsBottomSheetOpen(true)}
          className="w-10 h-10 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-sky-400 border border-slate-800 shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-md"
          title="Ferramentas do Mapa"
        >
          <SlidersHorizontal className="w-4 h-4 text-sky-400" />
        </button>

        {/* Recenter GPS */}
        <button
          onClick={onRecenterGps}
          className={`w-10 h-10 rounded-xl border shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
            hasGpsLock
              ? 'bg-slate-950/90 text-emerald-400 border-slate-800 hover:bg-slate-900'
              : 'bg-amber-950/90 text-amber-400 border-amber-500/50 animate-pulse'
          }`}
          title="Recentralizar no GPS"
        >
          <Crosshair className="w-4.5 h-4.5" />
        </button>

        {/* Zoom In */}
        {onZoomIn && (
          <button
            onClick={onZoomIn}
            className="w-10 h-10 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-200 border border-slate-800 shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            title="Aproximar Zoom (+)"
          >
            <ZoomIn className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Zoom Out */}
        {onZoomOut && (
          <button
            onClick={onZoomOut}
            className="w-10 h-10 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-200 border border-slate-800 shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            title="Afastar Zoom (-)"
          >
            <ZoomOut className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Fit Bounds */}
        {onFitBounds && (
          <button
            onClick={onFitBounds}
            className="w-10 h-10 rounded-xl bg-slate-950/90 hover:bg-slate-900 text-slate-200 border border-slate-800 shadow-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            title="Enquadrar Todas as Camadas"
          >
            <Maximize2 className="w-4.5 h-4.5" />
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BOTTOM-RIGHT CORNER: CLEAN ACTION FABS (FLUSH ABOVE NAV BAR)   */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute bottom-3 right-3 z-20 pointer-events-auto flex items-center gap-2">
        {/* Track Recording FAB */}
        {isRecordingTrack ? (
          <button
            onClick={onStopTrackRecording}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-xl transition-all active:scale-95 border border-rose-400/50 cursor-pointer animate-pulse"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Parar</span>
          </button>
        ) : (
          <button
            onClick={onStartTrackRecording}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-950/95 hover:bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl font-bold text-xs shadow-xl transition-all active:scale-95 cursor-pointer backdrop-blur-md"
            title="Iniciar Gravação de Trilha GPS"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>Gravar</span>
          </button>
        )}

        {/* Primary Waypoint Mark FAB */}
        <div className="relative">
          <button
            onClick={() => {
              if (onMarkWaypointClickMap) {
                setIsPinChoiceOpen(!isPinChoiceOpen);
              } else {
                onMarkWaypoint();
              }
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 px-3.5 py-2.5 rounded-xl font-black shadow-lg transition-all active:scale-95 cursor-pointer text-xs"
          >
            <Pin className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
            <span>Marcar Ponto</span>
          </button>

          {/* Pin Choice Dropup */}
          {isPinChoiceOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-52 bg-slate-950 border border-slate-800 p-2 rounded-2xl shadow-2xl flex flex-col gap-1 z-40 animate-in fade-in slide-in-from-bottom-2">
              <button
                onClick={() => {
                  setIsPinChoiceOpen(false);
                  onMarkWaypoint();
                }}
                className="text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 text-xs font-bold text-sky-400 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Crosshair className="w-4 h-4 shrink-0" />
                <span>Marcar no GPS Atual</span>
              </button>

              {onMarkWaypointClickMap && (
                <button
                  onClick={() => {
                    setIsPinChoiceOpen(false);
                    onMarkWaypointClickMap();
                  }}
                  className="text-left px-3 py-2.5 rounded-xl hover:bg-slate-800 text-xs font-bold text-amber-400 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>Marcar Clicando no Mapa</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ANDROID MATERIAL 3 TOOLS BOTTOM SHEET                         */}
      {/* ------------------------------------------------------------- */}
      <BottomSheet
        isOpen={isToolsBottomSheetOpen}
        onClose={() => setIsToolsBottomSheetOpen(false)}
        title={isPdfMap ? `Ferramentas do Mapa PDF` : `Painel de Ferramentas de Campo`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-1">
          {/* 1. Régua / Medição */}
          <button
            onClick={() => {
              setIsToolsBottomSheetOpen(false);
              onToggleMeasuring();
            }}
            className={`p-3.5 rounded-2xl border flex flex-col items-start gap-2 transition-all active:scale-95 cursor-pointer text-left ${
              isMeasuring
                ? 'bg-amber-950/60 border-amber-500/60 text-amber-300'
                : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800 text-slate-200'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-xs">Régua & Medição</div>
              <div className="text-[10px] text-slate-400">Distâncias e áreas no mapa</div>
            </div>
          </button>

          {/* 2. Camadas / Basemap */}
          {onOpenLayers && (
            <button
              onClick={() => {
                setIsToolsBottomSheetOpen(false);
                onOpenLayers();
              }}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-start gap-2 transition-all active:scale-95 cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-slate-200">Camadas & Satélite</div>
                <div className="text-[10px] text-slate-400">Trocar mapa de fundo</div>
              </div>
            </button>
          )}

          {/* 3. Cubagem de Madeira */}
          {onOpenWoodpileCubage && (
            <button
              onClick={() => {
                setIsToolsBottomSheetOpen(false);
                onOpenWoodpileCubage();
              }}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-start gap-2 transition-all active:scale-95 cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-slate-200">Cubagem Madeira</div>
                <div className="text-[10px] text-slate-400">Cálculo de volume st/m³</div>
              </div>
            </button>
          )}

          {/* 4. Importar KML / KMZ */}
          {onOpenKmlImport && (
            <button
              onClick={() => {
                setIsToolsBottomSheetOpen(false);
                onOpenKmlImport();
              }}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-start gap-2 transition-all active:scale-95 cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-slate-200">Importar KML/KMZ</div>
                <div className="text-[10px] text-slate-400">Vetores e coordenadas</div>
              </div>
            </button>
          )}

          {/* 5. Download Offline */}
          {onOpenOfflineDownload && (
            <button
              onClick={() => {
                setIsToolsBottomSheetOpen(false);
                onOpenOfflineDownload();
              }}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-start gap-2 transition-all active:scale-95 cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-slate-200">Mapa Offline</div>
                <div className="text-[10px] text-slate-400">Baixar área para campo</div>
              </div>
            </button>
          )}

          {/* 6. Exportar & Compartilhar */}
          {onOpenPdfExport && (
            <button
              onClick={() => {
                setIsToolsBottomSheetOpen(false);
                onOpenPdfExport();
              }}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-start gap-2 transition-all active:scale-95 cursor-pointer text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-slate-200">Exportar & Compartilhar</div>
                <div className="text-[10px] text-slate-400">PDF, KML ou GeoJSON</div>
              </div>
            </button>
          )}

          {/* 7. Meus Mapas PDF (para PDF Viewer) */}
          {onOpenMapsList && (
            <button
              onClick={() => {
                setIsToolsBottomSheetOpen(false);
                onOpenMapsList();
              }}
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex flex-col items-start gap-2 transition-all active:scale-95 cursor-pointer text-left col-span-2 sm:col-span-1"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-slate-200">Meus Mapas PDF</div>
                <div className="text-[10px] text-slate-400">Lista de plantas salvas</div>
              </div>
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
};
