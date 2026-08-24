import { useState } from 'react';
import { WifiOff, RefreshCw, Globe, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const [checking, setChecking] = useState(false);

  const checkConnection = () => {
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (navigator.onLine) {
        window.location.reload();
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 relative overflow-hidden transition-colors duration-300">
      {/* Background glow effects */}
      <div className="absolute right-0 top-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-rose-500/10 dark:bg-rose-500/20 blur-3xl pointer-events-none" />
      <div className="absolute left-0 bottom-0 -mb-20 -ml-20 h-96 w-96 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full bg-card border border-border rounded-3xl p-8 text-center shadow-2xl space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400">
          <WifiOff className="h-10 w-10 animate-pulse" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <AlertTriangle className="h-3.5 w-3.5" /> No Internet Connection
          </span>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Connection Lost</h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            StayEaze cannot reach the server right now. Please verify your Wi-Fi, Ethernet, or cellular data connection and try again.
          </p>
        </div>

        <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-left text-xs space-y-2">
          <p className="font-bold text-foreground uppercase tracking-wider text-[10px]">Troubleshooting Steps:</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Verify router cables and wireless connection.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Disable VPNs or proxy servers that block traffic.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Data entered locally will sync once internet returns.</span>
            </li>
          </ul>
        </div>

        <Button
          onClick={checkConnection}
          disabled={checking}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 text-xs shadow-lg shadow-indigo-600/20"
        >
          {checking ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Verifying Connection...
            </>
          ) : (
            <>
              <Globe className="mr-2 h-4 w-4" /> Check Internet & Reconnect
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
