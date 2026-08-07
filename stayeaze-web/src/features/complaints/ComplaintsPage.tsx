import { useState } from 'react';
import { MessageSquareWarning, Plus, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Complaint, Property, User } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm, useBulkDelete } from '@/lib/hooks/use-crud';

const ENDPOINT = '/complaints';
const categories = [
  { value: 'electrical', label: 'Electrical' }, { value: 'plumbing', label: 'Plumbing' },
  { value: 'cleanliness', label: 'Cleanliness' }, { value: 'noise', label: 'Noise' },
  { value: 'security', label: 'Security' }, { value: 'other', label: 'Other' },
];
const priorities = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
];
const statuses = [
  { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
];

const emptyForm = {
  tenantName: '', propertyId: '', roomNumber: '', category: 'electrical' as Complaint['category'],
  priority: 'medium' as Complaint['priority'], description: '', status: 'open' as Complaint['status'],
  assignedTo: '',
};

export default function ComplaintsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Complaint | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['complaints-properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));
  const { data: users } = useQuery({
    queryKey: ['complaints-users'],
    queryFn: () => api.get<{ data: User[] }>('/users', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const { data: complaints } = useQuery({
    queryKey: ['complaints-stats'],
    queryFn: () => api.get<{ data: Complaint[] }>(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const open = complaints?.filter((c) => c.status === 'open').length ?? 0;
  const inProgress = complaints?.filter((c) => c.status === 'in_progress').length ?? 0;
  const resolved = complaints?.filter((c) => c.status === 'resolved' || c.status === 'closed').length ?? 0;

  const createMut = useCreate<Complaint>(ENDPOINT, 'Complaint');
  const updateMut = useUpdate<Complaint>(ENDPOINT, 'Complaint');
  const deleteMut = useDelete(ENDPOINT, 'Complaint');
  const bulkDeleteMut = useBulkDelete(ENDPOINT, 'complaints');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: Complaint) {
    setEditing(row);
    form.reset({
      tenantName: row.tenantName, propertyId: row.propertyId, roomNumber: row.roomNumber,
      category: row.category, priority: row.priority, description: row.description,
      status: row.status, assignedTo: row.assignedTo ?? '',
    });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ tenantName: (v) => !v ? 'Required' : undefined, description: (v) => !v ? 'Description is required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = {
      ...form.values,
      assignedTo: form.values.assignedTo || undefined,
      ticketNumber: editing?.ticketNumber ?? `CMP-${String(Date.now()).slice(-4)}`,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Complaint>[] = [
    { key: 'ticketNumber', header: 'Ticket', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.ticketNumber}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'category', header: 'Category', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.category}</span> },
    { key: 'priority', header: 'Priority', sortable: true, cell: (r) => <StatusBadge status={r.priority} tone={r.priority === 'critical' ? 'destructive' : r.priority === 'high' ? 'warning' : r.priority === 'medium' ? 'info' : 'neutral'} /> },
    { key: 'description', header: 'Description', cell: (r) => <span className="line-clamp-1 max-w-[240px] text-sm text-muted-foreground">{r.description}</span> },
    { key: 'assignedTo', header: 'Assigned', sortable: true, cell: (r) => <span className="text-sm">{r.assignedTo ?? '—'}</span> },
    { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Complaint Management" description="Review and resolve tenant complaints (management view)." icon={MessageSquareWarning}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Log Complaint</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={open} icon={MessageSquareWarning} accent="warning" />
        <StatCard label="In Progress" value={inProgress} icon={CheckCircle} accent="info" />
        <StatCard label="Resolved" value={resolved} icon={CheckCircle} accent="success" />
      </div>
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search tickets, tenants..." exportFilename="complaints" initialSortBy="createdAt"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'priority', label: 'Priority', options: priorities },
          { key: 'category', label: 'Category', options: categories },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        dateRangeFilter={{ key: 'createdAt', label: 'Created Date', field: 'createdAt' }}
        bulkActions={[{ label: 'Delete Selected', icon: Trash2, variant: 'destructive', onAction: (ids) => bulkDeleteMut.mutate(ids) }]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Complaint' : 'Log Complaint'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <div className="space-y-1.5"><Label>Property</Label><Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>{form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}</div>
          <FormInput label="Room Number" id="roomNumber" value={form.values.roomNumber} onChange={(e) => form.setValue('roomNumber', e.target.value)} />
          <div className="space-y-1.5"><Label>Category</Label><Select value={form.values.category} onValueChange={(v) => form.setValue('category', v as Complaint['category'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Priority</Label><Select value={form.values.priority} onValueChange={(v) => form.setValue('priority', v as Complaint['priority'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Complaint['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <FormTextarea label="Description" required className="sm:col-span-2" id="description" value={form.values.description} onChange={(e) => form.setValue('description', e.target.value)} error={form.errors.description} rows={3} />
          <div className="space-y-1.5 sm:col-span-2"><Label>Assign To</Label><Select value={form.values.assignedTo} onValueChange={(v) => form.setValue('assignedTo', v)}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent>{(users ?? []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Complaint" variant="destructive"
        description={`Delete complaint "${deleteTarget?.ticketNumber}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
