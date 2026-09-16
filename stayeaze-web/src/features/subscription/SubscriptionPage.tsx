import { useState } from 'react';
import { 
  Sparkles, CheckCircle2, ShieldCheck, Building2, Calendar, Award, Zap, 
  AlertTriangle, Loader2, BedDouble, Receipt, Info, FileText, Printer, Download, Play, RotateCcw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import api from '@/lib/api';
import type { SubscriptionDetails, SubscriptionPlanApi } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';

import { FormDialog } from '@/components/common/FormDialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DowngradeComplianceDialog } from './DowngradeComplianceDialog';

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [pendingPlan, setPendingPlan] = useState<{ planName: string; planPrice: number; cycle: string } | null>(null);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);

  // Downgrade compliance dialog state
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [complianceData, setComplianceData] = useState<{
    targetPlanName: string;
    targetMaxProperties: number;
    targetMaxBeds: number;
    properties: any[];
    pendingVars: { planName: string; planPrice: number; cycle: string };
  } | null>(null);

  // Fetch active subscription details from backend API
  const { data: subDetails, isLoading: isLoadingSub } = useQuery<SubscriptionDetails>({
    queryKey: ['my-subscription-details'],
    queryFn: () => api.get('/subscription/my-subscription').then((r) => r.data),
  });

  // Fetch subscription plans from backend database API
  const { data: plansData, isLoading: isLoadingPlans } = useQuery<any[]>({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/super-admin/plans').then((r) => r.data),
  });

  // Fetch subscription tax invoices & receipts for logged-in organization
  const { data: myInvoicesData, isLoading: isLoadingInvoices } = useQuery<any[]>({
    queryKey: ['my-subscription-invoices'],
    queryFn: () => api.get('/subscription/my-invoices').then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : Array.isArray(d?.data) ? d.data : [];
    }),
  });

  // Mutation to manually generate initial GST tax receipt for active plan
  const generateInvoiceMut = useMutation({
    mutationFn: async () => {
      const res = await api.get('/subscription/my-invoices');
      return res.data;
    },
    onSuccess: () => {
      toast.success('Tax receipt generated successfully!');
      queryClient.invalidateQueries({ queryKey: ['my-subscription-invoices'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to generate tax receipt');
    },
  });

  // Mutation to preview prorated plan switch
  const previewMutation = useMutation({
    mutationFn: async ({ planName, planPrice, cycle }: { planName: string; planPrice: number; cycle: string }) => {
      const res = await api.post(`/subscription/preview-switch?targetPlanName=${encodeURIComponent(planName)}&targetPlanPrice=${planPrice}&billingCycle=${cycle}`);
      return res.data;
    },
    onSuccess: (data, vars) => {
      setPreviewData(data);
      setPendingPlan(vars);
      setPreviewModalOpen(true);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to calculate subscription proration preview.');
    },
  });

  // Pre-flight check for plan downgrades (quota compliance & 90-day cooldown)
  const handleInitiatePlanSwitch = async (vars: { planName: string; planPrice: number; cycle: string }) => {
    try {
      const eligRes = await api.get(`/subscription/check-downgrade-eligibility?targetPlanName=${encodeURIComponent(vars.planName)}&billingCycle=${vars.cycle}`);
      const elig = eligRes.data;

      if (elig.isDowngrade) {
        if (elig.cooldownLocked) {
          toast.error(elig.message || 'Plan Downgrade Restricted: SaaS plan downgrades are locked to once every 3 months (90 days).', {
            duration: 6000,
          });
          return;
        }

        if (elig.quotaExceeded) {
          setComplianceData({
            targetPlanName: vars.planName,
            targetMaxProperties: elig.targetMaxProperties,
            targetMaxBeds: elig.targetMaxBeds,
            properties: elig.properties || [],
            pendingVars: vars,
          });
          setComplianceDialogOpen(true);
          return;
        }
      }

      // If eligible or upgrade, proceed to proration preview and checkout
      previewMutation.mutate(vars);
    } catch (err: any) {
      previewMutation.mutate(vars);
    }
  };

  // State for tracking Razorpay payment in progress
  const [paymentInProgress, setPaymentInProgress] = useState(false);
  const [sandboxModalOpen, setSandboxModalOpen] = useState(false);
  const [sandboxPaymentData, setSandboxPaymentData] = useState<{
    planName: string;
    planPrice: number;
    cycle: string;
    amountFormatted: number;
    orgName: string;
  } | null>(null);

  // Mutation to confirm upgrade/switch subscription plan (called after Razorpay payment succeeds)
  const upgradePlanMut = useMutation({
    mutationFn: async ({ planName, planPrice, cycle, razorpayPaymentId, razorpayOrderId, razorpaySignature }: {
      planName: string; planPrice: number; cycle: string;
      razorpayPaymentId?: string; razorpayOrderId?: string; razorpaySignature?: string;
    }) => {
      let url = `/subscription/upgrade?planName=${encodeURIComponent(planName)}&planPrice=${planPrice}&billingCycle=${cycle}`;
      if (razorpayPaymentId) url += `&razorpayPaymentId=${encodeURIComponent(razorpayPaymentId)}`;
      if (razorpayOrderId) url += `&razorpayOrderId=${encodeURIComponent(razorpayOrderId)}`;
      if (razorpaySignature) url += `&razorpaySignature=${encodeURIComponent(razorpaySignature)}`;
      const res = await api.post(url);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription plan updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['my-subscription-details'] });
      queryClient.invalidateQueries({ queryKey: ['organization-billing-profile'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['portal-branding'] });
      setPreviewModalOpen(false);
      setPaymentInProgress(false);
      setSandboxModalOpen(false);
      setSandboxPaymentData(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update subscription plan');
      setPaymentInProgress(false);
    },
  });

  // Initiate Razorpay payment flow for subscription upgrade
  async function handleUpgradeWithPayment() {
    if (!pendingPlan) return;
    const { planName, planPrice, cycle } = pendingPlan;

    // For zero-rupee downgrades (no payment needed), directly confirm
    if (previewData && previewData.netPayable <= 0 && previewData.isDowngrade) {
      upgradePlanMut.mutate({ planName, planPrice, cycle });
      return;
    }

    setPaymentInProgress(true);
    toast.info('Connecting to Razorpay Secure Payment Gateway...');

    try {
      // 1. Create Razorpay order on backend
      const orderRes = await api.post(
        `/subscription/create-upgrade-order?planName=${encodeURIComponent(planName)}&planPrice=${planPrice}&billingCycle=${cycle}`
      );
      const orderData = orderRes.data;

      // If backend says skip payment for free downgrade with netPayable = 0
      if (orderData.skipPayment && orderData.netPayable <= 0) {
        upgradePlanMut.mutate({ planName, planPrice, cycle });
        return;
      }

      // Close preview modal so Radix dialog focus-trap does not block clicks on Razorpay iframe
      setPreviewModalOpen(false);

      // Check if real Razorpay keys are configured
      const isRealRazorpayKey = orderData.keyId 
        && orderData.keyId.startsWith('rzp_') 
        && !orderData.keyId.includes('NotConfigured') 
        && !orderData.keyId.includes('MockKey');

      // If keys are placeholder/unconfigured, open the Sandbox Gateway Dialog
      if (!isRealRazorpayKey) {
        setPaymentInProgress(false);
        setSandboxPaymentData({
          planName,
          planPrice,
          cycle,
          amountFormatted: orderData.amountFormatted || planPrice,
          orgName: orderData.orgName || '',
        });
        setSandboxModalOpen(true);
        return;
      }

      // Clean order_id: Only pass real Razorpay server order IDs to avoid v2-entry.modern.js retry header crashes
      const validRazorpayOrderId = (orderData.orderId && orderData.orderId.startsWith('order_') && !orderData.orderId.startsWith('order_sub_')) 
        ? orderData.orderId 
        : undefined;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'StayEaze SaaS Subscription',
        description: `Upgrade to ${planName} (${cycle.toLowerCase()})`,
        order_id: validRazorpayOrderId,
        prefill: {
          name: orderData.orgName || '',
          email: '',
          contact: '',
        },
        retry: { enabled: true, max_count: 4 },
        theme: {
          color: '#4f46e5',
        },
        handler: async function (response: any) {
          try {
            if (!response || !response.razorpay_payment_id) {
              toast.error('Payment declined or cancelled.');
              setPaymentInProgress(false);
              return;
            }
            // 3. Confirm upgrade with Razorpay payment details
            upgradePlanMut.mutate({
              planName,
              planPrice,
              cycle,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });
          } catch (verErr: any) {
            toast.error(verErr?.response?.data?.message || 'Payment verification failed.');
            setPaymentInProgress(false);
          }
        },
        modal: {
          backdropclose: true,
          escape: true,
          handleback: true,
          ondismiss: function () {
            setPaymentInProgress(false);
            setPendingPlan(null);
            setPreviewData(null);
            toast.info('Payment checkout window closed.');
          },
        },
      };

      try {
        setTimeout(() => {
          try {
            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (resp: any) {
              setPaymentInProgress(false);
              toast.error(`Payment failed: ${resp.error?.description || 'Transaction declined'}. You can retry inside the payment window or choose another method.`);
            });
            rzp.open();
          } catch (openErr: any) {
            setPaymentInProgress(false);
            toast.error('Unable to open payment gateway. Please try again.');
          }
        }, 150);
      } catch (rzpErr: any) {
        setPaymentInProgress(false);
        toast.error('Unable to open payment gateway in this browser. Please try in a standard browser window.');
      }
    } catch (err: any) {
      setPaymentInProgress(false);
      const errMsg = err?.response?.data?.message || err?.message || 'Unable to connect to Razorpay payment gateway.';
      toast.error(errMsg);
    }
  }

  // Mutation to cancel auto-debit subscription
  const cancelSubMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/organization-billing-profile/cancel-subscription');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Auto-debit mandate cancelled successfully.');
      queryClient.invalidateQueries({ queryKey: ['my-subscription-details'] });
      queryClient.invalidateQueries({ queryKey: ['organization-billing-profile'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to cancel subscription');
    },
  });

  // Mutation to pause subscription
  const pauseSubMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/organization-billing-profile/pause-subscription?pauseMonths=1');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription paused for 1 month.');
      queryClient.invalidateQueries({ queryKey: ['my-subscription-details'] });
      queryClient.invalidateQueries({ queryKey: ['organization-billing-profile'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to pause subscription');
    },
  });

  // Mutation to resume subscription
  const resumeSubMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/organization-billing-profile/resume-subscription');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription plan resumed successfully.');
      queryClient.invalidateQueries({ queryKey: ['my-subscription-details'] });
      queryClient.invalidateQueries({ queryKey: ['organization-billing-profile'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to resume subscription');
    },
  });



  const isLoading = isLoadingSub || isLoadingPlans;

  const currentPlanName = subDetails?.planName || 'Starter PG Plan';
  const currentPlanPrice = subDetails?.planPrice || 1499;
  const currentCycle = subDetails?.billingCycle || 'MONTHLY';
  const currentStatus = (subDetails?.status || 'ACTIVE').toUpperCase();
  const expiryDate = subDetails?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const daysRemaining = subDetails?.daysRemaining ?? 30;

  const isCancelled = currentStatus.includes('CANCEL');
  const isPaused = currentStatus.includes('PAUS');

  const plansList: any[] = Array.isArray(plansData) 
    ? plansData 
    : (Array.isArray((plansData as any)?.data) ? (plansData as any).data : []);

  const availablePlans = plansList.length > 0
    ? plansList.map((p) => ({
        id: p.id || p.planKey,
        name: p.name,
        badge: (p.planKey || p.name).toUpperCase().includes('PRO') ? 'Most Popular' : ((p.planKey || p.name).toUpperCase().includes('ENTERPRISE') ? 'Enterprise Tier' : 'Starter Tier'),
        popular: (p.planKey || p.name).toUpperCase().includes('PRO'),
        monthlyPrice: p.monthlyPrice,
        annualPrice: p.annualPrice || Math.round(p.monthlyPrice * 10),
        description: p.description || `Includes ${p.maxBeds} beds, ${p.maxProperties} property workspaces, and ${p.maxStaffUsers} staff accounts.`,
        features: [
          `Up to ${p.maxBeds} Beds Capacity`,
          `Up to ${p.maxProperties} Property Workspaces`,
          `Up to ${p.maxStaffUsers} Staff User Accounts`,
          p.allowWhatsApp ? 'Automated WhatsApp Notifications' : 'Standard Email Alerts',
          p.allowCustomBranding ? 'Custom Property Branding & Domain' : 'Standard StayEaze Branding',
          p.allowRazorpayOnline ? 'Razorpay Online Rent Collection' : 'Offline Payment Support',
        ],
      }))
    : [
        {
          id: 'starter',
          name: 'Starter PG Plan',
          badge: 'Starter Tier',
          monthlyPrice: 1499,
          annualPrice: 14390,
          description: 'Ideal for Single-Building Standalone PGs (Up to 15 Rooms / 35 Beds in 2 & 3 sharing, 2 Staff logins).',
          features: [
            'Up to 35 Beds Capacity',
            '1 Property Workspace',
            'Up to 2 Staff Account Logins',
            'Automated Monthly Rent Invoices',
            'Razorpay Online Payment Links',
            'Complaints & Maintenance Hub',
          ],
        },
        {
          id: 'professional',
          name: 'Growth Hostel & PG',
          badge: 'Most Popular',
          popular: true,
          monthlyPrice: 3499,
          annualPrice: 33590,
          description: 'For Multi-Wing Hostels & 2-Branch PGs (Up to 4 Buildings, 50 Rooms / 120 Beds with Meter Engine & Digital Agreements).',
          features: [
            'Up to 120 Beds Capacity',
            'Up to 2 Property Workspaces',
            'Up to 6 Staff Account Logins',
            'Automated WhatsApp Notices & Alerts',
            'Sub-Meter Utility Engine & GST Receipts',
            'Digital KYC & Rental Agreements',
          ],
        },
        {
          id: 'enterprise',
          name: 'Enterprise Living Chain',
          badge: 'Enterprise Tier',
          monthlyPrice: 7999,
          annualPrice: 76790,
          description: 'For Multi-City Co-Living Chains (Unlimited Buildings, 500+ Beds, Bulk Rent Runs, Custom Subdomain & Priority SLA).',
          features: [
            'Up to 500 Beds Capacity (Scalable)',
            'Up to 10 Property Workspaces',
            'Up to 25 Staff Account Logins',
            'White-Label Custom Branding & Portal Domain',
            '1-Click Bulk Monthly Rent Runs',
            'Dedicated Account Manager & Priority SLA',
          ],
        },
      ];

  // Bed usage calculation for capacity progress bar
  const usage = (subDetails as any)?.usage;
  const totalBeds = subDetails?.totalBeds ?? usage?.currentBeds ?? usage?.totalBeds ?? 0;
  const occupiedBeds = subDetails?.occupiedBeds ?? usage?.occupiedBeds ?? 0;
  const maxBeds = subDetails?.maxBeds ?? usage?.maxBeds ?? (currentPlanName.toLowerCase().includes('enterprise') ? 500 : (currentPlanName.toLowerCase().includes('pro') || currentPlanName.toLowerCase().includes('growth')) ? 120 : 35);
  const isUnlimitedBeds = maxBeds >= 99999;
  const bedUsagePercent = isUnlimitedBeds ? 15 : Math.min(100, Math.round((totalBeds / maxBeds) * 100));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-500">Fetching SaaS subscription details from server...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SaaS Subscription & Plan"
        description="Manage your StayEaze property management subscription, track capacity utilization, and upgrade plan limits."
        icon={Sparkles}
      />

      {/* Status Alert Banners */}
      {isPaused && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs">
            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span><strong>Subscription Paused:</strong> Auto-debit billing is currently suspended. Click <strong>Resume Plan</strong> anytime to restore full operations and billing.</span>
          </div>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0" disabled={resumeSubMut.isPending} onClick={() => resumeSubMut.mutate()}>
            {resumeSubMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />} Resume Plan Now
          </Button>
        </div>
      )}

      {isCancelled && (
        <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 flex items-center justify-between gap-3 text-rose-900 dark:text-rose-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span><strong>Mandate Cancelled:</strong> Auto-debit billing is cancelled. Platform access remains active until <strong className="font-mono">{formatDate(expiryDate)}</strong>.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs" disabled={resumeSubMut.isPending} onClick={() => resumeSubMut.mutate()}>
              {resumeSubMut.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1 h-3.5 w-3.5" />} Reactivate / Upgrade Plan
            </Button>
          </div>
        </div>
      )}

      {/* Renewal Warning Banner if <= 7 days */}
      {daysRemaining <= 7 && !isPaused && !isCancelled && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-extrabold text-sm">Subscription Expiring Soon ({daysRemaining} days remaining)</h4>
            <p>
              Your subscription plan will expire on <strong className="font-mono">{formatDate(expiryDate)}</strong>. Please renew or upgrade your plan below to ensure uninterrupted tenant billing and property management access.
            </p>
          </div>
        </div>
      )}

      {/* 90-Day Downgrade Cooldown Alert Banner */}
      {subDetails?.downgradeCooldownActive && (
        <div className="rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 p-4 flex items-start gap-3 text-blue-900 dark:text-blue-200 shadow-xs">
          <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-extrabold text-sm">Plan Downgrade Policy (90-Day Cooldown Active)</h4>
            <p>
              SaaS plan downgrades are locked to once every 3 months (90 days). Your next downgrade eligibility unlocks on{' '}
              <strong className="font-mono">{formatDate(subDetails?.downgradeEligibleAfter)}</strong>. Upgrades and same-plan renewals remain available anytime.
            </p>
          </div>
        </div>
      )}

      {/* Active Subscription Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Zap className="h-3.5 w-3.5 text-amber-400" /> SaaS Subscription
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold ${
                currentStatus === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : currentStatus === 'PAUSED'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : currentStatus === 'TRIAL'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {currentStatus}
              </span>
            </div>

            <div className="flex items-baseline gap-4">
              <h2 className="text-3xl font-black tracking-tight text-white">{currentPlanName}</h2>
              <span className="text-xl font-bold font-mono text-indigo-300">
                {formatCurrency(currentPlanPrice)} <span className="text-xs font-medium text-slate-400">/ {currentCycle.toLowerCase()}</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" /> Next Renewal Date: <strong className="font-mono text-white ml-1">{formatDate(expiryDate)}</strong> ({daysRemaining} days left)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" /> Subscriber Org: <strong className="text-white ml-1">{subDetails?.orgName || 'Subscriber Organization'}</strong>
              </span>
              {subDetails?.paymentId && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Receipt className="h-3.5 w-3.5 text-indigo-400" /> Ref: <span className="font-mono text-slate-300 ml-1">{subDetails.paymentId}</span>
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-4 text-center sm:text-left min-w-[200px]">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Auto-Debit Mandate Status</p>
              <p className={`text-sm font-extrabold flex items-center gap-1 justify-center sm:justify-start mt-1 ${isCancelled ? 'text-rose-400' : isPaused ? 'text-amber-400' : 'text-emerald-400'}`}>
                <ShieldCheck className="h-4 w-4" /> {isCancelled ? 'Mandate Cancelled' : isPaused ? 'Mandate Paused' : 'Auto-Debit Active'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {isPaused && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-white font-semibold"
                    disabled={resumeSubMut.isPending}
                    onClick={() => resumeSubMut.mutate()}
                  >
                    {resumeSubMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />}
                    Resume Auto-Debit &amp; Plan
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-white text-xs"
                    disabled={cancelSubMut.isPending}
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel auto-debit billing? Your access will remain active until the end of the current billing cycle.')) {
                        cancelSubMut.mutate();
                      }
                    }}
                  >
                    {cancelSubMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-rose-400" />}
                    Cancel Auto-Debit
                  </Button>
                </>
              )}

              {isCancelled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-white font-semibold"
                  disabled={resumeSubMut.isPending}
                  onClick={() => resumeSubMut.mutate()}
                >
                  {resumeSubMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />}
                  Reactivate Auto-Debit
                </Button>
              )}

              {!isPaused && !isCancelled && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 hover:text-white"
                    disabled={pauseSubMut.isPending}
                    onClick={() => pauseSubMut.mutate()}
                  >
                    {pauseSubMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Calendar className="mr-1.5 h-3.5 w-3.5 text-amber-400" />}
                    Pause Mandate
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:text-white"
                    disabled={cancelSubMut.isPending}
                    onClick={() => {
                      if (confirm('Are you sure you want to cancel auto-debit billing? Your access will remain active until the end of the current billing cycle.')) {
                        cancelSubMut.mutate();
                      }
                    }}
                  >
                    {cancelSubMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-rose-400" />}
                    Cancel Auto-Debit
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Plan Features & Limits Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Property Portfolio Limit</p>
            <Building2 className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">
            {subDetails?.propertyLimitLabel || (currentPlanName.includes('Enterprise') ? 'Unlimited Properties' : currentPlanName.includes('Professional') ? 'Multi-Property Enabled' : 'Single PG Property')}
          </p>
          <p className="text-xs text-slate-500">Currently managing {subDetails?.propertyCount ?? 1} property.</p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bed Capacity Usage</p>
            <BedDouble className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">
            {totalBeds} <span className="text-xs font-normal text-slate-500">/ {isUnlimitedBeds ? 'Unlimited' : maxBeds} Beds</span>
          </p>
          <div className="space-y-1">
            <Progress value={bedUsagePercent} className="h-1.5 bg-slate-100 dark:bg-slate-800" />
            <p className="text-[11px] text-slate-500 flex justify-between">
              <span>Occupied: {occupiedBeds} beds</span>
              <span>{bedUsagePercent}% utilized</span>
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Support SLA & Priority</p>
            <Info className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white">
            {subDetails?.supportSla || (currentPlanName.includes('Enterprise') ? '24/7 SLA + Account Manager' : currentPlanName.includes('Professional') ? 'Priority Phone & Chat' : 'Standard Email Support')}
          </p>
          <p className="text-xs text-slate-500">Direct technical help for billing & tenants.</p>
        </div>
      </div>

      {/* Choose / Upgrade Plan Section */}
      <div id="plans-selection" className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Available Subscription Plans
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select a plan that fits your property portfolio. Switch between monthly or annual billing.
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                billingCycle === 'MONTHLY'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('ANNUAL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'ANNUAL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">20% OFF</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div id="subscription-plans-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {availablePlans.map((plan) => {
            const price = billingCycle === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice;

            const curLower = currentPlanName.toLowerCase();
            const pLower = plan.name.toLowerCase();
            const pKey = (plan.id || '').toLowerCase();

            const isSameTier =
              curLower === pLower ||
              (curLower.includes('starter') && (pLower.includes('starter') || pKey.includes('starter'))) ||
              ((curLower.includes('pro') || curLower.includes('professional')) && (pLower.includes('pro') || pKey.includes('pro'))) ||
              (curLower.includes('enterprise') && (pLower.includes('enterprise') || pKey.includes('enterprise')));

            const isCurrent = isSameTier && currentCycle === billingCycle;
            const isSameTierDifferentCycle = isSameTier && currentCycle !== billingCycle;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col justify-between transition-all relative ${
                  isCurrent
                    ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-lg ring-2 ring-emerald-500/50'
                    : plan.popular
                    ? 'border-indigo-500 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-md ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                {isCurrent ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-4 py-1 rounded-full shadow flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Active Plan ({currentCycle.toLowerCase()})
                  </div>
                ) : plan.popular ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow">
                    {plan.badge}
                  </div>
                ) : null}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h4>
                    {!plan.popular && !isCurrent && (
                      <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 rounded-md">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 h-10 leading-relaxed">{plan.description}</p>

                  <div className="my-5">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{formatCurrency(price)}</span>
                    <span className="text-xs text-slate-500 font-medium ml-1">/ {billingCycle.toLowerCase()}</span>
                  </div>

                  <ul className="space-y-2.5 mb-6 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  disabled={previewMutation.isPending || upgradePlanMut.isPending}
                  onClick={() => handleInitiatePlanSwitch({ planName: plan.name, planPrice: price, cycle: billingCycle })}
                  className={`w-full font-bold text-xs h-10 ${
                    isCurrent
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-extrabold'
                      : plan.popular
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                      : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900'
                  }`}
                >
                  {previewMutation.isPending && pendingPlan?.planName === plan.name ? (
                    'Calculating Proration...'
                  ) : isCurrent ? (
                    <>
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Renew Active Plan (+{billingCycle === 'ANNUAL' ? '1 Year' : '1 Month'})
                    </>
                  ) : isSameTierDifferentCycle ? (
                    <>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" /> Switch to {billingCycle === 'ANNUAL' ? 'Annual Billing' : 'Monthly Billing'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-300" /> Switch to {plan.name}
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* SaaS Subscription Receipts & Official GST Tax Invoices Card */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-600" /> SaaS Subscription Receipts & Tax Invoices
              </CardTitle>
              <CardDescription>
                View, print, and download official 18% GST tax invoices and payment receipts for your organization's subscription.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              GST Compliant
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingInvoices ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading subscription receipts...
            </div>
          ) : !myInvoicesData || myInvoicesData.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No subscription receipts found for your organization yet.</p>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                disabled={generateInvoiceMut.isPending}
                onClick={() => generateInvoiceMut.mutate()}
              >
                {generateInvoiceMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Receipt className="mr-1.5 h-3.5 w-3.5" />}
                Generate Initial Tax Receipt Now
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                    <TableHead className="font-bold">Invoice #</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Plan</TableHead>
                    <TableHead className="font-bold">Transaction ID</TableHead>
                    <TableHead className="font-bold">Base Rate</TableHead>
                    <TableHead className="font-bold">GST (18%)</TableHead>
                    <TableHead className="font-bold">Total Paid</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold">Tax Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myInvoicesData.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold">{inv.planName}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          {inv.transactionId || ('pay_' + (inv.invoiceNumber || 'txn').toLowerCase().replace(/[^a-z0-9]/g, ''))}
                        </span>
                      </TableCell>
                      <TableCell>₹{(inv.amount || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-muted-foreground">₹{(inv.gstAmount || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="font-extrabold text-indigo-700 dark:text-indigo-400">
                        ₹{(inv.totalAmount || 0).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30 text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> PAID
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            api.get(`/subscription/invoices/${inv.id}/html`, { responseType: 'text' }).then((res) => {
                              setReceiptHtml(res.data);
                            });
                          }}
                          className="border-indigo-600/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5 text-indigo-600" /> View Tax Receipt
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            api.get(`/subscription/invoices/${inv.id}/html`, { responseType: 'text' }).then((res) => {
                              const w = window.open('', '_blank');
                              if (w) { w.document.write(res.data); w.document.close(); w.print(); }
                            });
                          }}
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> Print / Save PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Official Tax Invoice / Receipt Modal Preview */}
      {receiptHtml && (
        <Dialog open={!!receiptHtml} onOpenChange={() => setReceiptHtml(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center pr-6">
                <span className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <Receipt className="h-5 w-5 text-indigo-600" /> Official SaaS GST Tax Invoice & Receipt
                </span>
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => {
                  const w = window.open('', '_blank');
                  if (w) { w.document.write(receiptHtml); w.document.close(); w.print(); }
                }}>
                  <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="border rounded-xl p-2 bg-white" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(receiptHtml) }} />
          </DialogContent>
        </Dialog>
      )}

      {/* Proration Calculation & Switch Summary Dialog */}
      <FormDialog
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        title={previewData?.isUpgrade ? 'Confirm Plan Upgrade & Pay via Razorpay' : 'Confirm Plan Switch (Downgrade Proration)'}
        onSubmit={() => handleUpgradeWithPayment()}
        loading={upgradePlanMut.isPending || paymentInProgress}
        submitLabel={previewData?.isUpgrade ? `Pay ${formatCurrency(previewData?.netPayable || 0)} via Razorpay` : 'Confirm & Extend Plan'}
        size="lg"
      >
        {previewData && (
          <div className="space-y-4">
            <div className="rounded-xl border p-4 bg-muted/20 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Current Active Plan</span>
                <span className="font-semibold">{previewData.currentPlanName} ({formatCurrency(previewData.currentPlanPrice)})</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Cycle Usage Elapsed</span>
                <span className="font-semibold">{previewData.daysUsed} / {previewData.totalCycleDays} Days Used</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Unused Plan Credit Remaining</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 font-mono font-bold">
                  {formatCurrency(previewData.unusedCredit)}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-1 font-bold text-sm pt-1">
                <span>Target Plan</span>
                <span className="text-primary">{previewData.targetPlanName} ({formatCurrency(previewData.targetPlanPrice)} / {previewData.billingCycle.toLowerCase()})</span>
              </div>
            </div>

            {previewData.isUpgrade ? (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Full Target Plan Price</span>
                  <span className="font-mono">{formatCurrency(previewData.targetPlanPrice)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Less Unused Credit Roll-Over</span>
                  <span className="font-mono">- {formatCurrency(previewData.unusedCredit)}</span>
                </div>
                <div className="border-t border-indigo-200 dark:border-indigo-800 pt-2 flex items-center justify-between font-extrabold text-sm text-indigo-700 dark:text-indigo-300">
                  <span>Net Amount Payable Now</span>
                  <span className="text-lg font-mono">{formatCurrency(previewData.netPayable)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  You only pay the prorated difference! Your new subscription cycle resets for 30 days starting today.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                  <span>Net Amount Payable</span>
                  <span className="text-lg font-mono">₹0 (Free Switch)</span>
                </div>
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                  <span>Bonus Days Converted from Unused Credit</span>
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                    +{previewData.extraDays} Extra Days
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1">
                  Your unused credit of {formatCurrency(previewData.unusedCredit)} is automatically converted into {previewData.extraDays} bonus days on the new plan. No extra payment required!
                </p>
              </div>
            )}
          </div>
        )}
      </FormDialog>
      {/* Downgrade Quota Compliance Dialog */}
      {complianceData && (
        <DowngradeComplianceDialog
          open={complianceDialogOpen}
          onOpenChange={setComplianceDialogOpen}
          targetPlanName={complianceData.targetPlanName}
          targetMaxProperties={complianceData.targetMaxProperties}
          targetMaxBeds={complianceData.targetMaxBeds}
          properties={complianceData.properties}
          onComplianceAchieved={() => {
            queryClient.invalidateQueries({ queryKey: ['my-subscription-details'] });
            if (complianceData.pendingVars) {
              previewMutation.mutate(complianceData.pendingVars);
            }
          }}
        />
      )}
      {/* Sandbox Gateway Simulation Modal (Used when live Razorpay keys are unconfigured) */}
      <Dialog open={sandboxModalOpen} onOpenChange={(val) => { if (!val) { setSandboxModalOpen(false); setSandboxPaymentData(null); } }}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Sandbox Payment Gateway
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Live Razorpay Master Keys are not configured in <strong>Super Admin &rarr; System Integrations</strong>. You can simulate a successful transaction for testing or configure keys in the admin panel.
            </DialogDescription>
          </DialogHeader>

          {sandboxPaymentData && (
            <div className="my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Plan Selected</span>
                <span className="font-bold text-slate-900 dark:text-white">{sandboxPaymentData.planName} ({sandboxPaymentData.cycle.toLowerCase()})</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 dark:text-slate-400">Simulated Net Payable</span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-base font-mono">
                  {formatCurrency(sandboxPaymentData.amountFormatted)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 shadow-md gap-2"
              disabled={upgradePlanMut.isPending}
              onClick={() => {
                if (!sandboxPaymentData) return;
                setSandboxModalOpen(false);
                upgradePlanMut.mutate({
                  planName: sandboxPaymentData.planName,
                  planPrice: sandboxPaymentData.planPrice,
                  cycle: sandboxPaymentData.cycle,
                  razorpayPaymentId: 'pay_sandbox_' + Date.now(),
                  razorpayOrderId: 'order_sandbox_' + Date.now(),
                });
              }}
            >
              {upgradePlanMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Activating Plan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Simulate Payment Success & Activate
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white h-9"
              onClick={() => {
                setSandboxModalOpen(false);
                setSandboxPaymentData(null);
                toast.info('Payment simulation cancelled.');
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
