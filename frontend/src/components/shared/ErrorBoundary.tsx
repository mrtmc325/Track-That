import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center p-8 text-center" role="alert">
          <h2 className="text-lg font-semibold text-red-600">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-500">Please try refreshing the page.</p>
          <button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Refresh</button>
        </div>
      );
    }
    return this.props.children;
  }
}
