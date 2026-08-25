import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ToastMessage } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  RefreshCw,
  Flame,
  MapPin,
  Shield,
  FileText,
} from 'lucide-react';

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const duration = toast.duration || 4500;

  useEffect(() => {
    if (isPaused) return;
    const intervalTime = 120;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss(toast.id);
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [duration, isPaused, onDismiss, toast.id]);

  const getStyleConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          borderColor: 'border-emerald-500/50',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(16,185,129,0.25)]',
          barColor: 'bg-emerald-500',
          badgeText: 'Sucesso',
          badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          borderColor: 'border-rose-500/60',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(244,63,94,0.28)]',
          barColor: 'bg-rose-500',
          badgeText: 'Erro',
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          borderColor: 'border-amber-500/50',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(245,158,11,0.25)]',
          barColor: 'bg-amber-500',
          badgeText: 'Atenção',
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      case 'sos':
        return {
          icon: <Flame className="w-5 h-5 text-red-400 shrink-0 animate-pulse" />,
          borderColor: 'border-red-500/80',
          bgColor: 'bg-slate-950/95',
          glow: 'shadow-[0_8px_35px_rgba(239,68,68,0.4)]',
          barColor: 'bg-red-500 animate-pulse',
          badgeText: 'EMERGÊNCIA SOS',
          badgeBg: 'bg-red-500/20 text-red-400 border-red-500/40',
        };
      case 'sync':
        return {
          icon: <RefreshCw className="w-5 h-5 text-cyan-400 shrink-0 animate-spin" />,
          borderColor: 'border-cyan-500/50',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(6,182,212,0.25)]',
          barColor: 'bg-cyan-500',
          badgeText: 'Sincronismo',
          badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        };
      case 'geofence':
        return {
          icon: <MapPin className="w-5 h-5 text-purple-400 shrink-0" />,
          borderColor: 'border-purple-500/50',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(168,85,247,0.25)]',
          barColor: 'bg-purple-500',
          badgeText: 'Geolocalização',
          badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        };
      case 'security':
        return {
          icon: <Shield className="w-5 h-5 text-indigo-400 shrink-0" />,
          borderColor: 'border-indigo-500/50',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(99,102,241,0.25)]',
          barColor: 'bg-indigo-500',
          badgeText: 'Segurança',
          badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        };
      case 'task':
        return {
          icon: <FileText className="w-5 h-5 text-blue-400 shrink-0" />,
          borderColor: 'border-blue-500/50',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(59,130,246,0.25)]',
          barColor: 'bg-blue-500',
          badgeText: 'Operação',
          badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
          borderColor: 'border-sky-500/50',
          bgColor: 'bg-slate-900/95',
          glow: 'shadow-[0_8px_30px_rgba(56,189,248,0.25)]',
          barColor: 'bg-sky-500',
          badgeText: 'Informativo',
          badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
        };
    }
  };

  const style = getStyleConfig();

  return (
    <div
      id={`toast-${toast.id}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`relative overflow-hidden w-full sm:w-[380px] max-w-full ${style.bgColor} backdrop-blur-xl border ${style.borderColor} ${style.glow} rounded-xl p-3.5 flex flex-col gap-2 transition-all duration-300 transform translate-y-0 opacity-100 pointer-events-auto`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-1 rounded-lg bg-slate-800/80 border border-slate-700/50 mt-0.5">
            {style.icon}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100 tracking-tight leading-snug">
                {toast.title}
              </span>
              <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border ${style.badgeBg}`}>
                {style.badgeText}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words font-medium">
              {toast.message}
            </p>
          </div>
        </div>

        <button
          id={`btn-close-toast-${toast.id}`}
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors shrink-0"
          title="Fechar notificação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress countdown bar */}
      <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden mt-1">
        <div
          className={`h-full ${style.barColor} transition-all duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      id="tactical-toast-container"
      className="fixed top-4 right-4 z-[999999] flex flex-col gap-2.5 pointer-events-none max-w-[calc(100vw-2rem)]"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
