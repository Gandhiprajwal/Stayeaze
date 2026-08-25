import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, Lock, CreditCard, Layers, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { formatCurrency } from '@/lib/format';

interface WorkspaceLockedModalProps {
  open: boolean;
  expiryDate?: string;
  isAdmin?: boolean;
  onPaymentSuccess?: () => void;
}

export function WorkspaceLockedModal({ open, expiryDate, isAdmin = true, onPaymentSuccess }: WorkspaceLockedModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  // Fetch current subscription details to dynamically know active plan & price
  const { data: subDetails } = useQuery({
    queryKey: ['my-subscription-details-modal'],
    queryFn: () => api.get('/subscription/my-subscription').then((r) => r.data),
    enabled: open && isAdmin,
    staleTime: 60000,
  });

  const planName = subDetails?.planName || 'Starter PG Plan';
  const planPrice = subDetails?.planPrice || 1499;
  const cycle = subDetails?.billingCycle || 'MONTHLY';

  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayNow = async () => {
    setIsProcessing(true);
    toast.info('Connecting to Razorpay Secure Gateway...');

    try {
      // 1. Request real Razorpay order from backend
      const orderRes = await api.post(
        `/subscription/create-upgrade-order?planName=${encodeURIComponent(planName)}&planPrice=${planPrice}&billingCycle=${cycle}`
      );
      const orderData = orderRes.data;

      if (orderData.skipPayment) {
        const upgradeRes = await api.post(
          `/subscription/upgrade?planName=${encodeURIComponent(planName)}&planPrice=${planPrice}&billingCycle=${cycle}`
        );
        toast.success(upgradeRes.data?.message || 'Subscription renewed successfully! Workspace unlocked.');
        setIsProcessing(false);
        queryClient.invalidateQueries();
        if (onPaymentSuccess) onPaymentSuccess();
        else window.location.reload();
        return;
      }

      // 2. Open Razorpay Checkout Modal
      if (typeof window !== 'undefined' && (window as any).Razorpay && orderData.keyId) {
        const validRazorpayOrderId = (orderData.orderId && orderData.orderId.startsWith('order_') && !orderData.orderId.startsWith('order_sub_')) 
          ? orderData.orderId 
          : undefined;

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'StayEaze SaaS Workspace Renewal',
          description: `Renewal for ${planName} (${cycle.toLowerCase()})`,
          order_id: validRazorpayOrderId,
          prefill: {
            name: currentUser?.name || orderData.orgName || '',
            email: currentUser?.email || '',
            contact: (currentUser as any)?.mobile || '',
          },
          retry: { enabled: true, max_count: 4 },
          handler: async (resp: any) => {
            try {
              let url = `/subscription/upgrade?planName=${encodeURIComponent(planName)}&planPrice=${planPrice}&billingCycle=${cycle}`;
              if (resp.razorpay_payment_id) url += `&razorpayPaymentId=${encodeURIComponent(resp.razorpay_payment_id)}`;
              if (resp.razorpay_order_id) url += `&razorpayOrderId=${encodeURIComponent(resp.razorpay_order_id)}`;
              if (resp.razorpay_signature) url += `&razorpaySignature=${encodeURIComponent(resp.razorpay_signature)}`;

              const confirmRes = await api.post(url);
              toast.success(confirmRes.data?.message || 'Payment verified! Workspace unlocked successfully.');
              setIsProcessing(false);
              queryClient.invalidateQueries();
              if (onPaymentSuccess) onPaymentSuccess();
              else window.location.reload();
            } catch (err: any) {
              toast.error(err?.response?.data?.message || 'Payment verification failed.');
              setIsProcessing(false);
            }
          },
          modal: {
            backdropclose: true,
            escape: true,
            handleback: true,
            ondismiss: () => {
              setIsProcessing(false);
              toast.info('Payment checkout window closed.');
            },
          },
          theme: {
            color: '#4f46e5',
          },
        };

        try {
          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', function (resp: any) {
            setIsProcessing(false);
            toast.error(`Payment failed: ${resp.error?.description || 'Transaction declined'}. You can retry inside the payment window or try another method.`);
          });
          rzp.open();
        } catch (rzpOpenErr: any) {
          setIsProcessing(false);
          toast.error('Unable to open payment popup in this browser.');
        }
      } else {
        // Fallback: Direct navigate to subscription plan picker
        navigate('/subscription');
        setIsProcessing(false);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to initiate checkout. Navigating to Plans page.');
      setIsProcessing(false);
      navigate('/subscription');
    }
  };

  return (
    <Dialog open={open && !isProcessing} onOpenChange={() => {}}>
      <DialogContent 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-md p-0 overflow-hidden border border-rose-500/30 dark:border-rose-500/20 bg-background shadow-2xl rounded-2xl [&>button]:hidden"
      >
        {/* Top Decorative Gradient Accent */}
        <div className="h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-600 w-full" />

        <div className="p-6 space-y-5">
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-inner">
              <Lock className="h-7 w-7 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[11px] font-bold tracking-wide uppercase">
                <ShieldAlert className="h-3.5 w-3.5" /> Workspace Locked
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Subscription Expired
              </DialogTitle>
            </div>

            <DialogDescription className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {expiryDate 
                ? `Your subscription expired on ${expiryDate}. Operational actions (adding rooms, beds, check-ins, and batch rent runs) are temporarily locked.`
                : 'Your subscription is currently inactive. Renew or switch plans to resume full management operations.'}
            </DialogDescription>
          </DialogHeader>

          {/* Active Plan & Renewal Card */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Active Plan</span>
              <p className="text-sm font-bold text-foreground">{planName}</p>
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Renewal Fee</span>
              <p className="text-base font-black font-mono text-primary">
                {formatCurrency(planPrice)}
                <span className="text-[10px] font-normal text-muted-foreground ml-1">/{cycle.toLowerCase()}</span>
              </p>
            </div>
          </div>

          {/* Active Restrictions Notice */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 space-y-2 text-xs text-rose-900 dark:text-rose-200">
            <div className="font-semibold flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Locked Actions:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground">
              <li>Creating, updating, and deleting properties, rooms & beds is blocked.</li>
              <li>New tenant check-ins, check-outs, and batch rent invoicing are halted.</li>
              <li>Non-admin staff members cannot access this workspace until renewed.</li>
            </ul>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2 pt-1">
            {isAdmin ? (
              <>
                <Button
                  size="lg"
                  onClick={handlePayNow}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs h-10 shadow-md gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting to Razorpay...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay {formatCurrency(planPrice)} & Unlock Workspace
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/subscription')}
                  className="w-full text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 h-9"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Choose Another Plan (Upgrade / Downgrade) &rarr;
                </Button>
              </>
            ) : (
              <div className="text-center p-3 rounded-xl bg-muted text-muted-foreground text-xs space-y-1">
                <p className="font-semibold text-foreground">Admin / Owner Access Required</p>
                <p>Only the organization administrator can renew the subscription plan. Please contact your property owner.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WorkspaceLockedModal;
