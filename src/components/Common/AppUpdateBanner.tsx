import React from 'react';
import { useUpdate } from '../../context/UpdateContext';
import { RefreshCw, Sparkles, X, ArrowUpCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

export const AppUpdateBanner: React.FC = () => {
  const {
    isUpdateAvailable,
    latestVersion,
    currentVersion,
    isApplyingUpdate,
    applyUpdate,
    dismissBanner,
    isBannerDismissed,
  } = useUpdate();

  if (!isUpdateAvailable || isBannerDismissed) return null;

  return (
    <>
      {/* Applying Update Overlay */}
      {isApplyingUpdate && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-sky-500/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
            <div>
              <h4 className="text-sm font-extrabold text-white">Atualizando Aplicativo</h4>
              <p className="text-xs text-slate-300 mt-1">
                Instalando versão <b>{latestVersion}</b> e limpando cache...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Update Notification Banner (Top-Center) */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[999990] w-[95%] max-w-lg animate-in slide-in-from-top duration-300 pointer-events-auto">
        <div className="bg-gradient-to-r from-sky-950/95 via-slate-900/95 to-indigo-950/95 backdrop-blur-md border border-sky-500/80 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-sky-950/80 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white">Nova Versão Disponível</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {latestVersion}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                Atualize seu aplicativo instalado para receber novas funções e correções.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={applyUpdate}
              disabled={isApplyingUpdate}
              className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isApplyingUpdate ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={dismissBanner}
              title="Lembrar mais tarde"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
