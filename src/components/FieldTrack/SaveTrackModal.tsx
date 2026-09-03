import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Track } from '../../types';
import {
  X,
  Activity,
  Download,
  CheckCircle2,
  Share2,
  Clock,
  Gauge,
  TrendingUp,
  MapPin,
  FileCode,
  Globe,
  Map,
} from 'lucide-react';
import {
  generateGPXContent,
  generateKMLContent,
  generateGeoJSONContent,
  downloadFile,
} from '../../utils/trackExport';

interface SaveTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTrack: Track | null;
  onSaveAndApply: (name: string, color: string) => void;
}

const COLOR_PALETTE = [
  { name: 'Vermelho Vibrante', hex: '#ef4444' },
  { name: 'Ciano Neon', hex: '#06b6d4' },
  { name: 'Azul Tático', hex: '#0284c7' },
  { name: 'Verde Esmeralda', hex: '#10b981' },
  { name: 'Âmbar Alerta', hex: '#f59e0b' },
  { name: 'Roxo Geodésico', hex: '#8b5cf6' },
  { name: 'Rosa Campo', hex: '#ec4899' },
];

export const SaveTrackModal: React.FC<SaveTrackModalProps> = ({
  isOpen,
  onClose,
  activeTrack,
  onSaveAndApply,
}) => {
  if (!isOpen || !activeTrack) return null;

  const [name, setName] = useState(
    activeTrack.name || `Trilha de Campo ${new Date().toLocaleTimeString('pt-BR')}`
  );
  const [selectedColor, setSelectedColor] = useState(activeTrack.color || '#ef4444');
  const [downloadedFormat, setDownloadedFormat] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownloadGPX = () => {
    const updated = { ...activeTrack, name, color: selectedColor };
    const content = generateGPXContent(updated);
    const filename = `${name.replace(/\s+/g, '_')}_${Date.now()}.gpx`;
    downloadFile(filename, content, 'application/gpx+xml');
    setDownloadedFormat('GPX');
    setTimeout(() => setDownloadedFormat(null), 3000);
  };

  const handleDownloadKML = () => {
    const updated = { ...activeTrack, name, color: selectedColor };
    const content = generateKMLContent(updated);
    const filename = `${name.replace(/\s+/g, '_')}_${Date.now()}.kml`;
    downloadFile(filename, content, 'application/vnd.google-earth.kml+xml');
    setDownloadedFormat('KML');
    setTimeout(() => setDownloadedFormat(null), 3000);
  };

  const handleDownloadGeoJSON = () => {
    const updated = { ...activeTrack, name, color: selectedColor };
    const content = generateGeoJSONContent(updated);
    const filename = `${name.replace(/\s+/g, '_')}_${Date.now()}.geojson`;
    downloadFile(filename, content, 'application/geo+json');
    setDownloadedFormat('GeoJSON');
    setTimeout(() => setDownloadedFormat(null), 3000);
  };

  const handleSave = () => {
    onSaveAndApply(name, selectedColor);
    onClose();
  };

  const totalPoints = activeTrack.points.length;
  const distanceFormatted =
    activeTrack.distanceKm >= 1
      ? `${activeTrack.distanceKm.toFixed(2)} km`
      : `${Math.round(activeTrack.distanceKm * 1000)} m`;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-32px))] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Gravação de Trilha Concluída</h2>
              <p className="text-xs text-slate-400">
                Salve no projeto e baixe os arquivos da rota para uso no mapa
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-200 text-sm">
          {/* Track Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nome da Trilha / Rota *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Rota Perímetro Leste - Vistoria"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-sky-500 text-xs sm:text-sm shadow-inner"
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Cor da Linha no Mapa
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setSelectedColor(c.hex)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    selectedColor === c.hex
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {selectedColor === c.hex && <CheckCircle2 className="w-4 h-4 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          {/* Telemetry KPIs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Distância
              </div>
              <div className="text-lg font-black font-mono text-white mt-0.5">
                {distanceFormatted}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Duração
              </div>
              <div className="text-lg font-black font-mono text-white mt-0.5">
                {formatDuration(activeTrack.durationSeconds)}
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                Vel. Média
              </div>
              <div className="text-lg font-black font-mono text-white mt-0.5">
                {activeTrack.avgSpeedKmh.toFixed(1)}{' '}
                <span className="text-[10px] font-normal text-slate-400">km/h</span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                Pontos
              </div>
              <div className="text-lg font-black font-mono text-white mt-0.5">
                {totalPoints} <span className="text-[10px] font-normal text-slate-400">pts</span>
              </div>
            </div>
          </div>

          {/* Download Formats Section */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                Baixar Rota para GPS / SIG / Google Earth
              </span>
              {downloadedFormat && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700 animate-pulse">
                  ✓ {downloadedFormat} baixado!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDownloadGPX}
                className="flex items-center justify-center gap-2 p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-white transition-all hover:scale-102"
              >
                <FileCode className="w-4 h-4 text-amber-400" />
                <span>Baixar GPX</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadKML}
                className="flex items-center justify-center gap-2 p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-white transition-all hover:scale-102"
              >
                <Globe className="w-4 h-4 text-sky-400" />
                <span>Baixar KML</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadGeoJSON}
                className="flex items-center justify-center gap-2 p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-white transition-all hover:scale-102"
              >
                <Map className="w-4 h-4 text-emerald-400" />
                <span>Baixar GeoJSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 shadow-xl shadow-emerald-900/40 transition-all hover:scale-102 active:scale-98"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Salvar e Aplicar no Mapa</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
