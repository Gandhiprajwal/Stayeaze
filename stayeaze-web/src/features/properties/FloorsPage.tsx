import { useState, useMemo } from 'react';
import { Building2, Plus, Pencil, Trash2, Layers, RotateCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { usePropertyStore } from '@/lib/stores/property-store';
import type { Floor } from '@/lib/types';
import type { Building as BuildingType } from '@/lib/types';
import { occupancyRate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/floors';

type FormValues = {
  name: string;
  number: number;
  buildingId: string;
};

const emptyForm: FormValues = {
  name: '',
  number: 1,
  buildingId: '',
};

export default function FloorsPage() {
  const { selectedPropertyId } = usePropertyStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Floor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Floor | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['floors-properties'],
    queryFn: () => api.get<any[]>('/properties', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] })?.data ?? [];
    }),
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

  const { data: buildings } = useQuery({
    queryKey: ['floors-buildings'],
    queryFn: () => api.get<BuildingType[]>('/buildings', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as BuildingType[];
      return (payload as { data: BuildingType[] }).data ?? [];
    }),
  });
  const buildingMap = new Map((buildings ?? []).map((b) => [b.id, b.name]));

  const createMut = useCreate<Floor>(ENDPOINT, 'Floor');
  const updateMut = useUpdate<Floor>(ENDPOINT, 'Floor');
  const deleteMut = useDelete(ENDPOINT, 'Floor');
  const form = useForm(emptyForm);

  const [selectedPropId, setSelectedPropId] = useState<string>('');

  function openCreate() {
    setEditing(null);
    setSelectedPropId(selectedPropertyId && selectedPropertyId !== 'ALL' ? selectedPropertyId : '');
    form.reset(emptyForm);
    setDialogOpen(true);
  }
  function openEdit(row: Floor) {
    setEditing(row);
    const bld = (buildings ?? []).find((b) => b.id === row.buildingId);
    const pId = row.propertyId || bld?.propertyId || '';
    setSelectedPropId(pId);
    form.reset({
      name: row.name,
      number: row.number || (row as any).floorNumber || 1,
      buildingId: row.buildingId || '',
    });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ name: (v) => !v ? 'Required' : undefined, buildingId: (v) => !v ? 'Select a building' : undefined })) return;
    const payload = {
      name: form.values.name,
      number: form.values.number,
      floorNumber: form.values.number,
      buildingId: form.values.buildingId,
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Floor>[] = [
    { key: 'name', header: 'Floor', sortable: true, cell: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Layers className="h-5 w-5" /></div>
        <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">Level {r.number}</p></div>
      </div>
    )},
    { key: 'buildingId', header: 'Building', sortable: true, cell: (r) => {
      const bldObj = (buildings ?? []).find((b) => b.id === r.buildingId);
      const bldName = r.buildingName || bldObj?.name || buildingMap.get(r.buildingId) || '—';
      const propName = r.propertyName || (bldObj ? (bldObj.propertyName || propMap.get(bldObj.propertyId)) : undefined) || '';
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-medium text-sm text-foreground">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{bldName}</span>
          </div>
          {propName && (
            <span className="text-xs text-muted-foreground pl-5 font-normal">
              {propName}
            </span>
          )}
        </div>
      );
    }},
    { key: 'rooms', header: 'Rooms', sortable: true, cell: (r) => <span className="tabular-nums">{r.rooms}</span> },
    { key: 'beds', header: 'Beds', sortable: true, cell: (r) => <span className="tabular-nums">{r.beds}</span> },
    { key: 'occupied', header: 'Occupancy', sortable: true, cell: (r) => {
      const rate = occupancyRate(r.occupied, r.beds);
      return (
        <div className="w-28">
          <div className="flex justify-between text-xs"><span className="font-medium">{rate}%</span><span className="text-muted-foreground">{r.occupied}/{r.beds}</span></div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} /></div>
        </div>
      );
    }},
  ];

  const buildingFilterOptions = (buildings ?? []).map((b) => ({ value: b.id, label: b.name }));

  const queryClient = useQueryClient();

  const handleUnarchive = async (row: Floor) => {
    try {
      await api.put(`/floors/${row.id}/unarchive`);
      toast({ title: 'Floor Unarchived', description: `Floor "${row.name}" and nested rooms/beds unarchived successfully.` });
      queryClient.invalidateQueries({ queryKey: ['/floors'] });
      queryClient.invalidateQueries({ queryKey: ['/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/beds'] });
      queryClient.invalidateQueries({ queryKey: ['/buildings'] });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Action Failed', description: e?.response?.data?.message || 'Failed to unarchive floor.', variant: 'destructive' });
    }
  };

  const filteredBuildingsForForm = useMemo(() => {
    if (!selectedPropId) return buildings ?? [];
    return (buildings ?? []).filter((b) => b.propertyId === selectedPropId);
  }, [buildings, selectedPropId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Floors" description="Manage floors within buildings." icon={Layers}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Floor</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search floors..." exportFilename="floors" initialSortBy="name"
        filters={buildingFilterOptions.length > 0 ? [{ key: 'buildingId', label: 'Building', options: buildingFilterOptions }] : []}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            ...(row.status?.toLowerCase() === 'archived' ? [{
              label: 'Unarchive Floor',
              icon: RotateCcw,
              onSelect: () => handleUnarchive(row),
            }] : []),
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Floor' : 'Add Floor'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>1. Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: any) => ({
                value: p.id,
                label: p.name,
                sublabel: p.address || p.city || 'Property',
              }))}
              value={selectedPropId}
              onChange={(val) => {
                setSelectedPropId(val);
                form.setValue('buildingId', '');
              }}
              placeholder="Choose Property..."
              searchPlaceholder="Search properties..."
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label required>2. Building</Label>
            <SearchableSelect
              options={filteredBuildingsForForm.map((b) => ({
                value: b.id,
                label: b.name,
                sublabel: `${b.propertyName || propMap.get(b.propertyId) || 'Property'} • ${b.code || 'Building'}`,
              }))}
              value={form.values.buildingId}
              onChange={(v) => {
                form.setValue('buildingId', v);
                const matchedBld = (buildings ?? []).find((b) => b.id === v);
                if (matchedBld && matchedBld.propertyId && !selectedPropId) {
                  setSelectedPropId(matchedBld.propertyId);
                }
              }}
              placeholder={selectedPropId ? "Select building in selected property..." : "Select building..."}
              searchPlaceholder="Search buildings by name..."
            />
            {form.errors.buildingId && <p className="text-xs text-destructive">{form.errors.buildingId}</p>}
          </div>

          <FormInput label="Floor Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} placeholder="e.g. Ground Floor, 1st Floor, Terrace" />
          <FormInput label="Floor Number / Level" type="number" id="number" value={String(form.values.number)} onChange={(e) => form.setValue('number', Number(e.target.value))} />
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Floor" variant="destructive"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
