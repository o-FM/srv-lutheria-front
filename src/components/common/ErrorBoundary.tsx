import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Evita a tela branca quando um componente lança durante a renderização.
 * Única exceção à regra "sem class components": o React 19 não tem
 * equivalente funcional para error boundaries.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <AlertTriangle className="w-10 h-10 text-amber-400" aria-hidden="true" />
        <h1 className="text-lg font-black text-amber-100">Algo deu errado</h1>
        <p className="text-sm text-stone-300 max-w-sm">
          O aplicativo encontrou um erro inesperado. Seus dados salvos neste aparelho
          continuam aqui. Recarregue para tentar de novo.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Recarregar
        </button>
      </div>
    );
  }
}
