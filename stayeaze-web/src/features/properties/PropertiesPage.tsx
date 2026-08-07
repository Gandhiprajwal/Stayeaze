import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Hotel, Pencil, Trash2, Eye } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import type { Property } from '@/lib/types';
import { formatCurrency, formatDate, occupancyRate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';

const ENDPOINT = '/properties';

const propertyTypes = [
  { value: 'PG', label: 'Paying Guest' },
  { value: 'HOSTEL', label: 'Hostel' },
  { value: 'CO_LIVING', label: 'Co-living' },
];
const propertyStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' },
];

const emptyForm = {
  name: '', code: '', type: 'PG' as Property['type'], address: '', city: '', state: '', pincode: '',
  manager: '', phone: '', email: '', status: 'active' as Property['status'],
  orgName: '', orgSubdomain: '', ownerEmail: '', ownerPhone: '', ownerPassword: '',
};

export default function PropertiesPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const createMut = useCreate<Property>(ENDPOINT, 'Property');
  const updateMut = useUpdate<Property>(ENDPOINT, 'Property');
  const deleteMut = useDelete(ENDPOINT, 'Property');

  const form = useForm(emptyForm);

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  }
  function openEdit(row: Property) {
    setEditing(row);
    form.reset({
      name: row.name, code: row.code, type: row.type, address: row.address, city: row.city,
      state: row.state, pincode: row.pincode, manager: row.manager, phone: row.phone,
      email: row.email, status: row.status,
      orgName: '', orgSubdomain: '', ownerEmail: '', ownerPhone: '', ownerPassword: '',
    });
    setDialogOpen(true);
  }

  function submit() {
    const rules: any = {
      name: (v: any) => !v ? 'Name is required' : undefined,
      code: (v: any) => !v ? 'Code is required' : undefined,
      city: (v: any) => !v ? 'City is required' : undefined,
    };
    if (!editing && isSuperAdmin) {
      rules.orgName = (v: any) => !v ? 'Org Name is required' : undefined;
      rules.orgSubdomain = (v: any) => !v ? 'Subdomain is required' : undefined;
      rules.ownerEmail = (v: any) => !v ? 'Owner Email is required' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? 'Invalid email' : undefined;
    }
    if (!form.validate(rules)) return;

    const payload = {
      ...form.values,
      totalBuildings: editing?.totalBuildings ?? 1,
      totalRooms: editing?.totalRooms ?? 12,
      totalBeds: editing?.totalBeds ?? 24,
      occupiedBeds: editing?.occupiedBeds ?? 0,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createMut.mutate(payload, {
        onSuccess: (data: any) => {
          setDialogOpen(false);
          if (isSuperAdmin && data.ownerEmail) {
            alert(`🎉 Property & Owner Account Created Successfully!\n\nOwner Account Credentials:\nEmail: ${data.ownerEmail}\nPassword: ${data.ownerPassword || 'owner123'}\n\nPlease share these credentials with the owner.`);
            toast.success(`Owner account created for ${data.ownerEmail}`);
          }
        }
      });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  const columns: Column<Property>[] = [
    { key: 'name', header: 'Property', sortable: true, cell: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Hotel className="h-4.5 w-4.5 h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.code || 'PROP'} · {(r.type || 'CO_LIVING').replace('_', '-')}</p>
        </div>
      </div>
    )},
    { key: 'city', header: 'Location', sortable: true, cell: (r) => (
      <div>
        <p className="text-sm">{r.city}</p>
        <p className="text-xs text-muted-foreground">{r.state}</p>
      </div>
    )},
    { key: 'manager', header: 'Manager', cell: (r) => (
      <div>
        <p className="text-sm">{r.manager}</p>
        <p className="text-xs text-muted-foreground">{r.phone}</p>
      </div>
    )},
    { key: 'occupiedBeds', header: 'Occupancy', sortable: true, cell: (r) => {
      const rate = occupancyRate(r.occupiedBeds, r.totalBeds);
      return (
        <div className="w-32">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{rate}%</span>
            <span className="text-muted-foreground">{r.occupiedBeds}/{r.totalBeds}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
          </div>
        </div>
      );
    }},
    { key: 'totalRooms', header: 'Rooms', sortable: true, cell: (r) => (
      <span className="tabular-nums">{r.totalRooms}</span>
    )},
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage your PG, hostel and co-living properties."
        icon={Hotel}
        actions={
          isSuperAdmin ? <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add Property</Button> : undefined
        }
      />
      <DataTable
        endpoint={ENDPOINT}
        columns={columns}
        searchPlaceholder="Search by name, code or city..."
        exportFilename="properties"
        initialSortBy="name"
        onRowClick={(row) => navigate(`/properties/${row.id}`)}
        filters={[
          { key: 'status', label: 'Status', options: propertyStatuses },
          { key: 'type', label: 'Type', options: propertyTypes },
        ]}
        rowActions={(row) => {
          const items = [
            { label: 'View', icon: Eye, onSelect: () => navigate(`/properties/${row.id}`) }
          ];
          if (isSuperAdmin) {
            items.push(
              { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
              { label: 'Delete', icon: Trash2, onSelect: () => setDeleteTarget(row) }
            );
          }
          return <RowActions items={items} />;
        }}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Property' : 'Add New Property'}
        description={editing ? 'Update property details.' : 'Create a new property in your portfolio.'}
        onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending}
        submitLabel={editing ? 'Save Changes' : 'Create Property'}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Property Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} />
          <FormInput label="Property Code" required id="code" value={form.values.code} onChange={(e) => form.setValue('code', e.target.value.toUpperCase())} error={form.errors.code} placeholder="SE-KRM" />
          <div className="space-y-1.5">
            <Label>Property Type</Label>
            <Select value={form.values.type} onValueChange={(v) => form.setValue('type', v as Property['type'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{propertyTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Property['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{propertyStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <FormInput label="Address" id="address" className="sm:col-span-2" value={form.values.address} onChange={(e) => form.setValue('address', e.target.value)} />
          <FormInput label="City" required id="city" value={form.values.city} onChange={(e) => form.setValue('city', e.target.value)} error={form.errors.city} />
          <FormInput label="State" id="state" value={form.values.state} onChange={(e) => form.setValue('state', e.target.value)} />
          <FormInput label="Pincode" id="pincode" value={form.values.pincode} onChange={(e) => form.setValue('pincode', e.target.value)} />
          <FormInput label="Manager" id="manager" value={form.values.manager} onChange={(e) => form.setValue('manager', e.target.value)} />
          <FormInput label="Phone" id="phone" value={form.values.phone} onChange={(e) => form.setValue('phone', e.target.value)} />
          <FormInput label="Email" type="email" id="email" value={form.values.email} onChange={(e) => form.setValue('email', e.target.value)} />
          {!editing && isSuperAdmin && (
            <>
              <div className="sm:col-span-2 border-t pt-4 my-2">
                <h4 className="font-semibold text-sm text-primary">Owner & Organization Details</h4>
                <p className="text-xs text-muted-foreground">Specify the details for the new tenant organization and owner credentials.</p>
              </div>
              <FormInput label="Organization Name" required id="orgName" value={form.values.orgName} onChange={(e) => form.setValue('orgName', e.target.value)} error={form.errors.orgName} />
              <FormInput label="Organization Subdomain" required id="orgSubdomain" value={form.values.orgSubdomain} onChange={(e) => form.setValue('orgSubdomain', e.target.value.toLowerCase())} error={form.errors.orgSubdomain} placeholder="e.g. greenwood" />
              <FormInput label="Owner Email" required type="email" id="ownerEmail" value={form.values.ownerEmail} onChange={(e) => form.setValue('ownerEmail', e.target.value)} error={form.errors.ownerEmail} />
              <FormInput label="Owner Phone" id="ownerPhone" value={form.values.ownerPhone} onChange={(e) => form.setValue('ownerPhone', e.target.value)} />
              <FormInput label="Owner Password" type="password" id="ownerPassword" value={form.values.ownerPassword} onChange={(e) => form.setValue('ownerPassword', e.target.value)} placeholder="default: owner123" />
            </>
          )}
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Property"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone and will remove all associated data.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleteMut.isPending}
      />
    </div>
  );
}

void formatCurrency;
void formatDate;
