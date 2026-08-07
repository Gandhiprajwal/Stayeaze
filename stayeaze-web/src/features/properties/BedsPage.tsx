import { useState } from 'react';
import { BedDouble, Plus, Pencil, Trash2, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Bed, Room } from '@/lib/types';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/beds';
const statuses = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'maintenance', label: 'Maintenance' },
];

const emptyForm = { number: 'B1', roomId: '', status: 'available' as Bed['status'], tenantId: '' };

export default function BedsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bed | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bed | null>(null);

  const { data: rooms } = useQuery({
    queryKey: ['beds-rooms'],
    queryFn: () => api.get<{ data: Room[] }>('/rooms', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const roomMap = new Map((rooms ?? []).map((r) => [r.id, `Room ${r.number}`]));

  const createMut = useCreate<Bed>(ENDPOINT, 'Bed');
  const updateMut = useUpdate<Bed>(ENDPOINT, 'Bed');
  const deleteMut = useDelete(ENDPOINT, 'Bed');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: Bed) {
    setEditing(row);
    form.reset({ number: row.number, roomId: row.roomId, status: row.status, tenantId: row.tenantId ?? '' });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ roomId: (v) => !v ? 'Select a room' : undefined })) return;
    const payload = {
      roomId: form.values.roomId,
      bedNumber: form.values.number,
      number: form.values.number,
      status: form.values.status,
      tenantId: form.values.status === 'occupied' ? form.values.tenantId || undefined : undefined,
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Bed>[] = [
    { key: 'number', header: 'Bed', sortable: true, cell: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></div>
        <span className="font-medium">{r.number}</span>
      </div>
    )},
    { key: 'roomId', header: 'Room', sortable: true, cell: (r) => <span className="text-sm">{roomMap.get(r.roomId) ?? '—'}</span> },
    { key: 'tenantId', header: 'Tenant', sortable: true, cell: (r) => (r.tenantName || r.tenantId) ? (
      <span className="inline-flex items-center gap-1.5 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground" />{r.tenantName || r.tenantId}</span>
    ) : <span className="text-sm text-muted-foreground">—</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const roomFilterOptions = (rooms ?? []).map((r) => ({ value: r.id, label: `Room ${r.number}` }));

  return (
    <div className="space-y-6">
      <PageHeader title="Beds" description="Manage individual bed allocations and availability." icon={BedDouble}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Bed</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search beds..." exportFilename="beds" initialSortBy="number"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          ...(roomFilterOptions.length > 0 ? [{ key: 'roomId', label: 'Room', options: roomFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Bed' : 'Add Bed'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Room</Label><Select value={form.values.roomId} onValueChange={(v) => form.setValue('roomId', v)}><SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger><SelectContent>{(rooms ?? []).map((r) => <SelectItem key={r.id} value={r.id}>Room {r.number}</SelectItem>)}</SelectContent></Select>{form.errors.roomId && <p className="text-xs text-destructive">{form.errors.roomId}</p>}</div>
          <div className="space-y-1.5"><Label>Bed Number</Label><Select value={form.values.number} onValueChange={(v) => form.setValue('number', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['B1', 'B2', 'B3', 'B4'].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Bed['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Bed" variant="destructive"
        description={`Delete bed "${deleteTarget?.number}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
