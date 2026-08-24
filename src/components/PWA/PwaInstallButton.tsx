import React from 'react';
import { Download, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import { PwaInstallModal } from './PwaInstallModal';

interface PwaInstallButtonProps {
  variant?: 'topbar' | 'sidebar' | 'banner' | 'login';
}

export const PwaInstallButton: React.FC<PwaInstallButtonProps> = ({ variant = 'topbar' }) => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    showModal,
    setShowModal,
    promptInstall,
  } = usePwaInstall();

  // If already running as installed app in standalone mode
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>App Instalado (PWA)</span>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {variant === 'topbar' && (
        <button
          id="btn-topbar-install-pwa"
          onClick={promptInstall}
          title="Instalar GoField Pro no Celular / Tablet"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md shadow-sky-600/20 transition-all active:scale-95 animate-pulse"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          id="btn-sidebar-install-pwa"
          onClick={promptInstall}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white text-xs font-bold shadow-lg shadow-sky-600/20 transition-all active:scale-95 group"
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-sky-200 group-hover:scale-110 transition-transform" />
            <span>Instalar Aplicativo</span>
          </div>
          <span className="text-[10px] bg-sky-950/60 text-sky-200 px-2 py-0.5 rounded-md border border-sky-400/30">
            PWA
          </span>
        </button>
      )}

      {variant === 'banner' && (
        <div className="bg-gradient-to-r from-sky-950/80 via-slate-900 to-sky-950/80 border border-sky-600/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Instale o GoField Pro no seu Celular
                <span className="text-[10px] bg-sky-500 text-white font-black px-1.5 py-0.5 rounded uppercase">
                  Recomendado
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Uso em tela cheia sem barras de navegador, GPS contínuo e acesso offline aos mapas.
              </p>
            </div>
          </div>
          <button
            onClick={promptInstall}
            className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all shrink-0 active:scale-95"
          >
            <Download className="w-4 h-4" />
            Instalar Aplicativo
          </button>
        </div>
      )}

      {variant === 'login' && (
        <button
          type="button"
          onClick={promptInstall}
          className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <Smartphone className="w-4 h-4 text-sky-400" />
          Instalar no Celular (Modo App)
        </button>
      )}

      <PwaInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        isIOS={isIOS}
        isAndroid={isAndroid}
        onNativeInstall={promptInstall}
        hasNativePrompt={isInstallable}
      />
    </>
  );
};
