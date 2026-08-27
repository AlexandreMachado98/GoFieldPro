import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // @ts-ignore
    this.setState({ errorInfo });
  }

  handleReset = () => {
    // @ts-ignore
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleHardReload = () => {
    try {
      localStorage.removeItem('geofield_active_tool');
      localStorage.removeItem('geofield_selected_pdf_id');
    } catch {}
    window.location.reload();
  };

  handlePurgeAndReload = () => {
    try {
      localStorage.clear();
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('geofield_pdf_db');
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full h-full min-h-[300px] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            
            <div>
              <h3 className="text-base font-extrabold text-white">
                {this.props.fallbackTitle || 'Instabilidade Recuperada'}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Ocorreu uma inconsistência temporária ao manipular o mapa. O sistema isolou a falha para proteger seus dados.
              </p>
              {this.state.error?.message && (
                <div className="mt-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-rose-400 font-mono break-all text-left">
                  <span className="font-bold">Erro:</span> {this.state.error.name}: {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Restaurar Tela</span>
              </button>
              <button
                onClick={this.handleHardReload}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Recarregar App
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
              <button
                onClick={() => (this as any).setState((prev: any) => ({ showDetails: !prev.showDetails }))}
                className="flex items-center gap-1 hover:text-slate-300"
              >
                <Bug className="w-3 h-3" />
                {this.state.showDetails ? 'Ocultar Detalhes Técnicos' : 'Ver Detalhes Técnicos'}
              </button>
              <button
                onClick={this.handlePurgeAndReload}
                className="text-rose-400/80 hover:text-rose-300 flex items-center gap-1"
                title="Limpar documentos do cache e reiniciar"
              >
                <Trash2 className="w-3 h-3" />
                Limpar Cache Local
              </button>
            </div>

            {this.state.showDetails && this.state.error?.stack && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[9px] text-slate-400 font-mono text-left max-h-40 overflow-y-auto whitespace-pre-wrap">
                {this.state.error.stack}
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
