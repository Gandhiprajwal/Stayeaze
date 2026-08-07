import { useState } from 'react';
import { LogIn, Plus, Pencil, Trash2, BadgeCheck, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormDialog } from '@/components/common/FormDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { CheckIn, Property, Room, Bed } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/check-ins';
const statuses = [{ value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }];

const emptyForm = {
  tenantName: '', propertyId: '', roomNumber: '', bedNumber: 'B1',
  checkInDate: new Date().toISOString().slice(0, 10), leaseEnd: '',
  rent: 8000, depositPaid: 16000, idVerified: true, status: 'pending' as CheckIn['status'],
};

export default function CheckInsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CheckIn | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CheckIn | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<CheckIn | null>(null);
  const [checkInDate, setCheckInDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const { data: properties } = useQuery({
    queryKey: ['checkins-properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

  // Fetch all rooms for dropdown
  const { data: allRooms } = useQuery({
    queryKey: ['checkins-rooms'],
    queryFn: () => api.get<Room[]>('/rooms', { params: { pageSize: 500 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    enabled: dialogOpen,
  });

  const roomOptions = (allRooms ?? []).filter((r) => r.status !== 'archived' && r.status !== 'maintenance' && r.status !== 'blocked');

  // Fetch beds for selected room
  const { data: bedsForRoom } = useQuery({
    queryKey: ['checkins-beds', selectedRoomId],
    queryFn: () => api.get<Bed[]>(`/rooms/${selectedRoomId}/beds`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Bed[];
      return (payload as { data: Bed[] }).data ?? [];
    }),
    enabled: !!selectedRoomId,
  });

  const createMut = useCreate<CheckIn>(ENDPOINT, 'Check-in');
  const updateMut = useUpdate<CheckIn>(ENDPOINT, 'Check-in');
  const deleteMut = useDelete(ENDPOINT, 'Check-in');
  const form = useForm(emptyForm);

  function openCreate() {
    setEditing(null);
    setSelectedRoomId('');
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: CheckIn) {
    setEditing(row);
    const matchedRoom = (allRooms ?? []).find((r) => r.number === row.roomNumber);
    setSelectedRoomId(matchedRoom?.id ?? '');
    form.reset({
      tenantName: row.tenantName, propertyId: row.propertyId, roomNumber: row.roomNumber,
      bedNumber: row.bedNumber, checkInDate: row.checkInDate, leaseEnd: row.leaseEnd,
      rent: row.rent, depositPaid: row.depositPaid, idVerified: row.idVerified, status: row.status,
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.validate({ tenantName: (v) => !v ? 'Required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = { ...form.values, code: editing?.code ?? `CI-${String(Date.now()).slice(-4)}`, bookingId: editing?.bookingId };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  function openProcessModal(row: CheckIn) {
    setCheckInTarget(row);
    setCheckInDate(new Date().toISOString().slice(0, 10));
  }

  async function handleCompleteCheckIn() {
    if (!checkInTarget) return;
    try {
      setIsSubmitting(true);
      await api.post(`/check-ins/${checkInTarget.id}/mark-completed`, {
        checkInDate: checkInDate || new Date().toISOString().slice(0, 10),
      });
      setCheckInTarget(null);
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
    } catch (err) {
      console.error('Check-in completion error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<CheckIn>[] = [
    { key: 'code', header: 'Check-in ID', sortable: true, cell: (r) => (
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs font-medium">{r.code}</span>
        {r.bookingId && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-semibold border border-blue-200/60 dark:border-blue-800/40">
            <Calendar className="h-3 w-3" /> Booking
          </span>
        )}
      </div>
    )},
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => <span className="text-sm">Room {r.roomNumber} · {r.bedNumber}</span> },
    { key: 'checkInDate', header: 'Scheduled Date', sortable: true, cell: (r) => <span className="text-sm">{r.checkInDate ? formatDate(r.checkInDate) : '—'}</span> },
    { key: 'leaseEnd', header: 'Lease End', sortable: true, cell: (r) => <span className="text-sm">{r.leaseEnd ? formatDate(r.leaseEnd) : '—'}</span> },
    { key: 'depositPaid', header: 'Deposit', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.depositPaid)}</span> },
    { key: 'idVerified', header: 'ID', cell: (r) => r.idVerified ? <BadgeCheck className="h-5 w-5 text-success" /> : <span className="text-xs text-muted-foreground">Pending</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Check-in" description="Process tenant check-ins and room assignments." icon={LogIn}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New Check-in</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search check-ins..." exportFilename="check-ins" initialSortBy="checkInDate"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <div className="flex items-center justify-end gap-2">
            {row.status !== 'completed' ? (
              <Button
                size="sm"
                onClick={() => openProcessModal(row)}
                className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
              >
                <BadgeCheck className="h-4 w-4" /> Mark Checked In
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-md">
                <BadgeCheck className="h-3.5 w-3.5" /> Checked In
              </span>
            )}
            <RowActions items={[
              { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
              { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
            ]} />
          </div>
        )} />

      {/* New / Edit Check-In Form Dialog */}
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Check-in' : 'New Check-in'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Process Check-in'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <div className="space-y-1.5">
            <Label>Property</Label>
            <Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
          </div>

          {/* Room Number Dropdown */}
          <div className="space-y-1.5">
            <Label>Room Number</Label>
            <Select
              value={selectedRoomId}
              onValueChange={(roomId) => {
                setSelectedRoomId(roomId);
                const rm = roomOptions.find((r) => r.id === roomId);
                if (rm) {
                  form.setValue('roomNumber', rm.number);
                  if (rm.rent) form.setValue('rent', rm.rent);
                }
              }}>
              <SelectTrigger>
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    Room {r.number} ({r.sharing ? `${r.sharing} share` : 'Room'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && !selectedRoomId && (
              <p className="text-xs text-muted-foreground">Current: Room {form.values.roomNumber || '—'}</p>
            )}
          </div>

          {/* Bed Number Dropdown */}
          <div className="space-y-1.5">
            <Label>Bed Number</Label>
            <Select
              value={form.values.bedNumber}
              onValueChange={(v) => form.setValue('bedNumber', v)}
              disabled={!selectedRoomId}>
              <SelectTrigger>
                <SelectValue placeholder={!selectedRoomId ? 'Select room first' : (bedsForRoom?.length === 0 ? 'No beds' : 'Select bed')} />
              </SelectTrigger>
              <SelectContent>
                {(bedsForRoom ?? []).map((b) => {
                  const isUnavailable = (b.status === 'occupied' || b.status === 'archived' || b.status === 'maintenance' || b.status === 'blocked')
                    && (!editing || b.number !== editing.bedNumber);
                  const statusLabel = b.status === 'occupied' 
                    ? 'Occupied' 
                    : (b.status === 'archived' ? 'Archived' : (b.status === 'maintenance' ? 'Maintenance' : (b.status === 'blocked' ? 'Blocked' : b.status)));
                  return (
                    <SelectItem key={b.id} value={b.number} disabled={isUnavailable}>
                      {b.number} {isUnavailable ? `(${statusLabel} - Unavailable)` : `(${b.status})`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {editing && !selectedRoomId && form.values.bedNumber && (
              <p className="text-xs text-muted-foreground">Current: {form.values.bedNumber}</p>
            )}
          </div>

          <FormInput label="Check-in Date" type="date" id="checkInDate" value={form.values.checkInDate} onChange={(e) => form.setValue('checkInDate', e.target.value)} />
          <FormInput label="Lease End Date" type="date" id="leaseEnd" value={form.values.leaseEnd} onChange={(e) => form.setValue('leaseEnd', e.target.value)} />
          <FormInput label="Monthly Rent (₹)" type="number" id="rent" value={String(form.values.rent)} onChange={(e) => form.setValue('rent', Number(e.target.value))} />
          <FormInput label="Deposit Paid (₹)" type="number" id="depositPaid" value={String(form.values.depositPaid)} onChange={(e) => form.setValue('depositPaid', Number(e.target.value))} />
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as CheckIn['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex items-center gap-2 pt-6"><Checkbox id="idVerified" checked={form.values.idVerified} onCheckedChange={(v) => form.setValue('idVerified', v === true)} /><Label htmlFor="idVerified">ID document verified</Label></div>
        </div>
      </FormDialog>

      {/* Process Check-In Quick Dialog with Full Booking Details */}
      <FormDialog
        open={!!checkInTarget}
        onOpenChange={(open) => !open && setCheckInTarget(null)}
        title="Complete Tenant Check-in"
        onSubmit={handleCompleteCheckIn}
        loading={isSubmitting}
        submitLabel="Complete Check-in"
      >
        {checkInTarget && (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 p-3.5 text-sm space-y-2">
              <div className="flex items-center justify-between font-semibold text-blue-900 dark:text-blue-200">
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {checkInTarget.bookingId ? 'Booking Details' : 'Check-in Details'}</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">{checkInTarget.code}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                <div><span className="text-muted-foreground">Tenant Name:</span> <p className="font-semibold text-foreground">{checkInTarget.tenantName}</p></div>
                <div><span className="text-muted-foreground">Property:</span> <p className="font-semibold text-foreground">{propMap.get(checkInTarget.propertyId) ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Room / Bed:</span> <p className="font-semibold text-foreground">Room {checkInTarget.roomNumber} · {checkInTarget.bedNumber}</p></div>
                <div><span className="text-muted-foreground">Advance Deposit:</span> <p className="font-semibold text-foreground">{formatCurrency(checkInTarget.depositPaid)}</p></div>
                <div><span className="text-muted-foreground">Scheduled Date:</span> <p className="font-semibold text-foreground">{checkInTarget.checkInDate ? formatDate(checkInTarget.checkInDate) : '—'}</p></div>
                <div><span className="text-muted-foreground">Monthly Rent:</span> <p className="font-semibold text-foreground">{formatCurrency(checkInTarget.rent)}</p></div>
              </div>
            </div>

            <FormInput
              label="Effective Check-in Date"
              type="date"
              id="checkInDate"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
            />
          </div>
        )}
      </FormDialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Check-in" variant="destructive"
        description={`Delete check-in record "${deleteTarget?.code}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
