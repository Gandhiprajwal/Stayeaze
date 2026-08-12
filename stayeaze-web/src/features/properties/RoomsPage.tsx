import { useState } from 'react';
import { DoorOpen, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Room, Floor } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/rooms';
const roomTypes = [
  { value: 'single', label: 'Single (1 sharing)' },
  { value: 'double', label: 'Double (2 sharing)' },
  { value: 'triple', label: 'Triple (3 sharing)' },
  { value: 'dorm', label: 'Dorm (4+ sharing)' },
];
const statuses = [
  { value: 'available', label: 'Available' },
  { value: 'partially_occupied', label: 'Partially Occupied' },
  { value: 'occupied', label: 'Fully Occupied' },
  { value: 'partially_reserved', label: 'Partially Reserved' },
  { value: 'reserved', label: 'Fully Reserved' },
  { value: 'maintenance', label: 'Maintenance' },
];
const allAmenities = ['AC', 'WiFi', 'Geyser', 'Wardrobe', 'Study Table', 'Balcony', 'Attached Bath', 'TV', 'Lift', 'Parking', 'Food', 'Laundry', 'Power Backup', 'Security' ];

const emptyForm = {
  number: '', type: 'double' as Room['type'], sharing: 2, beds: 2, occupied: 0,
  rent: 0, status: 'available' as Room['status'], floorId: '', amenities: [] as string[],
};

