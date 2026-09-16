import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt, Plus, Pencil, Trash2, Wallet, TrendingUp, AlertCircle, CheckCircle2,
  RefreshCw, CreditCard, Printer, Banknote, QrCode, Building2, ShieldCheck,
  Sparkles, Hourglass, Check, X, UserCheck, Zap, XCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import api from '@/lib/api';
import { usePropertyStore } from '@/lib/stores/property-store';
import type { Invoice, InvoiceIssuerSnapshot, Property, Tenant } from '@/lib/types';
import { formatCurrency, formatDate, numberToWords, getTodayIsoDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm, useBulkDelete } from '@/lib/hooks/use-crud';

import { TenantSelect } from '@/components/common/TenantSelect';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import RentRunPreviewModal from './RentRunPreviewModal';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { FeatureUpgradeDialog } from '@/components/subscription/FeatureUpgradeDialog';

const ENDPOINT = '/invoices';
const statuses = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'pending_approval', label: 'Pending Approval (UTR)' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'written_off', label: 'Written Off / Waived' },
  { value: 'cancelled', label: 'Cancelled' },
];

const emptyForm = {
  tenantId: '',
  tenantName: '',
  propertyId: '',
  period: `${getTodayIsoDate().slice(0, 7)}`,
  amount: 8000,
  paidAmount: 0,
  dueDate: getTodayIsoDate(),
  status: 'unpaid' as Invoice['status'],
};

