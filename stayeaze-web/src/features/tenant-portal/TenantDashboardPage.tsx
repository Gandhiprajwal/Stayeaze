import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Home, BedDouble, Wifi, Copy, Check, Clock, Phone, AlertCircle,
  Receipt, MessageSquareWarning, UserCheck, ShieldCheck, CreditCard,
  Sparkles, ShieldAlert, ArrowRight, FileText, CheckCircle2, User, Wallet
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
    <div className="space-y-6 pb-12 sm:pb-6">
      {/* Top Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900 p-5 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
              <span>Welcome Back to StayEaze</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight">
              Hello, {overview?.firstName || user?.name || 'Resident'}! 👋
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-xl">
              {overview?.propertyName || 'StayEaze Residency'} • Room {overview?.roomNumber || '101'} • Bed {overview?.bedNumber || 'A'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              onClick={() => navigate('/tenant/billing')}
              className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold shadow-md rounded-xl h-10 text-xs sm:text-sm flex-1 md:flex-none"
            >
              <Receipt className="mr-1.5 h-4 w-4" /> View Rent &amp; Bills
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/complaints')}
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-md rounded-xl h-10 text-xs sm:text-sm flex-1 md:flex-none"
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
        <Card className="rounded-2xl border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/50 via-slate-50 to-amber-50/30 dark:from-indigo-950/40 dark:via-slate-900/40 dark:to-amber-950/20 shadow-xs overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <CardTitle className="text-base sm:text-lg font-bold">Onboarding &amp; Move-In Checklist</CardTitle>
              </div>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 text-[10px] font-bold">
                Action Required
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Complete these initial steps to activate your accommodation access &amp; portal features.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Step 1: Lease Agreement */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-2 shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                    {overview?.isAgreementAccepted || overview?.isLeaseSigned ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px] shrink-0">1</div>
                    )}
                    <span className="truncate">Rental Agreement</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {overview?.isAgreementAccepted || overview?.isLeaseSigned ? 'Accepted & Signed' : 'Review & E-Sign'}
                  </div>
                </div>
                {!(overview?.isAgreementAccepted || overview?.isLeaseSigned) && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/tenant/documents')} className="text-xs h-7 px-2 rounded-lg shrink-0">
                    Sign <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Step 2: Initial Rent & Deposit */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-2 shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                    {overview?.isInitialPaid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : overview?.isDeskPending ? (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[10px] shrink-0">2</div>
                    )}
                    <span className="truncate">Deposit + Rent</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {overview?.isInitialPaid
                      ? 'Fully Cleared'
                      : overview?.isDeskPending
                      ? 'Awaiting Desk Approval'
                      : `${formatCurrency(pendingAmount)} Due`}
                  </div>
                </div>
                {!overview?.isInitialPaid && (
                  <Button size="sm" onClick={() => navigate('/tenant/billing')} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7 px-2 rounded-lg shrink-0">
                    Pay <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Step 3: KYC ID Proof & Staff Approval */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-2 shadow-2xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                    {kycVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : overview?.kycStatus === 'PENDING' ? (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center text-[10px] shrink-0">3</div>
                    )}
                    <span className="truncate">KYC Status</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {kycVerified
                      ? 'Approved'
                      : overview?.kycStatus === 'PENDING'
                      ? 'Staff Review Pending'
                      : 'Upload Govt ID'}
                  </div>
                </div>
                {!kycVerified && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/tenant/documents')} className="text-xs h-7 px-2 rounded-lg shrink-0">
                    {overview?.kycStatus === 'PENDING' ? 'Docs' : 'Upload'} <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3 Main Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. My Room & Living Space */}
        <Card className="rounded-2xl shadow-xs border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">My Living Space</span>
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 text-[10px] font-bold">
                Active Stay
              </Badge>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold">Room {overview?.roomNumber || '—'}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-3 text-xs sm:text-sm">
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
        <Card className="rounded-2xl shadow-xs border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Rent &amp; Dues</span>
              <Badge variant={pendingAmount > 0 ? 'destructive' : 'default'} className="text-[10px] font-bold">
                {pendingAmount > 0 ? 'Payment Due' : 'All Clear'}
              </Badge>
            </div>
            <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
              {formatCurrency(Number(overview?.rent || 0))} <span className="text-xs font-normal text-muted-foreground">/ month</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-3 text-xs sm:text-sm">
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground">Deposit Paid</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(Number(overview?.deposit || 0))}</span>
            </div>
            {Number(overview?.advanceBalance || 0) > 0 && (
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-muted-foreground flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                  <Wallet className="h-3.5 w-3.5" /> Advance Rent Credit
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(Number(overview?.advanceBalance || 0))}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-muted-foreground">Pending Balance</span>
              <span className={`font-bold font-mono ${pendingAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                {formatCurrency(pendingAmount)}
              </span>
            </div>
            <div className="pt-1">
              <Button
                onClick={handleQuickPay}
                size="sm"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs rounded-xl h-9.5 text-xs"
              >
                <CreditCard className="mr-1.5 h-4 w-4" /> Pay Rent Online
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. Wi-Fi & Quick Contacts */}
        <Card className="rounded-2xl shadow-xs border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">{overview?.wifiType || 'PROPERTY WI-FI'}</span>
                {overview?.wifiType?.includes('ROOM') ? (
                  <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 text-[9px] px-1.5 py-0 font-bold">
                    ROOM ROUTER
                  </Badge>
                ) : overview?.wifiType?.includes('FLOOR') ? (
                  <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 text-[9px] px-1.5 py-0 font-bold">
                    FLOOR WI-FI
                  </Badge>
                ) : overview?.wifiType?.includes('BUILDING') ? (
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[9px] px-1.5 py-0 font-bold">
                    BUILDING WI-FI
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold">
                    PROPERTY DEFAULT
                  </Badge>
                )}
              </div>
              <Wifi className="h-4 w-4 text-indigo-500 shrink-0" />
            </div>
            <CardTitle className="text-base sm:text-lg font-bold truncate mt-1">{overview?.wifiSsid || 'Front Desk Wi-Fi'}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-3 text-xs sm:text-sm">
            <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5 font-mono text-xs">
                <div className="text-[10px] text-muted-foreground uppercase">Password</div>
                <div className="font-bold text-indigo-600 dark:text-cyan-400">{overview?.wifiPassword || 'Ask Reception'}</div>
              </div>
              {overview?.wifiPassword ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => copyWifiPassword(overview.wifiPassword)}
                  className="h-8 px-2 text-xs rounded-lg"
                  title="Copy Wi-Fi password"
                >
                  {copiedWifi ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              ) : null}
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
        <Card className="rounded-2xl shadow-xs border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-600" /> My Roommates (Room {overview.roomNumber})
            </CardTitle>
            <CardDescription className="text-xs">Residents currently sharing this room with you</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Recent Invoices */}
        <Card className="rounded-2xl shadow-xs border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">Recent Invoices</CardTitle>
              <CardDescription className="text-xs">Monthly rent and utility charges</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tenant/billing')} className="text-xs rounded-xl h-8">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-2.5">
            {(!invoices || invoices.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No invoices generated yet.</p>
            ) : (
              invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold font-mono">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-muted-foreground">Due: {formatDate(inv.dueDate)}</div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="text-xs font-bold font-mono">{formatCurrency(Number(inv.amountDue || 0))}</div>
                    <Badge variant={inv.status === 'PAID' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 font-bold">
                      {inv.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Complaints */}
        <Card className="rounded-2xl shadow-xs border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold">Maintenance Requests</CardTitle>
              <CardDescription className="text-xs">Track your open repair tickets</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/complaints')} className="text-xs rounded-xl h-8">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-2.5">
            {(!complaints || complaints.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No complaints filed. Everything is running smooth!</p>
            ) : (
              complaints.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold capitalize">{c.category || 'General Issue'}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">{c.description}</div>
                  </div>
                  <Badge variant={c.status === 'RESOLVED' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0 font-bold">
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
