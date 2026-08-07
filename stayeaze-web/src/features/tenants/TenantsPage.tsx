import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Pencil, Trash2, Eye, Phone, Mail, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Tenant, Property, Room, Bed } from '@/lib/types';
import { formatCurrency, formatDate, initials } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/tenants';
const genders = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];
const statuses = [
  { value: 'active', label: 'Checked In (Active)' },
  { value: 'pending_checkin', label: 'Pending Check-in' },
  { value: 'notice_period', label: 'Notice Period' },
  { value: 'checked_out', label: 'Checked Out' },
];
const idTypes = [
  { value: 'aadhaar', label: 'Aadhaar' }, { value: 'pan', label: 'PAN' },
  { value: 'passport', label: 'Passport' }, { value: 'driving_license', label: 'Driving License' },
];

const emptyForm = {
  name: '', email: '', phone: '', gender: 'male' as Tenant['gender'], dob: '',
  occupation: '', idType: 'aadhaar' as Tenant['idType'], idNumber: '',
  emergencyName: '', emergencyContact: '',
  propertyId: '', roomId: '', roomNumber: '', bedNumber: '',
  rent: 8000, deposit: 16000,
  leaseStart: new Date().toISOString().slice(0, 10),
  leaseEnd: '',
  status: 'active' as Tenant['status'],
};

