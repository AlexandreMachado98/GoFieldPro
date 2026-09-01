import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import {
  Map as MapIcon,
  FileText,
  Gauge,
  Trees,
  Flame,
  Plus,
  Compass,
  CheckCircle2,
  Clock,
  ChevronRight,
  HardDrive,
  Crown,
  FileDown,
  Navigation,
} from 'lucide-react';
import { BottomSheet } from '../Common/BottomSheet';
import { formatFieldDistance } from '../../utils/geoUtils';

export const HomeDashboard: React.FC = () => {
  const {
    setActiveTab,
    fieldRounds,
    setIsWoodpileModalOpen,
    hasGpsLock,
    currentGps,
    openUpgradeModal,
    isProUser,
    activeProject,
  } = useApp();

  const { profile } = useAuth();
  const [isQuickActionSheetOpen, setIsQuickActionSheetOpen] = useState(false);

  const completedRounds = fieldRounds.filter((r) => r.status === 'finalizada');
  const activeRounds = fieldRounds.filter((r) => r.status === 'em_andamento');

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-[#070A10] text-slate-100 pb-28">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        
        {/* Welcome & GPS Status Hero Banner */}
        <div className="bg-[#0F172A] border border-slate-800 p-5 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-400">
                {activeProject?.name || 'GoField Pro Android'}
              </span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                hasGpsLock
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{hasGpsLock ? `GPS ±${(currentGps?.accuracy || 2).toFixed(0)}m` : 'Buscando GPS...'}</span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Olá, {profile?.name?.split(' ')[0] || 'Técnico de Campo'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pronto para mapear e registrar dados de campo offline.
          </p>

          {/* Core Action Button */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setActiveTab('map')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <MapIcon className="w-4 h-4 stroke-[2.5]" />
              <span>Abrir Mapa GPS</span>
            </button>

            <button
              onClick={() => setActiveTab('pdf_maps')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer border border-slate-700"
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Plantas PDF</span>
            </button>
          </div>
        </div>

        {/* Quick Tools Grid */}
        <div className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
            Ferramentas de Campo
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setIsWoodpileModalOpen(true)}
              className="bg-[#0F172A] border border-slate-800 hover:border-emerald-500/40 p-4 rounded-2xl flex flex-col items-start gap-2.5 text-left active:scale-95 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Trees className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs font-black text-white">Cubagem m³</span>
                <span className="text-[10px] text-slate-400">Pilha de madeira</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('field_rounds')}
              className="bg-[#0F172A] border border-slate-800 hover:border-sky-500/40 p-4 rounded-2xl flex flex-col items-start gap-2.5 text-left active:scale-95 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs font-black text-white">Rondas</span>
                <span className="text-[10px] text-slate-400">{fieldRounds.length} registros</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('fire_incidents')}
              className="bg-[#0F172A] border border-slate-800 hover:border-rose-500/40 p-4 rounded-2xl flex flex-col items-start gap-2.5 text-left active:scale-95 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs font-black text-white">Incêndios</span>
                <span className="text-[10px] text-slate-400">Focos de calor</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('offline')}
              className="bg-[#0F172A] border border-slate-800 hover:border-purple-500/40 p-4 rounded-2xl flex flex-col items-start gap-2.5 text-left active:scale-95 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-xs font-black text-white">Sincronização</span>
                <span className="text-[10px] text-slate-400">Modo offline</span>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Work Activity Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Atividades Recentes
            </h2>
            <button
              onClick={() => setActiveTab('field_rounds')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {fieldRounds.length === 0 ? (
            <div className="bg-[#0F172A] border border-slate-800/80 p-6 rounded-2xl text-center space-y-2">
              <Compass className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">Nenhum registro de ronda realizado hoje.</p>
              <button
                onClick={() => setActiveTab('field_rounds')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova Ronda</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {fieldRounds.slice(0, 3).map((round) => (
                <div
                  key={round.id}
                  onClick={() => setActiveTab('field_rounds')}
                  className="bg-[#0F172A] border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        round.status === 'finalizada'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {round.status === 'finalizada' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4 animate-spin" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-extrabold text-white truncate max-w-[180px] sm:max-w-[300px]">
                        {round.locationName}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {round.date} • {round.technicianName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-emerald-400 block">
                      {round.totalKm} KM
                    </span>
                    <span className="text-[9px] uppercase font-bold text-slate-500">
                      {round.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upgrade Banner for Free Tier (Compact & Non-intrusive) */}
        {!isProUser && (
          <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white">GoField Pro Anual</h4>
                <p className="text-[10px] text-slate-400">Desbloqueie plantas PDF e mapas ilimitados.</p>
              </div>
            </div>

            <button
              onClick={() => openUpgradeModal('Home Banner')}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shrink-0 cursor-pointer shadow"
            >
              Assinar Pro
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sheet for Quick Actions (if triggered) */}
      <BottomSheet
        isOpen={isQuickActionSheetOpen}
        onClose={() => setIsQuickActionSheetOpen(false)}
        title="Ações Rápidas de Campo"
        icon={<Compass className="w-5 h-5" />}
      >
        <div className="space-y-2">
          <button
            onClick={() => {
              setIsQuickActionSheetOpen(false);
              setActiveTab('map');
            }}
            className="w-full p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-left font-bold text-xs text-white hover:border-emerald-500/40 transition-colors flex items-center justify-between cursor-pointer"
          >
            <span>Iniciar Rastreamento GPS</span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
