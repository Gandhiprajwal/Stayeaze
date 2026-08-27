import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Search,
  Mail,
  Phone,
  Building2,
  Send,
  FileText,
  StickyNote,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/format';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { useAuthStore } from '@/lib/stores/auth-store';
import api from '@/lib/api';

export default function SuperAdminLeadsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1);
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('pageSize') || '10', 10) || 10);

  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [leadToConvert, setLeadToConvert] = useState<any | null>(null);
  const [noteText, setNoteText] = useState('');

  // Sync state to URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
    if (page > 1) params.page = String(page);
    if (pageSize !== 10) params.pageSize = String(pageSize);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, statusFilter, page, pageSize, setSearchParams]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // Server-side paginated query
  const { data: leadsData, isLoading, refetch } = useQuery({
    queryKey: ['super-admin', 'leads', debouncedSearch, statusFilter, page, pageSize],
    queryFn: () =>
      api.get<any>('/super-admin/leads', {
        params: {
          search: debouncedSearch,
          status: statusFilter === 'ALL' ? '' : statusFilter,
          page,
          pageSize,
        },
      }).then((r) => r.data),
    refetchInterval: 15000,
  });

  const leads = Array.isArray(leadsData)
    ? leadsData
    : Array.isArray(leadsData?.data)
    ? leadsData.data
    : Array.isArray(leadsData?.content)
    ? leadsData.content
    : [];

  const totalItems = leadsData?.total ?? leadsData?.totalElements ?? leads.length;
  const totalPages = leadsData?.totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = leadsData?.page ?? page;

  // Sync Leads from Properties Mutation
  const syncPropertiesMutation = useMutation({
    mutationFn: () => api.post('/super-admin/leads/sync-from-properties'),
    onSuccess: (resp: any) => {
      toast.success(resp.data?.message || 'Leads synced successfully from properties!');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] });
    },
    onError: () => {
      toast.error('Failed to sync leads from properties.');
    },
  });

  const resendInvoiceMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/leads/${id}/resend-invoice`),
    onSuccess: (resp: any) => {
      toast.success(resp.data?.message || 'Onboarding invoice email resent successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] });
    },
    onError: () => {
      toast.error('Failed to resend onboarding invoice.');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, paymentStatus }: { id: string; status: string; paymentStatus: string }) =>
      api.put(`/super-admin/leads/${id}/status`, { status, paymentStatus }),
    onSuccess: () => {
      toast.success('Lead status updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] });
    },
    onError: () => {
      toast.error('Failed to update lead status.');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/super-admin/leads/${id}/notes`, { note }),
    onSuccess: () => {
      toast.success('Sales call note saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] });
      setNoteText('');
      setSelectedLead(null);
    },
    onError: () => {
      toast.error('Failed to save sales note.');
    },
  });

  const convertToSubscriberMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/leads/${id}/convert-to-subscriber`),
    onSuccess: (resp: any) => {
      toast.success(resp.data?.message || 'Lead successfully converted to Active Subscriber!');
      setLeadToConvert(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to convert lead to subscriber.');
    },
  });

  const sendVipInviteMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/leads/${id}/send-vip-invite`),
    onSuccess: (resp: any) => {
      toast.success(resp.data?.message || 'VIP Invite pass dispatched successfully!');
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'leads'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send VIP invite pass.');
    },
  });

  // Server-side Aggregated Leads Stats Query
  const { data: leadStats } = useQuery<any>({
    queryKey: ['super-admin-leads-stats'],
    queryFn: () => api.get('/super-admin/leads/stats').then((r) => r.data),
    staleTime: 30000,
  });

  const pendingPaymentCount = leadStats?.pendingPaymentLeads ?? leads.filter((l: any) => l.paymentStatus === 'UNPAID').length;
  const failedOnboardingCount = leadStats?.failedOnboardingLeads ?? leads.filter((l: any) => l.status === 'FAILED_ONBOARDING').length;
  const convertedCount = leadStats?.convertedLeads ?? leads.filter((l: any) => l.paymentStatus === 'COMPLETED').length;

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Super Admin - Property Onboarding Leads"
          description="Track property registration leads, unpaid onboarding drop-offs, and registration error alerts."
        />
        <Button
          variant="outline"
          onClick={() => syncPropertiesMutation.mutate()}
          disabled={syncPropertiesMutation.isPending}
          className="border-primary/30 text-primary hover:bg-primary/10 w-full sm:w-auto shrink-0 rounded-xl h-10 text-xs font-semibold"
        >
          <Sparkles className="mr-2 h-4 w-4 text-primary" />
          {syncPropertiesMutation.isPending ? 'Syncing...' : 'Sync From Properties'}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Unpaid Registration Leads" value={pendingPaymentCount} icon={Clock} accent="warning" hint="Awaiting onboarding fee payment" />
        <StatCard label="Failed Onboarding Errors" value={failedOnboardingCount} icon={ShieldAlert} accent="destructive" hint="Registrations with errors" />
        <StatCard label="Converted Active Subscriptions" value={convertedCount} icon={CheckCircle2} accent="success" hint="Paid & fully onboarded properties" />
      </div>

      <Card className="rounded-2xl shadow-xs overflow-hidden">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> Onboarding Pipeline Leads
              </CardTitle>
              <CardDescription>Real-time property owner signups &amp; payment statuses</CardDescription>
            </div>
            <div className="flex items-center flex-wrap sm:flex-nowrap gap-2.5 w-full lg:w-auto">
              <div className="relative w-full sm:w-64 md:w-72 lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Owner, Property, or Email..."
                  className="pl-9 text-xs rounded-xl h-10 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-none">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] text-xs rounded-xl h-10">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="PENDING_PAYMENT">PENDING_PAYMENT</SelectItem>
                    <SelectItem value="DEMO_REQUESTED">DEMO_REQUESTED</SelectItem>
                    <SelectItem value="INVITE_SENT">INVITE_SENT</SelectItem>
                    <SelectItem value="INVITE_REQUESTED">INVITE_REQUESTED</SelectItem>
                    <SelectItem value="FAILED_ONBOARDING">FAILED_ONBOARDING</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                    <SelectItem value="CONVERTED">CONVERTED</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl h-10 w-10 shrink-0"
                  title="Refresh Leads"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <>
              {/* Mobile View: High-Density Responsive Breakdown Cards */}
              <div className="block md:hidden space-y-3.5">
                {leads.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-muted/20">
                    No property onboarding leads found matching the selected filters.
                  </div>
                ) : (
                  leads.map((lead: any) => (
                    <div key={lead.id} className="p-4 rounded-2xl border bg-card shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground truncate">{lead.propertyName}</h4>
                          <span className="font-mono text-[11px] text-muted-foreground">{lead.propertyCode || 'No Code'}</span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          lead.paymentStatus === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {lead.paymentStatus}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-muted/40 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{lead.ownerName}</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(lead.onboardingFee ?? 2999)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{lead.ownerEmail}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div>
                          {lead.status === 'CONVERTED' ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[10px] font-bold">
                              ✓ Active Subscriber
                            </Badge>
                          ) : lead.status === 'INVITE_REQUESTED' ? (
                            <Badge className="bg-purple-500/10 text-purple-600 border border-purple-500/30 text-[10px] font-bold">
                              VIP Requested
                            </Badge>
                          ) : lead.status === 'INVITE_SENT' ? (
                            <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/30 text-[10px] font-bold">
                              VIP Code Sent
                            </Badge>
                          ) : lead.status === 'DEMO_REQUESTED' ? (
                            <Badge className="bg-indigo-500/10 text-indigo-600 border border-indigo-500/30 text-[10px] font-bold">
                              Demo Lead
                            </Badge>
                          ) : lead.status === 'FAILED_ONBOARDING' ? (
                            <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[10px] font-bold">
                              Failed Dropoff
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {lead.status || 'PENDING'}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{formatDate(lead.createdAt)}</span>
                      </div>

                      {lead.salesNotes && (
                        <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                          <StickyNote className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{lead.salesNotes}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 flex-wrap">
                        {(lead.status || '').toUpperCase() === 'CONVERTED' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 w-full justify-center">
                            <CheckCircle2 className="h-4 w-4" /> Workspace Active
                          </span>
                        ) : (
                          <>
                            {isSuperAdmin && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8.5 px-3 rounded-xl shadow-xs font-bold gap-1 flex-1 min-w-[110px]"
                                title="Convert Lead into Active Organization"
                                onClick={() => setLeadToConvert(lead)}
                              >
                                <UserCheck className="h-3.5 w-3.5" /> Convert
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8.5 px-3 text-xs font-semibold rounded-xl border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-50 gap-1 flex-1 min-w-[100px]"
                              title="Log Sales Note"
                              onClick={() => setSelectedLead(lead)}
                            >
                              <StickyNote className="h-3.5 w-3.5 text-amber-600" /> Log Note
                            </Button>

                            {isSuperAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8.5 px-2.5 text-xs rounded-xl border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300 hover:bg-purple-50 gap-1"
                                title="Send VIP Passcode"
                                onClick={() => sendVipInviteMutation.mutate(lead.id)}
                                disabled={sendVipInviteMutation.isPending}
                              >
                                <Sparkles className="h-3.5 w-3.5 text-purple-600" /> VIP
                              </Button>
                            )}

                            {isSuperAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8.5 w-8.5 p-0 rounded-xl"
                                title="Resend Registration Email"
                                onClick={() => resendInvoiceMutation.mutate(lead.id)}
                                disabled={resendInvoiceMutation.isPending}
                              >
                                <Send className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop View: Full 9-Column Tabular View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property Code</TableHead>
                      <TableHead>Property Name</TableHead>
                      <TableHead>Owner Details</TableHead>
                      <TableHead>Lead Status</TableHead>
                      <TableHead>Sales Notes</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead className="text-right">Fee (₹)</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.length > 0 ? (
                      leads.map((lead: any) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-mono text-xs font-semibold">{lead.propertyCode || 'N/A'}</TableCell>
                          <TableCell className="font-medium text-xs">{lead.propertyName}</TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold">{lead.ownerName}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {lead.ownerEmail}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.status === 'CONVERTED' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[10px] font-bold whitespace-nowrap">
                                ✓ Active Subscriber
                              </Badge>
                            ) : lead.status === 'INVITE_REQUESTED' ? (
                              <Badge className="bg-purple-500/10 text-purple-600 border border-purple-500/30 text-[10px] font-bold whitespace-nowrap">
                                VIP Requested
                              </Badge>
                            ) : lead.status === 'INVITE_SENT' ? (
                              <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/30 text-[10px] font-bold whitespace-nowrap">
                                VIP Code Sent
                              </Badge>
                            ) : lead.status === 'DEMO_REQUESTED' ? (
                              <Badge className="bg-indigo-500/10 text-indigo-600 border border-indigo-500/30 text-[10px] font-bold whitespace-nowrap">
                                Demo Lead
                              </Badge>
                            ) : lead.status === 'FAILED_ONBOARDING' ? (
                              <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/30 text-[10px] font-bold whitespace-nowrap">
                                Failed Dropoff
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-medium whitespace-nowrap">
                                {lead.status || 'PENDING'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={lead.salesNotes}>
                              {lead.salesNotes ? (
                                <span className="flex items-center gap-1 font-mono text-[11px] text-foreground">
                                  <StickyNote className="h-3 w-3 text-amber-500 shrink-0" />
                                  {lead.salesNotes.split('\n')[0]}
                                </span>
                              ) : (
                                <span className="italic text-[10px]">No notes</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              lead.paymentStatus === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                            }`}>
                              {lead.paymentStatus}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs">{formatCurrency(lead.onboardingFee ?? 2999)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            {(lead.status || '').toUpperCase() === 'CONVERTED' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Workspace Active
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {isSuperAdmin && (
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5 shadow-xs font-bold gap-1"
                                    title="Convert Lead into Active Organization & Workspace"
                                    onClick={() => setLeadToConvert(lead)}
                                  >
                                    <UserCheck className="h-3.5 w-3.5" /> Convert
                                  </Button>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs font-semibold border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 gap-1"
                                  title="Log Sales Call / Follow-up Note"
                                  onClick={() => setSelectedLead(lead)}
                                >
                                  <StickyNote className="h-3.5 w-3.5 text-amber-600" /> Log Note
                                </Button>

                                {isSuperAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 gap-1"
                                    title="Send VIP Fast-Track Passcode"
                                    onClick={() => sendVipInviteMutation.mutate(lead.id)}
                                    disabled={sendVipInviteMutation.isPending}
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-purple-600" /> VIP Code
                                  </Button>
                                )}

                                {isSuperAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2"
                                    title="Resend Invoice / Registration Email"
                                    onClick={() => resendInvoiceMutation.mutate(lead.id)}
                                    disabled={resendInvoiceMutation.isPending}
                                  >
                                    <Send className="h-3.5 w-3.5 text-blue-600" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">
                          No property onboarding leads found matching the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Server-Side Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4 text-xs sm:text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4 text-center sm:text-left">
              <span>
                Showing{' '}
                <span className="font-semibold text-foreground">
                  {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-foreground">
                  {Math.min(currentPage * pageSize, totalItems)}
                </span>{' '}
                of <span className="font-semibold text-foreground">{totalItems}</span> leads
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">Rows:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px] rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 rounded-xl text-xs flex-1 sm:flex-none"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <span className="text-xs font-medium px-2 shrink-0">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-3 rounded-xl text-xs flex-1 sm:flex-none"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Sales Call Note Modal */}
      <Dialog open={!!selectedLead} onOpenChange={(o) => !o && setSelectedLead(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <StickyNote className="h-5 w-5 text-amber-500 shrink-0" /> Log Sales Note for {selectedLead?.propertyName}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Owner: {selectedLead?.ownerName} ({selectedLead?.ownerEmail})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedLead?.salesNotes && (
              <div className="p-3 rounded-xl bg-muted/50 border text-xs max-h-36 overflow-y-auto space-y-1 font-mono">
                <p className="font-semibold text-foreground mb-1">Previous Notes:</p>
                <pre className="whitespace-pre-wrap font-sans text-muted-foreground text-[11px]">{selectedLead.salesNotes}</pre>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold">New Call Note / Activity</label>
              <Textarea
                placeholder="Spoke with property owner, promised payment by 6 PM..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="rounded-xl text-xs sm:text-sm"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t">
            <Button variant="outline" className="rounded-xl h-10 w-full sm:w-auto text-xs" onClick={() => setSelectedLead(null)}>Cancel</Button>
            <Button
              className="rounded-xl h-10 w-full sm:w-auto text-xs font-bold"
              onClick={() =>
                addNoteMutation.mutate({
                  id: selectedLead.id,
                  note: noteText,
                })
              }
              disabled={addNoteMutation.isPending || !noteText.trim()}
            >
              {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Security & Permission Confirmation Dialog for Provisioning Lead */}
      <Dialog open={!!leadToConvert} onOpenChange={(open) => !open && setLeadToConvert(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-5 w-5 shrink-0" />
              <DialogTitle className="text-base sm:text-lg">Convert Lead to Active SaaS Organization?</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Confirm applicant details before executing live workspace provisioning.
            </DialogDescription>
          </DialogHeader>

          {leadToConvert && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-xl border p-3.5 bg-muted/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Property / Org:</span>
                  <span className="font-bold text-foreground truncate max-w-[180px] sm:max-w-[220px]" title={leadToConvert.propertyName}>{leadToConvert.propertyName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Owner Contact:</span>
                  <span className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-[220px]">{leadToConvert.ownerName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Owner Email:</span>
                  <span className="font-mono text-foreground truncate max-w-[180px] sm:max-w-[220px]" title={leadToConvert.ownerEmail}>{leadToConvert.ownerEmail}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Mobile Phone:</span>
                  <span className="font-mono text-foreground">{leadToConvert.ownerPhone || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Assigned Subdomain:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold truncate max-w-[180px] sm:max-w-[220px]" title={`${leadToConvert.propertyName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'org'}.stayeaze.com`}>
                    {leadToConvert.propertyName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'org'}.stayeaze.com
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  <strong>Sensitive Operation:</strong> This action provisions the Organization in database, activates the Owner credentials, creates the initial Property master record, sets the 30-day billing cycle, and dispatches the welcome onboarding email.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t">
            <Button
              variant="outline"
              className="rounded-xl h-10 w-full sm:w-auto text-xs"
              onClick={() => setLeadToConvert(null)}
              disabled={convertToSubscriberMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl h-10 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
              onClick={() => leadToConvert && convertToSubscriberMutation.mutate(leadToConvert.id)}
              disabled={convertToSubscriberMutation.isPending}
            >
              {convertToSubscriberMutation.isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Provisioning Workspace...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm &amp; Provision
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
