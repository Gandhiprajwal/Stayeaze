import React, { useState, useMemo } from 'react';
import {
  Activity, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Search, Download,
  RefreshCw, Filter, Copy, ExternalLink, Terminal, Eye, LifeBuoy, ArrowUpDown,
  Smartphone, Monitor, Globe, User, Building2, Calendar, CreditCard, ChevronRight,
  Clock, Check, ArrowRight, FileText, AlertCircle, Wrench
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDebounce } from '@/lib/hooks/use-debounce';

export interface UserJourneyEvent {
  id: string;
  orgId?: string;
  orgName?: string;
  orgSubdomain?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  category: 'AUTH' | 'SAAS_BILLING' | 'TENANT_RENT' | 'ONBOARDING' | 'SECURITY' | 'SYSTEM_ERROR';
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING' | 'CRITICAL';
  resourceId?: string;
  amount?: number;
  details?: string;
  clientIp?: string;
  userAgent?: string;
  device?: string;
  createdAt: string;
}

export default function UserJourneyTrackingPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Inspector & Actions Dialogs
  const [inspectEvent, setInspectEvent] = useState<UserJourneyEvent | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<UserJourneyEvent | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [reconcileNotesTouched, setReconcileNotesTouched] = useState<boolean>(false);

  // 1. Fetch KPI Telemetry Stats
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['super-admin-telemetry-stats'],
    queryFn: () => api.get('/super-admin/user-tracking/stats').then((r) => r.data || {}),
    refetchInterval: 15000,
  });

  // 2. Fetch Organizations list for filter dropdown
  const { data: orgsData } = useQuery({
    queryKey: ['telemetry-orgs-minimal'],
    queryFn: () => api.get('/super-admin/subscribers', { params: { pageSize: 100 } }).then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  });
  const organizations = Array.isArray(orgsData) ? orgsData : [];

  // 3. Fetch Top Critical Anomalies
  const { data: anomaliesData } = useQuery({
    queryKey: ['super-admin-telemetry-anomalies'],
    queryFn: () => api.get('/super-admin/user-tracking/anomalies', { params: { limit: 5 } }).then((r) => r.data || []),
    refetchInterval: 10000,
  });
  const anomalies: UserJourneyEvent[] = Array.isArray(anomaliesData) ? anomaliesData : [];

  // 4. Fetch Paginated Events
  const { data: eventsResponse, isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['super-admin-telemetry-events', debouncedSearch, selectedOrgId, categoryFilter, statusFilter, currentPage, pageSize],
    queryFn: () =>
      api
        .get('/super-admin/user-tracking/events', {
          params: {
            page: currentPage,
            pageSize,
            search: debouncedSearch || undefined,
            orgId: selectedOrgId !== 'ALL' ? selectedOrgId : undefined,
            category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
            status: statusFilter !== 'ALL' ? statusFilter : undefined,
          },
        })
        .then((r) => r.data || {}),
    refetchInterval: 10000,
  });

  const events: UserJourneyEvent[] = Array.isArray(eventsResponse?.data)
    ? eventsResponse.data
    : (eventsResponse?.content && Array.isArray(eventsResponse.content) ? eventsResponse.content : []);
  const totalEventsCount = eventsResponse?.total ?? eventsResponse?.totalElements ?? events.length;
  const totalPages = eventsResponse?.totalPages ?? Math.max(1, Math.ceil(totalEventsCount / pageSize));

  // Reconcile Mutation
  const reconcileMutation = useMutation({
    mutationFn: ({ auditId, notes }: { auditId: string; notes: string }) =>
      api.post(`/super-admin/user-tracking/reconcile/${auditId}`, { notes }),
    onSuccess: () => {
      toast.success('Payment transaction reconciled & workspace state synchronized.');
      setReconcileTarget(null);
      setReconcileNotes('');
      queryClient.invalidateQueries({ queryKey: ['super-admin-telemetry-events'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-telemetry-stats'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-telemetry-anomalies'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reconcile transaction.');
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (selectedOrgId !== 'ALL') params.append('orgId', selectedOrgId);
    if (categoryFilter !== 'ALL') params.append('category', categoryFilter);
    if (statusFilter !== 'ALL') params.append('status', statusFilter);
    if (debouncedSearch) params.append('search', debouncedSearch);

    window.open(`/api/v1/super-admin/user-tracking/export?${params.toString()}`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold">SUCCESS</Badge>;
      case 'FAILURE':
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold">FAILURE</Badge>;
      case 'CRITICAL':
        return <Badge className="bg-red-600 text-white font-black animate-pulse">🚨 CRITICAL</Badge>;
      case 'WARNING':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold">WARNING</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'SAAS_BILLING':
        return <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/40 text-[10px] font-bold">SaaS Billing</Badge>;
      case 'TENANT_RENT':
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-[10px] font-bold">Tenant Rent</Badge>;
      case 'AUTH':
        return <Badge variant="outline" className="text-indigo-600 border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-bold">Auth & Security</Badge>;
      case 'ONBOARDING':
        return <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold">Onboarding</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-600 text-[10px]">{category}</Badge>;
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshTelemetry = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['super-admin-telemetry-events'] }),
        queryClient.invalidateQueries({ queryKey: ['super-admin-telemetry-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['super-admin-telemetry-anomalies'] }),
      ]);
      toast.success('Telemetry data refreshed');
    } catch {
      toast.error('Failed to refresh telemetry');
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="User Journey & Payment Telemetry"
        description="Comprehensive real-time audit log of user logins, checkout orders, gateway captures, payment anomalies, and organization traces."
        actions={
          <div className="flex items-center gap-2.5">
            <Button size="sm" variant="outline" onClick={handleExportCsv} className="text-xs h-9 font-medium">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Audit CSV
            </Button>
            <Button
              size="sm"
              onClick={handleRefreshTelemetry}
              disabled={isRefreshing}
              className="text-xs h-9 bg-indigo-600 hover:bg-indigo-700 font-medium"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Telemetry'}
            </Button>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Trace Events</p>
            {loadingStats ? (
              <div className="h-7 w-16 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{statsData?.totalEvents ?? 0}</p>
            )}
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">All organizations</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Failures</p>
            {loadingStats ? (
              <div className="h-7 w-12 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{statsData?.paymentFailures ?? 0}</p>
            )}
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Gateway & checkout errors</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-100 dark:border-rose-900/50 shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Anomalies</p>
            {loadingStats ? (
              <div className="h-7 w-10 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-black text-red-600 mt-1">{statsData?.criticalAnomalies ?? 0}</p>
            )}
            <p className="text-[11px] text-red-600 font-medium mt-0.5">Deducted / Unconfirmed</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 flex items-center justify-center border border-red-100 dark:border-red-900/50 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl p-4 bg-card border shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Auth / Login Failures</p>
            {loadingStats ? (
              <div className="h-7 w-12 rounded-md bg-muted animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{statsData?.authFailures ?? 0}</p>
            )}
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Password & 2FA blocks</p>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/50 shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Critical Anomalies Alert Bar (if any detected) */}
      {anomalies.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5 shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-4 border-b border-red-500/20 bg-red-500/10 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <CardTitle className="text-sm font-bold text-red-700 dark:text-red-400">
                Action Required: {anomalies.length} Critical Transaction Anomalies Detected
              </CardTitle>
            </div>
            <Badge variant="destructive" className="text-xs uppercase font-bold">Immediate Resolution</Badge>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {anomalies.map((ano) => (
              <div key={ano.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs hover:bg-red-500/5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{ano.orgName || 'Workspace'}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{ano.userEmail || 'Customer'}</span>
                    {ano.amount && (
                      <Badge variant="outline" className="font-mono text-emerald-600 font-bold ml-1">
                        {formatCurrency(ano.amount)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-red-600 dark:text-red-400 font-medium">
                    {ano.action}: {ano.resourceId ? `Ref #${ano.resourceId}` : 'Transaction verification error'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 text-xs font-semibold" onClick={() => setInspectEvent(ano)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Inspect
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setReconcileTarget(ano);
                      setReconcileNotes(`Reconciled anomaly #${ano.resourceId || ano.id}`);
                    }}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Re-verify & Resolve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Filter & Search Toolbar */}
      <div className="p-4 rounded-xl bg-card border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Email, Order ID, Payment ID, IP Address, Action..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 text-xs h-9.5 rounded-lg"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground">
                ✕
              </button>
            )}
          </div>

          {/* Organization Selector */}
          <div className="w-full lg:w-72">
            <Select
              value={selectedOrgId}
              onValueChange={(val) => {
                setSelectedOrgId(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9.5 text-xs rounded-lg">
                <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Organizations (Global Feed)</SelectItem>
                {organizations.map((org: any) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name} ({org.subdomain})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category & Status Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Category:
            </span>
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'SAAS_BILLING', label: 'SaaS Billing' },
              { id: 'TENANT_RENT', label: 'Tenant Rent' },
              { id: 'AUTH', label: 'Auth & Logins' },
              { id: 'ONBOARDING', label: 'Onboarding' },
              { id: 'SYSTEM_ERROR', label: 'Errors' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategoryFilter(cat.id);
                  setCurrentPage(1);
                }}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  categoryFilter === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-bold text-muted-foreground uppercase mr-1">Status:</span>
            {[
              { id: 'ALL', label: 'All' },
              { id: 'SUCCESS', label: 'Success' },
              { id: 'FAILURE', label: 'Failed' },
              { id: 'WARNING', label: 'Warnings' },
              { id: 'CRITICAL', label: 'Critical' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setStatusFilter(st.id);
                  setCurrentPage(1);
                }}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === st.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events Data Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        {loadingEvents ? (
          <div className="py-20 text-center text-sm text-muted-foreground space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-600" />
            <p className="font-medium">Streaming telemetry trace logs...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <Terminal className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
            <h3 className="text-base font-bold">No telemetry events found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search || selectedOrgId !== 'ALL' || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'Try resetting the filters or clearing the search query.'
                : 'Activity events will appear here in real-time as users log in and initiate payments.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[180px] text-xs font-bold uppercase">Timestamp</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Organization</TableHead>
                  <TableHead className="text-xs font-bold uppercase">User / Client</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Category</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Action / Event</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Status</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Resource Ref</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Device / IP</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {events.map((ev) => (
                  <TableRow key={ev.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                      {formatDate(ev.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {ev.orgName || 'Global Platform'}
                      </div>
                      {ev.orgSubdomain && (
                        <span className="text-[10px] font-mono text-muted-foreground">{ev.orgSubdomain}.stayeaze.com</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {ev.userEmail || 'Anonymous'}
                      </div>
                      {ev.userRole && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase font-mono">
                          {ev.userRole.replace('ROLE_', '')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getCategoryBadge(ev.category)}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {ev.action}
                      </div>
                      {ev.amount != null && ev.amount > 0 && (
                        <div className="font-mono font-bold text-emerald-600 text-[11px]">
                          {formatCurrency(ev.amount)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(ev.status)}</TableCell>
                    <TableCell>
                      {ev.resourceId ? (
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span className="truncate max-w-[110px]">{ev.resourceId}</span>
                          <button
                            onClick={() => copyToClipboard(ev.resourceId!, 'Resource ID')}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                            title="Copy ID"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                        {ev.device || 'Web Browser'}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">{ev.clientIp || '127.0.0.1'}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setInspectEvent(ev)}
                          title="Inspect JSON Payload & Diagnostics"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(ev.category === 'SAAS_BILLING' || ev.category === 'TENANT_RENT' || ev.status === 'CRITICAL') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px] font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                            onClick={() => {
                              setReconcileTarget(ev);
                              setReconcileNotes(`Verified with gateway by Super Admin`);
                            }}
                            title="Re-verify with Gateway"
                          >
                            Re-verify
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalEventsCount > 0 && (
          <div className="py-3 px-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalEventsCount)} of {totalEventsCount} trace events
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-medium"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs font-bold px-2">Page {currentPage} of {totalPages}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-medium"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* JSON Payload & Diagnostic Inspector Modal */}
      <Dialog open={!!inspectEvent} onOpenChange={(open) => !open && setInspectEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-indigo-600" />
              <DialogTitle className="text-base font-bold">Event Diagnostic Inspector</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Trace ID: <span className="font-mono">{inspectEvent?.id}</span> • {inspectEvent?.createdAt}
            </DialogDescription>
          </DialogHeader>

          {inspectEvent && (
            <div className="space-y-4 my-2 overflow-y-auto pr-1 text-xs">
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Organization</span>
                  <p className="font-semibold">{inspectEvent.orgName || 'N/A'} ({inspectEvent.orgSubdomain || 'public'})</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">User Email / Role</span>
                  <p className="font-semibold">{inspectEvent.userEmail || 'Anonymous'} ({inspectEvent.userRole || 'NONE'})</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Category & Action</span>
                  <p className="font-semibold">{inspectEvent.category} • {inspectEvent.action}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Status</span>
                  <div className="mt-0.5">{getStatusBadge(inspectEvent.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Resource / Transaction Ref</span>
                  <p className="font-mono font-semibold">{inspectEvent.resourceId || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Client Device & IP</span>
                  <p className="font-mono">{inspectEvent.device} ({inspectEvent.clientIp})</p>
                </div>
              </div>

              {/* Raw Details / JSON Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold uppercase text-[10px] text-muted-foreground">Payload & Diagnostic Trace Data</span>
                  {inspectEvent.details && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px]"
                      onClick={() => copyToClipboard(inspectEvent.details!, 'Diagnostics JSON')}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy JSON
                    </Button>
                  )}
                </div>
                <pre className="p-3.5 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 border border-slate-800">
                  {inspectEvent.details ? (
                    (() => {
                      try {
                        return JSON.stringify(JSON.parse(inspectEvent.details), null, 2);
                      } catch {
                        return inspectEvent.details;
                      }
                    })()
                  ) : (
                    <span className="text-slate-500">// No extra payload recorded for this event</span>
                  )}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold"
              onClick={() => {
                if (inspectEvent) {
                  const eventDetail = {
                    title: `[Telemetry Event] ${inspectEvent.action || inspectEvent.category} - ${inspectEvent.orgName || 'Subscriber Org'}`,
                    description: `Telemetry Event Context:\n• Organization: ${inspectEvent.orgName || 'N/A'} (ID: ${inspectEvent.orgId || 'N/A'})\n• User: ${inspectEvent.userEmail || 'N/A'}\n• Category: ${inspectEvent.category}\n• Action: ${inspectEvent.action}\n• Status: ${inspectEvent.status}\n• Resource / Ref ID: ${inspectEvent.resourceId || 'N/A'}\n• IP Address: ${inspectEvent.clientIp || 'N/A'}\n• Timestamp: ${new Date(inspectEvent.createdAt).toLocaleString()}`,
                    category: inspectEvent.category === 'SAAS_BILLING' || inspectEvent.category === 'TENANT_RENT' ? 'PAYMENT_GATEWAY' : 'TECHNICAL_BUG',
                    priority: inspectEvent.status === 'FAILURE' || inspectEvent.status === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
                    contactEmail: inspectEvent.userEmail || '',
                  };
                  window.dispatchEvent(new CustomEvent('open-support-modal', { detail: eventDetail }));
                  setInspectEvent(null);
                  toast.info(`Support ticket modal opened for event #${inspectEvent.resourceId || inspectEvent.id?.slice(0, 8)}`);
                }
              }}
            >
              <LifeBuoy className="mr-1.5 h-3.5 w-3.5 text-indigo-600" /> Create / Link Support Ticket
            </Button>
            <Button size="sm" onClick={() => setInspectEvent(null)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconcile & Verify Gateway Dialog */}
      <Dialog open={!!reconcileTarget} onOpenChange={(open) => !open && setReconcileTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-indigo-600" />
              <DialogTitle className="text-base font-bold">Reconcile & Synchronize Gateway</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Re-verify the transaction status with the payment gateway and update the subscriber workspace state.
            </DialogDescription>
          </DialogHeader>

          {reconcileTarget && (
            <div className="space-y-3 text-xs my-2">
              <div className="p-3 bg-muted/50 rounded-xl space-y-1 border">
                <p><span className="font-semibold text-muted-foreground">Organization:</span> {reconcileTarget.orgName}</p>
                <p><span className="font-semibold text-muted-foreground">Email:</span> {reconcileTarget.userEmail}</p>
                <p><span className="font-semibold text-muted-foreground">Order / Ref ID:</span> <span className="font-mono font-bold">{reconcileTarget.resourceId}</span></p>
                {reconcileTarget.amount && (
                  <p><span className="font-semibold text-muted-foreground">Amount:</span> <span className="font-bold text-emerald-600">{formatCurrency(reconcileTarget.amount)}</span></p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[11px] flex items-center justify-between">
                  <span>
                    Reconciliation Notes & Resolution Summary <span className="text-red-500 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">{reconcileNotes.trim().length} chars</span>
                </label>
                <Input
                  placeholder="e.g. Verified with Razorpay Dashboard, captured payment confirmed."
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  onBlur={() => setReconcileNotesTouched(true)}
                  className={`text-xs h-9 ${reconcileNotesTouched && !reconcileNotes.trim() ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                />
                {reconcileNotesTouched && !reconcileNotes.trim() && (
                  <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Resolution notes are required (minimum 5 characters).
                  </p>
                )}
                {reconcileNotesTouched && reconcileNotes.trim().length > 0 && reconcileNotes.trim().length < 5 && (
                  <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    Please provide at least 5 characters explaining the resolution.
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setReconcileTarget(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-all"
              disabled={reconcileNotes.trim().length < 5 || reconcileMutation.isPending}
              onClick={() => {
                if (reconcileTarget && reconcileNotes.trim().length >= 5) {
                  reconcileMutation.mutate({
                    auditId: reconcileTarget.id,
                    notes: reconcileNotes.trim(),
                  });
                }
              }}
            >
              {reconcileMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Confirm & Mark Reconciled
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