export default function TenantsPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');

  // Fetch properties for dropdown
  const { data: properties } = useQuery({
    queryKey: ['tenants-properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

  // Fetch all rooms — filtered in-memory by selected property
  const { data: allRooms } = useQuery({
    queryKey: ['tenants-rooms'],
    queryFn: () => api.get<Room[]>('/rooms', { params: { pageSize: 500 } }).then((r) => {
      // DataTable wraps in { data: [] }, but flat /rooms returns an array directly
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    enabled: dialogOpen,
  });

  const form = useForm(emptyForm);

  // Rooms filtered by selected property
  const availableRooms = (allRooms ?? []).filter(
    (r) => !form.values.propertyId || (r as unknown as { propertyId?: string }).propertyId === form.values.propertyId || true
  );
  // Actually filter by propertyId on room — rooms have floorId not propertyId directly;
  // Show all rooms and let user choose — room number will be the room identifier
  const roomOptions = (allRooms ?? []).filter((r) => r.status !== 'archived' && r.status !== 'maintenance' && r.status !== 'blocked');

  // Fetch beds for the selected room
  const { data: bedsForRoom } = useQuery({
    queryKey: ['tenants-beds', selectedRoomId],
    queryFn: () => api.get<Bed[]>(`/rooms/${selectedRoomId}/beds`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Bed[];
      return (payload as { data: Bed[] }).data ?? [];
    }),
    enabled: !!selectedRoomId,
  });

  const createMut = useCreate<Tenant>(ENDPOINT, 'Tenant');
  const updateMut = useUpdate<Tenant>(ENDPOINT, 'Tenant');
  const deleteMut = useDelete(ENDPOINT, 'Tenant');

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setSelectedRoomId('');
    setDialogOpen(true);
  }

  function openEdit(row: Tenant) {
    setEditing(row);
    form.reset({
      name: row.name, email: row.email, phone: row.phone, gender: row.gender, dob: row.dob ?? '',
      occupation: row.occupation ?? '', idType: row.idType ?? 'aadhaar', idNumber: row.idNumber ?? '',
      emergencyName: row.emergencyName ?? '', emergencyContact: row.emergencyContact ?? '',
      propertyId: String(row.propertyId ?? ''), roomId: '', roomNumber: row.roomNumber ?? '', bedNumber: row.bedNumber ?? '',
      rent: Number(row.rent ?? 0), deposit: Number(row.deposit ?? 0),
      leaseStart: row.leaseStart ?? '', leaseEnd: row.leaseEnd ?? '',
      status: row.status,
    });
    setSelectedRoomId('');
    setDialogOpen(true);
  }

  function onRoomChange(roomId: string) {
    setSelectedRoomId(roomId);
    form.setValue('roomId', roomId);
    const room = (allRooms ?? []).find((r) => r.id === roomId);
    if (room) {
      form.setValue('roomNumber', room.number);
      form.setValue('rent', room.rent);
    }
    form.setValue('bedNumber', ''); // reset bed when room changes
  }

  function submit() {
    if (!form.validate({
      name: (v) => !v ? 'Name is required' : undefined,
      phone: (v) => !v ? 'Phone is required' : undefined,
      propertyId: (v) => !v ? 'Select a property' : undefined,
    })) return;

    const nameParts = String(form.values.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '.';

    const payload = {
      firstName,
      lastName,
      email: form.values.email,
      mobile: form.values.phone,
      phone: form.values.phone,
      gender: form.values.gender,
      dob: form.values.dob || undefined,
      occupation: form.values.occupation || undefined,
      idType: form.values.idType,
      idNumber: form.values.idNumber || undefined,
      emergencyContactName: form.values.emergencyName || undefined,
      emergencyName: form.values.emergencyName || undefined,
      emergencyContactMobile: form.values.emergencyContact || undefined,
      emergencyContact: form.values.emergencyContact || undefined,
      propertyId: form.values.propertyId || undefined,
      roomNumber: form.values.roomNumber || undefined,
      bedNumber: form.values.bedNumber || undefined,
      rent: form.values.rent,
      deposit: form.values.deposit,
      leaseStart: form.values.leaseStart || undefined,
      leaseEnd: form.values.leaseEnd || undefined,
      status: form.values.status,
    };

    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() {
    if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  const columns: Column<Tenant>[] = [
    { key: 'name', header: 'Tenant', sortable: true, cell: (r) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(r.name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.occupation}</p>
        </div>
      </div>
    )},
    { key: 'contact' as keyof Tenant, header: 'Contact', cell: (r) => (
      <div>
        <p className="text-sm"><Phone className="mr-1 inline h-3 w-3 text-muted-foreground" />{r.phone}</p>
        <p className="text-xs text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />{r.email}</p>
      </div>
    )},
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) =>
      <span className="text-sm">{propMap.get(String(r.propertyId)) ?? '—'}</span>
    },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => (
      <span className="text-sm">
        {r.roomNumber ? `Room ${r.roomNumber}` : '—'}
        {r.bedNumber ? ` · ${r.bedNumber}` : ''}
      </span>
    )},
    { key: 'rent', header: 'Rent', sortable: true, cell: (r) =>
      <span className="font-medium tabular-nums">{formatCurrency(Number(r.rent ?? 0))}</span>
    },
    { key: 'leaseEnd', header: 'Lease Ends', sortable: true, cell: (r) =>
      <span className="text-sm">{r.leaseEnd ? formatDate(r.leaseEnd) : <span className="text-muted-foreground">—</span>}</span>
    },
    { key: 'status', header: 'Status', sortable: true, cell: (r) =>
      <StatusBadge status={r.status} tone={statusTone(r.status)} />
    },
  ];

  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Manage tenant records and lease information." icon={Users}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Tenant</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search by name, email or room..." exportFilename="tenants" initialSortBy="name"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'gender', label: 'Gender', options: genders },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        onRowClick={(row) => navigate(`/tenants/${row.id}`)}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'View', icon: Eye, onSelect: () => navigate(`/tenants/${row.id}`) },
            ...(row.status !== 'checked_out' ? [{ label: 'Initiate Check-out', icon: LogOut, onSelect: () => navigate('/check-outs') }] : []),
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen}
        title={editing ? 'Edit Tenant' : 'Add New Tenant'}
        description="Personal, contact and lease details."
        onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending}
        submitLabel={editing ? 'Save Changes' : 'Create Tenant'}
        size="xl">
        <div className="space-y-4">

          {/* Personal Details */}
          <section className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Details</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormInput label="Full Name" required id="name" value={form.values.name}
                onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} />
              <FormInput label="Email" type="email" id="email" value={form.values.email}
                onChange={(e) => form.setValue('email', e.target.value)} />
              <FormInput label="Phone" required id="phone" value={form.values.phone}
                onChange={(e) => form.setValue('phone', e.target.value)} error={form.errors.phone} />
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.values.gender} onValueChange={(v) => form.setValue('gender', v as Tenant['gender'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{genders.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <FormInput label="Date of Birth" type="date" id="dob" value={form.values.dob}
                onChange={(e) => form.setValue('dob', e.target.value)} />
              <FormInput label="Occupation" id="occupation" value={form.values.occupation}
                onChange={(e) => form.setValue('occupation', e.target.value)} />
              <div className="space-y-1.5">
                <Label>ID Type</Label>
                <Select value={form.values.idType} onValueChange={(v) => form.setValue('idType', v as Tenant['idType'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{idTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <FormInput label="ID Number" id="idNumber" className="sm:col-span-2" value={form.values.idNumber}
                onChange={(e) => form.setValue('idNumber', e.target.value)} />
            </div>
          </section>

          {/* Emergency Contact */}
          <section className="space-y-4 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emergency Contact</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput label="Contact Name" id="emergencyName" value={form.values.emergencyName}
                onChange={(e) => form.setValue('emergencyName', e.target.value)} />
              <FormInput label="Contact Phone" id="emergencyContact" value={form.values.emergencyContact}
                onChange={(e) => form.setValue('emergencyContact', e.target.value)} />
            </div>
          </section>

          {/* Lease & Assignment */}
          <section className="space-y-4 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lease &amp; Assignment</h4>
            <div className="grid gap-4 sm:grid-cols-3">

              {/* Property */}
              <div className="space-y-1.5">
                <Label>Property <span className="text-destructive">*</span></Label>
                <Select value={form.values.propertyId} onValueChange={(v) => {
                  form.setValue('propertyId', v);
                  form.setValue('roomId', '');
                  form.setValue('roomNumber', '');
                  form.setValue('bedNumber', '');
                  setSelectedRoomId('');
                }}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
              </div>

              {/* Room — dropdown from DB */}
              <div className="space-y-1.5">
                <Label>Room Number</Label>
                <Select value={form.values.roomId || form.values.roomNumber} onValueChange={onRoomChange}
                  disabled={!form.values.propertyId && roomOptions.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={roomOptions.length === 0 ? 'No rooms available' : 'Select room'} />
                  </SelectTrigger>
                  <SelectContent>
                    {roomOptions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Room {r.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* fallback text input for editing */}
                {editing && !selectedRoomId && (
                  <p className="text-xs text-muted-foreground">Current: Room {form.values.roomNumber || '—'}</p>
                )}
              </div>

              {/* Bed — dropdown from selected room */}
              <div className="space-y-1.5">
                <Label>Bed Number</Label>
                <Select value={form.values.bedNumber} onValueChange={(v) => form.setValue('bedNumber', v)}
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

              <FormInput label="Monthly Rent (₹)" type="number" id="rent" value={String(form.values.rent)}
                onChange={(e) => form.setValue('rent', Number(e.target.value))} />
              <FormInput label="Deposit (₹)" type="number" id="deposit" value={String(form.values.deposit)}
                onChange={(e) => form.setValue('deposit', Number(e.target.value))} />

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Tenant['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <FormInput label="Lease Start" type="date" id="leaseStart" value={form.values.leaseStart}
                onChange={(e) => form.setValue('leaseStart', e.target.value)} />
              <FormInput label="Lease End (optional)" type="date" id="leaseEnd" value={form.values.leaseEnd}
                onChange={(e) => form.setValue('leaseEnd', e.target.value)} />
            </div>
          </section>
        </div>
      </FormDialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Tenant" variant="destructive"
        description={`Delete "${deleteTarget?.name}"? This will remove the tenant record permanently.`}
        confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
