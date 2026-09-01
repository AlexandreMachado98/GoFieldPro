import React, { useState, useEffect } from 'react';
import { 
  X, 
  Flame, 
  MapPin, 
  Compass, 
  Wind, 
  Thermometer, 
  Droplets, 
  ShieldAlert, 
  Camera, 
  Trash2, 
  Check, 
  Layers, 
  Users, 
  AlertTriangle,
  Upload
} from 'lucide-react';
import { FireIncident, FireIncidentType, FireIncidentStatus, FireSeverity } from '../../types';
import { useApp } from '../../context/AppContext';
import { latLngToUTM } from '../../utils/geoUtils';

interface FireIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIncident?: FireIncident | null;
}

const RESOURCE_OPTIONS = [
  'Brigada de Incêndio',
  'Caminhão Pipa',
  'Trator c/ Grade / Lâmina',
  'Bombas Costais',
  'Abafadores Manuais',
  'Aeronave / Helicóptero',
  'Corpo de Bombeiros',
  'Defesa Civil',
  'Equipe de Apoio Local'
];

export const FireIncidentModal: React.FC<FireIncidentModalProps> = ({
  isOpen,
  onClose,
  initialIncident,
}) => {
  const { currentGps, addFireIncident, updateFireIncident, notifySuccess, notifyWarning } = useApp();

  const [formData, setFormData] = useState({
    title: '',
    locationName: '',
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    type: 'foco_ativo' as FireIncidentType,
    status: 'em_combate' as FireIncidentStatus,
    severity: 'alta' as FireSeverity,
    lat: currentGps.lat || -20.2541,
    lng: currentGps.lng || -46.5823,
    altitude: currentGps.altitude || 780,
    estimatedAreaHectares: '',
    windSpeedKmh: '',
    windDirection: 'NE',
    temperatureC: '',
    relativeHumidity: '',
    resourcesMobilized: [] as string[],
    combatTeamNotes: '',
    probableCause: '',
    technicianName: '',
    photos: [] as string[],
    notes: '',
  });

  useEffect(() => {
    if (initialIncident) {
      setFormData({
        title: initialIncident.title || '',
        locationName: initialIncident.locationName || '',
        date: initialIncident.date || new Date().toISOString().slice(0, 10),
        time: initialIncident.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: initialIncident.type || 'foco_ativo',
        status: initialIncident.status || 'em_combate',
        severity: initialIncident.severity || 'alta',
        lat: initialIncident.lat || currentGps.lat,
        lng: initialIncident.lng || currentGps.lng,
        altitude: initialIncident.altitude || currentGps.altitude || 780,
        estimatedAreaHectares: initialIncident.estimatedAreaHectares ? String(initialIncident.estimatedAreaHectares) : '',
        windSpeedKmh: initialIncident.windSpeedKmh ? String(initialIncident.windSpeedKmh) : '',
        windDirection: initialIncident.windDirection || 'NE',
        temperatureC: initialIncident.temperatureC ? String(initialIncident.temperatureC) : '',
        relativeHumidity: initialIncident.relativeHumidity ? String(initialIncident.relativeHumidity) : '',
        resourcesMobilized: initialIncident.resourcesMobilized || [],
        combatTeamNotes: initialIncident.combatTeamNotes || '',
        probableCause: initialIncident.probableCause || '',
        technicianName: initialIncident.technicianName || '',
        photos: initialIncident.photos || [],
        notes: initialIncident.notes || '',
      });
    } else {
      setFormData({
        title: '',
        locationName: '',
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'foco_ativo',
        status: 'em_combate',
        severity: 'alta',
        lat: currentGps.lat,
        lng: currentGps.lng,
        altitude: currentGps.altitude || 780,
        estimatedAreaHectares: '',
        windSpeedKmh: '',
        windDirection: 'NE',
        temperatureC: '',
        relativeHumidity: '',
        resourcesMobilized: ['Brigada de Incêndio', 'Abafadores Manuais'],
        combatTeamNotes: '',
        probableCause: '',
        technicianName: '',
        photos: [],
        notes: '',
      });
    }
  }, [initialIncident, currentGps, isOpen]);

  if (!isOpen) return null;

  const handleCaptureGps = () => {
    setFormData((prev) => ({
      ...prev,
      lat: currentGps.lat,
      lng: currentGps.lng,
      altitude: currentGps.altitude || prev.altitude,
    }));
    notifySuccess('GPS Capturado', `Coordenadas fixadas: ${currentGps.lat.toFixed(5)}, ${currentGps.lng.toFixed(5)}`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        if (base64) {
          setFormData((prev) => ({
            ...prev,
            photos: [...prev.photos, base64],
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const toggleResource = (item: string) => {
    setFormData((prev) => {
      const exists = prev.resourcesMobilized.includes(item);
      return {
        ...prev,
        resourcesMobilized: exists
          ? prev.resourcesMobilized.filter((r) => r !== item)
          : [...prev.resourcesMobilized, item],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.locationName.trim()) {
      notifyWarning('Campo Obrigatório', 'Informe o local, talhão ou fazenda do foco.');
      return;
    }

    const utmCoords = latLngToUTM(formData.lat, formData.lng);

    const payload = {
      title: formData.title.trim() || `Foco em ${formData.locationName}`,
      locationName: formData.locationName.trim(),
      date: formData.date,
      time: formData.time,
      type: formData.type,
      status: formData.status,
      severity: formData.severity,
      lat: Number(formData.lat),
      lng: Number(formData.lng),
      altitude: Number(formData.altitude) || undefined,
      utm: utmCoords,
      estimatedAreaHectares: formData.estimatedAreaHectares ? Number(parseFloat(formData.estimatedAreaHectares.replace(',', '.')).toFixed(2)) : undefined,
      windSpeedKmh: formData.windSpeedKmh ? parseFloat(formData.windSpeedKmh.replace(',', '.')) : undefined,
      windDirection: formData.windDirection,
      temperatureC: formData.temperatureC ? parseFloat(formData.temperatureC.replace(',', '.')) : undefined,
      relativeHumidity: formData.relativeHumidity ? parseFloat(formData.relativeHumidity.replace(',', '.')) : undefined,
      resourcesMobilized: formData.resourcesMobilized,
      combatTeamNotes: formData.combatTeamNotes.trim(),
      probableCause: formData.probableCause.trim(),
      technicianName: formData.technicianName.trim() || 'Brigadista / Técnico',
      photos: formData.photos,
      notes: formData.notes.trim(),
    };

    if (initialIncident) {
      updateFireIncident(initialIncident.id, payload);
      notifySuccess('Ocorrência Atualizada', 'As informações do foco de incêndio foram atualizadas.');
    } else {
      addFireIncident(payload);
      notifySuccess('Foco Registrado', 'Ocorrência de incêndio / sinistro registrada com sucesso.');
    }

    onClose();
  };

  const utm = latLngToUTM(formData.lat, formData.lng);

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/90 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[min(90dvh,calc(100vh-32px))] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-rose-950/80 to-amber-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {initialIncident ? 'Editar Foco de Incêndio' : 'Registrar Foco de Incêndio / Sinistro'}
              </h3>
              <p className="text-xs text-rose-300">Monitoramento Florestal & Gestão de Combate</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Local / Fazenda / Talhão *</label>
              <input
                type="text"
                required
                placeholder="Ex: Fazenda Boa Vista - Talhão 08"
                value={formData.locationName}
                onChange={(e) => setFormData((p) => ({ ...p, locationName: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Título / Identificador</label>
              <input
                type="text"
                placeholder="Ex: Foco Margem Rodovia / Talhão Eucalipto"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-xs font-medium"
              />
            </div>
          </div>

          {/* Status, Type & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Tipo de Ocorrência</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value as FireIncidentType }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-rose-500 text-xs"
              >
                <option value="foco_ativo">🔥 Foco Ativo (Em Chamas)</option>
                <option value="area_queimada">⬛ Área Queimada / Cicatriz</option>
                <option value="queima_controlada">🟡 Queima Controlada / Aceiro</option>
                <option value="sinistro_florestal">⚠️ Sinistro / Dano Florestal</option>
                <option value="principio_incendio">💨 Princípio de Incêndio</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Status Atual</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as FireIncidentStatus }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-rose-500 text-xs"
              >
                <option value="em_combate">🚨 Em Combate Ativo</option>
                <option value="controlado">🛡️ Controlado (Aceirado)</option>
                <option value="extinto">✅ Extinto / Rescaldo Finalizado</option>
                <option value="monitoramento">👀 Em Monitoramento</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Severidade / Risco</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData((p) => ({ ...p, severity: e.target.value as FireSeverity }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-rose-500 text-xs"
              >
                <option value="critica">🔴 Crítica (Avanço Rápido)</option>
                <option value="alta">🟠 Alta (Risco a Estruturas)</option>
                <option value="media">🟡 Média (Moderado)</option>
                <option value="baixa">🟢 Baixa (Controlável)</option>
              </select>
            </div>
          </div>

          {/* GPS Coordinates & Area */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sky-400 font-bold">
                <MapPin className="w-4 h-4" />
                <span>Localização Geográfica & UTM</span>
              </div>
              <button
                type="button"
                onClick={handleCaptureGps}
                className="px-3 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/50 text-sky-300 font-bold text-[11px] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                Capturar GPS Atual
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Latitude:</span>
                <input
                  type="number"
                  step="any"
                  value={formData.lat}
                  onChange={(e) => setFormData((p) => ({ ...p, lat: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs mt-1"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-medium">Longitude:</span>
                <input
                  type="number"
                  step="any"
                  value={formData.lng}
                  onChange={(e) => setFormData((p) => ({ ...p, lng: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs mt-1"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-medium">Área Estimada (Hectares):</span>
                <input
                  type="text"
                  placeholder="Ex: 12.5"
                  value={formData.estimatedAreaHectares}
                  onChange={(e) => setFormData((p) => ({ ...p, estimatedAreaHectares: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-amber-400 font-mono font-bold text-xs mt-1"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-900">
              <span>UTM: {utm.easting} E, {utm.northing} N (Zona {utm.zone})</span>
              <span>Altitude: {formData.altitude} m</span>
            </div>
          </div>

          {/* Meteorological Conditions */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Wind className="w-4 h-4" />
              <span>Condições Climáticas no Momento</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Vento (km/h):</span>
                <input
                  type="text"
                  placeholder="Ex: 25"
                  value={formData.windSpeedKmh}
                  onChange={(e) => setFormData((p) => ({ ...p, windSpeedKmh: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs mt-1"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-medium">Direção do Vento:</span>
                <select
                  value={formData.windDirection}
                  onChange={(e) => setFormData((p) => ({ ...p, windDirection: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs mt-1"
                >
                  <option value="N">N (Norte)</option>
                  <option value="NE">NE (Nordeste)</option>
                  <option value="E">E (Leste)</option>
                  <option value="SE">SE (Sudeste)</option>
                  <option value="S">S (Sul)</option>
                  <option value="SW">SW (Sudoeste)</option>
                  <option value="W">W (Oeste)</option>
                  <option value="NW">NW (Noroeste)</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-medium">Temperatura (°C):</span>
                <input
                  type="text"
                  placeholder="Ex: 34"
                  value={formData.temperatureC}
                  onChange={(e) => setFormData((p) => ({ ...p, temperatureC: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs mt-1"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-medium">Umidade Relativa (%):</span>
                <input
                  type="text"
                  placeholder="Ex: 18"
                  value={formData.relativeHumidity}
                  onChange={(e) => setFormData((p) => ({ ...p, relativeHumidity: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Resources Mobilized */}
          <div>
            <label className="block text-slate-300 font-bold mb-2">Recursos e Brigada Mobilizados</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RESOURCE_OPTIONS.map((item) => {
                const checked = formData.resourcesMobilized.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleResource(item)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      checked
                        ? 'border-emerald-500/80 bg-emerald-950/40 text-emerald-300 font-bold'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <span className="text-[11px] truncate">{item}</span>
                    {checked && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technical Notes & Probable Cause */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Causa Provável / Origem</label>
              <input
                type="text"
                placeholder="Ex: Raio, queima de lixo, bituca na margem da estrada"
                value={formData.probableCause}
                onChange={(e) => setFormData((p) => ({ ...p, probableCause: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Técnico / Responsável do Registro</label>
              <input
                type="text"
                placeholder="Nome do Técnico ou Brigadista Chefe"
                value={formData.technicianName}
                onChange={(e) => setFormData((p) => ({ ...p, technicianName: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">Parecer Técnico / Ações de Combate</label>
            <textarea
              rows={2}
              placeholder="Descreva a dinâmica do fogo, aceiros construídos, rescaldo realizado e áreas ameaçadas..."
              value={formData.combatTeamNotes}
              onChange={(e) => setFormData((p) => ({ ...p, combatTeamNotes: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs resize-none"
            />
          </div>

          {/* Photo Evidence Gallery */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-300 font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Evidências Fotográficas ({formData.photos.length})</span>
              </label>
              <label className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95">
                <Upload className="w-3.5 h-3.5" />
                Anexar Fotos
                <input
                  type="file" onClick={(e) => e.stopPropagation()}
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>

            {formData.photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {formData.photos.map((p, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 aspect-video bg-slate-950">
                    <img src={p} alt="Foco" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))}
                      className="absolute top-1 right-1 p-1 bg-rose-600/90 text-white rounded-lg opacity-80 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons (Fixo) */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2.5 bg-slate-950/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 font-bold transition-all text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold shadow-lg shadow-rose-950/50 flex items-center gap-2 transition-all active:scale-95 cursor-pointer text-xs"
            >
              <Check className="w-4 h-4" />
              {initialIncident ? 'Salvar Alterações' : 'Registrar Ocorrência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
