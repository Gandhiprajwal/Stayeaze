import React, { useState } from 'react';
import { ShieldAlert, Sparkles, AlertTriangle, ArrowRight, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

interface WorkspaceLockedModalProps {
  open: boolean;
  expiryDate?: string;
  isAdmin?: boolean;
  onPaymentSuccess?: () => void;
}

export function WorkspaceLockedModal({ open, expiryDate, isAdmin = true, onPaymentSuccess }: WorkspaceLockedModalProps) {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayNow = async () => {
    setIsProcessing(true);
    try {
      // Trigger plan upgrade / mandate renewal endpoint
      const res = await api.post('/subscription/upgrade?planName=Starter%20PG%20Plan&planPrice=1499&billingCycle=MONTHLY');
      toast.success(res.data?.message || 'Subscription renewed successfully! Workspace unlocked.');
      setIsProcessing(false);
      if (onPaymentSuccess) {
        onPaymentSuccess();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
      navigate('/subscription');
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="[&>button]:hidden sm:max-w-lg border-2 border-rose-500/80 bg-white dark:bg-slate-950 shadow-2xl z-[9999]"
      >
        <DialogHeader className="text-center space-y-3 pt-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border-2 border-rose-500/30 animate-pulse">
            <Lock className="h-8 w-8" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
            <span>Workspace Access Locked</span>
            <Badge variant="destructive" className="bg-rose-600 font-extrabold uppercase text-[10px]">
              Payment Required
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
            {isAdmin ? (
              <>
                Your property workspace subscription ended on <strong className="text-rose-600 font-mono">{expiryDate || 'recently'}</strong> and the <strong className="text-rose-600">3-day grace period has expired</strong>. Operational actions (creating/modifying buildings, rooms, beds, tenants, or staff) are locked.
              </>
            ) : (
              <>
                Your property workspace subscription has expired. All non-administrative staff access is currently suspended. Please contact your administrator to renew.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 p-4 space-y-2.5 text-xs text-rose-950 dark:text-rose-200 my-2">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-600 flex-shrink-0" />
            <span>Zero Data Loss Protection Guarantee</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            All tenant records, ledgers, and property data remain 100% safe and intact. Complete payment now to immediately unlock and resume full workspace access.
          </p>
        </div>

        {isAdmin ? (
          <div className="space-y-3 pt-2">
            <Button
              onClick={handlePayNow}
              disabled={isProcessing}
              className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold h-12 text-sm shadow-lg flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Processing Payment...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-amber-300" /> Pay & Unlock Workspace Now <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/subscription')}
              className="w-full border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs h-9"
            >
              Go to Subscription Plans Page
            </Button>
          </div>
        ) : (
          <div className="p-3 bg-muted/30 rounded-lg text-center text-xs text-muted-foreground">
            Contact property owner/admin to complete payment.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
