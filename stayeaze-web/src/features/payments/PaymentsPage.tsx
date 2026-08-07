import { useState } from 'react';
import { Wallet, Plus, Pencil, Trash2, TrendingUp, Banknote, CheckCircle2 } from 'lucide-react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Payment, Property, User } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm, useBulkDelete } from '@/lib/hooks/use-crud';

const ENDPOINT = '/payments';
const methods = [
  { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' }, { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];
const statuses = [{ value: 'success', label: 'Success' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }];

const emptyForm = {
  invoiceId: '', tenantName: '', propertyId: '', amount: 8000,
  method: 'upi' as Payment['method'], status: 'success' as Payment['status'],
  date: new Date().toISOString().slice(0, 10), collectedBy: '',
};

export default function PaymentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['payments-properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));
  const { data: users } = useQuery({
    queryKey: ['payments-users'],
    queryFn: () => api.get<{ data: User[] }>('/users', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const { data: payments } = useQuery({
    queryKey: ['payments-stats'],
    queryFn: () => api.get<{ data: Payment[] }>(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const totalCollected = payments?.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0) ?? 0;
  const successCount = payments?.filter((p) => p.status === 'success').length ?? 0;
  const pendingCount = payments?.filter((p) => p.status === 'pending').length ?? 0;

  const createMut = useCreate<Payment>(ENDPOINT, 'Payment');
  const updateMut = useUpdate<Payment>(ENDPOINT, 'Payment');
  const deleteMut = useDelete(ENDPOINT, 'Payment');
  const bulkDeleteMut = useBulkDelete(ENDPOINT, 'payments');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: Payment) {
    setEditing(row);
    form.reset({
      invoiceId: row.invoiceId, tenantName: row.tenantName, propertyId: row.propertyId, amount: row.amount,
      method: row.method, status: row.status, date: row.date, collectedBy: row.collectedBy,
    });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ tenantName: (v) => !v ? 'Required' : undefined, amount: (v) => Number(v) <= 0 ? 'Amount must be positive' : undefined })) return;
    const payload = {
      ...form.values,
      receiptNumber: editing?.receiptNumber ?? `RCPT-${String(Date.now()).slice(-4)}`,
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Payment>[] = [
    { key: 'receiptNumber', header: 'Receipt', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.receiptNumber}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'amount', header: 'Amount', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.amount)}</span> },
    { key: 'method', header: 'Method', sortable: true, cell: (r) => <span className="inline-flex items-center gap-1.5 text-sm capitalize"><Banknote className="h-3.5 w-3.5 text-muted-foreground" />{(r.method || 'CASH').replace('_', ' ')}</span> },
    { key: 'collectedBy', header: 'Collected By', cell: (r) => <span className="text-sm">{r.collectedBy}</span> },
    { key: 'date', header: 'Date', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.date)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Record and reconcile payment transactions." icon={Wallet}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Record Payment</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Collected" value={formatCurrency(totalCollected)} icon={Wallet} accent="success" trend={{ value: '+8.4%', direction: 'up', positive: true }} />
        <StatCard label="Successful" value={successCount} icon={CheckCircle2} accent="primary" hint="Transactions" />
        <StatCard label="Pending" value={pendingCount} icon={TrendingUp} accent="warning" hint="Awaiting clearance" />
        <StatCard label="Avg. Transaction" value={formatCurrency(Math.round(totalCollected / (successCount || 1)))} icon={Banknote} accent="info" />
      </div>

      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search receipts or tenants..." exportFilename="payments" initialSortBy="date"
        filters={[{ key: 'method', label: 'Method', options: methods }, { key: 'status', label: 'Status', options: statuses }]}
        dateRangeFilter={{ key: 'date', label: 'Payment Date', field: 'date' }}
        bulkActions={[{ label: 'Delete Selected', icon: Trash2, variant: 'destructive', onAction: (ids) => bulkDeleteMut.mutate(ids) }]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Payment' : 'Record Payment'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Record'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <div className="space-y-1.5"><Label>Property</Label><Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <FormInput label="Amount (₹)" required type="number" id="amount" value={String(form.values.amount)} onChange={(e) => form.setValue('amount', Number(e.target.value))} error={form.errors.amount} />
          <FormInput label="Invoice Reference" id="invoiceId" value={form.values.invoiceId} onChange={(e) => form.setValue('invoiceId', e.target.value)} />
          <div className="space-y-1.5"><Label>Payment Method</Label><Select value={form.values.method} onValueChange={(v) => form.setValue('method', v as Payment['method'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{methods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Payment['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <FormInput label="Date" type="date" id="date" value={form.values.date} onChange={(e) => form.setValue('date', e.target.value)} />
          <div className="space-y-1.5"><Label>Collected By</Label><Select value={form.values.collectedBy} onValueChange={(v) => form.setValue('collectedBy', v)}><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{(users ?? []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Payment" variant="destructive"
        description={`Delete payment "${deleteTarget?.receiptNumber}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
