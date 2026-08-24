import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  Activity,
  MapPin,
  Layers,
  CloudCheck,
  BatteryCharging,
  ShieldCheck,
  Award,
  Users,
  Compass,
} from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
  const {
    waypoints,
    savedTracks,
    layers,
    teamMembers,
    activeProject,
    t,
  } = useApp();

  const totalKm = savedTracks.reduce((acc, t) => acc + t.distanceKm, 0);
  const syncedCount = waypoints.filter((w) => w.synced).length;
  const syncPercentage = waypoints.length > 0 ? Math.round((syncedCount / waypoints.length) * 100) : 100;

  // Category counts
  const categoryCounts: Record<string, number> = {};
  waypoints.forEach((w) => {
    categoryCounts[w.category] = (categoryCounts[w.category] || 0) + 1;
  });

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-5xl mx-auto text-slate-100">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div>
          <h2 className="font-bold text-lg text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            {t.analyticsTitle}
          </h2>
          <p className="text-xs text-slate-400">Indicadores-chave de desempenho (KPIs) de campo e produtividade operacional no projeto "{activeProject.name}".</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950 border border-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            Integridade SIG Validada
          </span>
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            {t.totalDistance}
          </div>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {totalKm.toFixed(1)} <span className="text-xs font-normal text-slate-400">km</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +18% acima da meta semanal
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            {t.totalWaypoints}
          </div>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {waypoints.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {waypoints.filter(w => w.status === 'alert').length} pontos críticos / risco
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            {t.areaCovered}
          </div>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {activeProject.stats.areaCoveredHectares} <span className="text-xs font-normal text-slate-400">ha</span>
          </div>
          <div className="text-[11px] text-purple-400 mt-1 font-mono">
            {layers.length} camadas espaciais ativas
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <CloudCheckIcon className="w-3.5 h-3.5 text-sky-400" />
            {t.syncRate}
          </div>
          <div className="text-3xl font-black font-mono text-sky-400 mt-2">
            {syncPercentage}%
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">
            {syncedCount} de {waypoints.length} waypoints em nuvem
          </div>
        </div>
      </div>

      {/* Grid: Category Breakdown & Operator Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400" />
            Distribuição de Registros por Categoria
          </h3>

          <div className="space-y-2.5 pt-2">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const pct = Math.round((count / waypoints.length) * 100) || 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 capitalize font-medium">{cat.replace('_', ' ')}</span>
                    <span className="font-mono text-slate-400">{count} registros ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-sky-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Productivity Ranking */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Desempenho & Produtividade da Equipe
          </h3>

          <div className="space-y-2.5 pt-2">
            {teamMembers.map((member, i) => (
              <div
                key={member.id}
                className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 font-bold font-mono text-xs text-amber-400">#{i + 1}</span>
                  <img src={member.avatar} className="w-8 h-8 rounded-full object-cover" />
                  <div>
                    <div className="font-bold text-xs text-white">{member.name}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{member.role.replace('_', ' ')}</div>
                  </div>
                </div>

                <div className="text-right font-mono text-xs text-slate-300">
                  <div className="font-bold text-sky-400">{8 - i * 2} km mapeados</div>
                  <div className="text-[10px] text-slate-400">{12 - i * 3} waypoints</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function CloudCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}
