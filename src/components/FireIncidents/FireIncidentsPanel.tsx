import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Plus, 
  FileText, 
  Globe, 
  MapPin, 
  Wind, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  Camera, 
  Layers, 
  Search, 
  Compass, 
  ShieldAlert, 
  Calendar, 
  Clock, 
  ChevronRight,
  ExternalLink,
  Droplets,
  Share2
} from 'lucide-react';
import { FireIncident, FireIncidentStatus } from '../../types';
import { useApp } from '../../context/AppContext';
import { FireIncidentModal } from './FireIncidentModal';
import { generateFireIncidentPdf } from '../../utils/fireIncidentPdfReport';
import { generateFireKML, generateFireKMZ } from '../../utils/fireKmlExport';
import { downloadFile, shareExportedFile } from '../../utils/pdfMapExport';

export const FireIncidentsPanel: React.FC = () => {
  const { 
    fireIncidents, 
    deleteFireIncident, 
    updateFireIncident, 
    setActiveTab, 
    setMapCenter, 
    setMapZoom, 
    notifySuccess, 
    notifyInfo, 
    notifyError,
    showConfirm
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<FireIncident | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Statistics
  const totalCount = fireIncidents.length;
  const activeCount = fireIncidents.filter((i) => i.status === 'em_combate').length;
  const controlledCount = fireIncidents.filter((i) => i.status === 'controlado').length;
  const extinguishedCount = fireIncidents.filter((i) => i.status === 'extinto').length;
  const totalHectares = fireIncidents.reduce((sum, i) => sum + (i.estimatedAreaHectares || 0), 0);

  // Filtered List
  const filteredIncidents = useMemo(() => {
    return fireIncidents.filter((inc) => {
      const matchStatus = filterStatus === 'todos' || inc.status === filterStatus;
      const matchQuery = 
        !searchQuery ||
        inc.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.technicianName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchQuery;
    });
  }, [fireIncidents, filterStatus, searchQuery]);

  const handleOpenNewModal = () => {
    setEditingIncident(null);
    setIsModalOpen(true);
  };

  const handleEdit = (incident: FireIncident) => {
    setEditingIncident(incident);
    setIsModalOpen(true);
  };

  const handleDelete = (incident: FireIncident) => {
    showConfirm({
      title: 'Excluir Registro de Incêndio',
      message: `Deseja realmente remover o registro de foco em "${incident.locationName}"?`,
      confirmLabel: 'Excluir Registro',
      cancelLabel: 'Cancelar',
      onConfirm: () => {
        deleteFireIncident(incident.id);
      },
    });
  };

  const handleViewOnMap = (incident: FireIncident) => {
    setMapCenter({ lat: incident.lat, lng: incident.lng });
    setMapZoom(16);
    setActiveTab('map');
    notifyInfo('Navegando ao Foco', `Centralizado em ${incident.locationName}`);
  };

  const handleExportPdf = async () => {
    if (fireIncidents.length === 0) {
      notifyInfo('Sem Registros', 'Não há ocorrências registradas para gerar o relatório.');
      return;
    }
    try {
      setIsExporting(true);
      await generateFireIncidentPdf(filteredIncidents.length > 0 ? filteredIncidents : fireIncidents);
      notifySuccess('Relatório Gerado', 'O PDF com os sinistros e focos de incêndio foi baixado.');
    } catch (err: any) {
      notifyError('Erro ao Gerar PDF', err.message || 'Falha na emissão do relatório.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportKml = () => {
    if (fireIncidents.length === 0) return;
    const kml = generateFireKML(filteredIncidents.length > 0 ? filteredIncidents : fireIncidents);
    downloadFile(kml, `GoField_Focos_Incendio_${new Date().toISOString().slice(0, 10)}.kml`, 'application/vnd.google-earth.kml+xml');
    notifySuccess('KML Exportado', 'Arquivo KML pronto para Google Earth e QGIS.');
  };

  const handleExportKmz = async () => {
    if (fireIncidents.length === 0) return;
    try {
      setIsExporting(true);
      const kmzBlob = await generateFireKMZ(filteredIncidents.length > 0 ? filteredIncidents : fireIncidents);
      downloadFile(kmzBlob, `GoField_Focos_Incendio_Fotos_${new Date().toISOString().slice(0, 10)}.kmz`, 'application/vnd.google-earth.kmz');
      notifySuccess('KMZ Exportado', 'Pacote KMZ com fotos baixado com sucesso.');
    } catch (err: any) {
      notifyError('Erro na Exportação', err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusBadge = (status: FireIncidentStatus) => {
    switch (status) {
      case 'em_combate':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Em Combate
          </span>
        );
      case 'controlado':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Controlado
          </span>
        );
      case 'extinto':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Extinto
          </span>
        );
      case 'monitoramento':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Monitoramento
          </span>
        );
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critica':
        return <span className="text-[10px] font-extrabold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900">Crítica</span>;
      case 'alta':
        return <span className="text-[10px] font-extrabold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-900">Alta</span>;
      case 'media':
        return <span className="text-[10px] font-extrabold text-yellow-400 bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-900">Média</span>;
      default:
        return <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">Baixa</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-6 overflow-y-auto bg-slate-950 pb-32 sm:pb-16 text-slate-100 select-none">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <Flame className="w-3 h-3 text-rose-400" />
                Brigada & Monitoramento Florestal
              </span>
              {activeCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-rose-300 font-black bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-800 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {activeCount} FOCOS EM COMBATE
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Focos de <span className="text-rose-500">Incêndio</span> & Sinistros
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Mapeamento de queimadas, cicatrizes de fogo, cálculo de área afetada e emissão de laudos para seguradoras e bombeiros.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenNewModal}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs shadow-lg shadow-rose-950/50 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Foco</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExporting || totalCount === 0}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Relatório PDF</span>
            </button>

            <button
              onClick={handleExportKml}
              disabled={totalCount === 0}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Globe className="w-4 h-4 text-sky-400" />
              <span>KML</span>
            </button>
          </div>
        </div>

        {/* KPI Telemetry Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">{activeCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">Focos Ativos</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">
                {totalHectares > 0 ? totalHectares.toLocaleString('pt-BR') : '0'} <span className="text-xs font-semibold text-amber-400">ha</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Área Afetada</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">{extinguishedCount + controlledCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">Extintos / Controlados</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-extrabold text-white">{totalCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">Total Registros</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-2 rounded-2xl border border-slate-800/80">
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'em_combate', label: 'Em Combate' },
              { id: 'controlado', label: 'Controlados' },
              { id: 'extinto', label: 'Extintos' },
              { id: 'monitoramento', label: 'Monitoramento' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all shrink-0 ${
                  filterStatus === f.id
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar talhão ou local..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Incidents Cards Grid */}
        {filteredIncidents.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500 mx-auto">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Nenhum Foco Encontrado</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Nenhuma ocorrência de incêndio ou sinistro cadastrada com os filtros atuais.
            </p>
            <button
              onClick={handleOpenNewModal}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition-all"
            >
              Registrar Primeira Ocorrência
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all shadow-lg group"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getStatusBadge(inc.status)}
                        {getSeverityBadge(inc.severity)}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {inc.date} às {inc.time}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-white group-hover:text-rose-400 transition-colors">
                        {inc.locationName}
                      </h3>
                      {inc.title && inc.title !== inc.locationName && (
                        <p className="text-xs text-slate-400">{inc.title}</p>
                      )}
                    </div>
                  </div>

                  {/* Geolocation & Area Badges */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Área Queimada</div>
                      <div className="text-sm font-black text-amber-400 font-mono mt-0.5">
                        {inc.estimatedAreaHectares ? `${inc.estimatedAreaHectares} ha` : '--'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Coordenadas</div>
                      <div className="text-[11px] font-mono text-sky-400 truncate mt-0.5">
                        {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Vento / Clima</div>
                      <div className="text-[11px] font-mono text-slate-300 truncate mt-0.5">
                        {inc.windSpeedKmh ? `${inc.windSpeedKmh} km/h (${inc.windDirection})` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Resources Mobilized */}
                  {inc.resourcesMobilized && inc.resourcesMobilized.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {inc.resourcesMobilized.map((res, i) => (
                        <span key={i} className="text-[10px] bg-slate-950 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-800">
                          {res}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Notes snippet */}
                  {(inc.combatTeamNotes || inc.notes) && (
                    <p className="text-[11px] text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 line-clamp-2">
                      {inc.combatTeamNotes || inc.notes}
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleViewOnMap(inc)}
                      className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 font-bold text-xs flex items-center gap-1 transition-colors"
                      title="Abrir no Mapa GPS"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Ver no Mapa</span>
                    </button>

                    {inc.photos && inc.photos.length > 0 && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800">
                        <Camera className="w-3 h-3 text-amber-400" />
                        {inc.photos.length} fotos
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(inc)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Editar Registro"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(inc)}
                      className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 transition-colors"
                      title="Excluir Registro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Modal */}
      {isModalOpen && (
        <FireIncidentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialIncident={editingIncident}
        />
      )}
    </div>
  );
};
