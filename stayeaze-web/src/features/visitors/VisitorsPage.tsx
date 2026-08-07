import { useState } from 'react';
import { UserCheck, Plus, Pencil, Trash2, Clock, LogOut } from 'lucide-react';
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
import type { Visitor, Property, User } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/visitors';
const purposes = [{ value: 'meeting', label: 'Meeting' }, { value: 'delivery', label: 'Delivery' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'other', label: 'Other' }];
const statuses = [{ value: 'checked_in', label: 'Checked In' }, { value: 'checked_out', label: 'Checked Out' }];

const emptyForm = {
  visitorName: '', visitorPhone: '', tenantName: '', propertyId: '',
  purpose: 'meeting' as Visitor['purpose'], status: 'checked_in' as Visitor['status'],
  approvedBy: '', checkInTime: new Date().toISOString(),
};

export default function VisitorsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Visitor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['visitors-properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));
  const { data: users } = useQuery({
    queryKey: ['visitors-users'],
    queryFn: () => api.get<{ data: User[] }>('/users', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const { data: visitors } = useQuery({
    queryKey: ['visitors-stats'],
    queryFn: () => api.get<{ data: Visitor[] }>(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const checkedIn = visitors?.filter((v) => v.status === 'checked_in').length ?? 0;
  const checkedOut = visitors?.filter((v) => v.status === 'checked_out').length ?? 0;

  const createMut = useCreate<Visitor>(ENDPOINT, 'Visitor');
  const updateMut = useUpdate<Visitor>(ENDPOINT, 'Visitor');
  const deleteMut = useDelete(ENDPOINT, 'Visitor');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: Visitor) {
    setEditing(row);
    form.reset({
      visitorName: row.visitorName, visitorPhone: row.visitorPhone, tenantName: row.tenantName,
      propertyId: row.propertyId, purpose: row.purpose, status: row.status,
      approvedBy: row.approvedBy, checkInTime: row.checkInTime,
    });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ visitorName: (v) => !v ? 'Required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = {
      ...form.values,
      checkOutTime: form.values.status === 'checked_out' ? new Date().toISOString() : undefined,
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Visitor>[] = [
    { key: 'visitorName', header: 'Visitor', sortable: true, cell: (r) => (
      <div><p className="font-medium">{r.visitorName}</p><p className="text-xs text-muted-foreground">{r.visitorPhone}</p></div>
    )},
    { key: 'tenantName', header: 'Meeting', sortable: true, cell: (r) => <span className="text-sm">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'purpose', header: 'Purpose', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.purpose}</span> },
    { key: 'checkInTime', header: 'Check-in', sortable: true, cell: (r) => <span className="text-sm">{formatDateTime(r.checkInTime)}</span> },
    { key: 'checkOutTime', header: 'Check-out', sortable: true, cell: (r) => <span className="text-sm">{r.checkOutTime ? formatDateTime(r.checkOutTime) : '—'}</span> },
    { key: 'approvedBy', header: 'Approved By', sortable: true, cell: (r) => <span className="text-sm">{r.approvedBy}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Visitor Management" description="Monitor visitor check-ins and approvals (management view)." icon={UserCheck}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Log Visitor</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Checked In" value={checkedIn} icon={Clock} accent="warning" hint="Currently inside" />
        <StatCard label="Checked Out" value={checkedOut} icon={LogOut} accent="success" hint="Completed visits" />
        <StatCard label="Total Today" value={(checkedIn + checkedOut)} icon={UserCheck} accent="primary" hint="All visitors" />
      </div>
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search visitors or tenants..." exportFilename="visitors" initialSortBy="checkInTime"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'purpose', label: 'Purpose', options: purposes },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Visitor' : 'Log Visitor'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Visitor Name" required id="visitorName" value={form.values.visitorName} onChange={(e) => form.setValue('visitorName', e.target.value)} error={form.errors.visitorName} />
          <FormInput label="Visitor Phone" id="visitorPhone" value={form.values.visitorPhone} onChange={(e) => form.setValue('visitorPhone', e.target.value)} />
          <FormInput label="Visiting Tenant" id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} />
          <div className="space-y-1.5"><Label>Property</Label><Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>{form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}</div>
          <div className="space-y-1.5"><Label>Purpose</Label><Select value={form.values.purpose} onValueChange={(v) => form.setValue('purpose', v as Visitor['purpose'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{purposes.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Visitor['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Approved By</Label><Select value={form.values.approvedBy} onValueChange={(v) => form.setValue('approvedBy', v)}><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger><SelectContent>{(users ?? []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Visitor" variant="destructive"
        description={`Delete visitor record for "${deleteTarget?.visitorName}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
