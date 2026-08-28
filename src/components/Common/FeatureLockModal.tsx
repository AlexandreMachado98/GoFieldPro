import React from 'react';
import { X, Lock, Sparkles, ExternalLink, ArrowRight, Check, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const FeatureLockModal: React.FC = () => {
  const { isUpgradeModalOpen, setIsUpgradeModalOpen, upgradeModalFeature } = useApp();

  if (!isUpgradeModalOpen) return null;

  const handleOpenAmtstPortal = () => {
    window.open('https://am-tst.com.br/#apps', '_blank');
    setIsUpgradeModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#070A10] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 p-6 sm:p-8 space-y-6">
        
        {/* Header with Close */}
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={() => setIsUpgradeModalOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recurso Exclusivo GoField Pro</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {upgradeModalFeature || 'Funcionalidade Pro'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Este recurso faz parte do plano profissional do <strong>GoField Pro</strong>. A contratação, licenças e ativações corporativas são realizadas diretamente no portal oficial da <strong>AM TST</strong>.
          </p>
        </div>

        {/* Benefits Preview */}
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2 text-xs text-slate-300">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            O que está incluído no GoField Pro:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Mapas PDF Ilimitados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Satélite 100% Offline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Cubagem de Madeira (m³)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Rondas & Inspeções SST</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Exportação KML / KMZ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Relatórios Técnicos em PDF</span>
            </div>
          </div>
        </div>

        {/* CTA Actions */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleOpenAmtstPortal}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Conhecer o GoField Pro na AM TST</span>
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsUpgradeModalOpen(false)}
            className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
          >
            Continuar no Modo Gratuito
          </button>
        </div>

      </div>
    </div>
  );
};
