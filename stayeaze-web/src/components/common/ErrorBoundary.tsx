import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertOctagon, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportFrontendError } from '@/lib/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Unhandled UI Error caught by StayEaze ErrorBoundary:', error, errorInfo);
    reportFrontendError(error, { componentStack: errorInfo.componentStack });
  }

  copyLog = () => {
    const log = `Error: ${this.state.error?.message}\nStack: ${this.state.error?.stack}`;
    navigator.clipboard.writeText(log);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 relative overflow-hidden transition-colors duration-300">
          <div className="max-w-xl w-full bg-card border border-border rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 shrink-0">
                <AlertOctagon className="h-7 w-7" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Application Recoverable Error</span>
                <h2 className="text-xl font-bold text-foreground">Something Went Wrong</h2>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              An unexpected error occurred in the StayEaze interface. Our automated logging system has recorded this issue.
            </p>

            {this.state.error && (
              <div className="bg-secondary/60 border border-border rounded-2xl p-4 font-mono text-[11px] text-rose-600 dark:text-rose-300 max-h-40 overflow-y-auto space-y-1">
                <p className="font-bold text-foreground">Error: {this.state.error.message}</p>
                <p className="text-muted-foreground text-[10px] whitespace-pre-wrap">{this.state.error.stack}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Button
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 text-xs"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reload Application
              </Button>

              <Button
                onClick={this.copyLog}
                variant="outline"
                className="w-full sm:w-auto border-border hover:bg-accent text-foreground h-10 text-xs"
              >
                {this.state.copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Log Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Error Log
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
