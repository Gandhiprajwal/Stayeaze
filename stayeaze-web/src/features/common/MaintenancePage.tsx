import { Wrench, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 relative overflow-hidden transition-colors duration-300">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg w-full bg-card border border-border rounded-3xl p-8 text-center shadow-2xl space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400">
          <Wrench className="h-10 w-10 animate-pulse text-indigo-600 dark:text-indigo-400" />
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            <Clock className="h-3.5 w-3.5" /> Scheduled System Maintenance
          </span>
          <h1 className="text-3xl font-black tracking-tight text-foreground">We'll Be Right Back</h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
            StayEaze servers are currently undergoing scheduled database performance upgrades. Services will resume shortly.
          </p>
        </div>

        <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-left text-xs space-y-2">
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>Status:</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" /> System Upgrade in Progress
            </span>
          </div>
          <div className="flex items-center justify-between font-medium text-foreground">
            <span>Estimated Duration:</span>
            <span className="text-muted-foreground font-mono">15 - 30 minutes</span>
          </div>
        </div>

        <Button
          onClick={() => window.location.reload()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 text-xs shadow-lg shadow-indigo-600/20"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Check System Status & Refresh
        </Button>
      </div>
    </div>
  );
}
