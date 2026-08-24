import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowDownCircle,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { OfflineMapDownloadModal } from './OfflineMapDownloadModal';

export const OfflineSyncDrawer: React.FC = () => {
  const {
    isOffline,
    setIsOffline,
    offlineQueue,
    isSyncing,
    triggerManualSync,
    cachedStorageMB,
    layers,
    activeProject,
    t,
  } = useApp();

  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto text-slate-100 pb-32 sm:pb-16">
      {/* Header & Status Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${isOffline ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {isOffline ? <WifiOff className="w-6 h-6" /> : <Wifi className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-base text-white">
              {isOffline ? 'Modo Campo Offline Ativo' : 'Conectado à Nuvem Corporativa'}
            </h3>
            <p className="text-xs text-slate-400">
              {isOffline
                ? 'Todos os novos pontos, trilhas e fotos ficam armazenados no dispositivo e serão sincronizados automaticamente ao retornar da área remota.'
                : 'Sincronização em tempo real ativa. Backups automáticos em execução.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-lg transition-all active:scale-95 border border-emerald-400/40"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Mapa Offline</span>
          </button>

          <button
            id="btn-toggle-field-offline-mode"
            onClick={() => setIsOffline(!isOffline)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isOffline
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {isOffline ? 'Simular Reconexão (Ficar Online)' : 'Simular Modo Sem Internet'}
          </button>
        </div>
      </div>

      {/* Offline Storage Usage & Pre-cached Packs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            Armazenamento Local Utilizado
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {cachedStorageMB.toFixed(1)} <span className="text-xs font-normal text-slate-400">MB</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Limite alocado: 500 MB (IndexedDB)</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Mapas e Folhas Pré-Carregadas
          </div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {layers.filter((l) => l.isOfflineCached).length} <span className="text-xs font-normal text-slate-400">camadas</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1">Disponíveis para zoom 10-18 offline</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
          <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            Fila de Envio Pendente
          </div>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {offlineQueue.length} <span className="text-xs font-normal text-slate-400">itens</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {offlineQueue.length === 0 ? 'Tudo sincronizado' : 'Aguardando envio'}
          </div>
        </div>
      </div>

      {/* Sync Queue Table & Manual Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h4 className="font-bold text-sm text-white">Fila de Mutações e Registros Locais</h4>
            <p className="text-xs text-slate-400">Itens capturados durante a jornada de campo aguardando confirmação no servidor central.</p>
          </div>

          <button
            id="btn-trigger-manual-sync-queue"
            onClick={triggerManualSync}
            disabled={isSyncing}
            className="bg-sky-600 hover:bg-sky-500 disabled:bg-sky-900 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? t.syncing : t.syncNow}
          </button>
        </div>

        {offlineQueue.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            Nenhuma mutação pendente. O banco de dados local está 100% em sincronia com a nuvem.
          </div>
        ) : (
          <div className="space-y-2">
            {offlineQueue.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-200">
                    {item.entityType.toUpperCase()}: {item.data?.name || item.id}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Ação: {item.action} | Timestamp: {new Date(item.timestamp).toLocaleTimeString('pt-BR')}
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  Pendente
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Corporate Copyright Footer */}
      <footer className="mt-6 pt-4 pb-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400">GoField Pro</span>
          <span>•</span>
          <span>AM TST SAÚDE E SEGURANÇA DO TRABALHO</span>
        </div>
        <a
          href="https://amtst.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 font-medium hover:underline transition-colors"
        >
          https://amtst.vercel.app/
        </a>
      </footer>

      <OfflineMapDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </div>
  );
};
