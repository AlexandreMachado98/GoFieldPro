import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Download,
  Share2,
  MapPin,
  Flag,
  AlertTriangle,
  Clock,
  Activity,
  Layers,
  CheckCircle2,
  Edit3,
  Loader2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { MeasurementPoint, MeasurementSession, Track } from '../../types';
import { calculateDistanceMeters, latLngToUTM, calculatePolygonArea } from '../../utils/geoUtils';
import {
  generateMeasurementPdfReport,
  exportMeasurementKml,
  generateMeasurementMapCanvas,
  generateMeasurementMapCanvasAsync,
} from '../../utils/measurementPdfReport';
import { useApp } from '../../context/AppContext';

interface MeasurementSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: MeasurementPoint[];
  totalDistanceMeters: number;
  onEditPoint: (point: MeasurementPoint, index: number) => void;
  onResetMeasurement: () => void;
}

export const MeasurementSummaryModal: React.FC<MeasurementSummaryModalProps> = ({
  isOpen,
  onClose,
  points,
  totalDistanceMeters,
  onEditPoint,
  onResetMeasurement,
}) => {
  const { activeProject, notifySuccess, notifyError, notifyInfo, currentRole } = useApp();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [sessionName, setSessionName] = useState(
    `Levantamento de Medição - ${new Date().toLocaleDateString('pt-BR')}`
  );
  const [mapType, setMapType] = useState<'satellite' | 'street' | 'drawing'>('satellite');
  const [previewCanvasImg, setPreviewCanvasImg] = useState<string>('');
  const [isLoadingMap, setIsLoadingMap] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || points.length === 0) return;
    let isMounted = true;
    setIsLoadingMap(true);

    generateMeasurementMapCanvasAsync(points, 960, 480, mapType)
      .then((dataUrl) => {
        if (isMounted) {
          setPreviewCanvasImg(dataUrl);
          setIsLoadingMap(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPreviewCanvasImg(generateMeasurementMapCanvas(points, 800, 360));
          setIsLoadingMap(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, points, mapType]);

  if (!isOpen || points.length === 0) return null;

  const stopsCount = points.filter((p) => p.type === 'stop').length;
  const hazardsCount = points.filter((p) => p.type === 'hazard').length;

  const walkMinutes = Math.round((totalDistanceMeters / 4000) * 60);
  const vehicleMinutes = Math.max(Math.round((totalDistanceMeters / 35000) * 60), 1);

  const formattedTotalDist =
    totalDistanceMeters >= 1000
      ? `${(totalDistanceMeters / 1000).toFixed(3)} km (${Math.round(totalDistanceMeters)} m)`
      : `${totalDistanceMeters.toFixed(1)} metros`;

  // Construct current session object
  const segmentDistances: number[] = [];
  let cumDist = 0;
  points.forEach((pt, idx) => {
    if (idx === 0) {
      segmentDistances.push(0);
    } else {
      const d = calculateDistanceMeters(points[idx - 1].lat, points[idx - 1].lng, pt.lat, pt.lng);
      segmentDistances.push(d);
      cumDist += d;
    }
  });

  const session: MeasurementSession = {
    id: `meas-${Date.now()}`,
    name: sessionName,
    points,
    totalDistanceMeters,
    segmentDistancesMeters: segmentDistances,
    createdAt: new Date().toISOString(),
    technicianName: 'Carlos Silva (Operador de Campo)',
    projectName: activeProject.name,
  };

  const handleExportPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateMeasurementPdfReport(session, {
        companyName: 'GOFIELD PRO • GESTÃO E ENGENHARIA DE CAMPO',
        responsibleName: 'Carlos Silva',
        weatherCondition: 'Operação de Campo Normal',
        mapType,
      });
      notifySuccess('Relatório PDF Gerado', 'O PDF com o mapa de satélite real e dados organizados foi baixado.');
    } catch (err) {
      console.error(err);
      notifyError('Erro ao Gerar PDF', 'Não foi possível compilar o relatório técnico.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportKml = () => {
    try {
      exportMeasurementKml(session);
      notifySuccess('KML Exportado', 'Arquivo KML baixado para uso no Google Earth / QGIS.');
    } catch (err) {
      console.error(err);
      notifyError('Erro ao exportar KML', 'Falha ao estruturar o arquivo geográfico.');
    }
  };

  const isClosed =
    points.length >= 3 &&
    points[0].lat === points[points.length - 1].lat &&
    points[0].lng === points[points.length - 1].lng;

  const areaResult = isClosed ? calculatePolygonArea(points) : { m2: 0, hectares: 0 };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 text-white flex items-center justify-center shadow-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg text-white">Resumo Técnico da Medição</h2>
                {isClosed ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40">
                    Perímetro Fechado
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    {points.length} vértices
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Projeto: <span className="text-slate-200 font-medium">{activeProject.name}</span> • Datum WGS84 / SIRGAS 2000
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm">
          {/* Editable Session Title */}
          <div>
            <label className="block text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
              Título do Levantamento / Relatório
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* KPI Metrics Dashboard Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/80 border border-rose-500/30 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-rose-400" />
                {isClosed ? 'Perímetro Total' : 'Distância Total'}
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-1">
                {totalDistanceMeters >= 1000
                  ? `${(totalDistanceMeters / 1000).toFixed(2)} km`
                  : `${totalDistanceMeters.toFixed(0)} m`}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isClosed ? 'Polígono 100% fechado' : `${Math.round(totalDistanceMeters)} metros exatos`}
              </div>
            </div>

            {isClosed ? (
              <div className="bg-slate-950/80 border border-emerald-500/40 p-3.5 rounded-2xl">
                <div className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Área Calculada
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                  {areaResult.hectares} <span className="text-xs font-bold">ha</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {areaResult.m2.toLocaleString('pt-BR')} m² exatos
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                  <Flag className="w-3.5 h-3.5 text-emerald-400" />
                  Pontos de Parada
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1">
                  {stopsCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Vistorias / checkpoints</div>
              </div>
            )}

            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                {isClosed ? 'Paradas / Alertas' : 'Alertas de Risco'}
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-1">
                {hazardsCount + (isClosed ? stopsCount : 0)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isClosed ? `${stopsCount} paradas • ${hazardsCount} alertas` : 'Obstáculos mapeados'}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
              <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Tempo Estimado
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-sky-400 mt-1">
                ~{walkMinutes} <span className="text-xs font-normal">min</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Veículo: ~{vehicleMinutes} min</div>
            </div>
          </div>

          {/* Cartographic Map Snapshot Preview */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                Mapa de Campo (Imagem Real no PDF)
              </span>

              {/* Map Layer Selector */}
              <div className="flex items-center bg-slate-900 border border-slate-700 p-0.5 rounded-lg text-[10px]">
                <button
                  onClick={() => setMapType('satellite')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    mapType === 'satellite'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🛰️ Satélite Real
                </button>
                <button
                  onClick={() => setMapType('street')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    mapType === 'street'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🗺️ Ruas / OSM
                </button>
                <button
                  onClick={() => setMapType('drawing')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                    mapType === 'drawing'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📐 Vetorial
                </button>
              </div>
            </div>

            <div className="w-full aspect-[20/9] max-h-64 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center relative">
              {isLoadingMap ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                  <span className="text-xs font-semibold">Carregando imagem de satélite georreferenciada...</span>
                </div>
              ) : previewCanvasImg ? (
                <img
                  src={previewCanvasImg}
                  alt="Enquadramento do Mapa Medido"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-500">Sem prévia disponível</span>
              )}
            </div>
          </div>

          {/* Point-by-Point Segment Breakdown Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                Detalhamento Segmento a Segmento (Ponto em Ponto)
              </h4>
              <span className="text-[11px] text-slate-400">
                Clique no botão de editar para adicionar fotos ou observações
              </span>
            </div>

            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-semibold">Vértice</th>
                      <th className="py-2.5 px-3 font-semibold">Tipo</th>
                      <th className="py-2.5 px-3 font-semibold">Coordenadas</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Trecho Parcial</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Acumulado</th>
                      <th className="py-2.5 px-3 font-semibold">Notas / Fotos</th>
                      <th className="py-2.5 px-3 text-center font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {points.map((pt, idx) => {
                      const segDist = segmentDistances[idx];
                      let cum = 0;
                      for (let i = 0; i <= idx; i++) cum += segmentDistances[i];
                      const utm = latLngToUTM(pt.lat, pt.lng);

                      return (
                        <tr
                          key={pt.id || idx}
                          className="hover:bg-slate-900/50 transition-colors group"
                        >
                          <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                            #{idx + 1} {pt.label}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                pt.type === 'stop'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : pt.type === 'hazard'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                              }`}
                            >
                              {pt.type === 'stop' && <Flag className="w-2.5 h-2.5" />}
                              {pt.type === 'hazard' && <AlertTriangle className="w-2.5 h-2.5" />}
                              {pt.type === 'standard' && <MapPin className="w-2.5 h-2.5" />}
                              {pt.type === 'stop' ? 'Parada' : pt.type === 'hazard' ? 'Alerta' : 'Vértice'}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-300">
                            {pt.lat.toFixed(5)}°, {pt.lng.toFixed(5)}°
                            <div className="text-[9px] text-slate-500">UTM: {utm.northing}N {utm.easting}E</div>
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-right text-slate-200">
                            {idx === 0 ? '---' : `${segDist.toFixed(1)} m`}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-right text-rose-400">
                            {cum.toFixed(1)} m
                          </td>
                          <td className="py-2 px-3 text-slate-400 max-w-xs truncate">
                            {pt.photos && pt.photos.length > 0 && (
                              <span className="inline-block bg-sky-950 text-sky-400 font-bold px-1.5 py-0.5 rounded mr-1 text-[10px]">
                                📷 {pt.photos.length} foto(s)
                              </span>
                            )}
                            {pt.notes || '-'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => onEditPoint(pt, idx)}
                              title="Editar ponto, nota e fotos"
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onResetMeasurement();
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-950/40 text-xs font-bold transition-colors"
            >
              Descartar Medição
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Continuar Medindo no Mapa
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportKml}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar KML</span>
            </button>

            <button
              disabled={isGeneratingPdf}
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white text-xs font-extrabold shadow-xl transition-all active:scale-95 border border-rose-400/40 disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Gerar Relatório PDF com Mapa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
