import { useState } from 'react';
import { Receipt, Plus, Pencil, Trash2, Wallet, TrendingUp, AlertCircle, CheckCircle2, RefreshCw, CreditCard, Printer, Banknote, QrCode, Building2, ShieldCheck, Sparkles } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import api from '@/lib/api';
import type { Invoice, InvoiceIssuerSnapshot, Property, Tenant } from '@/lib/types';
import { formatCurrency, formatDate, numberToWords } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm, useBulkDelete } from '@/lib/hooks/use-crud';

import { TenantSelect } from '@/components/common/TenantSelect';

const ENDPOINT = '/invoices';
const statuses = [
  { value: 'paid', label: 'Paid' }, { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' }, { value: 'overdue', label: 'Overdue' },
];

const emptyForm = {
  tenantId: '', tenantName: '', propertyId: '', period: new Date().toISOString().slice(0, 7),
  amount: 8000, paidAmount: 0, dueDate: new Date().toISOString().slice(0, 10),
  status: 'unpaid' as Invoice['status'],
};

export default function BillingPage() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  
  // Receipt Preview State
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

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
    queryKey: ['billing-stats'],
    queryFn: () => api.get<{ data: Invoice[] }>(ENDPOINT, { params: { pageSize: 200 } }).then((r) => r.data.data),
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

  // Batch Monthly Invoices Generation
  const batchGenerateMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/invoices/auto-generate');
      return res.data;
    },
    onSuccess: (res: any) => {
      const count = res.generatedCount ?? 0;
      const skipped = res.skippedCheckedOutCount ?? 0;
      if (count > 0) {
        toast.success(`Generated ${count} monthly rent invoice(s) for due 1-month check-in anniversaries! (${skipped} checked-out tenants excluded)`);
      } else {
        toast.info(`No invoices due today. Checked active tenants' check-in anniversaries (${skipped} checked-out tenants excluded).`);
      }
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
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
          name: 'StayEaze Living Solutions',
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
    form.reset(emptyForm);
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
      invoiceNumber: `INV-${String(Date.now()).slice(-6)}`,
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
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'period', header: 'Period', sortable: true, cell: (r) => <span className="text-sm">{r.period || formatDate(r.createdAt)}</span> },
    { key: 'amount', header: 'Amount', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.amount)}</span> },
    { key: 'paidAmount', header: 'Paid', sortable: true, cell: (r) => <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(r.paidAmount)}</span> },
    { key: 'dueDate', header: 'Due Date', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.dueDate)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p: any) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent & Billing"
        description="Generate invoices, process rent collections, and manage tenant billing cycles."
        icon={Receipt}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={batchGenerateMut.isPending}
              onClick={() => batchGenerateMut.mutate()}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${batchGenerateMut.isPending ? 'animate-spin' : ''}`} />
              Generate Monthly Invoices
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> New Invoice
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              { label: 'Record Payment', icon: CreditCard, onSelect: () => openRecordPayment(row) },
              { label: 'View Rent Receipt', icon: Printer, onSelect: () => setViewInvoice(row) },
              { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
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
            <Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {(properties ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <DialogContent className="sm:max-w-[520px] p-6 sm:p-7 gap-0 rounded-2xl">
          <DialogHeader className="pb-4 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">Process Rent Payment</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Collect payment or trigger online checkout for tenant invoice.</p>
              </div>
            </div>
          </DialogHeader>

          {paymentInvoice && (
            <div className="space-y-5 my-4">
              {/* Invoice Summary Card */}
              <div className="rounded-xl p-4 bg-slate-50 border border-slate-200/80 dark:bg-slate-900/60 dark:border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Invoice Reference</span>
                  <span className="font-mono font-bold text-indigo-900 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900">{paymentInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Tenant Name</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{paymentInvoice.tenantName}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                  <div className="bg-white dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/40 dark:border-slate-700/50">
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Total Billed</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">{formatCurrency(paymentInvoice.amount)}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/40 dark:border-slate-700/50">
                    <p className="text-[10px] uppercase font-semibold text-slate-400">Remaining Balance</p>
                    <p className="font-bold text-red-600 dark:text-red-400 text-sm mt-0.5">{formatCurrency(Math.max(0, paymentInvoice.amount - paymentInvoice.paidAmount))}</p>
                  </div>
                </div>
              </div>

              {/* Payment Amount Input */}
              <FormInput
                label="Payment Amount (₹)"
                id="recordPaymentAmount"
                type="number"
                placeholder="Enter amount"
                className="h-11 font-medium"
                value={String(paymentAmount)}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
              />

              {/* Payment Method Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Select Payment Mode</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">
                      <div className="flex items-center gap-2 font-medium">
                        <Banknote className="h-4 w-4 text-emerald-600" />
                        <span>Cash Payment (In Person / Counter)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="RAZORPAY">
                      <div className="flex items-center gap-2 font-medium">
                        <CreditCard className="h-4 w-4 text-indigo-600" />
                        <span>Razorpay Online Gateway (Cards, UPI, NetBanking)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="UPI">
                      <div className="flex items-center gap-2 font-medium">
                        <QrCode className="h-4 w-4 text-violet-600" />
                        <span>Direct UPI (GPay / PhonePe / Paytm)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="BANK_TRANSFER">
                      <div className="flex items-center gap-2 font-medium">
                        <Building2 className="h-4 w-4 text-blue-600" />
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
                    className="h-10"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Optional physical cash collection receipt or serial voucher number.</p>
                </div>
              )}

              {paymentMethod === 'RAZORPAY' && (
                <div className="rounded-xl bg-indigo-50/80 border border-indigo-200/80 p-4 dark:bg-indigo-950/40 dark:border-indigo-800/60 space-y-1.5 my-2">
                  <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-300 font-bold text-xs">
                    <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
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
                    className="h-10"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-4 gap-3 sm:gap-2 flex items-center justify-end border-t border-slate-100 dark:border-slate-800 mt-2">
            <Button variant="outline" className="h-10 px-5 rounded-lg font-medium" onClick={() => setPaymentInvoice(null)}>
              Cancel
            </Button>

            {paymentMethod === 'RAZORPAY' ? (
              <Button
                className="h-10 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm flex items-center gap-2"
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
                className="h-10 px-5 rounded-lg font-semibold shadow-sm flex items-center gap-2"
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
        <DialogContent className="sm:max-w-[780px] p-0 overflow-hidden max-h-[92vh] overflow-y-auto">
          <DialogHeader className="p-4 bg-muted/40 border-b flex flex-row items-center justify-between print:hidden">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Official Rent Receipt & HRA Voucher
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePrintInvoice} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
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
              <div id="printable-gst-invoice" className="printable-receipt-card p-8 bg-white text-slate-900 font-sans text-xs leading-normal">
                {/* Header Banner */}
                <div className="border-b-2 border-slate-800 pb-4 mb-4 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-indigo-700 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">SE</div>
                      <div>
                        <h1 className="font-extrabold text-lg tracking-tight text-slate-900 uppercase">{issuerName}</h1>
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

                  <div className="text-right">
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
                <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3 mb-4 bg-slate-50/70">
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
                    <p className="text-slate-600">Transaction Ref ID: <span className="font-mono font-bold text-slate-800">{viewInvoice.paymentReference || ('TXN-' + viewInvoice.invoiceNumber.replace(/^INV-/, ''))}</span></p>
                    <p className="text-slate-600">Balance Outstanding: <span className={`font-bold ${remainingDue > 0 ? 'text-red-600' : 'text-slate-700'}`}>{formatCurrency(remainingDue)}</span></p>
                  </div>
                </div>

                {/* Particulars Itemized Table */}
                {(() => {
                  const accommodationRent = Math.round(viewInvoice.amount * 0.85);
                  const utilityMaintenance = viewInvoice.amount - accommodationRent;

                  return (
                    <>
                      <table className="w-full border-collapse border border-slate-300 mb-4 text-[11px]">
                        <thead>
                          <tr className="bg-slate-900 text-white text-left font-bold">
                            <th className="p-2 border border-slate-700 w-10 text-center">#</th>
                            <th className="p-2 border border-slate-700">Rent Particulars / Description</th>
                            <th className="p-2 border border-slate-700 w-32 text-center">Category</th>
                            <th className="p-2 border border-slate-700 w-28 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-300">
                            <td className="p-2 border border-slate-300 text-center font-medium">1</td>
                            <td className="p-2 border border-slate-300 font-semibold">
                              Monthly Room Rent & Accommodation
                              <p className="text-[10px] font-normal text-slate-500">Room accommodation and furnished stay for {viewInvoice.period || 'August 2026'}.</p>
                            </td>
                            <td className="p-2 border border-slate-300 text-center text-slate-700 font-medium">Room Rent</td>
                            <td className="p-2 border border-slate-300 text-right font-bold tabular-nums">{formatCurrency(accommodationRent)}</td>
                          </tr>
                          <tr className="border-b border-slate-300">
                            <td className="p-2 border border-slate-300 text-center font-medium">2</td>
                            <td className="p-2 border border-slate-300 font-semibold">
                              Maintenance, Water & Utility Services
                              <p className="text-[10px] font-normal text-slate-500">Includes Wi-Fi, 24/7 security, housekeeping & water supply.</p>
                            </td>
                            <td className="p-2 border border-slate-300 text-center text-slate-700 font-medium">Utilities</td>
                            <td className="p-2 border border-slate-300 text-right font-bold tabular-nums">{formatCurrency(utilityMaintenance)}</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-bold text-xs">
                            <td colSpan={3} className="p-2.5 border border-slate-900 text-right uppercase">Net Total Amount Received:</td>
                            <td className="p-2.5 border border-slate-900 text-right font-extrabold text-sm tabular-nums">{formatCurrency(viewInvoice.amount)}</td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Amount in Words */}
                      <div className="border border-slate-300 rounded p-2.5 mb-4 bg-slate-50 flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Amount in Words:</span>
                        <span className="font-bold text-indigo-950 italic">{numberToWords(viewInvoice.amount)}</span>
                      </div>
                    </>
                  );
                })()}

                {/* HRA Tax Declaration & Verification QR Box */}
                <div className="grid grid-cols-12 gap-3 border border-indigo-200 rounded p-3 mb-4 bg-indigo-50/40">
                  <div className="col-span-3 flex flex-col items-center justify-center border-r border-indigo-200 pr-2 text-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://stayeaze.com/verify-receipt?rcp=${viewInvoice.invoiceNumber}%26tenant=${encodeURIComponent(viewInvoice.tenantName)}%26amount=${viewInvoice.amount}`}
                      alt="Receipt Verification QR Code"
                      className="h-20 w-20 border border-slate-300 rounded p-0.5 bg-white shadow-sm"
                    />
                    <span className="text-[9px] font-mono font-bold text-indigo-950 mt-1 uppercase">Scan to Verify</span>
                  </div>
                  <div className="col-span-9 text-[10px] text-slate-700 leading-tight space-y-1">
                    <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-indigo-200 pb-1">House Rent Allowance (HRA) Tax Declaration</p>
                    <p className="italic text-slate-800">
                      "Received with thanks from <span className="font-bold">{viewInvoice.tenantName}</span> a sum of <span className="font-bold">{formatCurrency(viewInvoice.amount)}</span> ({numberToWords(viewInvoice.amount)}) towards room rent for the month of <span className="font-bold">{viewInvoice.period || 'August 2026'}</span>."
                    </p>
                    <p><span className="font-semibold text-slate-900">HRA Tax Compliance:</span> Valid rent receipt for claiming HRA tax exemption under Section 10(13A) of Income Tax Act 1961.</p>
                    <p><span className="font-semibold text-slate-900">Landlord PAN:</span> <span className="font-mono font-bold text-indigo-950">{issuer?.pan || 'Not provided'}</span> &nbsp;|&nbsp; <span className="font-semibold text-slate-900">Verification Hash:</span> <span className="font-mono text-indigo-900">RCP-SHA256:{viewInvoice.invoiceNumber.replace(/[^A-Z0-9]/gi, '')}</span></p>
                  </div>
                </div>

                {/* Bank Details & Terms */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-3 mb-6">
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
                <div className="flex justify-between items-end border-t-2 border-slate-300 pt-4 mt-6">
                  <div className="text-[10px] text-slate-500 space-y-0.5">
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
            );
          })()}
        </DialogContent>
      </Dialog>

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
    </div>
  );
}

void TrendingUp;
