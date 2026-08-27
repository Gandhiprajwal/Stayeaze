import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';

interface DestructiveActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  consequences?: string[];
  typeToConfirm?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'security';
  onConfirm: () => void;
  loading?: boolean;
}

export function DestructiveActionModal({
  open,
  onOpenChange,
  title,
  description,
  consequences = [],
  typeToConfirm,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  loading = false,
}: DestructiveActionModalProps) {
  const [typedValue, setTypedValue] = useState('');

  const isConfirmed = !typeToConfirm || typedValue.trim().toLowerCase() === typeToConfirm.trim().toLowerCase();

  const handleClose = () => {
    if (!loading) {
      setTypedValue('');
      onOpenChange(false);
    }
  };

  const getHeaderIcon = () => {
    if (variant === 'security') {
      return (
        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          <Lock className="h-6 w-6" />
        </div>
      );
    }
    if (variant === 'warning') {
      return (
        <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertTriangle className="h-6 w-6 animate-pulse" />
        </div>
      );
    }
    return (
      <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
        <ShieldAlert className="h-6 w-6 animate-bounce" />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 gap-0">
        {/* Top Header */}
        <div className="p-5 pb-4 flex items-start gap-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          {getHeaderIcon()}
          <div className="space-y-1 min-w-0 flex-1">
            <DialogTitle className="text-base font-black tracking-tight text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Consequences Alert Box */}
          {consequences.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-2">
              <p className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                Irreversible Side Effects & Warnings:
              </p>
              <ul className="text-[11px] text-rose-700 dark:text-rose-300/90 space-y-1.5 list-disc pl-4">
                {consequences.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Type to Confirm Guard */}
          {typeToConfirm && (
            <div className="space-y-2 bg-muted/40 p-3.5 rounded-xl border">
              <Label className="text-xs font-semibold text-foreground">
                To confirm, type <span className="font-mono font-black text-rose-600 dark:text-rose-400 select-all">{typeToConfirm}</span> below:
              </Label>
              <Input
                placeholder={`Type "${typeToConfirm}"`}
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                className="text-xs font-mono bg-background border-rose-200 dark:border-rose-900/50 focus-visible:ring-rose-500"
                disabled={loading}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="h-9 px-4 text-xs font-semibold"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (isConfirmed) {
                onConfirm();
              }
            }}
            disabled={!isConfirmed || loading}
            className={`h-9 px-4 text-xs font-semibold shadow-xs transition-all ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Executing...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {confirmLabel}
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
