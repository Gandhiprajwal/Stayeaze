import { useState, useEffect } from 'react';
import { ShieldCheck, Zap } from 'lucide-react';

interface GlobalLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

const CYBER_TIPS = [
  'Initializing StayEaze Quantum Engine...',
  'Synchronizing Room & Bed Telemetry...',
  'Allocating High-Availability Resources...',
  'Connecting to Real-Time Spatial Matrix...',
  'Securing Organization Channels...',
];

export function GlobalLoader({ message, fullScreen = false }: GlobalLoaderProps) {
  const [progress, setProgress] = useState(15);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        const diff = Math.floor(Math.random() * 12) + 5;
        return Math.min(95, prev + diff);
      });
    }, 180);

    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % CYBER_TIPS.length);
    }, 1200);

    return () => {
      clearInterval(timer);
      clearInterval(tipTimer);
    };
  }, []);

  const displayMessage = message || CYBER_TIPS[tipIndex];

  const content = (
    <div className="relative flex flex-col items-center justify-center p-8 select-none max-w-sm w-full">
      {/* Ambient Glow Aura */}
      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl animate-pulse" />

      {/* Glassmorphic Loader Card */}
      <div className="relative w-full rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-5">
        
        {/* Kinetic Physics Ball Drop Chute */}
        <div className="relative flex flex-col items-center justify-end w-24 h-24 pb-2">
          {/* Rotating Orbit Floor Ring */}
          <div className="absolute bottom-2 w-20 h-8 rounded-full border-2 border-dashed border-indigo-500/30 dark:border-cyan-400/40 animate-[spin_4s_linear_infinite] [transform:rotateX(65deg)]" />

          {/* Kinetic Bouncing Ball with Squash & Stretch */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 via-cyan-500 to-purple-600 dark:from-cyan-400 dark:via-indigo-500 dark:to-purple-400 shadow-lg shadow-indigo-500/40 dark:shadow-cyan-400/50 animate-[ballBounce_1.2s_cubic-bezier(0.45,0.05,0.55,0.95)_infinite] z-10" />

          {/* Dynamic Floor Shadow */}
          <div className="w-9 h-2 bg-slate-900/20 dark:bg-cyan-400/40 rounded-full mt-1.5 animate-[shadowScale_1.2s_cubic-bezier(0.45,0.05,0.55,0.95)_infinite]" />
        </div>

        {/* Brand Header & Tip */}
        <div className="space-y-1.5 w-full">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-transparent dark:bg-gradient-to-r dark:from-indigo-400 dark:via-cyan-400 dark:to-purple-400 dark:bg-clip-text">
              STAYEAZE KINETIC MATRIX
            </span>
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 dark:bg-cyan-400 animate-ping" />
          </div>

          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 h-8 flex items-center justify-center transition-all duration-300">
            {displayMessage}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-0.5">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500 animate-bounce" />
              <span>SYSTEM SYNC</span>
            </span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400">{progress}%</span>
          </div>

          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80 p-0.5 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-cyan-500 to-purple-600 dark:from-indigo-500 dark:via-cyan-400 dark:to-purple-500 transition-all duration-200 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_infinite]" />
            </div>
          </div>
        </div>

        {/* Footer Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          <span>Real-Time Encrypted Stream</span>
        </div>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/80 dark:bg-slate-950/85 backdrop-blur-md transition-all">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] w-full p-4">
      {content}
    </div>
  );
}