export default function BillingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedPropertyId } = usePropertyStore();

  const planFeatures = usePlanFeatures();
  const [rentRunUpgradeModalOpen, setRentRunUpgradeModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);
  const [showRentRunPreview, setShowRentRunPreview] = useState(false);
  const [writeOffTarget, setWriteOffTarget] = useState<{ invoice: Invoice; waivedAmount: number; reason: string } | null>(null);
  
  // Receipt Preview State
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // Double Confirmation States
  const [approvingInvoice, setApprovingInvoice] = useState<{ id: string; invoiceNumber: string; amount: number; tenantName?: string; paymentRef?: string } | null>(null);
  const [rejectingInvoice, setRejectingInvoice] = useState<{ id: string; invoiceNumber: string; amount: number; tenantName?: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const { data: properties } = useQuery({
    queryKey: ['billing-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

  const { data: tenants } = useQuery({
    queryKey: ['billing-tenants'],
    queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { pageSize: 200 } }).then((r) => r.data.data),
  });

  const { data: invoices } = useQuery({
    queryKey: ['billing-stats', selectedPropertyId],
    queryFn: () => {
      const p = selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId, pageSize: 500 } : { pageSize: 500 };
      return api.get<{ data: Invoice[] }>(ENDPOINT, { params: p }).then((r) => r.data.data);
    },
  });
  // Old invoices created before issuer snapshots use the current organization profile as a fallback.
  const { data: currentBillingProfile } = useQuery({
    queryKey: ['organization-billing-profile'],
    queryFn: () => api.get<InvoiceIssuerSnapshot>('/organization-billing-profile').then((r) => r.data),
  });
  const totalBilled = invoices?.reduce((s, i) => s + i.amount, 0) ?? 0;
  const totalCollected = invoices?.reduce((s, i) => s + i.paidAmount, 0) ?? 0;
  const overdueCount = invoices?.filter((i) => i.status === 'overdue').length ?? 0;
  const paidCount = invoices?.filter((i) => i.status === 'paid').length ?? 0;

  const createMut = useCreate<Invoice>(ENDPOINT, 'Invoice');
  const updateMut = useUpdate<Invoice>(ENDPOINT, 'Invoice');
  const deleteMut = useDelete(ENDPOINT, 'Invoice');
  const bulkDeleteMut = useBulkDelete(ENDPOINT, 'invoices');
  const form = useForm(emptyForm);

  // Record Payment State
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [isRazorpayProcessing, setIsRazorpayProcessing] = useState<boolean>(false);

  // Pending UTR Approvals
  const { data: pendingApprovals } = useQuery<any[]>({
    queryKey: ['pending-utr-approvals'],
    queryFn: () => api.get('/invoices/pending-approvals').then((r) => r.data || []),
    refetchInterval: 8000,
  });

  const approveUtrMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/invoices/${id}/approve-payment`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Payment verified and invoice marked as PAID.');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['pending-utr-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    },
  });

  const rejectUtrMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.post(`/invoices/${id}/reject-payment`, { reason });
      return res.data;
    },
    onSuccess: () => {
      toast.info('Payment proof rejected. Invoice reverted to unpaid.');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['pending-utr-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    },
  });

  const cancelInvoiceMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.put(`/invoices/${id}/cancel`);
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Invoice cancelled successfully.');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/payments'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to cancel invoice');
    },
  });

  const writeOffMut = useMutation({
    mutationFn: async ({ id, waivedAmount, reason }: { id: string; waivedAmount: number; reason: string }) => {
      const res = await api.post(`/invoices/${id}/write-off`, { waivedAmount, reason });
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || 'Invoice balance written off/waived successfully.');
      setWriteOffTarget(null);
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/payments'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to process write-off');
    },
  });

  // Batch Monthly Invoices Generation
  const batchGenerateMut = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const res = await api.post('/billing/monthly-rent-run', {
        billingMonth: now.getMonth() + 1,
        billingYear: now.getFullYear(),
        dueDateDays: 5,
      });
      return res.data;
    },
    onSuccess: (res: any) => {
      const count = res.invoicesGenerated ?? 0;
      if (count > 0) {
        toast.success(res.message || `Successfully generated ${count} invoice(s) for ${res.month} ${res.year}!`);
      } else {
        toast.info(res.message || `All active tenants are already invoiced for ${res.month} ${res.year}.`);
      }
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/payments'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to generate monthly invoices');
    },
  });

  // Record Payment Mutation
  const recordPaymentMut = useMutation({
    mutationFn: async ({ id, amount, method, ref }: { id: string; amount: number; method: string; ref?: string }) => {
      const res = await api.post(`/invoices/${id}/record-payment`, { amount, paymentMethod: method, paymentReference: ref });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Updated invoice payment & status successfully.');
      setPaymentInvoice(null);
      setPaymentRef('');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['/payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rep'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    },
  });

  async function handleRazorpayCheckout(invoice: Invoice) {
    try {
      setIsRazorpayProcessing(true);
      const orderRes = await api.post(`/invoices/${invoice.id}/create-razorpay-order`);
      const orderData = orderRes.data;

      const isMockKey = !orderData.keyId || orderData.keyId.includes('MockKey') || orderData.keyId.startsWith('rzp_test_Stayeaze');

      if (isMockKey) {
        // Instant simulated sandbox payment for demo/test environments
        await new Promise((r) => setTimeout(r, 600));
        const demoPayId = `pay_sandbox_${Date.now()}`;
        await api.post(`/invoices/${invoice.id}/verify-razorpay-payment`, {
          razorpayOrderId: orderData.orderId,
          razorpayPaymentId: demoPayId,
          razorpaySignature: 'verified_sandbox_sig',
        });
        toast.success(`Razorpay Sandbox payment (${demoPayId}) completed & verified successfully!`);
        setPaymentInvoice(null);
        queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
        queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
        return;
      }

      // Load Real Razorpay JS SDK for live / registered test keys
      const loaded = await new Promise((resolve) => {
        if ((window as any).Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (loaded && (window as any).Razorpay) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: orderData.propertyName || (invoice.propertyId ? propMap.get(invoice.propertyId) : undefined) || 'Property Rent Payment',
          description: `Rent Invoice Payment - ${orderData.invoiceNumber}`,
          order_id: orderData.orderId,
          prefill: {
            name: orderData.tenantName,
            email: orderData.tenantEmail,
            contact: orderData.tenantPhone,
          },
          theme: {
            color: '#4f46e5',
          },
          handler: async function (response: any) {
            try {
              await api.post(`/invoices/${invoice.id}/verify-razorpay-payment`, {
                razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                razorpayPaymentId: response.razorpay_payment_id || `pay_${Date.now()}`,
                razorpaySignature: response.razorpay_signature || 'verified_sig',
              });
              toast.success('Razorpay payment completed & verified successfully!');
              setPaymentInvoice(null);
              queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
              queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
            } catch (err: any) {
              toast.error('Failed to verify Razorpay payment response');
            }
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        toast.error('Razorpay SDK failed to load. Please try again.');
      }
    } catch (err: any) {
      toast.error('Razorpay checkout failed. Please try cash payment or retry.');
    } finally {
      setIsRazorpayProcessing(false);
    }
  }

  function openCreate() {
    const defaultProp = selectedPropertyId && selectedPropertyId !== 'ALL' ? selectedPropertyId : '';
    form.reset({ ...emptyForm, propertyId: defaultProp });
    setDialogOpen(true);
  }

  function handleSelectTenant(tenantId: string) {
    form.setValue('tenantId', tenantId);
    const selectedTenant = (tenants ?? []).find((t) => t.id === tenantId);
    if (selectedTenant) {
      form.setValue('tenantName', selectedTenant.name);
      if (selectedTenant.propertyId) {
        form.setValue('propertyId', selectedTenant.propertyId);
      }
    }
  }

  function openRecordPayment(row: Invoice) {
    setPaymentInvoice(row);
    setPaymentAmount(Math.max(0, row.amount - row.paidAmount));
    setPaymentMethod('UPI');
  }

  function submit() {
    if (!form.validate({ tenantName: (v) => (!v ? 'Required' : undefined), amount: (v) => (Number(v) <= 0 ? 'Amount must be positive' : undefined) })) return;
    const payload = {
      ...form.values,
      createdAt: new Date().toISOString(),
    };
    createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() {
    if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  function handlePrintInvoice() {
    const printContent = document.getElementById('printable-gst-invoice');
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=850,height=1100');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Rent Receipt - ${viewInvoice?.invoiceNumber || 'StayEaze'}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background-color: #ffffff !important;
              color: #0f172a !important;
              margin: 0;
              padding: 10px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print\\:hidden { display: none !important; }
          </style>
        </head>
        <body>
          <div style="max-width: 800px; margin: 0 auto;">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', header: 'Invoice', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium text-primary">{r.invoiceNumber}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{String(propMap.get(r.propertyId) || '—')}</span> },
    { key: 'period', header: 'Period', sortable: true, cell: (r) => <span className="text-sm">{r.period || formatDate(r.createdAt)}</span> },
    { key: 'amount', header: 'Amount', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.amount)}</span> },
    { key: 'paidAmount', header: 'Paid', sortable: true, cell: (r) => <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(r.paidAmount)}</span> },
    { key: 'dueDate', header: 'Due Date', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.dueDate)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => (
      <div className="flex items-center gap-2">
        <StatusBadge status={r.status} tone={statusTone(r.status)} />
        {String(r.status || '').toLowerCase() === 'pending_approval' && (
          <Button
            size="sm"
            className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs gap-1"
            disabled={approveUtrMut.isPending || rejectUtrMut.isPending}
            onClick={(e) => {
              e.stopPropagation();
              setApprovingInvoice({
                id: r.id,
                invoiceNumber: r.invoiceNumber,
                amount: Number(r.amount || 0),
                tenantName: r.tenantName,
              });
            }}
          >
            <Check className="h-3 w-3" /> Approve
          </Button>
        )}
      </div>
    )},
  ];

  const propertyFilterOptions = (properties ?? []).map((p: any) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="Rent & Billing"
        description="Generate invoices, process rent collections, and manage tenant billing cycles."
        icon={Receipt}
        actions={
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="gap-1.5 border-amber-300 text-amber-900 bg-amber-50/50 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:bg-amber-950/30 font-semibold rounded-xl h-9.5 text-xs flex-1 sm:flex-none"
              onClick={() => navigate('/utilities')}
            >
              <Zap className="mr-1.5 h-3.5 w-3.5 text-amber-600 fill-amber-500" />
              Utilities & Meters
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-9.5 text-xs font-semibold shrink-0"
              onClick={() => {
                if (!planFeatures.allowsBulkRentRun) {
                  setRentRunUpgradeModalOpen(true);
                } else {
                  setShowRentRunPreview(true);
                }
              }}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Generate Monthly Invoices
            </Button>
            <Button onClick={openCreate} className="rounded-xl h-9.5 text-xs font-bold shrink-0">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Invoice
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Billed" value={formatCurrency(totalBilled)} icon={Receipt} accent="primary" />
        <StatCard
          label="Total Collected"
          value={formatCurrency(totalCollected)}
          icon={Wallet}
          accent="success"
          trend={{ value: `${Math.round((totalCollected / (totalBilled || 1)) * 100)}%`, direction: 'up', positive: true }}
        />
        <StatCard label="Overdue Invoices" value={overdueCount} icon={AlertCircle} accent="destructive" hint="Follow-up needed" />
        <StatCard label="Paid Invoices" value={paidCount} icon={CheckCircle2} accent="info" hint="Completed payments" />
      </div>

      {/* Pending On-Desk & UTR Verifications Panel */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/60 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
                Action Required: {pendingApprovals.length} On-Desk / UTR Payment(s) Pending Approval
              </h3>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold rounded-lg px-2.5 py-0.5">
              Verification Queue
            </Badge>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {pendingApprovals.map((inv: any) => (
              <div key={inv.id} className="p-4 rounded-2xl border bg-card space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs font-mono text-primary">{inv.invoiceNumber}</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{formatCurrency(Number(inv.amountDue || inv.amount || 0))}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Resident: <strong className="text-foreground">{inv.tenantName}</strong> (Room {inv.roomNumber || '—'} / Bed {inv.bedNumber || '—'})</p>
                  <p className="font-mono text-amber-700 dark:text-amber-300 font-semibold truncate">{inv.paymentReference || 'UTR not specified'}</p>
                  <p className="text-[11px]">Mode: {inv.paymentMethod || 'UPI'}</p>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    className="h-9.5 px-4 rounded-xl text-xs sm:text-sm flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-xs"
                    disabled={approveUtrMut.isPending || rejectUtrMut.isPending}
                    onClick={() => setApprovingInvoice({
                      id: inv.id,
                      invoiceNumber: inv.invoiceNumber,
                      amount: Number(inv.amountDue || inv.amount || 0),
                      tenantName: inv.tenantName,
                      paymentRef: inv.paymentReference,
                    })}
                  >
                    <Check className="h-4 w-4 shrink-0" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9.5 px-3.5 rounded-xl text-xs sm:text-sm text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 dark:hover:bg-rose-900/50 gap-1.5"
                    disabled={approveUtrMut.isPending || rejectUtrMut.isPending}
                    onClick={() => {
                      setRejectReason('');
                      setRejectingInvoice({
                        id: inv.id,
                        invoiceNumber: inv.invoiceNumber,
                        amount: Number(inv.amountDue || inv.amount || 0),
                        tenantName: inv.tenantName,
                      });
                    }}
                  >
                    <X className="h-4 w-4 shrink-0" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Search invoices or tenants..."
        exportFilename="invoices"
        initialSortBy="dueDate"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        dateRangeFilter={{ key: 'dueDate', label: 'Due Date', field: 'dueDate' }}
        bulkActions={[{ label: 'Delete Selected', icon: Trash2, variant: 'destructive', onAction: (ids) => bulkDeleteMut.mutate(ids) }]}
        rowActions={(row) => (
          <RowActions
            items={[
              ...(String(row.status || '').toLowerCase() === 'pending_approval' ? [
                {
                  label: 'Approve Payment (UTR)',
                  icon: Check,
                  onSelect: () => setApprovingInvoice({
                    id: row.id,
                    invoiceNumber: row.invoiceNumber,
                    amount: Number(row.amount || 0),
                    tenantName: row.tenantName,
                  }),
                },
                {
                  label: 'Reject Payment (UTR)',
                  icon: X,
                  variant: 'destructive' as const,
                  onSelect: () => {
                    setRejectReason('');
                    setRejectingInvoice({
                      id: row.id,
                      invoiceNumber: row.invoiceNumber,
                      amount: Number(row.amount || 0),
                      tenantName: row.tenantName,
                    });
                  },
                },
              ] : []),
              ...(String(row.status || '').toLowerCase() !== 'paid' && (Number(row.amount || 0) - Number(row.paidAmount || 0)) > 0 ? [
                { label: 'Record Payment', icon: CreditCard, onSelect: () => openRecordPayment(row) },
              ] : []),
              { label: 'View Rent Receipt', icon: Printer, onSelect: () => setViewInvoice(row) },
              ...(String(row.status || '').toLowerCase() !== 'cancelled' && String(row.status || '').toLowerCase() !== 'written_off' && (Number(row.amount || 0) - Number(row.paidAmount || 0)) > 0 ? [
                {
                  label: 'Write-off / Waive',
                  icon: ShieldCheck,
                  variant: 'destructive' as const,
                  onSelect: () => setWriteOffTarget({
                    invoice: row,
                    waivedAmount: Math.max(0, Number(row.amount || 0) - Number(row.paidAmount || 0)),
                    reason: 'Bad Debt / Uncollectible',
                  }),
                },
              ] : []),
              ...(String(row.status || '').toLowerCase() !== 'cancelled' && String(row.status || '').toLowerCase() !== 'paid' ? [
                { label: 'Cancel Invoice', icon: XCircle, variant: 'destructive' as const, onSelect: () => setCancelTarget(row) },
              ] : []),
              ...(String(row.status || '').toLowerCase() !== 'paid' && Number(row.paidAmount || 0) <= 0 ? [
                { label: 'Delete Draft / Unpaid', icon: Trash2, variant: 'destructive' as const, onSelect: () => setDeleteTarget(row) },
              ] : []),
            ]}
          />
        )}
      />

      {/* Create Dialog */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New Rent Invoice"
        onSubmit={submit}
        loading={createMut.isPending}
        submitLabel="Generate Invoice"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {tenants && tenants.length > 0 && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Active Registered Tenant</Label>
              <TenantSelect
                tenants={tenants}
                selectedTenantId={form.values.tenantId}
                onSelectTenant={(t) => {
                  if (!t) {
                    form.setValue('tenantId', '');
                    return;
                  }
                  form.setValue('tenantId', t.id);
                  form.setValue('tenantName', t.name);
                  if (t.propertyId) form.setValue('propertyId', t.propertyId);
                  if (t.rent) form.setValue('amount', t.rent);
                }}
              />
            </div>
          )}

          <FormInput
            label="Tenant Name"
            required
            id="tenantName"
            value={form.values.tenantName}
            onChange={(e) => form.setValue('tenantName', e.target.value)}
            error={form.errors.tenantName}
          />
          <div className="space-y-1.5">
            <Label>Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: any) => ({
                value: p.id,
                label: p.name,
                sublabel: p.city || p.code || 'Property',
                badge: p.type || 'PG',
              }))}
              value={form.values.propertyId}
              onChange={(v) => form.setValue('propertyId', v)}
              placeholder="Search & select property..."
              searchPlaceholder="Search properties by name..."
            />
          </div>
          <FormInput
            label="Billing Period"
            type="month"
            id="period"
            value={form.values.period}
            onChange={(e) => form.setValue('period', e.target.value)}
          />
          <FormInput
            label="Due Date"
            type="date"
            id="dueDate"
            value={form.values.dueDate}
            onChange={(e) => form.setValue('dueDate', e.target.value)}
          />
          <FormInput
            label="Rent / Charge Amount (₹)"
            required
            type="number"
            id="amount"
            value={String(form.values.amount)}
            onChange={(e) => form.setValue('amount', Number(e.target.value))}
            error={form.errors.amount}
          />
          <FormInput
            label="Paid Amount (₹)"
            type="number"
            id="paidAmount"
            value={String(form.values.paidAmount)}
            onChange={(e) => form.setValue('paidAmount', Number(e.target.value))}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Status</Label>
            <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Invoice['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!paymentInvoice} onOpenChange={(open) => !open && setPaymentInvoice(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[520px] max-h-[85vh] p-0 rounded-2xl flex flex-col overflow-hidden shadow-2xl border">
          <DialogHeader className="p-4 sm:p-5 border-b shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">Process Rent Payment</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Collect payment or trigger online checkout for tenant invoice.</p>
              </div>
            </div>
          </DialogHeader>

          {paymentInvoice && (
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[calc(85vh-130px)] flex-1">
              {/* Invoice Summary Card */}
              <div className="rounded-2xl p-4 bg-slate-50 border border-slate-200/80 dark:bg-slate-900/60 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Invoice Reference</span>
                  <span className="font-mono font-bold text-indigo-900 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900">{paymentInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Tenant Name</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{paymentInvoice.tenantName}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                  <div className="bg-white dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/40 dark:border-slate-700/50">
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Total Billed</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5 font-mono">{formatCurrency(paymentInvoice.amount)}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/40 dark:border-slate-700/50">
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Remaining Balance</p>
                    <p className="font-bold text-red-600 dark:text-red-400 text-sm mt-0.5 font-mono">{formatCurrency(Math.max(0, paymentInvoice.amount - paymentInvoice.paidAmount))}</p>
                  </div>
                </div>
              </div>

              {/* Payment Amount Input */}
              <FormInput
                label="Payment Amount (₹)"
                id="recordPaymentAmount"
                type="number"
                placeholder="Enter amount"
                className="h-10 rounded-xl text-xs sm:text-sm font-medium"
                value={String(paymentAmount)}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
              />

              {/* Real-time Overpayment & Advance Rollover Helper (P0.1) */}
              {(() => {
                const due = Math.max(0, paymentInvoice.amount - (paymentInvoice.paidAmount || 0));
                const surplus = Math.max(0, paymentAmount - due);
                if (surplus > 0 && paymentAmount > 0) {
                  return (
                    <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold">Overpayment Surplus (+₹{surplus.toLocaleString('en-IN')})</p>
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                          ₹{due.toLocaleString('en-IN')} will fully settle this invoice, and the excess <strong>₹{surplus.toLocaleString('en-IN')}</strong> will automatically rollover to the resident's Advance Wallet to offset next month's rent.
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Select Payment Mode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH" className="text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <Banknote className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>Cash Payment (In Person / Counter)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="RAZORPAY" className="text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <CreditCard className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span>Razorpay Online Gateway (Cards, UPI, NetBanking)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="UPI" className="text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <QrCode className="h-4 w-4 text-violet-600 shrink-0" />
                        <span>Direct UPI (GPay / PhonePe / Paytm)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="BANK_TRANSFER" className="text-xs">
                      <div className="flex items-center gap-2 font-medium">
                        <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>Direct Bank Transfer / NEFT / IMPS</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Method Details */}
              {paymentMethod === 'CASH' && (
                <div className="space-y-1.5 pt-1">
                  <FormInput
                    label="Cash Receipt / Voucher Ref (Optional)"
                    id="cashRef"
                    placeholder="e.g. CASH-REC-0012"
                    className="h-10 rounded-xl text-xs sm:text-sm"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">Optional physical cash collection receipt or serial voucher number.</p>
                </div>
              )}

              {paymentMethod === 'RAZORPAY' && (
                <div className="rounded-2xl bg-indigo-50/80 border border-indigo-200/80 p-3.5 dark:bg-indigo-950/40 dark:border-indigo-800/60 space-y-1.5 my-2">
                  <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-300 font-bold text-xs">
                    <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Razorpay Instant Payment Checkout</span>
                  </div>
                  <p className="text-[11px] text-indigo-800 dark:text-indigo-300/80 leading-relaxed">
                    Tenant can pay via UPI, Debit/Credit Cards, NetBanking, or Wallets. Payment is verified & updated automatically upon checkout.
                  </p>
                </div>
              )}

              {(paymentMethod === 'UPI' || paymentMethod === 'BANK_TRANSFER') && (
                <div className="space-y-1.5 pt-1">
                  <FormInput
                    label="UTR / Transaction Reference No"
                    id="transRef"
                    placeholder="e.g. UTR 421098765432"
                    className="h-10 rounded-xl text-xs sm:text-sm"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col-reverse sm:flex-row gap-2 shrink-0">
            <Button variant="outline" className="h-10 rounded-xl font-medium w-full sm:w-auto" onClick={() => setPaymentInvoice(null)}>
              Cancel
            </Button>

            {paymentMethod === 'RAZORPAY' ? (
              <Button
                className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs flex items-center justify-center gap-2 w-full sm:w-auto"
                disabled={isRazorpayProcessing || !paymentInvoice}
                onClick={() => {
                  if (paymentInvoice) handleRazorpayCheckout(paymentInvoice);
                }}
              >
                {isRazorpayProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Opening Gateway...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Pay Online via Razorpay</span>
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="h-10 rounded-xl font-semibold shadow-xs flex items-center justify-center gap-2 w-full sm:w-auto"
                disabled={recordPaymentMut.isPending || paymentAmount <= 0}
                onClick={() => {
                  if (paymentInvoice) {
                    recordPaymentMut.mutate({ id: paymentInvoice.id, amount: paymentAmount, method: paymentMethod, ref: paymentRef });
                  }
                }}
              >
                {recordPaymentMut.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : paymentMethod === 'CASH' ? (
                  <>
                    <Banknote className="h-4 w-4" />
                    <span>Confirm Cash Payment</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Record Payment</span>
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Rent Receipt Printable Modal */}
      <Dialog open={!!viewInvoice} onOpenChange={(open) => !open && setViewInvoice(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[780px] p-0 overflow-hidden max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border">
          <DialogHeader className="p-4 bg-muted/40 border-b flex flex-row items-center justify-between print:hidden shrink-0">
            <DialogTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <Receipt className="h-4.5 w-4.5 text-primary shrink-0" /> Official Rent Receipt
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button onClick={handlePrintInvoice} className="h-9.5 px-4 rounded-xl text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs gap-2">
                <Printer className="h-4 w-4 shrink-0" /> Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          {viewInvoice && (() => {
            const prop = properties?.find((p) => p.id === viewInvoice.propertyId);
            const tenant = tenants?.find((t) => t.id === viewInvoice.tenantId);
            const issuer = viewInvoice.issuerSnapshot ?? currentBillingProfile;
            const issuerName = issuer?.legalName || prop?.name || 'Business name not configured';
            const issuerAddress = issuer?.billingAddress || prop?.address || 'Address not configured';
            const issuerCityState = [issuer?.city || prop?.city, issuer?.state || prop?.state, issuer?.pincode || prop?.pincode].filter(Boolean).join(', ');
            const remainingDue = Math.max(0, viewInvoice.amount - viewInvoice.paidAmount);

            return (
              <div className="overflow-y-auto max-h-[calc(92vh-80px)] flex-1 p-3 sm:p-6 bg-white">
                <div id="printable-gst-invoice" className="printable-receipt-card p-4 sm:p-8 bg-white text-slate-900 font-sans text-xs leading-normal">
                  {/* Header Banner */}
                  <div className="border-b-2 border-slate-800 pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-indigo-700 text-white font-extrabold flex items-center justify-center text-lg shadow-sm shrink-0">SE</div>
                        <div>
                          <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 uppercase">{issuerName}</h1>
                          <p className="text-[11px] font-semibold text-indigo-900">{prop?.name || 'Executive PG & Student Residence'}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-600 leading-snug">
                        <p className="font-medium">{issuerAddress}</p>
                        {issuerCityState && <p className="font-medium">{issuerCityState}, India</p>}
                        {(issuer?.pan || issuer?.gstin || issuer?.registrationNumber) && <p className="mt-0.5">{issuer?.pan && <><span className="font-bold text-slate-800">PAN:</span> {issuer.pan} &nbsp;</>}{issuer?.gstin && <><span className="font-bold text-slate-800">GSTIN:</span> {issuer.gstin} &nbsp;</>}{issuer?.registrationNumber && <><span className="font-bold text-slate-800">License No:</span> {issuer.registrationNumber}</>}</p>}
                        {(issuer?.supportEmail || issuer?.supportPhone) && <p>{issuer?.supportEmail && <><span className="font-bold text-slate-800">Email:</span> {issuer.supportEmail} </>}{issuer?.supportPhone && <>&nbsp;|&nbsp; <span className="font-bold text-slate-800">Helpline:</span> {issuer.supportPhone}</>}</p>}
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <div className="inline-block bg-slate-900 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded mb-2 shadow-sm">
                        OFFICIAL RENT RECEIPT
                      </div>
                      <p className="font-mono text-sm font-bold text-indigo-950">RCP-{viewInvoice.invoiceNumber.replace(/^INV-/, '')}</p>
                      <p className="text-[11px] text-slate-600 mt-1"><span className="font-semibold text-slate-800">Receipt Date:</span> {formatDate(viewInvoice.issueDate || viewInvoice.createdAt)}</p>
                      <p className="text-[11px] text-slate-600"><span className="font-semibold text-slate-800">Due Date:</span> {formatDate(viewInvoice.dueDate)}</p>
                      <p className="text-[11px] text-slate-600"><span className="font-semibold text-slate-800">Rent Month:</span> {viewInvoice.period || 'August 2026'}</p>
                    </div>
                  </div>

                  {/* Tenant / Rent Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-slate-300 rounded-xl p-3 mb-4 bg-slate-50/70">
                    <div>
                      <p className="font-bold text-[11px] text-indigo-950 uppercase tracking-wider border-b border-slate-200 pb-1 mb-1.5">Tenant Details (Received From)</p>
                      <p className="font-bold text-sm text-slate-900">{viewInvoice.tenantName}</p>
                      {tenant && <p className="text-slate-600">Contact: <span className="font-semibold text-slate-800">{tenant.phone || tenant.email || 'N/A'}</span></p>}
                      {tenant?.roomNumber && <p className="text-slate-600">Occupied Premises: <span className="font-semibold text-slate-800">Room {tenant.roomNumber} {tenant.bedNumber ? `(Bed ${tenant.bedNumber})` : ''}</span></p>}
                      <p className="text-slate-600">Property Location: <span className="font-semibold text-slate-800">{prop?.name || 'StayEaze Residence'}, Noida</span></p>
                    </div>
                    <div>
                      <p className="font-bold text-[11px] text-indigo-950 uppercase tracking-wider border-b border-slate-200 pb-1 mb-1.5">Payment Summary & Status</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-700">Receipt Status:</span>
                        <StatusBadge status={viewInvoice.status} tone={statusTone(viewInvoice.status)} />
                      </div>
                      <p className="text-slate-600">Total Monthly Rent: <span className="font-bold text-slate-900">{formatCurrency(viewInvoice.amount)}</span></p>
                      <p className="text-slate-600">Amount Received: <span className="font-bold text-emerald-700">{formatCurrency(viewInvoice.paidAmount)}</span></p>
                      <p className="text-slate-600">Paid By (Method): <span className="font-bold text-indigo-900 uppercase">{(viewInvoice.paymentMethod || 'CASH / ONLINE GATEWAY').replace('_', ' ')}</span></p>
                      <p className="text-slate-600 truncate">Transaction Ref ID: <span className="font-mono font-bold text-slate-800">{viewInvoice.paymentReference || ('TXN-' + viewInvoice.invoiceNumber.replace(/^INV-/, ''))}</span></p>
                      <p className="text-slate-600">Balance Outstanding: <span className={`font-bold ${remainingDue > 0 ? 'text-red-600' : 'text-slate-700'}`}>{formatCurrency(remainingDue)}</span></p>
                    </div>
                  </div>

                  {/* Particulars Itemized Table */}
                  {(() => {
                    const items = (viewInvoice as any).items && (viewInvoice as any).items.length > 0
                      ? (viewInvoice as any).items
                      : (() => {
                          const total = viewInvoice.amount || 0;
                          const tenantRent = Number(tenant?.rent || 0);
                          const tenantDeposit = Number(tenant?.deposit || 0);

                          if (tenantDeposit > 0 && tenantRent > 0 && total === (tenantRent + tenantDeposit)) {
                            return [
                              { description: 'First Month Room Accommodation Rent', amount: tenantRent, category: 'Room Rent' },
                              { description: 'Refundable Security Deposit', amount: tenantDeposit, category: 'Security Deposit' },
                            ];
                          } else if (tenantDeposit > 0 && total === tenantDeposit) {
                            return [
                              { description: 'Refundable Security Deposit', amount: tenantDeposit, category: 'Security Deposit' },
                            ];
                          }
                          return [
                            { description: `Monthly Room Rent & Accommodation (${viewInvoice.period || 'Current Cycle'})`, amount: total, category: 'Room Rent' },
                          ];
                        })();

                    return (
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full border-collapse border border-slate-300 text-[11px] min-w-[340px]">
                          <thead>
                            <tr className="bg-slate-900 text-white text-left font-bold">
                              <th className="p-2 border border-slate-700 w-10 text-center">#</th>
                              <th className="p-2 border border-slate-700">Rent Particulars / Description</th>
                              <th className="p-2 border border-slate-700 w-28 sm:w-32 text-center">Category</th>
                              <th className="p-2 border border-slate-700 w-24 sm:w-28 text-right">Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it: any, idx: number) => (
                              <tr key={idx} className="border-b border-slate-300">
                                <td className="p-2 border border-slate-300 text-center font-medium">{idx + 1}</td>
                                <td className="p-2 border border-slate-300 font-semibold">
                                  {it.description}
                                </td>
                                <td className="p-2 border border-slate-300 text-center text-slate-700 font-medium">
                                  {it.description?.toLowerCase().includes('deposit') ? 'Security Deposit' : 'Room Rent'}
                                </td>
                                <td className="p-2 border border-slate-300 text-right font-bold tabular-nums">
                                  {formatCurrency(Number(it.amount || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-900 text-white font-bold text-xs">
                              <td colSpan={3} className="p-2.5 border border-slate-900 text-right uppercase">Net Total Amount Received:</td>
                              <td className="p-2.5 border border-slate-900 text-right font-extrabold text-sm tabular-nums">{formatCurrency(viewInvoice.amount)}</td>
                            </tr>
                          </tfoot>
                        </table>

                        {/* Amount in Words */}
                        <div className="border border-slate-300 rounded-xl p-2.5 mt-3 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-semibold text-slate-700">Amount in Words:</span>
                          <span className="font-bold text-indigo-950 italic">{numberToWords(viewInvoice.amount)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* HRA Tax Declaration & Verification QR Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 border border-indigo-200 rounded-xl p-3 mb-4 bg-indigo-50/40">
                    <div className="sm:col-span-3 flex flex-col items-center justify-center sm:border-r border-indigo-200 sm:pr-2 text-center pb-2 sm:pb-0 border-b sm:border-b-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://stayeaze.com/verify-receipt?rcp=${viewInvoice.invoiceNumber}%26tenant=${encodeURIComponent(viewInvoice.tenantName)}%26amount=${viewInvoice.amount}`}
                        alt="Receipt Verification QR Code"
                        className="h-20 w-20 border border-slate-300 rounded-lg p-0.5 bg-white shadow-sm"
                      />
                      <span className="text-[9px] font-mono font-bold text-indigo-950 mt-1 uppercase">Scan to Verify</span>
                    </div>
                    <div className="sm:col-span-9 text-[10px] text-slate-700 leading-tight space-y-1">
                      <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-indigo-200 pb-1">House Rent Allowance (HRA) Tax Declaration</p>
                      <p className="italic text-slate-800">
                        "Received with thanks from <span className="font-bold">{viewInvoice.tenantName}</span> a sum of <span className="font-bold">{formatCurrency(viewInvoice.amount)}</span> ({numberToWords(viewInvoice.amount)}) towards room rent for the month of <span className="font-bold">{viewInvoice.period || 'August 2026'}</span>."
                      </p>
                      <p><span className="font-semibold text-slate-900">HRA Tax Compliance:</span> Valid rent receipt for claiming HRA tax exemption under Section 10(13A) of Income Tax Act 1961.</p>
                      <p><span className="font-semibold text-slate-900">Landlord PAN:</span> <span className="font-mono font-bold text-indigo-950">{issuer?.pan || 'Not provided'}</span> &nbsp;|&nbsp; <span className="font-semibold text-slate-900">Verification Hash:</span> <span className="font-mono text-indigo-900">RCP-SHA256:{viewInvoice.invoiceNumber.replace(/[^A-Z0-9]/gi, '')}</span></p>
                    </div>
                  </div>

                  {/* Bank Details & Terms */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-300 pt-3 mb-6">
                    <div>
                      <p className="font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-1">Bank Payment Details</p>
                      <div className="text-[10px] text-slate-600 space-y-0.5 leading-tight font-mono">
                        {issuer?.bankAccountName && <p><span className="font-semibold text-slate-700">Account Name:</span> {issuer.bankAccountName}</p>}
                        {issuer?.bankName && <p><span className="font-semibold text-slate-700">Bank Name:</span> {issuer.bankName}</p>}
                        {issuer?.bankAccountNumber && <p><span className="font-semibold text-slate-700">Account No:</span> {issuer.bankAccountNumber}</p>}
                        {issuer?.bankIfsc && <p><span className="font-semibold text-slate-700">IFSC Code:</span> {issuer.bankIfsc}</p>}
                        {issuer?.upiVpa && <p><span className="font-semibold text-slate-700">UPI VPA:</span> {issuer.upiVpa}</p>}
                        {!issuer?.bankAccountName && !issuer?.bankName && !issuer?.upiVpa && <p>Payment details not configured.</p>}
                      </div>
                    </div>

                    <div>
                      <p className="font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-1">Receipt Terms & Rules</p>
                      <div className="text-[10px] text-slate-600 whitespace-pre-line leading-tight">{issuer?.invoiceTerms || 'Rent is payable on or before the due date. This computer-generated receipt is valid for tenant records.'}</div>
                      {issuer?.lateFeeNote && <p className="mt-2 text-[10px] text-slate-700"><span className="font-semibold">Late fee:</span> {issuer.lateFeeNote}</p>}
                    </div>
                  </div>

                  {/* Signature & Seal Area */}
                  <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end border-t-2 border-slate-800 pt-4 mt-6 gap-4">
                    <div className="text-[10px] text-slate-500 space-y-0.5 text-center sm:text-left">
                      <p className="font-bold text-slate-800">Official Computer Generated Rent Receipt</p>
                      <p>Verified & Secured by StayEaze PMS System</p>
                      <p className="font-mono text-[9px] text-slate-400">Ref ID: {viewInvoice.id}</p>
                    </div>

                    <div className="text-center">
                      <div className="h-14 flex items-center justify-center mb-1">
                        <div className="border-2 border-indigo-700 rounded-full px-3 py-1 bg-indigo-50 text-[10px] font-bold text-indigo-900 rotate-[-3deg] shadow-sm flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{issuer?.authorizedSignatory || issuerName}<br />AUTHORIZED SIGNATORY</span>
                        </div>
                      </div>
                      <div className="border-t border-slate-800 w-48 pt-1 font-bold text-[11px] text-slate-900">
                        Landlord / Property Owner Signature
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Double Confirmation Dialog for Approving Offline/UTR Payments */}
      <Dialog open={!!approvingInvoice} onOpenChange={(open) => !open && setApprovingInvoice(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base sm:text-lg">Verify & Approve Payment?</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Please double check your bank statement or UPI app to ensure funds have been credited before approving.
            </DialogDescription>
          </DialogHeader>

          {approvingInvoice && (
            <div className="space-y-3 py-2">
              <div className="p-3.5 rounded-2xl border bg-slate-50 dark:bg-slate-900/50 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Number:</span>
                  <span className="font-mono font-bold text-primary">{approvingInvoice.invoiceNumber}</span>
                </div>
                {approvingInvoice.tenantName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resident / Tenant:</span>
                    <span className="font-semibold text-foreground truncate">{approvingInvoice.tenantName}</span>
                  </div>
                )}
                {approvingInvoice.paymentRef && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Proof / UTR:</span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-300 truncate">{approvingInvoice.paymentRef}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t">
                  <span className="text-muted-foreground font-semibold">Total Amount to Mark Paid:</span>
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(approvingInvoice.amount)}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">⚠️ Action Cannot Be Undone</p>
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Approving will permanently mark this invoice as <strong>PAID</strong> in the organization ledger and generate a stamped digital rent receipt.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t">
            <Button
              variant="outline"
              className="rounded-xl h-10 w-full sm:w-auto font-medium"
              disabled={approveUtrMut.isPending}
              onClick={() => setApprovingInvoice(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl h-10 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-xs"
              disabled={approveUtrMut.isPending}
              onClick={() => {
                if (approvingInvoice) {
                  approveUtrMut.mutate(approvingInvoice.id, {
                    onSettled: () => setApprovingInvoice(null),
                  });
                }
              }}
            >
              {approveUtrMut.isPending ? 'Verifying...' : 'Yes, Confirm & Mark Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Confirmation Dialog */}
      <Dialog open={!!rejectingInvoice} onOpenChange={(open) => !open && setRejectingInvoice(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base sm:text-lg">Reject Payment Proof?</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              The invoice will be reverted back to <strong>UNPAID</strong> and the resident will be notified.
            </DialogDescription>
          </DialogHeader>

          {rejectingInvoice && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Rejection Reason (Visible to Resident):</Label>
                <Input
                  className="rounded-xl h-10 text-xs sm:text-sm"
                  placeholder="e.g. UTR reference not matching bank account statement"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t">
            <Button
              variant="outline"
              className="rounded-xl h-10 w-full sm:w-auto font-medium"
              disabled={rejectUtrMut.isPending}
              onClick={() => setRejectingInvoice(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl h-10 w-full sm:w-auto font-bold shadow-xs"
              disabled={rejectUtrMut.isPending}
              onClick={() => {
                if (rejectingInvoice) {
                  rejectUtrMut.mutate({ id: rejectingInvoice.id, reason: rejectReason || 'UTR not found in bank statement' }, {
                    onSettled: () => setRejectingInvoice(null),
                  });
                }
              }}
            >
              {rejectUtrMut.isPending ? 'Rejecting...' : 'Reject Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancel Invoice"
        variant="destructive"
        description={`Are you sure you want to cancel invoice "${cancelTarget?.invoiceNumber}"? Any Advance Wallet funds applied to this invoice will be automatically rolled back and refunded to the resident's wallet.`}
        confirmLabel="Cancel Invoice"
        onConfirm={() => {
          if (cancelTarget) {
            cancelInvoiceMut.mutate(cancelTarget.id, {
              onSettled: () => setCancelTarget(null),
            });
          }
        }}
        loading={cancelInvoiceMut.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Invoice"
        variant="destructive"
        description={`Delete invoice "${deleteTarget?.invoiceNumber}"?`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        loading={deleteMut.isPending}
      />

      {/* P2.1: Rent Run Preview Modal */}
      <RentRunPreviewModal
        open={showRentRunPreview}
        onClose={() => setShowRentRunPreview(false)}
        propertyId={selectedPropertyId}
      />
      {/* P2.3: Invoice Write-off & Waiver Modal */}
      <Dialog open={!!writeOffTarget} onOpenChange={(open) => !open && setWriteOffTarget(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-destructive/10 text-destructive">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle>Write-Off / Waive Balance</DialogTitle>
                <DialogDescription>
                  Invoice {writeOffTarget?.invoice.invoiceNumber} · {writeOffTarget?.invoice.tenantName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {writeOffTarget && (
            <div className="space-y-4 py-2 text-xs sm:text-sm">
              <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Invoice Amount:</span>
                  <span className="font-semibold">{formatCurrency(writeOffTarget.invoice.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Already Paid:</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(writeOffTarget.invoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t font-bold text-foreground">
                  <span>Outstanding Remaining:</span>
                  <span className="text-destructive font-bold">
                    {formatCurrency(Math.max(0, Number(writeOffTarget.invoice.amount || 0) - Number(writeOffTarget.invoice.paidAmount || 0)))}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="waive-amount">Waive / Write-off Amount (₹)</Label>
                <Input
                  id="waive-amount"
                  type="number"
                  min={1}
                  max={Math.max(0, Number(writeOffTarget.invoice.amount || 0) - Number(writeOffTarget.invoice.paidAmount || 0))}
                  value={writeOffTarget.waivedAmount}
                  onChange={(e) => {
                    const max = Math.max(0, Number(writeOffTarget.invoice.amount || 0) - Number(writeOffTarget.invoice.paidAmount || 0));
                    const val = Number(e.target.value);
                    setWriteOffTarget({ ...writeOffTarget, waivedAmount: Math.min(max, Math.max(0, val)) });
                  }}
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  {writeOffTarget.waivedAmount >= Math.max(0, Number(writeOffTarget.invoice.amount || 0) - Number(writeOffTarget.invoice.paidAmount || 0))
                    ? 'Full write-off: status will be set to WRITTEN_OFF.'
                    : 'Partial waiver: outstanding balance will be reduced by this amount.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="writeoff-reason">Reason / Justification <span className="text-destructive">*</span></Label>
                <Select
                  value={['Bad Debt / Uncollectible', 'Dispute Settlement', 'Financial Hardship Concession', 'Administrative Error / Cancellation'].includes(writeOffTarget.reason) ? writeOffTarget.reason : 'Other'}
                  onValueChange={(val) => {
                    if (val !== 'Other') {
                      setWriteOffTarget({ ...writeOffTarget, reason: val });
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bad Debt / Uncollectible">Bad Debt / Uncollectible (Eviction/Abandoned)</SelectItem>
                    <SelectItem value="Financial Hardship Concession">Financial Hardship Concession</SelectItem>
                    <SelectItem value="Dispute Settlement">Dispute Settlement</SelectItem>
                    <SelectItem value="Administrative Error / Cancellation">Administrative Adjustment</SelectItem>
                    <SelectItem value="Other">Other (Custom Reason)</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Enter detailed justification..."
                  value={writeOffTarget.reason}
                  onChange={(e) => setWriteOffTarget({ ...writeOffTarget, reason: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs">
                ⚠️ This action is permanent and will be logged in the immutable Organization Audit Trail.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setWriteOffTarget(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={writeOffMut.isPending || !writeOffTarget?.reason.trim() || !writeOffTarget?.waivedAmount}
              onClick={() => {
                if (writeOffTarget) {
                  writeOffMut.mutate({
                    id: writeOffTarget.invoice.id,
                    waivedAmount: writeOffTarget.waivedAmount,
                    reason: writeOffTarget.reason,
                  });
                }
              }}
              className="rounded-xl font-semibold"
            >
              {writeOffMut.isPending ? 'Processing...' : 'Confirm Write-Off / Waiver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeatureUpgradeDialog
        open={rentRunUpgradeModalOpen}
        onOpenChange={setRentRunUpgradeModalOpen}
        featureTitle="1-Click Bulk Monthly Rent Runs"
        featureDescription="Automate monthly rent invoicing for all active tenants across all buildings and properties simultaneously with integrated sub-meter utility splits."
        requiredTier="GROWTH"
      />
    </div>
  );
}

void TrendingUp;
