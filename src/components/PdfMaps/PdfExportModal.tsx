import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  FileText, 
  Globe, 
  Map as MapIcon, 
  Navigation, 
  Check, 
  Sparkles,
  Layers,
  Camera,
  Footprints,
  FileCheck
} from 'lucide-react';
import { PdfDocument } from '../../utils/pdfStorage';
import { 
  generateKML, 
  generateGeoJSON, 
  generateGPX, 
  generateAnnotatedPdf, 
  downloadFile, 
  shareExportedFile 
} from '../../utils/pdfMapExport';
import { useApp } from '../../context/AppContext';

interface PdfExportModalProps {
  document: PdfDocument;
  isOpen: boolean;
  onClose: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  document: doc,
  isOpen,
  onClose,
}) => {
  const { notifySuccess, notifyInfo, notifyError } = useApp();
  const [activeFormat, setActiveFormat] = useState<'pdf' | 'kml' | 'geojson' | 'gpx'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState('');

  if (!isOpen) return null;

  const totalMarkers = doc.markers?.length || 0;
  const totalTracks = doc.tracks?.length || 0;
  const totalPhotos = doc.markers?.reduce((acc, m) => acc + (m.photos?.length || 0), 0) || 0;

  const cleanDocName = doc.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');

  const handleDownload = async (format: 'pdf' | 'kml' | 'geojson' | 'gpx') => {
    setIsGenerating(true);
    try {
      if (format === 'pdf') {
        setGeneratingLabel('Compondo Planta Anotada em Alta Resolução...');
        const pdfBlob = await generateAnnotatedPdf(doc);
        downloadFile(pdfBlob, `GoField_${cleanDocName}_Anotado.pdf`, 'application/pdf');
        notifySuccess('Download Concluído', 'Planta técnica PDF exportada com todas as marcações.');
      } else if (format === 'kml') {
        setGeneratingLabel('Gerando arquivo KML (Google Earth & QGIS)...');
        const kmlString = generateKML(doc);
        downloadFile(kmlString, `GoField_${cleanDocName}_SIG.kml`, 'application/vnd.google-earth.kml+xml');
        notifySuccess('Download KML Concluído', 'Compatível com Google Earth, Avenza Maps e QGIS.');
      } else if (format === 'geojson') {
        setGeneratingLabel('Gerando GeoJSON Universal...');
        const geojsonString = generateGeoJSON(doc);
        downloadFile(geojsonString, `GoField_${cleanDocName}_GeoJSON.geojson`, 'application/geo+json');
        notifySuccess('Download GeoJSON Concluído', 'Estrutura padrão RFC 7946 pronta para SIG.');
      } else if (format === 'gpx') {
        setGeneratingLabel('Gerando arquivo GPX (Garmin & GPS)...');
        const gpxString = generateGPX(doc);
        downloadFile(gpxString, `GoField_${cleanDocName}_Trilhas.gpx`, 'application/gpx+xml');
        notifySuccess('Download GPX Concluído', 'Compatível com Garmin, Strava e Gaia GPS.');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      notifyError('Erro na Exportação', err.message || 'Falha ao gerar arquivo.');
    } finally {
      setIsGenerating(false);
      setGeneratingLabel('');
    }
  };

  const handleShare = async (format: 'pdf' | 'kml' | 'geojson' | 'gpx') => {
    setIsGenerating(true);
    try {
      if (format === 'pdf') {
        setGeneratingLabel('Preparando PDF para compartilhamento...');
        const pdfBlob = await generateAnnotatedPdf(doc);
        await shareExportedFile(
          pdfBlob,
          `GoField_${cleanDocName}_Anotado.pdf`,
          `Planta Anotada: ${doc.name}`,
          `Levantamento de Campo realizado no GoField Pro com ${totalMarkers} pontos e ${totalTracks} trilhas.`
        );
      } else if (format === 'kml') {
        setGeneratingLabel('Preparando arquivo KML...');
        const kmlString = generateKML(doc);
        const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
        await shareExportedFile(
          blob,
          `GoField_${cleanDocName}_SIG.kml`,
          `Camadas KML: ${doc.name}`,
          `Arquivo KML contendo vértices e trilhas de campo do GoField Pro.`
        );
      } else if (format === 'geojson') {
        setGeneratingLabel('Preparando GeoJSON...');
        const geojsonString = generateGeoJSON(doc);
        const blob = new Blob([geojsonString], { type: 'application/geo+json' });
        await shareExportedFile(
          blob,
          `GoField_${cleanDocName}_GeoJSON.geojson`,
          `GeoJSON: ${doc.name}`,
          `Dados vetoriais georreferenciados do GoField Pro.`
        );
      } else if (format === 'gpx') {
        setGeneratingLabel('Preparando arquivo GPX...');
        const gpxString = generateGPX(doc);
        const blob = new Blob([gpxString], { type: 'application/gpx+xml' });
        await shareExportedFile(
          blob,
          `GoField_${cleanDocName}_Trilhas.gpx`,
          `Trilhas GPX: ${doc.name}`,
          `Rotas e waypoints GPS exportados do GoField Pro.`
        );
      }
      notifyInfo('Compartilhamento', 'Ação enviada para o dispositivo.');
    } catch (err: any) {
      console.error('Share error:', err);
      notifyError('Erro ao Compartilhar', err.message || 'Não foi possível compartilhar o arquivo.');
    } finally {
      setIsGenerating(false);
      setGeneratingLabel('');
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/90 w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Exportar & Compartilhar</h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{doc.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 text-center">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Pontos / Vistorias</div>
              <div className="text-base font-black text-emerald-400 mt-0.5">{totalMarkers}</div>
            </div>
            <div className="border-x border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Rotas / Trilhas</div>
              <div className="text-base font-black text-sky-400 mt-0.5">{totalTracks}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Fotos Anexadas</div>
              <div className="text-base font-black text-amber-400 mt-0.5">{totalPhotos}</div>
            </div>
          </div>

          {/* Formats Tabs */}
          <div>
            <label className="block text-slate-300 font-bold mb-2">Selecione o Formato de Exportação</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              
              {/* PDF */}
              <button
                type="button"
                onClick={() => setActiveFormat('pdf')}
                className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                  activeFormat === 'pdf'
                    ? 'border-emerald-500 bg-emerald-950/60 text-white ring-1 ring-emerald-500 shadow-md'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <FileText className={`w-6 h-6 ${activeFormat === 'pdf' ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="font-extrabold text-xs">PDF Anotado</span>
                <span className="text-[9px] text-slate-500">Planta com Desenhos</span>
              </button>

              {/* KML */}
              <button
                type="button"
                onClick={() => setActiveFormat('kml')}
                className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                  activeFormat === 'kml'
                    ? 'border-sky-500 bg-sky-950/60 text-white ring-1 ring-sky-500 shadow-md'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <Globe className={`w-6 h-6 ${activeFormat === 'kml' ? 'text-sky-400' : 'text-slate-500'}`} />
                <span className="font-extrabold text-xs">KML / KMZ</span>
                <span className="text-[9px] text-slate-500">Google Earth / SIG</span>
              </button>

              {/* GeoJSON */}
              <button
                type="button"
                onClick={() => setActiveFormat('geojson')}
                className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                  activeFormat === 'geojson'
                    ? 'border-amber-500 bg-amber-950/60 text-white ring-1 ring-amber-500 shadow-md'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <MapIcon className={`w-6 h-6 ${activeFormat === 'geojson' ? 'text-amber-400' : 'text-slate-500'}`} />
                <span className="font-extrabold text-xs">GeoJSON</span>
                <span className="text-[9px] text-slate-500">Padrão QGIS / Web</span>
              </button>

              {/* GPX */}
              <button
                type="button"
                onClick={() => setActiveFormat('gpx')}
                className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                  activeFormat === 'gpx'
                    ? 'border-purple-500 bg-purple-950/60 text-white ring-1 ring-purple-500 shadow-md'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <Navigation className={`w-6 h-6 ${activeFormat === 'gpx' ? 'text-purple-400' : 'text-slate-500'}`} />
                <span className="font-extrabold text-xs">GPX Universal</span>
                <span className="text-[9px] text-slate-500">Garmin / Strava</span>
              </button>
            </div>
          </div>

          {/* Format Description Box */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            {activeFormat === 'pdf' && (
              <>
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
                  <FileCheck className="w-4 h-4" />
                  <span>Dossiê Gráfico da Planta em Alta Resolução (PDF)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Gera um documento PDF com a folha da planta renderizada em alta definição, superimpondo todos os pinos de vistoria numerados, trajetos e trilhas desenhadas, tabela detalhada de anotações e carimbo oficial de segurança do trabalho.
                </p>
                <div className="text-[11px] text-slate-400 font-medium">
                  • Ideal para impressão, anexar em laudos e enviar para a diretoria.
                </div>
              </>
            )}

            {activeFormat === 'kml' && (
              <>
                <div className="flex items-center gap-2 text-sky-400 font-extrabold text-xs">
                  <Globe className="w-4 h-4" />
                  <span>Camadas Vetoriais KML / KMZ (OGC Standard)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Exporta todos os waypoints com descrições, categorias, coordenadas e todas as trilhas gravadas como <code className="text-sky-300">LineString</code> 3D.
                </p>
                <div className="text-[11px] text-slate-400 font-medium">
                  • Totalmente compatível com <b>Google Earth Pro</b>, <b>Avenza Maps</b>, <b>QGIS</b>, <b>ArcGIS</b> e <b>Locus Map</b>.
                </div>
              </>
            )}

            {activeFormat === 'geojson' && (
              <>
                <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs">
                  <MapIcon className="w-4 h-4" />
                  <span>GeoJSON Padrão Aberto (RFC 7946)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Estrutura universal com FeatureCollection completa contendo propriedades ricas, contagem de fotos, carimbo de data/hora e coordenadas em WGS84.
                </p>
                <div className="text-[11px] text-slate-400 font-medium">
                  • Padrão da indústria para importação direta no <b>QGIS</b>, <b>ArcGIS Online</b>, bancos PostGIS e aplicações web.
                </div>
              </>
            )}

            {activeFormat === 'gpx' && (
              <>
                <div className="flex items-center gap-2 text-purple-400 font-extrabold text-xs">
                  <Navigation className="w-4 h-4" />
                  <span>GPX 1.1 (GPS Exchange Format)</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Contém waypoints (<code className="text-purple-300">&lt;wpt&gt;</code>) e trilhas cronometradas (<code className="text-purple-300">&lt;trk&gt;</code>) gravadas pelo GPS do dispositivo.
                </p>
                <div className="text-[11px] text-slate-400 font-medium">
                  • Compatível com receptores <b>Garmin</b>, <b>Strava</b>, <b>Gaia GPS</b>, <b>Wikiloc</b> e <b>OruxMaps</b>.
                </div>
              </>
            )}
          </div>

          {/* Attribution Footer */}
          <div className="text-[10px] text-slate-500 flex items-center justify-between border-t border-slate-800/80 pt-3">
            <span>GoField Pro • Exportação Universal SIG & PDF</span>
            <span>WGS84 / SIRGAS 2000</span>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          <div className="text-xs text-slate-400 w-full sm:w-auto text-center sm:text-left">
            {isGenerating ? (
              <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-400 font-bold">
                <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>{generatingLabel || 'Processando...'}</span>
              </div>
            ) : (
              <span>Pronto para download ou envio</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleShare(activeFormat)}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 shadow flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>Compartilhar</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload(activeFormat)}
              disabled={isGenerating}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
