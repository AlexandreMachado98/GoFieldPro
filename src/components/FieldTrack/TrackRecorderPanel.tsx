import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Track } from '../../types';
import {
  Play,
  Pause,
  Square,
  Activity,
  TrendingUp,
  Clock,
  Gauge,
  MapPin,
  Eye,
  EyeOff,
  Trash2,
  Download,
  Share2,
  HardDrive,
  FileCode,
  Globe,
  Map,
  CheckCircle2,
} from 'lucide-react';
import {
  generateGPXContent,
  generateKMLContent,
  generateGeoJSONContent,
  downloadFile,
} from '../../utils/trackExport';
import { SaveTrackModal } from './SaveTrackModal';

export const TrackRecorderPanel: React.FC = () => {
  const {
    isRecordingTrack,
    isRecordingPaused,
    activeTrack,
    startTrackRecording,
    pauseTrackRecording,
    resumeTrackRecording,
    stopTrackRecording,
    savedTracks,
    currentGps,
    t,
    currentRole,
    notifySuccess,
  } = useApp();

  const [trackNameInput, setTrackNameInput] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<{ [trackId: string]: string }>({});

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleExportTrack = (track: Track, format: 'gpx' | 'kml' | 'geojson') => {
    const filename = `${(track.name || 'trilha').replace(/\s+/g, '_')}_${Date.now()}.${format}`;
    if (format === 'gpx') {
      const content = generateGPXContent(track);
      downloadFile(filename, content, 'application/gpx+xml');
    } else if (format === 'kml') {
      const content = generateKMLContent(track);
      downloadFile(filename, content, 'application/vnd.google-earth.kml+xml');
    } else if (format === 'geojson') {
      const content = generateGeoJSONContent(track);
      downloadFile(filename, content, 'application/geo+json');
    }

    setDownloadFeedback((prev) => ({ ...prev, [track.id]: format.toUpperCase() }));
    notifySuccess('Arquivo Baixado', `Trilha exportada em formato ${format.toUpperCase()} com sucesso.`);
    setTimeout(() => {
      setDownloadFeedback((prev) => {
        const next = { ...prev };
        delete next[track.id];
        return next;
      });
    }, 3000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto text-slate-100 pb-32 sm:pb-16">
      {/* Live Track Recording Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-base text-white">Gravador de Trilhas em Tempo Real</h3>
          </div>
          {isRecordingTrack && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-950/60 border border-red-800/80 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              GRAVANDO TRILHA
            </span>
          )}
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Distância Percorrida
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1">
              {activeTrack
                ? activeTrack.distanceKm >= 1
                  ? `${activeTrack.distanceKm.toFixed(2)} km`
                  : `${Math.round(activeTrack.distanceKm * 1000)} m`
                : '0.00 km'}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Tempo Decorrido
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1">
              {activeTrack ? formatDuration(activeTrack.durationSeconds) : '00:00:00'}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              Velocidade Atual
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1">
              {isRecordingTrack ? (activeTrack?.points[activeTrack.points.length - 1]?.speed || 3.8).toFixed(1) : '0.0'}{' '}
              <span className="text-xs font-normal text-slate-400">km/h</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              Altitude Atual
            </div>
            <div className="text-2xl font-black font-mono text-white mt-1">
              {currentGps.altitude || 1280} <span className="text-xs font-normal text-slate-400">m</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        {currentRole !== 'auditor' && (
          <div>
            {!isRecordingTrack ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nome da Trilha (ex: Patrulha Perímetro Norte)"
                  value={trackNameInput}
                  onChange={(e) => setTrackNameInput(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
                <button
                  id="btn-start-track-recording"
                  onClick={() => {
                    startTrackRecording(trackNameInput);
                    setTrackNameInput('');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Iniciar Gravação
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                {isRecordingPaused ? (
                  <button
                    id="btn-resume-track-recording"
                    onClick={resumeTrackRecording}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Retomar Gravação
                  </button>
                ) : (
                  <button
                    id="btn-pause-track-recording"
                    onClick={pauseTrackRecording}
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    Pausar
                  </button>
                )}

                <button
                  id="btn-stop-track-recording"
                  onClick={() => setIsSaveModalOpen(true)}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Finalizar e Baixar Rota
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved Tracks List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h3 className="font-bold text-base text-white">
            Trilhas Gravadas no Projeto ({savedTracks.length})
          </h3>
          <span className="text-xs text-slate-400">
            Total: {savedTracks.reduce((acc, t) => acc + t.distanceKm, 0).toFixed(2)} km
          </span>
        </div>

        {savedTracks.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Nenhuma trilha gravada ainda. Inicie uma gravação acima ou diretamente no mapa de navegação.
          </div>
        ) : (
          <div className="space-y-3">
            {savedTracks.map((track) => (
              <div
                key={track.id}
                className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: track.color }}></span>
                    <h4 className="font-bold text-sm text-white">{track.name}</h4>
                    {track.synced && (
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                        Sincronizado
                      </span>
                    )}
                    {downloadFeedback[track.id] && (
                      <span className="text-[10px] font-bold text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800 animate-pulse">
                        ✓ {downloadFeedback[track.id]} baixado!
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1.5 font-mono">
                    <div>
                      Dist:{' '}
                      <b className="text-slate-200">
                        {track.distanceKm >= 1
                          ? `${track.distanceKm.toFixed(2)} km`
                          : `${Math.round(track.distanceKm * 1000)} m`}
                      </b>
                    </div>
                    <div>
                      Pontos: <b className="text-slate-200">{track.points.length} pts</b>
                    </div>
                    <div>
                      Vel. Média: <b className="text-slate-200">{track.avgSpeedKmh.toFixed(1)} km/h</b>
                    </div>
                    <div>
                      Altimetria:{' '}
                      <b className="text-emerald-400">+{track.elevationGainM}m</b> /{' '}
                      <b className="text-rose-400">-{track.elevationLossM}m</b>
                    </div>
                    <div>
                      Data: <b className="text-slate-300">{new Date(track.startTime).toLocaleDateString('pt-BR')}</b>
                    </div>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button
                    onClick={() => handleExportTrack(track, 'gpx')}
                    title="Baixar Arquivo GPX (Garmin / QGIS / Strava)"
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-amber-400 flex items-center gap-1 transition-all"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>GPX</span>
                  </button>

                  <button
                    onClick={() => handleExportTrack(track, 'kml')}
                    title="Baixar Arquivo KML (Google Earth / Google Maps)"
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-sky-400 flex items-center gap-1 transition-all"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>KML</span>
                  </button>

                  <button
                    onClick={() => handleExportTrack(track, 'geojson')}
                    title="Baixar Arquivo GeoJSON (SIG / Web)"
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold text-emerald-400 flex items-center gap-1 transition-all"
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>GeoJSON</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Corporate Copyright Footer */}
      <footer className="pt-6 pb-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400">GoField Pro</span>
          <span>•</span>
          <span>AM TST SAÚDE E SEGURANÇA DO TRABALHO</span>
        </div>
        <a
          href="https://amtst.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 font-medium hover:underline transition-colors"
        >
          https://amtst.vercel.app/
        </a>
      </footer>

      {/* Save Track Modal */}
      <SaveTrackModal
        isOpen={isSaveModalOpen}
        activeTrack={activeTrack}
        onClose={() => setIsSaveModalOpen(false)}
        onSaveAndApply={(name, color) => {
          stopTrackRecording(name, color);
          setIsSaveModalOpen(false);
        }}
      />
    </div>
  );
};
