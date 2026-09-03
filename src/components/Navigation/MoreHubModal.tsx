import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  HardDrive,
  Gauge,
  Flame,
  Trees,
  Settings,
  Moon,
  Sun,
  Crown,
  ChevronRight,
  X,
  Compass,
} from 'lucide-react';
import { BottomSheet } from '../Common/BottomSheet';

interface MoreHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MoreHubModal: React.FC<MoreHubModalProps> = ({ isOpen, onClose }) => {
  const {
    setActiveTab,
    setIsWoodpileModalOpen,
    setIsSettingsModalOpen,
    openUpgradeModal,
    isProUser,
    settings,
    setSettings,
  } = useApp();

  const handleSelect = (action: () => void) => {
    onClose();
    action();
  };

  const isDarkMode = settings.theme === 'dark';

  const toggleTheme = () => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Menu & Recursos"
      icon={<Compass className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
    >
      <div className="space-y-4 pb-4">
        {/* Hub Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Plantas PDF */}
          <button
            onClick={() => handleSelect(() => setActiveTab('pdf_maps'))}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/50 flex flex-col items-start gap-2.5 text-left active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="block text-xs font-black text-slate-900 dark:text-white">
                Plantas PDF
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Mapas georreferenciados
              </span>
            </div>
          </button>

          {/* 2. Sincronização & Offline */}
          <button
            onClick={() => handleSelect(() => setActiveTab('offline'))}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/50 flex flex-col items-start gap-2.5 text-left active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <HardDrive className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="block text-xs font-black text-slate-900 dark:text-white">
                Sincronização
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Dados e nuvem offline
              </span>
            </div>
          </button>

          {/* 3. Rondas SST */}
          <button
            onClick={() => handleSelect(() => setActiveTab('field_rounds'))}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/50 flex flex-col items-start gap-2.5 text-left active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Gauge className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="block text-xs font-black text-slate-900 dark:text-white">
                Rondas SST
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Frota e inspeção
              </span>
            </div>
          </button>

          {/* 4. Incêndios */}
          <button
            onClick={() => handleSelect(() => setActiveTab('fire_incidents'))}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-rose-500/50 flex flex-col items-start gap-2.5 text-left active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="block text-xs font-black text-slate-900 dark:text-white">
                Incêndios
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Focos e combate
              </span>
            </div>
          </button>

          {/* 5. Cubagem m³ */}
          <button
            onClick={() => handleSelect(() => setIsWoodpileModalOpen(true))}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/50 flex flex-col items-start gap-2.5 text-left active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Trees className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="block text-xs font-black text-slate-900 dark:text-white">
                Cubagem m³
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Pilha de madeira
              </span>
            </div>
          </button>

          {/* 6. Configurações */}
          <button
            onClick={() => handleSelect(() => setIsSettingsModalOpen(true))}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/50 flex flex-col items-start gap-2.5 text-left active:scale-[0.98] transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Settings className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="block text-xs font-black text-slate-900 dark:text-white">
                Configurações
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Ajustes e precisão
              </span>
            </div>
          </button>
        </div>

        {/* Theme Switcher Tile */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isDarkMode ? (
              <Moon className="w-4 h-4 text-blue-400 stroke-[2.2]" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500 stroke-[2.2]" />
            )}
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Tema Escuro (Dark Mode)
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              isDarkMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${
                isDarkMode ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Pro Banner */}
        {!isProUser && (
          <div
            onClick={() => handleSelect(() => openUpgradeModal('Menu Mais'))}
            className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between gap-3 shadow-lg shadow-blue-600/20 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-amber-300 fill-amber-300" />
              </div>
              <div>
                <h4 className="text-xs font-black">GoField Pro Ilimitado</h4>
                <p className="text-[10px] text-blue-100">Desbloqueie todos os recursos.</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/80" />
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
