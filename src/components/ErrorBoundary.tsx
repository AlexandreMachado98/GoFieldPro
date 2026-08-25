import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-screen w-full bg-slate-950 p-6 text-white overflow-auto z-[999999] relative">
          <h2 className="text-2xl font-black text-rose-500 mb-4">Falha Crítica (Crash Detectado)</h2>
          <p className="mb-4 text-slate-300">
            O aplicativo encontrou um erro e não pôde continuar a renderização. Por favor, tire um print desta tela e avise o desenvolvedor.
          </p>
          <div className="bg-slate-900 p-4 rounded-xl font-mono text-xs overflow-auto border border-rose-900 mb-6">
            <div className="text-rose-400 font-bold mb-2">{this.state.error?.toString()}</div>
            <div className="text-slate-400 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</div>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold shadow-lg"
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
