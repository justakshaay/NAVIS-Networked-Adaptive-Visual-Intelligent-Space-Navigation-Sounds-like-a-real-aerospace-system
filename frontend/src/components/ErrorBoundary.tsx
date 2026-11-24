import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NAVIS Mission Control Error Caught by Boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#080A0D] text-[#E6EDF3] font-mono p-6 select-none">
          <div className="max-w-lg w-full bg-[#0F1217] border border-[#F85149] rounded-[2px] p-6 shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#F85149]/15 border border-[#F85149] flex items-center justify-center text-[#F85149]">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h2 className="text-sm font-bold tracking-wider text-[#F85149] uppercase">
                GNC SUBSYSTEM ANOMALY DETECTED
              </h2>
              <p className="text-xs text-[#8B949E] mt-1">
                A client rendering exception was intercepted. Telemetry state has been safely preserved.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-[#080A0D] border border-[#21262D] rounded-[2px] p-3 text-left overflow-x-auto text-[11px] text-[#F85149]">
                <code>{this.state.error.toString()}</code>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-[#161B22] border border-[#58A6FF] text-[#58A6FF] hover:bg-[#58A6FF]/15 font-bold text-xs rounded-[2px] flex items-center gap-2 transition-colors duration-150"
            >
              <RotateCcw className="w-4 h-4" />
              <span>RELOAD MISSION CONTROL</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
