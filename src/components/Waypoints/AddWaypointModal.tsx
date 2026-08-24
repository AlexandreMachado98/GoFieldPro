import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Waypoint } from '../../types';
import { latLngToUTM } from '../../utils/geoUtils';
import {
  X,
  MapPin,
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Compass,
  FileText,
  Upload,
} from 'lucide-react';

export const AddWaypointModal: React.FC = () => {
  const {
    isAddWaypointModalOpen,
    setIsAddWaypointModalOpen,
    currentGps,
    activeProject,
    addWaypoint,
    t,
    e2eeEnabled,
  } = useApp();

  const [name, setName] = useState('');
  const [code, setCode] = useState(`CAN-${Math.floor(10 + Math.random() * 90)}`);
  const [category, setCategory] = useState<Waypoint['category']>('inspection');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState(currentGps.lat);
  const [lng, setLng] = useState(currentGps.lng);
  const [altitude, setAltitude] = useState(currentGps.altitude || 1280);
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
  ]);

  if (!isAddWaypointModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    addWaypoint({
      projectId: activeProject.id,
      name,
      code,
      category,
      lat: Number(lat),
      lng: Number(lng),
      altitude: Number(altitude),
      accuracy: currentGps.accuracy || 1.5,
      createdBy: 'Carlos Silva (Operador)',
      notes,
      status: category === 'hazard' || category === 'obstacle' ? 'alert' : 'verified',
      photos,
      attributes: {
        'Condição Climática': 'Ensolarado / Seco',
        'Sinal de Rede': 'Satelital / LoRa',
      },
    });

    setIsAddWaypointModalOpen(false);
  };

  const utm = latLngToUTM(Number(lat), Number(lng));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="font-bold text-base text-white">{t.newWaypoint}</h2>
              <p className="text-xs text-slate-400">Projeto: {activeProject.name}</p>
            </div>
          </div>
          <button
            id="btn-close-waypoint-modal"
            onClick={() => setIsAddWaypointModalOpen(false)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-sm text-slate-200">
          {/* Code and Name */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">{t.waypointCode} *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-sky-500 text-xs"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">{t.waypointName} *</label>
              <input
                type="text"
                required
                placeholder="Ex: Vértice de Cerca / Ponto de Erosão"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 text-xs"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">{t.category}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Waypoint['category'])}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500 text-xs"
            >
              <option value="inspection">{t.categories.inspection}</option>
              <option value="hazard">{t.categories.hazard}</option>
              <option value="geodesic">{t.categories.geodesic}</option>
              <option value="fauna_flora">{t.categories.fauna_flora}</option>
              <option value="soil_sample">{t.categories.soil_sample}</option>
              <option value="infrastructure">{t.categories.infrastructure}</option>
              <option value="obstacle">{t.categories.obstacle}</option>
            </select>
          </div>

          {/* GPS Coordinates Telemetry Box */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-sky-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                Coordenadas GNSS Fixadas
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Precisão: ±{currentGps.accuracy}m</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 font-mono">LATITUDE</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-mono">LONGITUDE</label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-mono">ALTITUDE (m)</label>
                <input
                  type="number"
                  step="any"
                  value={altitude}
                  onChange={(e) => setAltitude(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono">
              UTM: {utm.zone} | E: {utm.easting} | N: {utm.northing} | DATUM: SIRGAS 2000
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">{t.notes}</label>
            <textarea
              rows={3}
              placeholder="Descreva detalhes observados em campo, anomalias, espécimes ou necessidade de manutenção..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Attached Geotagged Photos */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">{t.addPhoto}</label>
            <div className="flex gap-2 items-center overflow-x-auto pb-1">
              {photos.map((photo, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                  <img src={photo} alt="Foto de campo" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  setPhotos([
                    ...photos,
                    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=600&auto=format&fit=crop&q=80',
                  ]);
                }}
                className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-700 hover:border-sky-500 flex flex-col items-center justify-center text-slate-400 hover:text-sky-400 bg-slate-800/40 text-[10px] shrink-0"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span>Foto</span>
              </button>
            </div>
          </div>

          {/* E2EE Guarantee Banner */}
          {e2eeEnabled && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Assinatura Digital e Criptografia Ponta a Ponta (AES-256) ativas para este registro.</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddWaypointModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t.saveWaypoint}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
