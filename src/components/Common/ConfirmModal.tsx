import React from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { AlertTriangle, AlertCircle, HelpCircle, X } from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirm } = useApp();

  if (!confirmDialog.isOpen) return null;

  const handleConfirm = () => {
    confirmDialog.onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    if (confirmDialog.onCancel) {
      confirmDialog.onCancel();
    }
    closeConfirm();
  };

  const getTypeStyle = () => {
    switch (confirmDialog.type) {
      case 'danger':
        return {
          icon: <AlertCircle className="w-6 h-6 text-rose-400" />,
          buttonBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_16px_rgba(225,29,72,0.4)]',
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          borderColor: 'border-rose-500/30',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          buttonBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_4px_16px_rgba(217,119,6,0.4)]',
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          borderColor: 'border-amber-500/30',
        };
      case 'info':
      default:
        return {
          icon: <HelpCircle className="w-6 h-6 text-sky-400" />,
          buttonBg: 'bg-sky-600 hover:bg-sky-500 text-white shadow-[0_4px_16px_rgba(2,132,199,0.4)]',
          badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          borderColor: 'border-sky-500/30',
        };
    }
  };

  const style = getTypeStyle();

  return createPortal(
    <div
      id="modal-confirm-dialog"
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className={`bg-slate-900 border ${style.borderColor} w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col scale-100 transition-all max-h-[min(90dvh,calc(100vh-32px))]`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              {style.icon}
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">{confirmDialog.title}</h3>
            </div>
          </div>
          <button
            id="btn-close-confirm-modal"
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message body */}
        <div className="p-5 text-sm text-slate-300 leading-relaxed font-medium">
          {confirmDialog.message}
        </div>

        {/* Footer buttons */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
          <button
            id="btn-cancel-confirm"
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
          >
            {confirmDialog.cancelText || 'Cancelar'}
          </button>
          <button
            id="btn-action-confirm"
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${style.buttonBg}`}
          >
            {confirmDialog.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
