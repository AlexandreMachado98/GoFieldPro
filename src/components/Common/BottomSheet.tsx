import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
  icon?: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[88dvh]',
  icon,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex flex-col justify-end transition-opacity duration-200">
      {/* Backdrop without canvas-breaking blur */}
      <div
        className="fixed inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div
        className={`relative z-10 w-full bg-[#0F172A] border-t border-slate-800 rounded-t-3xl shadow-2xl flex flex-col ${maxHeight} overflow-hidden animate-in slide-in-from-bottom duration-300 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]`}
      >
        {/* Drag Handle */}
        <div className="w-full flex items-center justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-700/80 rounded-full" />
        </div>

        {/* Header (optional) */}
        {(title || icon) && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div>
                {title && <h3 className="text-sm font-extrabold text-white">{title}</h3>}
                {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-slate-200">{children}</div>
      </div>
    </div>
  );
};
