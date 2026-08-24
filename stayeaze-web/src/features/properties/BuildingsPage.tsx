import { useState } from 'react';
import { Building2, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
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
import type { Building, Property } from '@/lib/types';
import { occupancyRate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/buildings';
const statuses = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];

const emptyForm = { name: '', code: '', propertyId: '', status: 'active' as Building['status'] };

export default function BuildingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['buildings-properties-minimal'],
    queryFn: () => api.get<Property[]>('/properties/minimal').then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Property[];
      return (payload as { data: Property[] }).data || [];
    }),
  });
  const propMap = new Map((properties ?? []).map((p: Property) => [p.id, p.name]));

  const createMut = useCreate<Building>(ENDPOINT, 'Building');
  const updateMut = useUpdate<Building>(ENDPOINT, 'Building');
  const deleteMut = useDelete(ENDPOINT, 'Building');
  const form = useForm(emptyForm);

  function openCreate() {
    setEditing(null);
    const defaultPropId = properties && properties.length > 0 ? properties[0].id : '';
    form.reset({ ...emptyForm, propertyId: defaultPropId });
    setDialogOpen(true);
  }
  function openEdit(row: Building) {
    setEditing(row);
    form.reset({ name: row.name, code: row.code, propertyId: row.propertyId, status: row.status });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ name: (v) => !v ? 'Required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = {
      name: form.values.name,
      code: form.values.code,
      propertyId: form.values.propertyId,
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  const columns: Column<Building>[] = [
    { key: 'name', header: 'Building', sortable: true, cell: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
        <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.code}</p></div>
      </div>
    )},
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{r.propertyName || propMap.get(r.propertyId) || '—'}</span> },
    { key: 'floors', header: 'Floors', sortable: true, cell: (r) => <span className="tabular-nums">{r.floors}</span> },
    { key: 'rooms', header: 'Rooms', sortable: true, cell: (r) => <span className="tabular-nums">{r.rooms}</span> },
    { key: 'occupied', header: 'Occupancy', sortable: true, cell: (r) => {
      const rate = occupancyRate(r.occupied, r.beds);
      return (
        <div className="w-28">
          <div className="flex justify-between text-xs"><span className="font-medium">{rate}%</span><span className="text-muted-foreground">{r.occupied}/{r.beds}</span></div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} /></div>
        </div>
      );
    }},
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p: Property) => ({ value: p.id, label: p.name }));

  const queryClient = useQueryClient();

  const handleUnarchive = async (row: Building) => {
    try {
      await api.put(`/buildings/${row.id}/unarchive`);
      toast({ title: 'Building Unarchived', description: `Building "${row.name}" and all nested floors/rooms/beds unarchived successfully.` });
      queryClient.invalidateQueries({ queryKey: ['/buildings'] });
      queryClient.invalidateQueries({ queryKey: ['/floors'] });
      queryClient.invalidateQueries({ queryKey: ['/rooms'] });
      queryClient.invalidateQueries({ queryKey: ['/beds'] });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast({ title: 'Action Failed', description: e?.response?.data?.message || 'Failed to unarchive building.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Buildings" description="Manage buildings and blocks across properties." icon={Building2}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Building</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search buildings..." exportFilename="buildings" initialSortBy="name"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            ...(row.status?.toLowerCase() === 'archived' ? [{
              label: 'Unarchive Building',
              icon: RotateCcw,
              onSelect: () => handleUnarchive(row),
            }] : []),
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Building' : 'Add Building'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Building Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} />
          <FormInput label="Code" id="code" value={form.values.code} onChange={(e) => form.setValue('code', e.target.value.toUpperCase())} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label required>Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: Property) => ({
                value: p.id,
                label: p.name,
                sublabel: p.city || p.code || 'Property',
                badge: p.type || 'PG',
              }))}
              value={form.values.propertyId}
              onChange={(v) => form.setValue('propertyId', v)}
              placeholder="Search & select property..."
              searchPlaceholder="Search properties by name, city..."
            />
            {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Building['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Building" variant="destructive"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
