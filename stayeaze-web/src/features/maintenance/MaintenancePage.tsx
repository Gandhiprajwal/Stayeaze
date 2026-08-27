import { useState } from 'react';
import { Wrench, Plus, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Maintenance, Property } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/maintenance';
const types = [{ value: 'preventive', label: 'Preventive' }, { value: 'corrective', label: 'Corrective' }, { value: 'emergency', label: 'Emergency' }];
const priorities = [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }];
const statuses = [{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }];

const emptyForm = {
  asset: '', propertyId: '', type: 'corrective' as Maintenance['type'],
  priority: 'medium' as Maintenance['priority'], description: '', cost: 1000,
  vendor: '', status: 'open' as Maintenance['status'],
};

export default function MaintenancePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Maintenance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Maintenance | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['maintenance-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

  const { data: records } = useQuery({
    queryKey: ['maintenance-stats'],
    queryFn: () => api.get<{ data: Maintenance[] }>(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const open = records?.filter((m) => m.status === 'open').length ?? 0;
  const inProgress = records?.filter((m) => m.status === 'in_progress').length ?? 0;
  const totalCost = records?.filter((m) => m.status === 'completed').reduce((s, m) => s + m.cost, 0) ?? 0;

  const createMut = useCreate<Maintenance>(ENDPOINT, 'Maintenance task');
  const updateMut = useUpdate<Maintenance>(ENDPOINT, 'Maintenance task');
  const deleteMut = useDelete(ENDPOINT, 'Maintenance task');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: Maintenance) {
    setEditing(row);
    form.reset({
      asset: row.asset, propertyId: row.propertyId, type: row.type, priority: row.priority,
      description: row.description, cost: row.cost, vendor: row.vendor ?? '', status: row.status,
    });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ asset: (v) => !v ? 'Required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = {
      ...form.values, vendor: form.values.vendor || undefined,
      ticketNumber: editing?.ticketNumber ?? `MNT-${String(Date.now()).slice(-4)}`,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Maintenance>[] = [
    { key: 'ticketNumber', header: 'Ticket', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.ticketNumber}</span> },
    { key: 'asset', header: 'Asset', sortable: true, cell: (r) => <span className="font-medium">{r.asset}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{String(propMap.get(r.propertyId) || '—')}</span> },
    { key: 'type', header: 'Type', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.type}</span> },
    { key: 'priority', header: 'Priority', sortable: true, cell: (r) => <StatusBadge status={r.priority} tone={r.priority === 'critical' ? 'destructive' : r.priority === 'high' ? 'warning' : r.priority === 'medium' ? 'info' : 'neutral'} /> },
    { key: 'cost', header: 'Cost', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.cost)}</span> },
    { key: 'vendor', header: 'Vendor', sortable: true, cell: (r) => <span className="text-sm">{r.vendor ?? '—'}</span> },
    { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Track preventive and corrective maintenance tasks (management view)." icon={Wrench}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New Task</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open Tasks" value={open} icon={Wrench} accent="warning" />
        <StatCard label="In Progress" value={inProgress} icon={CheckCircle} accent="info" />
        <StatCard label="Maintenance Spend" value={formatCurrency(totalCost)} icon={Wrench} accent="primary" hint="Completed tasks" />
      </div>
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search tickets or assets..." exportFilename="maintenance" initialSortBy="createdAt"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'priority', label: 'Priority', options: priorities },
          { key: 'type', label: 'Type', options: types },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Maintenance Task' : 'New Maintenance Task'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Asset" required id="asset" value={form.values.asset} onChange={(e) => form.setValue('asset', e.target.value)} error={form.errors.asset} />
          <div className="space-y-1.5">
            <Label required>Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p) => ({
                value: p.id,
                label: p.name,
                sublabel: p.city || p.code || 'Property',
                badge: p.type || 'PG',
              }))}
              value={form.values.propertyId}
              onChange={(v) => form.setValue('propertyId', v)}
              placeholder="Search & select property..."
              searchPlaceholder="Search properties..."
            />
            {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
          </div>
          <div className="space-y-1.5"><Label>Type</Label><Select value={form.values.type} onValueChange={(v) => form.setValue('type', v as Maintenance['type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Priority</Label><Select value={form.values.priority} onValueChange={(v) => form.setValue('priority', v as Maintenance['priority'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
          <FormInput label="Estimated Cost (₹)" type="number" id="cost" value={String(form.values.cost)} onChange={(e) => form.setValue('cost', Number(e.target.value))} />
          <FormInput label="Vendor" id="vendor" value={form.values.vendor} onChange={(e) => form.setValue('vendor', e.target.value)} />
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Maintenance['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <FormTextarea label="Description" className="sm:col-span-2" id="description" value={form.values.description} onChange={(e) => form.setValue('description', e.target.value)} rows={3} />
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Task" variant="destructive"
        description={`Delete maintenance task "${deleteTarget?.ticketNumber}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
