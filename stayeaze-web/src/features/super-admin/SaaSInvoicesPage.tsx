import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Ban,
  AlertCircle,
  TrendingUp,
  Receipt,
  Layers,
  Sparkles,
  Link as LinkIcon,
  Copy,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
} from 'lucide-react';

interface SaaSInvoice {
  id: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  gstAmount: number;
  totalAmount: number;
  status: string;
  billingCycle?: string;
  paymentLink?: string;
  invoiceDate: string;
  dueDate: string;
  organization: {
    id: string;
    name: string;
  };
}

export default function SaaSInvoicesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [fromDate, setFromDate] = useState(searchParams.get('fromDate') || '');
  const [toDate, setToDate] = useState(searchParams.get('toDate') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1);
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('pageSize') || '10', 10) || 10);

  // Sync state changes to URL query parameters
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (page > 1) params.page = String(page);
    if (pageSize !== 10) params.pageSize = String(pageSize);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, statusFilter, fromDate, toDate, page, pageSize, setSearchParams]);

  // Reset page to 1 when search or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, fromDate, toDate]);

  // Invoice Generation Modal State
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [initialStatus, setInitialStatus] = useState('UNPAID');
  const [customAmount, setCustomAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [forceSupplementary, setForceSupplementary] = useState(false);

  // Batch Billing Modal State
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchMonth, setBatchMonth] = useState(String(new Date().getMonth() + 1));
  const [batchYear, setBatchYear] = useState(String(new Date().getFullYear()));
  const [batchDueDateDays, setBatchDueDateDays] = useState('15');
  const [batchStatus, setBatchStatus] = useState('UNPAID');
  const [batchForce, setBatchForce] = useState(false);

  // HTML Preview Modal State
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Fetch Subscribers List for Dropdown
  const { data: subscribersData } = useQuery({
    queryKey: ['super-admin-subscribers-list'],
    queryFn: () => api.get('/super-admin/subscribers?pageSize=100').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const subscribersList = Array.isArray(subscribersData)
    ? subscribersData
    : Array.isArray(subscribersData?.content)
    ? subscribersData.content
    : Array.isArray(subscribersData?.data)
    ? subscribersData.data
    : [];

  // Fetch Financial & GST Ledger Summary Statistics
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['super-admin-invoice-stats'],
    queryFn: () => api.get('/super-admin/invoices/stats').then((r) => r.data),
    refetchInterval: 30000,
  });

  // Duplicate Check for currently selected Organization
  const { data: duplicateCheck } = useQuery({
    queryKey: ['check-duplicate-invoice', selectedOrgId, billingCycle],
    queryFn: () => api.get(`/super-admin/invoices/check-duplicate/${selectedOrgId}?billingCycle=${billingCycle}`).then((r) => r.data),
    enabled: !!selectedOrgId,
  });

  // Fetch Paginated Invoices List (Server-side search, status, date-range, and pagination)
  const { data: invoicesData, isLoading, refetch } = useQuery({
    queryKey: ['super-admin-invoices', debouncedSearch, statusFilter, fromDate, toDate, page, pageSize],
    queryFn: () =>
      api.get('/super-admin/invoices', {
        params: {
          search: debouncedSearch,
          status: statusFilter === 'ALL' ? '' : statusFilter,
          fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
          toDate: toDate ? new Date(toDate + 'T23:59:59.999Z').toISOString() : undefined,
          page,
          pageSize,
        },
      }).then((r) => r.data),
  });

  // Single Invoice Generate Mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      api.post(`/super-admin/invoices/generate/${selectedOrgId}`, {
        customAmount: customAmount ? parseFloat(customAmount) : undefined,
        status: initialStatus,
        billingCycle,
        force: forceSupplementary,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('SaaS Tax Invoice generated successfully!');
      setGenerateOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['super-admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-invoice-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to generate invoice');
    },
  });

  // 1-Click Batch Monthly Billing Run Mutation
  const batchGenerateMutation = useMutation({
    mutationFn: () =>
      api.post('/super-admin/invoices/batch-generate', {
        billingMonth: parseInt(batchMonth, 10),
        billingYear: parseInt(batchYear, 10),
        dueDateDays: parseInt(batchDueDateDays, 10),
        status: batchStatus,
        force: batchForce,
      }),
    onSuccess: (res: any) => {
      const data = res.data || {};
      const count = data.generatedCount ?? 0;
      const skipped = data.skippedCount ?? 0;
      const period = data.period || `${batchMonth}/${batchYear}`;
      const billedStr = data.totalBilledAmount ? ` (Total: ₹${data.totalBilledAmount.toLocaleString('en-IN')})` : '';

      if (count > 0) {
        toast.success(`Batch Billing Run complete for ${period}! Generated ${count} invoice(s)${billedStr}. Skipped: ${skipped}.`);
      } else {
        toast.info(`Billing Run for ${period}: All ${data.totalSubscribers || 0} subscribers already invoiced (Skipped: ${skipped}). Use 'Force Re-issue' if needed.`);
      }
      setBatchOpen(false);
      queryClient.invalidateQueries({ queryKey: ['super-admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-invoice-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Batch generation encountered an error');
    },
  });

  // Status Update Mutation (Mark Paid, Cancel, etc.)
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/super-admin/invoices/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Invoice status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['super-admin-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-invoice-stats'] });
    },
  });

  const resetForm = () => {
    setSelectedOrgId('');
    setBillingCycle('MONTHLY');
    setInitialStatus('UNPAID');
    setCustomAmount('');
    setNotes('');
    setForceSupplementary(false);
  };

  const invoices: SaaSInvoice[] = Array.isArray(invoicesData)
    ? invoicesData
    : Array.isArray(invoicesData?.data)
    ? invoicesData.data
    : Array.isArray(invoicesData?.content)
    ? invoicesData.content
    : [];

  const totalItems = invoicesData?.total ?? invoicesData?.totalElements ?? invoices.length;
  const totalPages = invoicesData?.totalPages ?? Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = invoicesData?.page ?? page;

  const handlePrint = (id: string) => {
    api.get(`/super-admin/invoices/${id}/html`, { responseType: 'text' }).then((res) => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(res.data);
        printWindow.document.close();
        printWindow.print();
      }
    });
  };

  const handlePreview = (id: string) => {
    api.get(`/super-admin/invoices/${id}/html`, { responseType: 'text' }).then((res) => {
      setPreviewHtml(res.data);
    });
  };

  const handleCopyLink = (link?: string) => {
    if (!link) {
      toast.info('No payment link available for this invoice.');
      return;
    }
    navigator.clipboard.writeText(link);
    toast.success('Razorpay Payment Link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Automated SaaS Tax Invoices &amp; B2B Billing
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate, manage, and download official 18% GST tax invoices with duplicate guards and batch automation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setBatchOpen(true)}
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" /> Run Monthly Billing Cycle
          </Button>
          <Button onClick={() => setGenerateOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> Generate SaaS Invoice
          </Button>
        </div>
      </div>

      {/* Top Financial & GST Analytics Ledger Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/75 backdrop-blur-sm border-border/60 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total B2B Revenue
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{(stats?.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {stats?.paidInvoicesCount || 0} paid subscription invoices
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/75 backdrop-blur-sm border-border/60 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              18% GST Output Liability
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{(stats?.totalGstLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">SAC 998314 • CGST 9% + SGST 9%</p>
          </CardContent>
        </Card>

        <Card className="bg-card/75 backdrop-blur-sm border-border/60 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Receivables
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              ₹{(stats?.pendingReceivables || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" /> {stats?.unpaidInvoicesCount || 0} unpaid / overdue renewals
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/75 backdrop-blur-sm border-border/60 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Issued This Month
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats?.invoicesThisMonth || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active billing cycle volume</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Invoices Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice #, organization, plan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                    <SelectItem value="UNPAID">UNPAID</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                    <SelectItem value="OVERDUE">OVERDUE</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  title="Refresh Invoices"
                  onClick={() => {
                    refetch();
                    refetchStats();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Date Range GST Reconciliation Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Invoice Date:
              </span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 text-xs w-[130px]"
                />
                <span>to</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 text-xs w-[130px]"
                />
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="h-8 text-xs px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Clear Dates
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading platform invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No SaaS invoices found matching the selected filters. Click &quot;Generate SaaS Invoice&quot; to create one.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Plan &amp; Cycle</TableHead>
                    <TableHead>Taxable Base</TableHead>
                    <TableHead>18% GST</TableHead>
                    <TableHead>Grand Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium text-xs font-mono">{inv.invoiceNumber}</TableCell>
                      <TableCell className="font-semibold">{inv.organization?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-medium">
                            {inv.planName}
                          </Badge>
                          {inv.billingCycle && (
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                              {inv.billingCycle}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>₹{(inv.amount || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-muted-foreground">₹{(inv.gstAmount || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="font-bold text-foreground">₹{(inv.totalAmount || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        {(() => {
                          const s = (inv.status || '').toUpperCase().trim();
                          if (s === 'PAID') {
                            return (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 font-semibold uppercase tracking-wider text-[11px]">
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-500" /> PAID
                              </Badge>
                            );
                          }
                          if (s === 'UNPAID' || s === 'PENDING') {
                            return (
                              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 font-semibold uppercase tracking-wider text-[11px]">
                                <Clock className="mr-1 h-3.5 w-3.5 text-amber-500" /> {s}
                              </Badge>
                            );
                          }
                          if (s === 'OVERDUE' || s === 'FAILED') {
                            return (
                              <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 font-semibold uppercase tracking-wider text-[11px]">
                                <AlertCircle className="mr-1 h-3.5 w-3.5 text-rose-500" /> {s}
                              </Badge>
                            );
                          }
                          return (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 font-medium uppercase text-[11px]">
                              <Ban className="mr-1 h-3.5 w-3.5" /> {inv.status || 'N/A'}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {inv.paymentLink && (inv.status || '').toUpperCase().trim() !== 'PAID' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Copy Razorpay Payment Link"
                            onClick={() => handleCopyLink(inv.paymentLink)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <LinkIcon className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handlePreview(inv.id)}>
                          View HTML
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handlePrint(inv.id)}>
                          <Printer className="h-3.5 w-3.5 mr-1" /> Print
                        </Button>
                        {(inv.status || '').toUpperCase().trim() !== 'PAID' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            onClick={() => updateStatusMutation.mutate({ id: inv.id, status: 'PAID' })}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Server-Side Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                Showing{' '}
                <span className="font-semibold text-foreground">
                  {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-foreground">
                  {Math.min(currentPage * pageSize, totalItems)}
                </span>{' '}
                of <span className="font-semibold text-foreground">{totalItems}</span> invoices
              </span>
              <div className="flex items-center gap-1.5 ml-4">
                <span className="text-xs">Rows:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
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

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <span className="text-xs font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 px-3"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Single SaaS Invoice Modal with Duplicate Guard & Cycle Selector */}
      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          setGenerateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Generate SaaS Tax Invoice
            </DialogTitle>
            <DialogDescription>
              Create an official B2B tax invoice with automatic 18% GST tax computation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Organization Picker */}
            <div className="space-y-1.5">
              <Label>Select Subscriber Organization *</Label>
              <Select value={selectedOrgId} onValueChange={(val) => {
                setSelectedOrgId(val);
                setForceSupplementary(false);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Organization" />
                </SelectTrigger>
                <SelectContent>
                  {subscribersList.map((sub: any) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.planName || 'Standard'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Real-time Duplicate Invoice Guard Banner */}
            {duplicateCheck?.hasDuplicate && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs space-y-2 text-amber-800 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong>Active Invoice Already Exists:</strong> Invoice{' '}
                    <span className="font-mono font-bold">{duplicateCheck.invoiceNumber}</span> (₹
                    {duplicateCheck.amount}) is already active ({duplicateCheck.status}) for this subscriber in the current billing cycle.
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1 border-t border-amber-500/20">
                  <Checkbox
                    id="force-supplementary"
                    checked={forceSupplementary}
                    onCheckedChange={(checked) => setForceSupplementary(Boolean(checked))}
                  />
                  <label htmlFor="force-supplementary" className="font-semibold cursor-pointer select-none">
                    Force issue an additional supplementary bill
                  </label>
                </div>
              </div>
            )}

            {/* Billing Cycle Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly (1 Mo)</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly (3 Mo - 5% Off)</SelectItem>
                    <SelectItem value="ANNUAL">Annual (12 Mo - 2 Mo Free)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Initial Status Selector */}
              <div className="space-y-1.5">
                <Label>Initial Status</Label>
                <Select value={initialStatus} onValueChange={setInitialStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNPAID">UNPAID (Pending Payment)</SelectItem>
                    <SelectItem value="PAID">PAID (Payment Received)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Amount Override */}
            <div className="space-y-1.5">
              <Label>Custom Base Rate (₹) - Optional</Label>
              <Input
                type="number"
                placeholder="Leave blank to use default plan price"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                18% GST (CGST 9% + SGST 9%) will be calculated on top of this taxable base.
              </p>
            </div>

            {/* Notes / Internal Memo */}
            <div className="space-y-1.5">
              <Label>Internal Billing Memo / Notes (Optional)</Label>
              <Input
                placeholder="e.g. Annual renewal with 5 extra beds add-on"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={
                !selectedOrgId ||
                (duplicateCheck?.hasDuplicate && !forceSupplementary) ||
                generateMutation.isPending
              }
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate Tax Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1-Click Monthly Batch Billing Run Confirmation Dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Run Monthly Billing Cycle
            </DialogTitle>
            <DialogDescription>
              Automatically scan all active SaaS subscribers and issue upcoming monthly renewal invoices for organizations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Billing Month</Label>
                <Select value={batchMonth} onValueChange={setBatchMonth}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {['1:Jan', '2:Feb', '3:Mar', '4:Apr', '5:May', '6:Jun', '7:Jul', '8:Aug', '9:Sep', '10:Oct', '11:Nov', '12:Dec'].map((m) => {
                      const [val, label] = m.split(':');
                      return <SelectItem key={val} value={val} className="text-xs">{label} ({val})</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Billing Year</Label>
                <Select value={batchYear} onValueChange={setBatchYear}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {['2025', '2026', '2027', '2028'].map((y) => (
                      <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Due Window</Label>
                <Select value={batchDueDateDays} onValueChange={setBatchDueDateDays}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5" className="text-xs">5 Days</SelectItem>
                    <SelectItem value="10" className="text-xs">10 Days</SelectItem>
                    <SelectItem value="15" className="text-xs">15 Days (Standard)</SelectItem>
                    <SelectItem value="30" className="text-xs">30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Initial Status</Label>
                <Select value={batchStatus} onValueChange={setBatchStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNPAID" className="text-xs">UNPAID (Standard)</SelectItem>
                    <SelectItem value="PAID" className="text-xs">PAID (Pre-settled)</SelectItem>
                    <SelectItem value="PENDING" className="text-xs">PENDING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="batchForce"
                checked={batchForce}
                onCheckedChange={(c) => setBatchForce(!!c)}
              />
              <Label htmlFor="batchForce" className="text-xs font-medium cursor-pointer">
                Force Re-issue (Allow multiple invoices for same month)
              </Label>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1 text-muted-foreground border">
              <p>• Invoices will be generated in <strong>{batchStatus}</strong> status with a {batchDueDateDays}-day due date.</p>
              <p>• Duplicate prevention is {batchForce ? 'disabled (force mode)' : 'enforced (already billed subscribers are skipped)'}.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => batchGenerateMutation.mutate()}
              disabled={batchGenerateMutation.isPending}
              className="bg-primary hover:bg-primary/90 gap-1.5"
            >
              {batchGenerateMutation.isPending ? (
                <>Processing Billing Run...</>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Execute Batch Run
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HTML Invoice Modal Preview */}
      {previewHtml && (
        <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-between items-center pr-6">
                <span>Official B2B GST Tax Invoice</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const w = window.open('', '_blank');
                    if (w) {
                      w.document.write(previewHtml);
                      w.document.close();
                      w.print();
                    }
                  }}
                >
                  <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="border rounded-md p-2 bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
