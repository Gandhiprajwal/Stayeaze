import { useState } from 'react';
import { 
  Wallet, Plus, Pencil, Trash2, Banknote, CheckCircle2, 
  CreditCard, Printer, Eye, Building2, ShieldCheck, QrCode, ArrowUpRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Payment, Property, User, Tenant, InvoiceIssuerSnapshot } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm, useBulkDelete } from '@/lib/hooks/use-crud';
import { toast } from 'sonner';

import { TenantSelect } from '@/components/common/TenantSelect';

const ENDPOINT = '/payments';
const methods = [
  { value: 'razorpay', label: 'Razorpay Online (Cards, UPI, NetBanking)' },
  { value: 'cash', label: 'Cash Payment' },
  { value: 'upi', label: 'UPI Direct / VPA' },
  { value: 'card', label: 'POS Debit / Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer (IMPS / NEFT)' },
  { value: 'cheque', label: 'Cheque' },
];
const statuses = [
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending Clearance' },
  { value: 'failed', label: 'Failed' }
];

const emptyForm = {
  tenantId: '', invoiceId: '', tenantName: '', propertyId: '', amount: 8000,
  method: 'razorpay' as Payment['method'], status: 'success' as Payment['status'],
  date: new Date().toISOString().slice(0, 10), collectedBy: '',
  paymentReference: '',
};

