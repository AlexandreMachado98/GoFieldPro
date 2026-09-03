import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Settings,
  CloudOff,
  RefreshCw,
  FileText,
  CloudUpload,
  MapPin,
  Camera,
  ClipboardList,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export const OfflineSyncDrawer: React.FC = () => {
  const {
    setActiveTab,
    isSyncing,
    triggerManualSync,
    offlineQueue,
    waypoints,
    setIsSettingsModalOpen,
  } = useApp();

  const savedCount = 24;
  const pendingCount = 17;

  const pendingItems = [
    {
      id: 'pend-1',
      title: 'Waypoint 12',
      date: '23/05/2025 09:21',
      type: 'waypoint',
    },
    {
      id: 'pend-2',
      title: 'Foto',
      subtitle: 'Sinalização de segurança',
      date: '23/05/2025 09:05',
      type: 'photo',
    },
    {
      id: 'pend-3',
      title: 'Formulário',
      subtitle: 'Checklist de EPI',
      date: '23/05/2025 08:47',
      type: 'form',
    },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 pb-28 select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('home')}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sincronização
          </h1>
        </div>

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Configurações"
        >
          <Settings className="w-5 h-5 stroke-[2]" />
        </button>
      </header>

      <div className="p-4 sm:p-6 max-w-lg mx-auto w-full space-y-4">
        {/* Card 1: Status da sincronização */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block">
            Status da sincronização
          </span>

          <div className="flex flex-col items-center text-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <CloudOff className="w-8 h-8 stroke-[2]" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Offline
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Dados salvos no dispositivo
            </p>

            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 font-mono">
              Última tentativa: 23/05/2025 09:30
            </span>
          </div>

          <button
            onClick={() => triggerManualSync()}
            disabled={isSyncing}
            className="w-full py-3 rounded-2xl border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Tentar agora'}</span>
          </button>
        </div>

        {/* Grid: 2 Metric Cards (Salvos no dispositivo & Pendentes de envio) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card A: Salvos no dispositivo */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                {savedCount}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold leading-tight block">
                Itens salvos
              </span>
            </div>
          </div>

          {/* Card B: Pendentes de envio */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CloudUpload className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 dark:text-white block font-mono">
                {pendingCount}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold leading-tight block">
                Pendentes
              </span>
            </div>
          </div>
        </div>

        {/* Section: Pendentes de sincronização */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Pendentes de sincronização
          </h4>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingItems.map((item) => {
              return (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      {item.type === 'waypoint' && (
                        <MapPin className="w-4 h-4 text-emerald-500 stroke-[2.2]" />
                      )}
                      {item.type === 'photo' && (
                        <Camera className="w-4 h-4 text-slate-500 stroke-[2.2]" />
                      )}
                      {item.type === 'form' && (
                        <ClipboardList className="w-4 h-4 text-slate-500 stroke-[2.2]" />
                      )}
                    </div>

                    <div>
                      <h5 className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {item.title}
                      </h5>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.subtitle}
                        </p>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {item.date}
                      </span>
                    </div>
                  </div>

                  {/* Pending Amber Cloud */}
                  <div className="text-amber-500 shrink-0">
                    <CloudUpload className="w-5 h-5 stroke-[2]" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('evidence')}
              className="text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider cursor-pointer"
            >
              Ver todos ({pendingCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
