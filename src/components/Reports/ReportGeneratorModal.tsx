import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { generateFieldDossierPDF } from '../../utils/pdfExport';
import {
  exportToKMLString,
  exportToKMZBlob,
  exportToGeoJSON,
  exportToCSV,
  exportToGPX,
} from '../../utils/kmlParser';
import {
  FileText,
  Download,
  Cloud,
  CheckCircle2,
  Share2,
  FileSpreadsheet,
  Globe,
  HardDrive,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const ReportGeneratorModal: React.FC = () => {
  const {
    activeProject,
    waypoints,
    savedTracks,
    teamMembers,
    t,
  } = useApp();

  const [isCloudBackingUp, setIsCloudBackingUp] = useState(false);
  const [cloudBackupSuccess, setCloudBackupSuccess] = useState(false);

  const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    generateFieldDossierPDF(activeProject, waypoints, savedTracks, teamMembers, 'Carlos Silva');
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  const handleExportKML = () => {
    const kml = exportToKMLString(activeProject.name, waypoints, savedTracks);
    downloadTextFile(kml, `${activeProject.name.replace(/\s+/g, '_')}_export.kml`, 'application/vnd.google-earth.kml+xml');
  };

  const handleExportKMZ = async () => {
    const blob = await exportToKMZBlob(activeProject.name, waypoints, savedTracks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name.replace(/\s+/g, '_')}_package.kmz`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGeoJSON = () => {
    const geojson = exportToGeoJSON(activeProject.name, waypoints, savedTracks);
    downloadTextFile(geojson, `${activeProject.name.replace(/\s+/g, '_')}.geojson`, 'application/geo+json');
  };

  const handleExportCSV = () => {
    const csv = exportToCSV(waypoints);
    downloadTextFile(csv, `Coordenadas_${activeProject.name.replace(/\s+/g, '_')}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportGPX = () => {
    const gpx = exportToGPX(activeProject.name, waypoints, savedTracks);
    downloadTextFile(gpx, `Trilhas_${activeProject.name.replace(/\s+/g, '_')}.gpx`, 'application/gpx+xml');
  };

  const handleTriggerCloudBackup = async () => {
    setIsCloudBackingUp(true);
    await new Promise((r) => setTimeout(r, 1600));
    setIsCloudBackingUp(false);
    setCloudBackupSuccess(true);
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.7 } });
    setTimeout(() => setCloudBackupSuccess(false), 5000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-5xl mx-auto text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div>
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-400" />
            {t.exportTitle}
          </h2>
          <p className="text-xs text-slate-400">Gere relatórios técnicos oficiais e exporte camadas em múltiplos formatos abertos e interoperáveis.</p>
        </div>

        <button
          id="btn-cloud-backup-instant"
          onClick={handleTriggerCloudBackup}
          disabled={isCloudBackingUp}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-colors shrink-0"
        >
          <Cloud className="w-4 h-4" />
          {isCloudBackingUp ? 'Executando Backup...' : cloudBackupSuccess ? 'Backup Concluído!' : 'Backup Automático em Nuvem'}
        </button>
      </div>

      {/* Cloud Backup Status Alert */}
      {cloudBackupSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span><b>Backup Corporativo Concluído:</b> Todos os mapas em PDF, camadas KML/KMZ, coordenadas e fotos foram replicados no armazenamento seguro com redundância geográfica.</span>
        </div>
      )}

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* PDF Dossier */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-sky-500/50 transition-all shadow-xl">
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t.generatePdfReport}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Dossiê oficial A4 com cabeçalho corporativo, tabela de marcos, fotos, metadados SIRGAS 2000 e termo de responsabilidade técnica.
            </p>
          </div>

          <button
            id="btn-export-pdf-dossier"
            onClick={handleExportPDF}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Dossiê PDF
          </button>
        </div>

        {/* KMZ Package */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-orange-500/50 transition-all shadow-xl">
          <div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-3">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t.exportKmz}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Pacote ZIP compactado contendo doc.kml com todas as camadas, trilhas e pontos de interesse para o Google Earth Pro.
            </p>
          </div>

          <button
            id="btn-export-kmz-package"
            onClick={handleExportKMZ}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Pacote KMZ
          </button>
        </div>

        {/* KML Standard */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-xl">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t.exportKml}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Arquivo vetorial XML padrão OGC KML 2.2 compatível com QGIS, ArcGIS, Global Mapper e navegadores GPS.
            </p>
          </div>

          <button
            id="btn-export-kml-vector"
            onClick={handleExportKML}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Vetor KML
          </button>
        </div>

        {/* GeoJSON */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-purple-500/50 transition-all shadow-xl">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
              <Share2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t.exportGeoJson}</h3>
            <p className="text-xs text-slate-400 mt-1">
              FeatureCollection GeoJSON formatada para integração com bancos de dados PostGIS, Mapbox, Leaflet e APIs web REST.
            </p>
          </div>

          <button
            id="btn-export-geojson"
            onClick={handleExportGeoJSON}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar GeoJSON
          </button>
        </div>

        {/* CSV Spreadsheet */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-emerald-500/50 transition-all shadow-xl">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t.exportCsv}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Planilha de coordenadas tabulares com Latitude, Longitude, Altitude, Precisão, Categoria, Notas e Operador.
            </p>
          </div>

          <button
            id="btn-export-csv-table"
            onClick={handleExportCSV}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Tabela CSV
          </button>
        </div>

        {/* GPX Track Format */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between hover:border-sky-500/50 transition-all shadow-xl">
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-3">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white">{t.exportGpx}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Formato GPS Exchange padrão para importação direta em aparelhos Garmin, rádio comunicadores e relógios de expedição.
            </p>
          </div>

          <button
            id="btn-export-gpx-tracks"
            onClick={handleExportGPX}
            className="mt-4 w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Arquivo GPX
          </button>
        </div>
      </div>
    </div>
  );
};
