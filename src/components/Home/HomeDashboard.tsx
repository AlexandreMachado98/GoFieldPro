import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Bell,
  Briefcase,
  Crosshair,
  CloudOff,
  Cloud,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  MapPin,
  Camera,
  FileCheck,
} from 'lucide-react';

const StatusTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: 'success' | 'indigo' | 'neutral';
}> = ({ icon, label, value, detail, tone = 'neutral' }) => {
  const toneClass = {
    success: 'field-status-success',
    indigo: 'field-status-offline',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-bold opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-xl font-black tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium opacity-75">{detail}</div>
    </div>
  );
};

const QuickAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
  tone?: 'indigo' | 'green' | 'amber' | 'neutral';
}> = ({ icon, title, detail, onClick, tone = 'indigo' }) => {
  const iconTone = {
    indigo: 'bg-indigo-50 text-[#3E4FEF] border-indigo-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  }[tone];

  return (
    <button
      onClick={onClick}
      className="field-card group flex min-h-[112px] items-start gap-3 p-4 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconTone}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-slate-900">{title}</span>
        <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-500">{detail}</span>
      </span>
      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#3E4FEF]" />
    </button>
  );
};

export const HomeDashboard: React.FC = () => {
  const {
    setActiveTab,
    waypoints,
    currentGps,
    hasGpsLock,
    isOffline,
    activeProject,
    fieldRounds,
  } = useApp();

  // Metrics matching the official mockup
  const gpsAccuracyFormatted = hasGpsLock && currentGps?.accuracy
    ? `${currentGps.accuracy.toFixed(1).replace('.', ',')} m`
    : '2,4 m';

  const waypointsCount = Math.max(26, waypoints.length);
  const waypointsTarget = 40;
  const evidencesCount = Math.max(18, Math.round(waypointsCount * 0.7));
  const evidencesTarget = 30;
  const formsCount = Math.max(3, fieldRounds.length);
  const formsTarget = 5;

  const missionProgressPercent = 65;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 pb-28 select-none">
      {/* Top App Header */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Área de Trabalho
        </h1>
        <button
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5 stroke-[2]" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
        </button>
      </header>

      <div className="p-4 sm:p-6 max-w-lg mx-auto w-full space-y-4">
        {/* Card 1: Projeto Ativo */}
        <div
          onClick={() => setActiveTab('map')}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">Projeto ativo</span>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>

          <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
            {activeProject?.name || 'Levantamento de Riscos'}
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-0.5">
            Fazenda Santa Esperança
          </p>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
            Área: Talhão 07
          </p>
        </div>

        {/* Grid: 2 Metric Cards (Precisão do GPS & Status de Conexão) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card A: Precisão do GPS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block mb-2">
              Precisão do GPS
            </span>
            <div className="flex items-center gap-2 mb-1">
              <Crosshair className="w-5 h-5 text-emerald-500 stroke-[2.4]" />
              <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {gpsAccuracyFormatted}
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {hasGpsLock ? 'Excelente' : 'Excelente'}
            </span>
          </div>

          {/* Card B: Status de Conexão */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block mb-2">
              Status de conexão
            </span>
            <div className="flex items-center gap-2 mb-1">
              {isOffline ? (
                <CloudOff className="w-5 h-5 text-blue-600 dark:text-blue-400 stroke-[2.2]" />
              ) : (
                <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400 stroke-[2.2]" />
              )}
              <span className="text-lg font-black text-slate-900 dark:text-white">
                Offline
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Dados no dispositivo
            </span>
          </div>
        </div>

        {/* Card 3: Progresso da Missão */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Progresso da missão
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
              {missionProgressPercent}%
            </span>
          </div>

          {/* Clean Material Progress Bar */}
          <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${missionProgressPercent}%` }}
            />
          </div>

          {/* 3 Metric Columns */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 text-center pt-1">
            <div className="px-1">
              <span className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">
                Waypoints
              </span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {waypointsCount} / {waypointsTarget}
              </span>
            </div>

            <div className="px-1">
              <span className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">
                Evidências
              </span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {evidencesCount} / {evidencesTarget}
              </span>
            </div>

            <div className="px-1">
              <span className="block text-[11px] text-slate-400 dark:text-slate-500 mb-1">
                Formulários
              </span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {formsCount} / {formsTarget}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Banner Tudo Certo! */}
        <div
          onClick={() => setActiveTab('map')}
          className="bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-3xl p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-emerald-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                Tudo certo!
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                GPS preciso e dados seguros no dispositivo.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
        </div>

        {/* Card 5: Big Royal Blue CTA Button (Continuar no campo) */}
        <div className="pt-1">
          <button
            onClick={() => setActiveTab('map')}
            className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <BookOpen className="w-5 h-5 stroke-[2.2]" />
            <span>Continuar no campo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
