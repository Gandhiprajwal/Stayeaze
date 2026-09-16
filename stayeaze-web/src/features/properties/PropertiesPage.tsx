import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Hotel, Pencil, Trash2, Eye, CreditCard, ShieldCheck, AlertTriangle, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { DestructiveActionModal } from '@/components/common/DestructiveActionModal';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';

import type { Property } from '@/lib/types';
import { occupancyRate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';
import { useAuthStore } from '@/lib/stores/auth-store';
import { StateCityPincodeSelector } from '@/components/common/StateCityPincodeSelector';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { FeatureUpgradeDialog } from '@/components/subscription/FeatureUpgradeDialog';

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
  securityDeposit: 0,
  minimumLockInMonths: 3,
  noticePeriodDays: 30,
  defaultExitCleaningFee: 500,
  defaultElectricityRatePerUnit: 10.0,
  razorpayKeyId: '', razorpayKeySecret: '',
  orgName: '', orgSubdomain: '', ownerEmail: '', ownerPhone: '', ownerPassword: '',
};

export default function PropertiesPage() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  const planFeatures = usePlanFeatures();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN' || (currentUser?.role as string) === 'ROLE_SUPER_ADMIN';
  const canManage = isSuperAdmin || currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  const { data: subDetails } = useQuery({
    queryKey: ['my-subscription-details'],
    queryFn: () => api.get('/subscription/my-subscription').then((r) => r.data),
  });

  const planName = subDetails?.planName || 'Active Plan';
  const maxProperties = subDetails?.maxProperties ?? subDetails?.usage?.maxProperties ?? 1;
  const currentPropertyCount = subDetails?.propertyCount ?? subDetails?.usage?.currentProperties ?? 1;
  const isPropertyLimitReached = !editing && currentPropertyCount >= maxProperties;

  const createMut = useCreate<Property>(ENDPOINT, 'Property');
  const updateMut = useUpdate<Property>(ENDPOINT, 'Property');
  const deleteMut = useDelete(ENDPOINT, 'Property');

  const { data: orgProfile } = useQuery({
    queryKey: ['org-billing-profile'],
    queryFn: () => api.get('/organization-billing-profile').then((r) => r.data).catch(() => null),
  });

  const form = useForm(emptyForm);

  function openCreate() {
    if (isPropertyLimitReached && !isSuperAdmin) {
      setUpgradeDialogOpen(true);
      return;
    }
    setEditing(null);
    form.reset({
      ...emptyForm,
      minimumLockInMonths: orgProfile?.minimumLockInMonths ?? 3,
      noticePeriodDays: orgProfile?.noticePeriodDays ?? 30,
      defaultExitCleaningFee: orgProfile?.defaultExitCleaningFee ?? 500,
      defaultElectricityRatePerUnit: orgProfile?.defaultElectricityRatePerUnit ?? 10.0,
    });
    setDialogOpen(true);
  }
  function openEdit(row: Property) {
    setEditing(row);
    form.reset({
      name: row.name, code: row.code, type: row.type, address: row.address, city: row.city,
      state: row.state, pincode: row.pincode, manager: row.manager, phone: row.phone,
      email: row.email, status: row.status,
      securityDeposit: row.securityDeposit ?? 0,
      minimumLockInMonths: (row as any).minimumLockInMonths ?? orgProfile?.minimumLockInMonths ?? 3,
      noticePeriodDays: (row as any).noticePeriodDays ?? orgProfile?.noticePeriodDays ?? 30,
      defaultExitCleaningFee: (row as any).defaultExitCleaningFee ?? orgProfile?.defaultExitCleaningFee ?? 500,
      defaultElectricityRatePerUnit: (row as any).defaultElectricityRatePerUnit ?? orgProfile?.defaultElectricityRatePerUnit ?? 10.0,
      razorpayKeyId: row.razorpayKeyId ?? '',
      razorpayKeySecret: row.razorpayKeySecret ?? '',
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
    if (!form.validate(rules)) return;

    const payload = {
      ...form.values,
      totalBuildings: editing?.totalBuildings ?? 0,
      totalRooms: editing?.totalRooms ?? 0,
      totalBeds: editing?.totalBeds ?? 0,
      occupiedBeds: editing?.occupiedBeds ?? 0,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };

    if (editing) {
      updateMut.mutate({ id: editing.id, payload }, {
        onSuccess: () => setDialogOpen(false),
      });
    } else {
      createMut.mutate(payload, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  }

  const columns: Column<Property>[] = [
    { key: 'name', header: 'Property', sortable: true, cell: (r) => (
      <div>
        <span className="font-semibold text-foreground hover:underline cursor-pointer" onClick={() => navigate(`/properties/${r.id}`)}>
          {r.name || 'Unnamed Property'}
        </span>
        {r.code && <span className="ml-2 font-mono text-xs text-muted-foreground">({r.code})</span>}
      </div>
    )},
    { key: 'type', header: 'Type', sortable: true, cell: (r) => (
      <span className="text-xs uppercase font-medium">{r.type ? String(r.type).replace(/_/g, ' ') : 'PG'}</span>
    )},
    { key: 'city', header: 'City', sortable: true, cell: (r) => r.city || r.address || '—' },
    { key: 'totalBuildings', header: 'Buildings', sortable: true, cell: (r) => {
      const buildings = r.totalBuildings ?? 0;
      if (buildings === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      return <span className="tabular-nums font-semibold">{buildings}</span>;
    }},
    { key: 'totalBeds', header: 'Occupancy', sortable: true, cell: (r) => {
      const total = r.totalBeds ?? 0;
      const occupied = r.occupiedBeds ?? 0;
      if (total === 0) {
        return <span className="text-xs text-muted-foreground">No beds added</span>;
      }
      const rate = occupancyRate(occupied, total);
      return (
        <div className="w-32">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{rate}%</span>
            <span className="text-muted-foreground">{occupied}/{total}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
          </div>
        </div>
      );
    }},
    { key: 'totalRooms', header: 'Rooms', sortable: true, cell: (r) => {
      const rooms = r.totalRooms ?? 0;
      if (rooms === 0) {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      return <span className="tabular-nums">{rooms}</span>;
    }},
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status || 'active'} tone={statusTone(r.status || 'active')} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Manage your PG, hostel and co-living properties."
        icon={Hotel}
        actions={
          canManage && (
            <Button onClick={openCreate} className="font-bold gap-2 text-xs shadow-xs">
              <Plus className="h-4 w-4" /> Add Property
            </Button>
          )
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
        <div className="space-y-4">
          {/* Plan Property Limit Warning Banner */}
          {isPropertyLimitReached && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/40 p-3.5 space-y-2 text-rose-900 dark:text-rose-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold">
                    Plan Property Limit Reached ({currentPropertyCount}/{maxProperties} Properties)
                  </p>
                  <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                    Your <strong>{planName}</strong> allows up to <strong>{maxProperties} property workspace(s)</strong>. Upgrade to <strong>Professional (3 Properties)</strong> or <strong>Enterprise (10 Properties)</strong> to manage multiple properties.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-rose-200 dark:border-rose-900/60 text-[11px]">
                <span>Requires multi-property plan</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    navigate('/subscription');
                  }}
                  className="h-6 px-2.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white border-transparent gap-1"
                >
                  <Zap className="h-3 w-3" /> Upgrade Plan
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Property Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} />
          <FormInput label="Property Code" required id="code" value={form.values.code} onChange={(e) => form.setValue('code', e.target.value.toUpperCase())} error={form.errors.code} placeholder="SE-KRM" />
          <div className="space-y-1.5">
            <Label>Property Type</Label>
            <Select value={form.values.type} onValueChange={(v) => form.setValue('type', v as Property['type'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {propertyTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Property['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {propertyStatuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormInput label="Manager Name" id="manager" value={form.values.manager} onChange={(e) => form.setValue('manager', e.target.value)} />
          <FormInput label="Phone" id="phone" value={form.values.phone} onChange={(e) => form.setValue('phone', e.target.value)} />
          <FormInput label="Email" id="email" type="email" value={form.values.email} onChange={(e) => form.setValue('email', e.target.value)} />
          <FormInput label="Default Security Deposit (₹)" id="securityDeposit" type="number" value={form.values.securityDeposit} onChange={(e) => form.setValue('securityDeposit', Number(e.target.value))} />
          <div className="sm:col-span-2">
            <FormInput label="Address" id="address" value={form.values.address} onChange={(e) => form.setValue('address', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <StateCityPincodeSelector
              state={form.values.state}
              city={form.values.city}
              pincode={form.values.pincode}
              onStateChange={(v) => form.setValue('state', v)}
              onCityChange={(v) => form.setValue('city', v)}
              onPincodeChange={(v) => form.setValue('pincode', v)}
            />
          </div>

          {/* Lease Terms & Operational Settlement Policy (P3.3) */}
          <div className="sm:col-span-2 mt-2 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <h4 className="text-sm font-bold">Lease Terms &amp; Settlement Policies</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Define the default contractual terms, lock-in duration, notice period, exit deep cleaning fees, and electricity tariff for this property.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput
                label="Minimum Lock-In Period (Months)"
                id="minimumLockInMonths"
                type="number"
                value={form.values.minimumLockInMonths}
                onChange={(e) => form.setValue('minimumLockInMonths', Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="e.g. 3 (0 for monthly rolling)"
              />
              <FormInput
                label="Required Notice Period (Days)"
                id="noticePeriodDays"
                type="number"
                value={form.values.noticePeriodDays}
                onChange={(e) => form.setValue('noticePeriodDays', Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="e.g. 30"
              />
              <FormInput
                label="Default Exit Cleaning Fee (₹)"
                id="defaultExitCleaningFee"
                type="number"
                value={form.values.defaultExitCleaningFee}
                onChange={(e) => form.setValue('defaultExitCleaningFee', Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="e.g. 500"
              />
              <FormInput
                label="Default Electricity Tariff (₹/Unit)"
                id="defaultElectricityRatePerUnit"
                type="number"
                value={form.values.defaultElectricityRatePerUnit}
                onChange={(e) => form.setValue('defaultElectricityRatePerUnit', Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="e.g. 10.0"
              />
            </div>
          </div>

          {/* Payment gateway settings */}
          <div className="sm:col-span-2 mt-2 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              <h4 className="text-sm font-bold">Property Payment Gateway (Razorpay)</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput label="Razorpay Key ID" id="razorpayKeyId" value={form.values.razorpayKeyId} onChange={(e) => form.setValue('razorpayKeyId', e.target.value)} placeholder="rzp_live_..." />
              <FormInput label="Razorpay Key Secret" id="razorpayKeySecret" type="password" value={form.values.razorpayKeySecret} onChange={(e) => form.setValue('razorpayKeySecret', e.target.value)} />
            </div>
          </div>
          </div>
        </div>
      </FormDialog>

      <DestructiveActionModal
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMut.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Property"
        description="Are you sure you want to delete this property? All associated buildings, floors, rooms, beds, and tenant data will be permanently removed."
        typeToConfirm={deleteTarget?.name || ''}
        confirmLabel="Delete Property"
        loading={deleteMut.isPending}
      />

      <FeatureUpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        featureTitle="Property Portfolio Limit Reached"
        featureDescription={`Your current plan (${planName}) allows up to ${maxProperties} property workspace(s). Upgrade your subscription to add more properties and campuses.`}
        requiredTier={planFeatures.isStarter ? 'GROWTH' : 'ENTERPRISE'}
      />
    </div>
  );
}
