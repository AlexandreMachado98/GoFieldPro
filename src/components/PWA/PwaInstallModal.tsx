import React from 'react';
import { APP_VERSION } from '../../config/version';
import {
  Download,
  Smartphone,
  Share2,
  PlusSquare,
  CheckCircle2,
  X,
  Compass,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  isAndroid: boolean;
  onNativeInstall?: () => void;
  hasNativePrompt?: boolean;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  isIOS,
  isAndroid,
  onNativeInstall,
  hasNativePrompt,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Icon */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 p-0.5 shadow-lg shadow-sky-500/20 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Compass className="w-7 h-7 text-sky-400" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Instalar GoField Pro
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                PWA
              </span>
            </h2>
            <p className="text-xs text-slate-400">Aplicativo nativo para celular e tablet</p>
          </div>
        </div>

        {/* Benefits Box */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 mb-5 space-y-2 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Funciona em <b>tela cheia</b> sem barras de navegação</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Acesso rápido direto pelo <b>ícone na tela de início</b></span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span><b>GPS em tempo real</b> e mapas em PDF offline</span>
          </div>
        </div>

        {/* Action / Step Instructions */}
        {hasNativePrompt && onNativeInstall ? (
          <div className="space-y-3">
            <button
              onClick={() => {
                onNativeInstall();
                onClose();
              }}
              className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all active:scale-95"
            >
              <Download className="w-5 h-5" />
              Instalar Agora no Aparelho
            </button>
            <p className="text-[11px] text-center text-slate-400">
              O sistema abrirá a janela oficial de instalação do aplicativo.
            </p>
          </div>
        ) : isIOS ? (
          /* iOS Safari Specific Guide */
          <div className="space-y-3">
            <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Como instalar no iPhone / iPad (Safari):
            </div>
            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  No Safari, toque no botão <b>Compartilhar</b> <Share2 className="w-3.5 h-3.5 inline text-sky-400 mx-0.5" /> (na barra inferior).
                </div>
              </li>
              <li className="flex items-start gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  Role as opções para baixo e toque em <b className="text-white">"Adicionar à Tela de Início"</b> <PlusSquare className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" />.
                </div>
              </li>
              <li className="flex items-start gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  Toque em <b className="text-white">"Adicionar"</b> no canto superior direito.
                </div>
              </li>
            </ol>
          </div>
        ) : (
          /* Android Chrome / Standard Guide */
          <div className="space-y-3">
            <div className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Como instalar no Android (Google Chrome):
            </div>
            <ol className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  Toque nos <b>três pontinhos (⋮)</b> no canto superior direito do Chrome.
                </div>
              </li>
              <li className="flex items-start gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  Selecione a opção <b className="text-white">"Instalar aplicativo"</b> (ou <i>"Adicionar à tela inicial"</i>).
                </div>
              </li>
              <li className="flex items-start gap-3 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  Confirme em <b className="text-white">"Instalar"</b>. O aplicativo será adicionado como app nativo com ícone próprio!
                </div>
              </li>
            </ol>
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="font-mono text-emerald-400 font-bold">{APP_VERSION}</span>
            <span>•</span>
            <span className="text-slate-500">Auto-Update Ativo</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
