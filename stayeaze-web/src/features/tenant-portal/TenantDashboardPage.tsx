import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Home, BedDouble, Wifi, Copy, Check, Clock, Phone, AlertCircle,
  Receipt, MessageSquareWarning, UserCheck, ShieldCheck, CreditCard,
  Sparkles, ShieldAlert, ArrowRight, FileText, CheckCircle2, User
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import api from '@/lib/api';
import { RefundAccountCard } from './RefundAccountCard';

export default function TenantDashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [copiedWifi, setCopiedWifi] = useState(false);

  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ['tenant-overview'],
    queryFn: () => api.get('/tenant-portal/overview').then((r) => r.data),
  });

  const { data: invoices } = useQuery({
    queryKey: ['tenant-invoices-recent'],
    queryFn: () => api.get('/tenant-portal/invoices').then((r) => {
      const list = Array.isArray(r.data) ? r.data : (r.data as any).data || [];
      return list.slice(0, 3);
    }),
  });

  const { data: complaints } = useQuery({
    queryKey: ['tenant-complaints-recent'],
    queryFn: () => api.get('/tenant-portal/complaints').then((r) => {
      const list = Array.isArray(r.data) ? r.data : (r.data as any).data || [];
      return list.slice(0, 3);
    }),
  });

  function copyWifiPassword(password: string) {
    navigator.clipboard.writeText(password);
    setCopiedWifi(true);
    setTimeout(() => setCopiedWifi(false), 2000);
    toast.success('Wi-Fi Password copied to clipboard!');
  }

  function handleQuickPay() {
    navigate('/tenant/billing');
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const kycVerified = overview?.kycStatus === 'VERIFIED';
  const pendingAmount = Number(overview?.totalPendingAmount || 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Welcome Back to StayEaze</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Hello, {overview?.firstName || user?.name || 'Resident'}! 👋
            </h1>
            <p className="text-indigo-100 text-sm max-w-xl">
              {overview?.propertyName || 'StayEaze Residency'} • Room {overview?.roomNumber || '101'} • Bed {overview?.bedNumber || 'A'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => navigate('/tenant/billing')}
              className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold shadow-md"
            >
              <Receipt className="mr-1.5 h-4 w-4" /> View Rent & Bills
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/complaints')}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-md"
            >
              <MessageSquareWarning className="mr-1.5 h-4 w-4" /> Raise Complaint
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 h-56 w-56 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>
      </div>

      {/* Onboarding & Check-In Activation Stepper Card if onboarding is incomplete */}
      {!overview?.onboardingComplete && (
        <Card className="border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/50 via-slate-50 to-amber-50/30 dark:from-indigo-950/40 dark:via-slate-900/40 dark:to-amber-950/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-base font-bold">Onboarding & Move-In Checklist</CardTitle>
              </div>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300">
                Action Required
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Complete these initial steps to activate your accommodation access & portal features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Step 1: Lease Agreement */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    {overview?.isAgreementAccepted || overview?.isLeaseSigned ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px]">1</div>
                    )}
                    <span>Rental Agreement</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {overview?.isAgreementAccepted || overview?.isLeaseSigned ? 'Accepted & Signed' : 'Review & E-Sign'}
                  </div>
                </div>
                {!(overview?.isAgreementAccepted || overview?.isLeaseSigned) && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/tenant/documents')} className="text-xs h-7 px-2">
                    Sign <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Step 2: Initial Rent & Deposit */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    {overview?.isInitialPaid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : overview?.isDeskPending ? (
                      <Clock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[10px]">2</div>
                    )}
                    <span>Initial Deposit + Rent</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {overview?.isInitialPaid
                      ? 'Fully Cleared'
                      : overview?.isDeskPending
                      ? 'Awaiting Desk Approval'
                      : `${formatCurrency(pendingAmount)} Due`}
                  </div>
                </div>
                {!overview?.isInitialPaid && (
                  <Button size="sm" onClick={() => navigate('/tenant/billing')} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7 px-2">
                    Pay Online <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Step 3: KYC ID Proof & Staff Approval */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    {kycVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : overview?.kycStatus === 'PENDING' ? (
                      <Clock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-[10px]">3</div>
                    )}
                    <span>KYC Verification</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {kycVerified
                      ? 'Approved by Management'
                      : overview?.kycStatus === 'PENDING'
                      ? 'Under Review (Staff Approval Pending)'
                      : 'Upload Aadhaar / Govt ID'}
                  </div>
                </div>
                {!kycVerified && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/tenant/documents')} className="text-xs h-7 px-2">
                    {overview?.kycStatus === 'PENDING' ? 'View Docs' : 'Upload'} <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3 Main Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. My Room & Living Space */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Living Space</span>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200">
                Active Stay
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold">Room {overview?.roomNumber || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground flex items-center gap-1.5"><BedDouble className="h-4 w-4" /> Bed Number</span>
              <span className="font-semibold">{overview?.bedNumber || 'Single Bed'}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground flex items-center gap-1.5"><Home className="h-4 w-4" /> Property</span>
              <span className="font-semibold truncate max-w-[150px]">{overview?.propertyName || 'StayEaze'}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-4 w-4" /> Gate Closing</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">{overview?.gateClosingTime || '10:30 PM'}</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Rent & Financial Status */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rent & Dues</span>
              <Badge variant={pendingAmount > 0 ? 'destructive' : 'default'}>
                {pendingAmount > 0 ? 'Payment Due' : 'All Clear'}
              </Badge>
            </div>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(Number(overview?.rent || 0))} <span className="text-xs font-normal text-muted-foreground">/ month</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground">Deposit Paid</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(overview?.deposit || 0))}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground">Pending Balance</span>
              <span className={`font-bold ${pendingAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {formatCurrency(pendingAmount)}
              </span>
            </div>
            <div className="pt-1">
              <Button
                onClick={handleQuickPay}
                size="sm"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs"
              >
                <CreditCard className="mr-1.5 h-4 w-4" /> Pay Rent Online
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. Wi-Fi & Quick Contacts */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{overview?.wifiType || 'PROPERTY WI-FI'}</span>
              <Wifi className="h-4 w-4 text-indigo-500" />
            </div>
            <CardTitle className="text-base font-bold truncate">{overview?.wifiSsid || 'StayEaze_HighSpeed'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5 font-mono text-xs">
                <div className="text-[10px] text-muted-foreground uppercase">Password</div>
                <div className="font-bold text-indigo-600 dark:text-cyan-400">{overview?.wifiPassword || 'StayEaze@2026'}</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copyWifiPassword(overview?.wifiPassword || 'StayEaze@2026')}
                className="h-8 px-2 text-xs"
              >
                {copiedWifi ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>

            <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Reception Desk</span>
              <a href={`tel:${overview?.managerPhone || '9876543210'}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                {overview?.managerPhone || '+91 98765 43210'}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Deposit Refund Destination (Self-Service) */}
      <RefundAccountCard depositAmount={Number(overview?.deposit || 10000)} />

      {/* Roommates Card (if any sharing) */}
      {overview?.roommates && overview.roommates.length > 0 && (
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-600" /> My Roommates (Room {overview.roomNumber})
            </CardTitle>
            <CardDescription className="text-xs">Residents currently sharing this room with you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {overview.roommates.map((rm: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                    {rm.name ? rm.name.charAt(0) : 'R'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{rm.name}</div>
                    <div className="text-xs text-muted-foreground">Bed {rm.bedNumber || 'Single'}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom 2 Columns: Invoices & Recent Complaints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recent Invoices */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold">Recent Invoices</CardTitle>
              <CardDescription className="text-xs">Monthly rent and utility charges</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tenant/billing')} className="text-xs">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(!invoices || invoices.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No invoices generated yet.</p>
            ) : (
              invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold font-mono">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-muted-foreground">Due: {formatDate(inv.dueDate)}</div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="text-xs font-bold">{formatCurrency(Number(inv.amountDue || 0))}</div>
                    <Badge variant={inv.status === 'PAID' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Complaints */}
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold">Maintenance Requests</CardTitle>
              <CardDescription className="text-xs">Track your open repair tickets</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/complaints')} className="text-xs">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(!complaints || complaints.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No complaints filed. Everything is running smooth!</p>
            ) : (
              complaints.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold capitalize">{c.category || 'General Issue'}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">{c.description}</div>
                  </div>
                  <Badge variant={c.status === 'RESOLVED' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                    {c.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
