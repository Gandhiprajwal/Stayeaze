import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Plus, Pencil, Trash2, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
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
import type { Booking, Property, Room, Bed } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/bookings';
const statuses = [
  { value: 'pending', label: 'Pending' }, { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' }, { value: 'expired', label: 'Expired' },
  { value: 'checked_in', label: 'Checked In' },
];
const sources = [
  { value: 'direct', label: 'Direct' }, { value: 'website', label: 'Website' },
  { value: 'agent', label: 'Agent' }, { value: 'referral', label: 'Referral' },
];

const emptyForm = {
  tenantName: '', tenantEmail: '', tenantPhone: '', propertyId: '',
  roomNumber: '', bedNumber: 'B1', checkInDate: new Date().toISOString().slice(0, 10),
  durationMonths: 6, rent: 8000, deposit: 16000, status: 'pending' as Booking['status'],
  source: 'direct' as Booking['source'],
};

export default function BookingsPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');

  const { data: properties } = useQuery({
    queryKey: ['bookings-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

  // Fetch all rooms for dropdown
  const { data: allRooms } = useQuery({
    queryKey: ['bookings-rooms'],
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
    queryKey: ['bookings-beds', selectedRoomId],
    queryFn: () => api.get<Bed[]>(`/rooms/${selectedRoomId}/beds`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Bed[];
      return (payload as { data: Bed[] }).data ?? [];
    }),
    enabled: !!selectedRoomId,
  });

  const createMut = useCreate<Booking>(ENDPOINT, 'Booking');
  const updateMut = useUpdate<Booking>(ENDPOINT, 'Booking');
  const deleteMut = useDelete(ENDPOINT, 'Booking');
  const form = useForm(emptyForm);

  function openCreate() {
    setEditing(null);
    setSelectedRoomId('');
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: Booking) {
    setEditing(row);
    const matchedRoom = (allRooms ?? []).find((r) => r.number === row.roomNumber);
    setSelectedRoomId(matchedRoom?.id ?? '');
    form.reset({
      tenantName: row.tenantName, tenantEmail: row.tenantEmail, tenantPhone: row.tenantPhone,
      propertyId: row.propertyId, roomNumber: row.roomNumber, bedNumber: row.bedNumber,
      checkInDate: row.checkInDate, durationMonths: row.durationMonths, rent: row.rent,
      deposit: row.deposit, status: row.status, source: row.source,
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.validate({
      tenantName: (v) => !v ? 'Required' : undefined,
      tenantEmail: (v) => !v ? 'Required' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? 'Invalid email' : undefined,
      propertyId: (v) => !v ? 'Select a property' : undefined,
    })) return;
    const payload = {
      ...form.values,
      bookingCode: editing?.bookingCode ?? `BK-${String(Date.now()).slice(-4)}`,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Booking>[] = [
    { key: 'bookingCode', header: 'Booking ID', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.bookingCode}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => (
      <div><p className="font-medium">{r.tenantName}</p><p className="text-xs text-muted-foreground">{r.tenantEmail}</p></div>
    )},
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => <span className="text-sm">Room {r.roomNumber} · {r.bedNumber}</span> },
    { key: 'checkInDate', header: 'Check-in', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.checkInDate)}</span> },
    { key: 'rent', header: 'Rent', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.rent)}</span> },
    { key: 'source', header: 'Source', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.source}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="Manage booking requests and reservations." icon={CalendarCheck}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New Booking</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search by booking ID or tenant..." exportFilename="bookings" initialSortBy="checkInDate" initialSortOrder="desc"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'source', label: 'Source', options: sources },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        onRowClick={(row) => navigate(`/bookings/${row.id}`)}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'View', icon: Eye, onSelect: () => navigate(`/bookings/${row.id}`) },
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Booking' : 'New Booking'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <FormInput label="Email" required type="email" id="tenantEmail" value={form.values.tenantEmail} onChange={(e) => form.setValue('tenantEmail', e.target.value)} error={form.errors.tenantEmail} />
          <FormInput label="Phone" id="tenantPhone" value={form.values.tenantPhone} onChange={(e) => form.setValue('tenantPhone', e.target.value)} />
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
          <FormInput label="Duration (months)" type="number" id="durationMonths" value={String(form.values.durationMonths)} onChange={(e) => form.setValue('durationMonths', Number(e.target.value))} />
          <FormInput label="Monthly Rent (₹)" type="number" id="rent" value={String(form.values.rent)} onChange={(e) => form.setValue('rent', Number(e.target.value))} />
          <FormInput label="Deposit (₹)" type="number" id="deposit" value={String(form.values.deposit)} onChange={(e) => form.setValue('deposit', Number(e.target.value))} />
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Booking['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Source</Label><Select value={form.values.source} onValueChange={(v) => form.setValue('source', v as Booking['source'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sources.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Booking" variant="destructive"
        description={`Delete booking "${deleteTarget?.bookingCode}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}

void CheckCircle2; void XCircle;
