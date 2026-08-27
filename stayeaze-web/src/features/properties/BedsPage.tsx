import { useState } from 'react';
import { BedDouble, Plus, Pencil, Trash2, User, Building2, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { formatCurrency, formatRoomName } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';
import type { Bed, Room } from '@/lib/types';

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

  const { data: properties } = useQuery({
    queryKey: ['beds-properties'],
    queryFn: () => api.get<any[]>('/properties', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] })?.data ?? [];
    }),
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

  const { data: buildings } = useQuery({
    queryKey: ['beds-buildings'],
    queryFn: () => api.get<any[]>('/buildings', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] })?.data ?? [];
    }),
  });

  const { data: floors } = useQuery({
    queryKey: ['beds-floors'],
    queryFn: () => api.get<any[]>('/floors', { params: { pageSize: 200 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] })?.data ?? [];
    }),
  });

  const { data: rooms } = useQuery({
    queryKey: ['beds-rooms'],
    queryFn: () => api.get<any>('/rooms', { params: { pageSize: 500 } }).then((r) => {
      const payload = r.data;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    staleTime: 0,
  });
  const roomMap = new Map((rooms ?? []).map((r: any) => [r.id, formatRoomName(r.roomNumber || r.number)]));

  const createMut = useCreate<Bed>(ENDPOINT, 'Bed');
  const updateMut = useUpdate<Bed>(ENDPOINT, 'Bed');
  const deleteMut = useDelete(ENDPOINT, 'Bed');
  const form = useForm(emptyForm);

  const [formPropId, setFormPropId] = useState<string>('');
  const [formBldId, setFormBldId] = useState<string>('');
  const [formFloorId, setFormFloorId] = useState<string>('');

  function openCreate() {
    setEditing(null);
    setFormPropId('');
    setFormBldId('');
    setFormFloorId('');
    form.reset(emptyForm);
    setDialogOpen(true);
  }
  function openEdit(row: Bed) {
    setEditing(row);
    const rm = (rooms ?? []).find((r: any) => r.id === row.roomId);
    const flr = (floors ?? []).find((f: any) => f.id === (rm?.floorId || (row as any).floorId));
    const bld = (buildings ?? []).find((b: any) => b.id === (rm?.buildingId || flr?.buildingId));
    const pId = rm?.propertyId || bld?.propertyId || '';

    setFormPropId(pId);
    setFormBldId(bld?.id || '');
    setFormFloorId(flr?.id || '');

    form.reset({ number: row.number || (row as any).bedNumber || 'B1', roomId: row.roomId, status: row.status, tenantId: row.tenantId ?? '' });
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
        <span className="font-bold font-mono">{r.number || (r as any).bedNumber}</span>
      </div>
    )},
    { key: 'roomId', header: 'Room', sortable: true, cell: (r: any) => (
      <span className="font-semibold text-sm">Room {formatRoomName(r.roomNumber || roomMap.get(r.roomId))}</span>
    )},
    { key: 'buildingName', header: 'Location (Property, Building & Floor)', sortable: true, cell: (r: any) => (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{r.buildingName || 'Main Building'}</span>
          <span>•</span>
          <Layers className="h-3 w-3" />
          <span>{r.floorName || (r.floorNumber != null ? `Floor ${r.floorNumber}` : 'Floor')}</span>
        </div>
        {r.propertyName && (
          <span className="text-[11px] text-muted-foreground pl-5 font-normal">
            {r.propertyName}
          </span>
        )}
      </div>
    )},
    { key: 'tenantId', header: 'Tenant', sortable: true, cell: (r) => (r.tenantName || r.tenantId) ? (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium"><User className="h-3.5 w-3.5 text-muted-foreground" />{r.tenantName || r.tenantId}</span>
    ) : <span className="text-sm text-muted-foreground">—</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const roomFilterOptions = (rooms ?? []).map((r: any) => ({
    value: r.id,
    label: `Room ${formatRoomName(r.roomNumber || r.number)} (${r.buildingName || 'Main Building'})`
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Beds" description="Manage individual bed allocations, building structures and availability." icon={BedDouble}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Bed</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search beds, rooms, buildings..." exportFilename="beds" initialSortBy="number"
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
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>1. Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: any) => ({
                value: p.id,
                label: p.name,
                sublabel: p.address || p.city || 'Property',
              }))}
              value={formPropId}
              onChange={(val) => {
                setFormPropId(val);
                setFormBldId('');
                setFormFloorId('');
                form.setValue('roomId', '');
              }}
              placeholder="Choose Property..."
              searchPlaceholder="Search properties..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>2. Building</Label>
            <SearchableSelect
              options={(buildings ?? [])
                .filter((b) => !formPropId || b.propertyId === formPropId)
                .map((b) => ({
                  value: b.id,
                  label: b.name,
                  sublabel: `${b.propertyName || propMap.get(b.propertyId) || 'Property'} • ${b.code || 'Building'}`,
                }))}
              value={formBldId}
              onChange={(val) => {
                setFormBldId(val);
                setFormFloorId('');
                form.setValue('roomId', '');
                const matchedBld = (buildings ?? []).find((b) => b.id === val);
                if (matchedBld && matchedBld.propertyId && !formPropId) {
                  setFormPropId(matchedBld.propertyId);
                }
              }}
              placeholder={formPropId ? "Select building in property..." : "Select building..."}
              searchPlaceholder="Search buildings..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>3. Floor</Label>
            <SearchableSelect
              options={(floors ?? [])
                .filter((f) => !formBldId || f.buildingId === formBldId)
                .map((f) => ({
                  value: f.id,
                  label: f.name || `Floor ${f.floorNumber || 1}`,
                  sublabel: `${f.buildingName || 'Building'} • Level ${f.floorNumber || 1}`,
                }))}
              value={formFloorId}
              onChange={(val) => {
                setFormFloorId(val);
                form.setValue('roomId', '');
                const matchedFloor = (floors ?? []).find((f) => f.id === val);
                if (matchedFloor) {
                  if (matchedFloor.buildingId && !formBldId) {
                    setFormBldId(matchedFloor.buildingId);
                  }
                  const bld = (buildings ?? []).find((b) => b.id === matchedFloor.buildingId);
                  if (bld && bld.propertyId && !formPropId) {
                    setFormPropId(bld.propertyId);
                  }
                }
              }}
              placeholder={formBldId ? "Select floor in building..." : "Select floor..."}
              searchPlaceholder="Search floors..."
            />
          </div>

          <div className="space-y-1.5">
            <Label required>4. Room</Label>
            <SearchableSelect
              options={(rooms ?? [])
                .filter((r: any) => !formFloorId || r.floorId === formFloorId)
                .map((r: any) => ({
                  value: r.id,
                  label: `Room ${r.roomNumber || r.number}`,
                  sublabel: `${r.buildingName || 'Building'} • ${r.floorName || (r.floorNumber != null ? 'Floor ' + r.floorNumber : 'Floor')}`,
                  badge: r.buildingName || 'Building',
                }))}
              value={form.values.roomId}
              onChange={(v) => {
                form.setValue('roomId', v);
                const matchedRoom = (rooms ?? []).find((r: any) => r.id === v);
                if (matchedRoom) {
                  if (matchedRoom.floorId && !formFloorId) {
                    setFormFloorId(matchedRoom.floorId);
                  }
                  if (matchedRoom.buildingId && !formBldId) {
                    setFormBldId(matchedRoom.buildingId);
                  }
                  const bld = (buildings ?? []).find((b) => b.id === matchedRoom.buildingId);
                  if (bld && bld.propertyId && !formPropId) {
                    setFormPropId(bld.propertyId);
                  }
                }
              }}
              placeholder={formFloorId ? "Select room on floor..." : "Select room..."}
              searchPlaceholder="Search room..."
            />
            {form.errors.roomId && <p className="text-xs text-destructive">{form.errors.roomId}</p>}
          </div>

          <div className="space-y-1.5">
            <Label required>Bed Identifier (e.g. B1, Bed A, B2)</Label>
            <Select value={form.values.number} onValueChange={(v) => form.setValue('number', v)}>
              <SelectTrigger><SelectValue placeholder="Select Bed" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="B1">Bed B1 (Window/Primary)</SelectItem>
                <SelectItem value="B2">Bed B2 (Secondary)</SelectItem>
                <SelectItem value="B3">Bed B3 (Corner)</SelectItem>
                <SelectItem value="B4">Bed B4 (Entrance)</SelectItem>
                <SelectItem value="Bed A">Bed A</SelectItem>
                <SelectItem value="Bed B">Bed B</SelectItem>
                <SelectItem value="Bed C">Bed C</SelectItem>
                <SelectItem value="Bed D">Bed D</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Availability Status</Label>
            <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Bed['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Bed" variant="destructive"
        description={`Delete Bed ${deleteTarget?.number}?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
