import React from 'react';
import { useUpdate } from '../../context/UpdateContext';
import { RefreshCw, Sparkles, X, ShieldAlert, CheckCircle2, ShieldCheck, Clock } from 'lucide-react';

export const AppUpdateBanner: React.FC = () => {
  const {
    isUpdateAvailable,
    latestVersion,
    currentVersion,
    isApplyingUpdate,
    isEnforcedMandatory,
    daysRemaining,
    applyUpdate,
    forceCleanUpdate,
    dismissBanner,
    isBannerDismissed,
  } = useUpdate();

  if (!isUpdateAvailable) return null;

  return (
    <>
      {/* Applying Update Fullscreen Overlay */}
      {isApplyingUpdate && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-sky-500/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/40">
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-white">Aplicando Atualização</h4>
              <p className="text-xs text-slate-300 mt-1.5">
                Instalando a versão <b>{latestVersion}</b> e limpando o cache antigo...
              </p>
            </div>
            <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Seus pontos, mapas e dados estão 100% preservados.</span>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Blocking Modal after 3-Day Grace Period */}
      {isEnforcedMandatory && (
        <div className="fixed inset-0 z-[999995] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 sm:p-7 shadow-2xl max-w-md w-full text-center space-y-4 relative overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-2">
                Prazo de 3 Dias Expirado
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                Atualização Obrigatória Necessária
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                A versão <b className="text-emerald-400">{latestVersion}</b> foi lançada há mais de 3 dias. Para evitar conflitos de versão e garantir o funcionamento seguro do app, a instalação é obrigatória.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-left flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-300 leading-snug">
                <b>Seus dados estão 100% seguros:</b> Todos os seus pontos, mapas PDF, trilhas e configurações serão preservados durante o processo.
              </p>
            </div>

            <button
              type="button"
              onClick={forceCleanUpdate}
              disabled={isApplyingUpdate}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isApplyingUpdate ? 'animate-spin' : ''}`} />
              <span>{isApplyingUpdate ? 'Instalando Atualização...' : 'Instalar Atualização Agora'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Update Notification Banner (Within 3-Day Grace Period) */}
      {!isEnforcedMandatory && !isBannerDismissed && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[999990] w-[95%] max-w-lg animate-in slide-in-from-top duration-300 pointer-events-auto">
          <div className="bg-gradient-to-r from-sky-950/95 via-slate-900/95 to-indigo-950/95 backdrop-blur-md border border-sky-500/80 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-sky-950/80 text-white flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-white">Nova Versão Disponível</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {latestVersion}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    <span>Auto-atualização em {daysRemaining}d</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                  Atualize seu app para receber novas funções. Seus dados locais permanecem salvos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={forceCleanUpdate}
                disabled={isApplyingUpdate}
                className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isApplyingUpdate ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>

              <button
                type="button"
                onClick={dismissBanner}
                title="Lembrar mais tarde"
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
