import React from 'react';
import { Building2, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface OrganizationSetupGuardModalProps {
  open: boolean;
  missingFields?: string[];
  completionPercentage?: number;
  isAdmin?: boolean;
}

export function OrganizationSetupGuardModal({
  open,
  missingFields = [],
  completionPercentage = 0,
  isAdmin = true,
}: OrganizationSetupGuardModalProps) {
  const navigate = useNavigate();

  const handleGoToSettings = () => {
    navigate('/settings?tab=organization');
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="[&>button]:hidden sm:max-w-lg border-2 border-amber-500/80 bg-white dark:bg-slate-950 shadow-2xl z-[9998]"
      >
        <DialogHeader className="text-center space-y-3 pt-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border-2 border-amber-500/30 animate-pulse">
            <Building2 className="h-8 w-8" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
            <span>Setup Profile Required</span>
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 font-extrabold uppercase text-[10px] bg-amber-50 dark:bg-amber-950/40">
              Action Required
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            {isAdmin ? (
              <>
                To activate StayEaze operational features (Properties, Rooms, Tenants, Check-ins, Billing), you must complete and save your organization business profile and banking details.
              </>
            ) : (
              <>
                Your property organization profile setup is incomplete. Feature access is currently restricted. Please ask your property administrator or owner to complete setup in Settings.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2 my-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Profile Completion</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{completionPercentage}% Completed</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, completionPercentage)}%` }}
            />
          </div>
        </div>

        {/* Missing Fields Checklist */}
        {missingFields.length > 0 && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-2 text-xs text-amber-950 dark:text-amber-200 my-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span>Pending Required Details ({missingFields.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {missingFields.map((field, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded-md bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {field}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action CTA */}
        <div className="pt-2">
          {isAdmin ? (
            <Button
              onClick={handleGoToSettings}
              className="w-full h-11 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-sm shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
            >
              <span>Complete Setup & Unlock Features</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 text-center text-xs text-slate-500">
              Please notify the Property Owner / Administrator to complete setup.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