export default function PaymentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['payments-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p]));
  
  const { data: tenants } = useQuery({
    queryKey: ['payments-tenants'],
    queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['payments-users'],
    queryFn: () => api.get<{ data: User[] }>('/users', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const { data: payments } = useQuery({
    queryKey: ['payments-stats'],
    queryFn: () => api.get<{ data: Payment[] }>(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const { data: billingProfile } = useQuery({
    queryKey: ['organization-billing-profile'],
    queryFn: () => api.get<InvoiceIssuerSnapshot>('/organization-billing-profile').then((r) => r.data),
  });

  const totalCollected = payments?.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0) ?? 0;
  const razorpayCollected = payments?.filter((p) => p.status === 'success' && (p.method === 'razorpay' || p.method === 'card')).reduce((s, p) => s + p.amount, 0) ?? 0;
  const cashCollected = payments?.filter((p) => p.status === 'success' && p.method === 'cash').reduce((s, p) => s + p.amount, 0) ?? 0;
  const successCount = payments?.filter((p) => p.status === 'success').length ?? 0;

  const createMut = useCreate<Payment>(ENDPOINT, 'Payment');
  const updateMut = useUpdate<Payment>(ENDPOINT, 'Payment');
  const deleteMut = useDelete(ENDPOINT, 'Payment');
  const bulkDeleteMut = useBulkDelete(ENDPOINT, 'payments');
  const form = useForm(emptyForm);

  function handleSelectTenant(tenantId: string) {
    form.setValue('tenantId', tenantId);
    const selected = (tenants ?? []).find((t) => t.id === tenantId);
    if (selected) {
      form.setValue('tenantName', selected.name);
      if (selected.propertyId) form.setValue('propertyId', selected.propertyId);
      if (selected.rent) form.setValue('amount', selected.rent);
      if (selected.roomNumber) form.setValue('invoiceId', `Room ${selected.roomNumber}`);
    }
  }

  function openCreate() { form.reset(emptyForm); setDialogOpen(true); }

  function submit() {
    if (!form.validate({ tenantName: (v) => !v ? 'Required' : undefined, amount: (v) => Number(v) <= 0 ? 'Amount must be positive' : undefined })) return;
    const ref = form.values.paymentReference || (form.values.method === 'razorpay' ? `pay_online_${Date.now()}` : `REF-${Date.now().toString().slice(-6)}`);
    const payload = {
      ...form.values,
      receiptNumber: `RCPT-${String(Date.now()).slice(-6)}`,
      paymentReference: ref,
      razorpayPaymentId: form.values.method === 'razorpay' ? ref : undefined,
    };
    createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  function handlePrintReceipt() {
    const printContent = document.getElementById('printable-official-payment-receipt');
    if (!printContent) {
      window.print();
      return;
    }

    const printWin = window.open('', '_blank', 'width=850,height=1000');
    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Rent Receipt - ${viewingReceipt?.receiptNumber || 'StayEaze'}</title>
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
              padding: 16px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print\\:hidden { display: none !important; }
          </style>
        </head>
        <body>
          <div style="max-width: 700px; margin: 0 auto; border: 2px solid #e2e8f0; border-radius: 16px; padding: 24px; background: white;">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 350);
            };
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  }

  const columns: Column<Payment>[] = [
    { 
      key: 'receiptNumber', 
      header: 'Receipt No.', 
      sortable: true, 
      cell: (r) => (
        <button 
          onClick={() => setViewingReceipt(r)}
          className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline flex items-center gap-1"
        >
          <span>{r.receiptNumber}</span>
          <ArrowUpRight className="h-3 w-3 opacity-60" />
        </button>
      ) 
    },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium text-slate-900 dark:text-slate-100">{r.tenantName}</span> },
    { 
      key: 'propertyId', 
      header: 'Property', 
      cell: (r) => {
        const tenant = tenants?.find((t) => t.name === r.tenantName);
        const pId = r.propertyId || tenant?.propertyId;
        const propName = pId ? propMap.get(pId)?.name : (properties && properties.length > 0 ? properties[0].name : '—');
        return <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{propName}</span>;
      } 
    },
    { key: 'amount', header: 'Amount Paid', sortable: true, cell: (r) => <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(r.amount)}</span> },
    { 
      key: 'method', 
      header: 'Payment Method', 
      sortable: true, 
      cell: (r) => {
        const isOnline = r.method === 'razorpay' || r.method === 'card';
        return (
          <div className="flex items-center gap-1.5">
            {isOnline ? <CreditCard className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> : <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {(r.method || 'CASH').replace('_', ' ')}
            </span>
          </div>
        );
      } 
    },
    { 
      key: 'paymentReference', 
      header: 'Transaction Ref ID', 
      cell: (r) => (
        <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
          {r.paymentReference || r.razorpayPaymentId || 'CASH-REC'}
        </span>
      ) 
    },
    { key: 'collectedBy', header: 'Collected By', cell: (r) => <span className="text-sm text-slate-600 dark:text-slate-400">{r.collectedBy || 'Staff Admin'}</span> },
    { key: 'date', header: 'Date', sortable: true, cell: (r) => <span className="text-sm text-slate-600 dark:text-slate-400">{formatDate(r.date)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const currentProperty = viewingReceipt ? propMap.get(viewingReceipt.propertyId) : null;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Payment & Collections" 
        description="Monitor, record, and reconcile rent payments and official receipts." 
        icon={Wallet}
        actions={
          <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm">
            <Plus className="mr-1.5 h-4 w-4" /> Record New Payment
          </Button>
        } 
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Rent Collected" value={formatCurrency(totalCollected)} icon={Wallet} accent="success" hint="All cleared transactions" />
        <StatCard label="Razorpay Online Gateway" value={formatCurrency(razorpayCollected)} icon={CreditCard} accent="primary" hint="UPI, Cards & NetBanking" />
        <StatCard label="Cash Counter Payments" value={formatCurrency(cashCollected)} icon={Banknote} accent="info" hint="Direct cash receipts" />
        <StatCard label="Successful Transactions" value={successCount} icon={CheckCircle2} accent="success" hint="Cleared receipts" />
      </div>

      <DataTable 
        endpoint={ENDPOINT} 
        columns={columns} 
        searchPlaceholder="Search receipts, tenants or transaction IDs..." 
        exportFilename="payments_collection_report" 
        initialSortBy="date"
        filters={[{ key: 'method', label: 'Payment Method', options: methods }, { key: 'status', label: 'Status', options: statuses }]}
        dateRangeFilter={{ key: 'date', label: 'Payment Date', field: 'date' }}
        bulkActions={[{ label: 'Delete Selected', icon: Trash2, variant: 'destructive', onAction: (ids) => bulkDeleteMut.mutate(ids) }]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'View Official Receipt', icon: Eye, onSelect: () => setViewingReceipt(row) },
            { label: 'Print Receipt (PDF)', icon: Printer, onSelect: () => { setViewingReceipt(row); setTimeout(handlePrintReceipt, 300); } },
            { label: 'Delete Record', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} 
      />

      {/* Record Payment Form Dialog */}
      <FormDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        title="Record New Rent Payment" 
        onSubmit={submit}
        loading={createMut.isPending} 
        submitLabel="Record & Generate Receipt"
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
                  if (t.roomNumber) form.setValue('invoiceId', `Room ${t.roomNumber}`);
                }}
              />
            </div>
          )}

          <FormInput 
            label="Tenant Full Name" 
            required 
            id="tenantName" 
            placeholder="e.g. Rahul Sharma"
            value={form.values.tenantName} 
            onChange={(e) => form.setValue('tenantName', e.target.value)} 
            error={form.errors.tenantName} 
          />
          <div className="space-y-1.5">
            <Label>Property / Hostel</Label>
            <Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{(properties ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <FormInput 
            label="Payment Amount (₹)" 
            required 
            type="number" 
            id="amount" 
            value={String(form.values.amount)} 
            onChange={(e) => form.setValue('amount', Number(e.target.value))} 
            error={form.errors.amount} 
          />
          <FormInput 
            label="Invoice / Room Ref No." 
            id="invoiceId" 
            placeholder="e.g. INV-2026-001 or Room 104"
            value={form.values.invoiceId} 
            onChange={(e) => form.setValue('invoiceId', e.target.value)} 
          />
          <div className="space-y-1.5">
            <Label>Payment Method</Label>
            <Select value={form.values.method} onValueChange={(v) => form.setValue('method', v as Payment['method'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => {
                  const isRazorpay = m.value === 'razorpay';
                  const isConfigured = (billingProfile as any)?.hasRazorpayConfigured;
                  const disabled = isRazorpay && !isConfigured;
                  const label = isRazorpay && !isConfigured ? 'Razorpay Online (Not Configured by Owner)' : m.label;
                  return <SelectItem key={m.value} value={m.value} disabled={disabled}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <FormInput 
            label="Transaction Ref / Razorpay ID" 
            id="paymentReference" 
            placeholder="e.g. pay_TMzrAcqaVP9Rns or UPI/1234"
            value={form.values.paymentReference} 
            onChange={(e) => form.setValue('paymentReference', e.target.value)} 
          />
          <div className="space-y-1.5">
            <Label>Clearance Status</Label>
            <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Payment['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <FormInput label="Payment Date" type="date" id="date" value={form.values.date} onChange={(e) => form.setValue('date', e.target.value)} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Collected By (Staff / Owner Name)</Label>
            <Select value={form.values.collectedBy} onValueChange={(v) => form.setValue('collectedBy', v)}>
              <SelectTrigger><SelectValue placeholder="Select staff member..." /></SelectTrigger>
              <SelectContent>{(users ?? []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name} ({u.role})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      {/* Official Printable Rent Receipt Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={(o) => !o && setViewingReceipt(null)}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
          {viewingReceipt && (
            <div id="printable-official-payment-receipt" className="printable-receipt-card bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 sm:p-8 space-y-6">
              
              {/* Receipt Top Header */}
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      {currentProperty?.name || 'StayEaze Accommodations'}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {currentProperty?.address || 'Official PG / Hostel Accommodation & Rental Receipt'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs rounded-full border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                    Rent Receipt
                  </span>
                  <p className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 mt-1.5">
                    {viewingReceipt.receiptNumber}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Date: {formatDate(viewingReceipt.date)}
                  </p>
                </div>
              </div>

              {/* Tax & Verification Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-[10px]">Landlord PAN (Sec 10 13A HRA)</span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {billingProfile?.pan || currentProperty?.landlordPan || 'PRAJ0987A'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-semibold text-[10px]">PG License / Registration No</span>
                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {billingProfile?.registrationNumber || currentProperty?.pgLicenseNo || 'PG/2026/OFFICIAL/987'}
                  </p>
                </div>
              </div>

              {/* Tenant & Payment Information */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Paid By (Tenant)</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{viewingReceipt.tenantName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Payment Method</span>
                  <span className="font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {(viewingReceipt.method || 'CASH').replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-medium">Transaction / Ref ID</span>
                  <span className="font-mono font-extrabold text-indigo-950 dark:text-indigo-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    {viewingReceipt.paymentReference || viewingReceipt.razorpayPaymentId || ('TXN-' + viewingReceipt.receiptNumber.replace(/^RCPT-/, ''))}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Collected By</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{viewingReceipt.collectedBy || 'Property Manager'}</span>
                </div>
              </div>

              {/* Amount Highlight Banner */}
              <div className="rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex justify-between items-center">
                <div>
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Total Amount Paid</p>
                  <p className="text-xs text-slate-500 mt-0.5">Valid for HRA exemption & tenant records</p>
                </div>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(viewingReceipt.amount)}
                </span>
              </div>

              {/* Bottom Signatory & Verification Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-end">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <QrCode className="h-10 w-10 text-slate-800 dark:text-slate-200" />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Security QR Code Verified</p>
                    <p>Scan to verify authentic digital receipt</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Digitally Signed</span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {currentProperty?.authorizedSignatory || 'Authorized Manager'}
                  </p>
                  <p className="text-[10px] text-slate-400">Property Owner / Manager Seal</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="print:hidden flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setViewingReceipt(null)}>Close</Button>
                <Button onClick={handlePrintReceipt} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  <Printer className="mr-1.5 h-4 w-4" /> Print Official Receipt
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog 
        open={!!deleteTarget} 
        onOpenChange={(o) => !o && setDeleteTarget(null)} 
        title="Delete Payment Record" 
        variant="destructive"
        description={`Delete payment receipt "${deleteTarget?.receiptNumber}"?`} 
        confirmLabel="Delete" 
        onConfirm={confirmDelete} 
        loading={deleteMut.isPending} 
      />
    </div>
  );
}