export default function RoomsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  const { data: floors } = useQuery({
    queryKey: ['rooms-floors'],
    queryFn: () => api.get<Floor[]>('/floors', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Floor[];
      return (payload as { data: Floor[] }).data ?? [];
    }),
  });
  const floorMap = new Map((floors ?? []).map((f) => [f.id, f.name]));

  const createMut = useCreate<Room>(ENDPOINT, 'Room');
  const updateMut = useUpdate<Room>(ENDPOINT, 'Room');
  const deleteMut = useDelete(ENDPOINT, 'Room');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: Room) {
    setEditing(row);
    const num = row.roomNumber || row.number || '';
    const rawType = (row.type || row.sharingType || 'double').toString().toLowerCase();
    const normalizedType = rawType.includes('single') ? 'single' : rawType.includes('double') ? 'double' : rawType.includes('triple') ? 'triple' : rawType.includes('dorm') ? 'dorm' : 'double';
    form.reset({
      number: num,
      type: normalizedType as Room['type'],
      sharing: row.sharing || (normalizedType === 'single' ? 1 : normalizedType === 'double' ? 2 : normalizedType === 'triple' ? 3 : 4),
      beds: row.beds || 2,
      occupied: row.occupied || 0,
      rent: row.rent || row.baseRent || 10000,
      status: (row.status || 'available').toLowerCase() as Room['status'],
      floorId: row.floorId || '',
      amenities: row.amenities ?? [],
    });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ number: (v) => !v ? 'Required' : undefined, floorId: (v) => !v ? 'Select a floor' : undefined })) return;
    const payload = {
      floorId: form.values.floorId,
      roomNumber: form.values.number,
      number: form.values.number,
      sharingType: (form.values.type as string).toUpperCase(),
      baseRent: form.values.rent,
      rent: form.values.rent,
      status: form.values.status,
      amenities: form.values.amenities ?? [],
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }
  function toggleAmenity(a: string) {
    const current = form.values.amenities || [];
    form.setValue('amenities', current.includes(a)
      ? current.filter((x) => x !== a)
      : [...current, a]);
  }

  const columns: Column<Room>[] = [
    { key: 'number', header: 'Room', sortable: true, cell: (r: any) => {
      const num = r.roomNumber || r.number || '';
      const display = num.toString().toLowerCase().startsWith('room') ? num : `Room ${num}`;
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><DoorOpen className="h-5 w-5" /></div>
          <div><p className="font-medium">{display}</p><p className="text-xs text-muted-foreground capitalize">{r.type || r.sharingType || '—'}</p></div>
        </div>
      );
    }},
    { key: 'floorId', header: 'Floor', sortable: true, cell: (r: any) => <span className="text-sm">{r.floorNumber !== undefined && r.floorNumber !== null ? `Floor ${r.floorNumber}` : (floorMap.get(r.floorId) ?? '—')}</span> },
    { key: 'sharing', header: 'Sharing', sortable: true, cell: (r) => <span className="tabular-nums">{r.sharing ?? 1} share</span> },
    { key: 'beds', header: 'Beds', sortable: true, cell: (r) => {
      const total = r.beds || r.sharing || 1;
      const occ = r.occupied ?? 0;
      const isRes = r.status === 'reserved' || r.status === 'partially_reserved';
      return (
        <div className="flex flex-col text-sm">
          <span>{occ}/{total} <span className="text-muted-foreground">occupied</span></span>
          {isRes && (
            <span className="text-[11px] font-medium text-info">
              {r.status === 'reserved' ? 'All Beds Reserved' : 'Bed Reserved'}
            </span>
          )}
        </div>
      );
    }},
    { key: 'rent', header: 'Rent', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.rent)}</span> },
    { key: 'amenities', header: 'Amenities', cell: (r: any) => (
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {(r.amenities || []).slice(0, 3).map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
        {(r.amenities || []).length > 3 && <Badge variant="outline" className="text-[10px]">+{r.amenities.length - 3}</Badge>}
      </div>
    )},
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const floorFilterOptions = (floors ?? []).map((f) => ({ value: f.id, label: f.name }));

  const queryClient = useQueryClient();

  const handleUnarchive = async (row: Room) => {
    try {
      await api.put(`/rooms/${row.id}/unarchive`);
      toast({ title: 'Room Unarchived', description: `Room "${row.roomNumber || row.number}" and nested beds unarchived successfully.` });
      queryClient.invalidateQueries({ queryKey: ['/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/beds'] });
      queryClient.invalidateQueries({ queryKey: ['/floors'] });
      queryClient.invalidateQueries({ queryKey: ['/buildings'] });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Action Failed', description: e?.response?.data?.message || 'Failed to unarchive room.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Rooms" description="Manage rooms, sharing types and amenities." icon={DoorOpen}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Room</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search rooms..." exportFilename="rooms" initialSortBy="number"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'type', label: 'Type', options: roomTypes },
          ...(floorFilterOptions.length > 0 ? [{ key: 'floorId', label: 'Floor', options: floorFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            ...(row.status?.toLowerCase() === 'archived' ? [{
              label: 'Unarchive Room',
              icon: RotateCcw,
              onSelect: () => handleUnarchive(row),
            }] : []),
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Room' : 'Add Room'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Room Number" required id="number" value={form.values.number} onChange={(e) => form.setValue('number', e.target.value)} error={form.errors.number} />
          <div className="space-y-1.5"><Label>Floor</Label><Select value={form.values.floorId} onValueChange={(v) => form.setValue('floorId', v)}><SelectTrigger><SelectValue placeholder="Select floor" /></SelectTrigger><SelectContent>{(floors ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select>{form.errors.floorId && <p className="text-xs text-destructive">{form.errors.floorId}</p>}</div>
          <div className="space-y-1.5"><Label>Room Type</Label><Select value={form.values.type} onValueChange={(v) => { form.setValue('type', v as Room['type']); const share = v === 'single' ? 1 : v === 'double' ? 2 : v === 'triple' ? 3 : 4; form.setValue('sharing', share); form.setValue('beds', share); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roomTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
          <FormInput label="Monthly Rent (₹)" type="number" id="rent" value={String(form.values.rent)} onChange={(e) => form.setValue('rent', Number(e.target.value))} />
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Room['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <FormInput label="Occupied Beds" type="number" id="occupied" value={String(form.values.occupied)} onChange={(e) => form.setValue('occupied', Number(e.target.value))} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Amenities</Label>
            <div className="flex flex-wrap gap-2 rounded-lg border p-3">
              {allAmenities.map((a) => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${(form.values.amenities || []).includes(a) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Room" variant="destructive"
        description={`Delete Room ${deleteTarget?.number}?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
