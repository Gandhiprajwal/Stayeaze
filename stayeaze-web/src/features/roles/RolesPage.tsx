import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Plus, Pencil, Trash2, Lock, Users, Info
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import type { Role } from '@/lib/types';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';
import { useAuthStore } from '@/lib/stores/auth-store';

const ENDPOINT = '/roles';

export interface PermissionItem {
  key: string;
  label: string;
  description: string;
}

export interface PermissionCategory {
  category: string;
  icon?: string;
  permissions: PermissionItem[];
}

const DEFAULT_PERMISSION_CATALOG: PermissionCategory[] = [
  {
    category: 'Property Management',
    permissions: [
      { key: 'property.read', label: 'View Properties', description: 'View properties, campuses, and configurations' },
      { key: 'property.write', label: 'Manage Properties', description: 'Create, edit, or configure properties' },
      { key: 'building.manage', label: 'Buildings & Floors', description: 'Add, edit, or delete buildings and floor plans' },
      { key: 'room.manage', label: 'Rooms & Beds', description: 'Configure room sharing types, pricing, and beds' },
    ],
  },
  {
    category: 'Tenancy & Bookings',
    permissions: [
      { key: 'tenant.read', label: 'View Residents', description: 'View tenant profiles, emergency contacts, and KYC' },
      { key: 'tenant.write', label: 'Manage Residents', description: 'Onboard new tenants, upload ID proofs, and edit profiles' },
      { key: 'booking.read', label: 'View Bookings', description: 'View room reservations, inquiries, and requests' },
      { key: 'booking.write', label: 'Create Bookings', description: 'Reserve beds, process token advances, and allocate rooms' },
      { key: 'checkin.manage', label: 'Check-in & Check-out', description: 'Process digital check-ins, move-outs, and room transfers' },
    ],
  },
  {
    category: 'Finance & Invoicing',
    permissions: [
      { key: 'billing.read', label: 'View Invoices', description: 'Access monthly rent invoices, utility bills, and tariffs' },
      { key: 'billing.write', label: 'Generate Invoices', description: 'Create custom bills, apply discounts, and edit line items' },
      { key: 'payment.read', label: 'View Payments', description: 'View receipts, settlement status, and payment histories' },
      { key: 'payment.write', label: 'Record Payments', description: 'Log offline payments, approve refunds, and reconcile' },
      { key: 'deposit.manage', label: 'Security Deposits', description: 'Process deposit deductions, settlements, and net refunds' },
    ],
  },
  {
    category: 'Operations & Facilities',
    permissions: [
      { key: 'complaint.read', label: 'View Complaints', description: 'View resident grievances, tickets, and photos' },
      { key: 'complaint.write', label: 'Resolve Complaints', description: 'Assign tickets to staff, update status, and close complaints' },
      { key: 'maintenance.read', label: 'View Maintenance', description: 'View scheduled repairs and asset maintenance logs' },
      { key: 'maintenance.write', label: 'Manage Maintenance', description: 'Create maintenance tasks, log costs, and complete jobs' },
      { key: 'visitor.read', label: 'View Visitors', description: 'View visitor entry logs, vehicle numbers, and checkout times' },
      { key: 'visitor.write', label: 'Log Visitors', description: 'Register guests, issue digital visitor passes, and check out' },
    ],
  },
  {
    category: 'Administration & Security',
    permissions: [
      { key: 'user.read', label: 'View Staff & Users', description: 'View staff members, managers, and assigned properties' },
      { key: 'user.write', label: 'Manage Staff', description: 'Create staff logins, assign roles, and modify access' },
      { key: 'reporting.read', label: 'Analytics & Reports', description: 'View financial summaries, occupancy stats, and export CSVs' },
      { key: 'audit.read', label: 'Audit Logs', description: 'Inspect security logs, login timestamps, and system actions' },
      { key: 'settings.manage', label: 'System Settings', description: 'Configure payment gateways, templates, and notifications' },
    ],
  },
];

const emptyForm = { name: '', description: '', permissions: [] as string[] };

export default function RolesPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const { data: roles } = useQuery({
    queryKey: [ENDPOINT],
    queryFn: () => api.get<any>(ENDPOINT).then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || [])),
  });

  const { data: catalogData } = useQuery({
    queryKey: ['/roles/permissions'],
    queryFn: () => api.get<PermissionCategory[]>('/roles/permissions').then((r) => r.data || DEFAULT_PERMISSION_CATALOG),
    staleTime: 60000,
  });

  const categories: PermissionCategory[] = catalogData && catalogData.length > 0 ? catalogData : DEFAULT_PERMISSION_CATALOG;

  const allAvailablePermKeys = useMemo(() => {
    return categories.flatMap((c) => c.permissions.map((p) => p.key));
  }, [categories]);

  const createMut = useCreate<Role>(ENDPOINT, 'Role');
  const updateMut = useUpdate<Role>(ENDPOINT, 'Role');
  const deleteMut = useDelete(ENDPOINT, 'Role');
  const form = useForm(emptyForm);

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: Role) {
    if (!isSuperAdmin) return;
    setEditing(row);
    form.reset({
      name: row.name,
      description: row.description || '',
      permissions: row.permissions.includes('*') ? [...allAvailablePermKeys] : row.permissions,
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!isSuperAdmin) return;
    if (!form.validate({ name: (v) => (!v ? 'Role name is required' : undefined) })) return;

    const finalPermissions =
      form.values.permissions.length === allAvailablePermKeys.length ? ['*'] : form.values.permissions;

    const payload = {
      ...form.values,
      permissions: finalPermissions,
      userCount: editing?.userCount ?? 0,
      isSystem: editing?.isSystem ?? false,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };

    if (editing) {
      updateMut.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            setDialogOpen(false);
            qc.invalidateQueries({ queryKey: [ENDPOINT] });
          },
        }
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: [ENDPOINT] });
        },
      });
    }
  }

  function confirmDelete() {
    if (!isSuperAdmin) return;
    if (deleteTarget) {
      deleteMut.mutate(deleteTarget.id, {
        onSuccess: () => {
          setDeleteTarget(null);
          qc.invalidateQueries({ queryKey: [ENDPOINT] });
        },
      });
    }
  }

  function togglePerm(perm: string) {
    form.setValue(
      'permissions',
      form.values.permissions.includes(perm)
        ? form.values.permissions.filter((p) => p !== perm)
        : [...form.values.permissions, perm]
    );
  }

  function toggleCategory(cat: PermissionCategory) {
    const catKeys = cat.permissions.map((p) => p.key);
    const allSelected = catKeys.every((k) => form.values.permissions.includes(k));
    if (allSelected) {
      form.setValue('permissions', form.values.permissions.filter((k) => !catKeys.includes(k)));
    } else {
      const merged = Array.from(new Set([...form.values.permissions, ...catKeys]));
      form.setValue('permissions', merged);
    }
  }

  function toggleAllGlobal() {
    if (form.values.permissions.length === allAvailablePermKeys.length) {
      form.setValue('permissions', []);
    } else {
      form.setValue('permissions', [...allAvailablePermKeys]);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Security Permissions"
        description="Configure access control tiers, granular module permissions, and staff responsibilities."
        actions={
          isSuperAdmin ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create Role
            </Button>
          ) : undefined
        }
      />

      {!isSuperAdmin && (
        <div className="p-3.5 rounded-xl border bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2.5">
          <Info className="h-4 w-4 shrink-0 text-indigo-600" />
          <span>Role definitions and security permissions are centrally managed by StayEaze Super Administrators. Property owners can assign these verified roles to team members.</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Roles" value={roles?.length ?? 0} icon={ShieldCheck} accent="primary" />
        <StatCard label="System Roles" value={roles?.filter((r) => r.isSystem).length ?? 0} icon={Lock} accent="warning" hint="Protected system definitions" />
        <StatCard label="Assigned Users" value={roles?.reduce((s, r) => s + r.userCount, 0) ?? 0} icon={Users} accent="info" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles?.map((role) => (
          <Card key={role.id} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    {role.isSystem && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        <Lock className="mr-1 h-3 w-3" /> System
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <CardDescription className="mt-2">{role.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.includes('*') ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Full Access (*)</Badge>
                ) : (
                  role.permissions.slice(0, 4).map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px] font-normal">
                      {p}
                    </Badge>
                  ))
                )}
                {role.permissions.length > 4 && !role.permissions.includes('*') && (
                  <Badge variant="outline" className="text-[10px]">
                    +{role.permissions.length - 4} more
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">{role.userCount} users assigned</span>
                {isSuperAdmin ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(role)} title="Edit Role">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(role)}
                        title="Delete Role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Standard
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Security Role' : 'Create Security Role'}
        onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending}
        submitLabel={editing ? 'Save Changes' : 'Create Role'}
        size="lg"
      >
        <div className="space-y-5">
          <FormInput
            label="Role Name"
            required
            id="name"
            placeholder="e.g. OPERATIONS_DIRECTOR"
            value={form.values.name}
            onChange={(e) => form.setValue('name', e.target.value)}
            error={form.errors.name}
          />
          <FormTextarea
            label="Description & Responsibilities"
            id="description"
            placeholder="Describe the duties and scope of this role..."
            value={form.values.description}
            onChange={(e) => form.setValue('description', e.target.value)}
            rows={2}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Granular Module Permissions</Label>
                <p className="text-xs text-muted-foreground">
                  Select the explicit functional privileges granted to users with this role.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={toggleAllGlobal}
              >
                {form.values.permissions.length === allAvailablePermKeys.length
                  ? 'Deselect All'
                  : `Select All (${allAvailablePermKeys.length})`}
              </Button>
            </div>

            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {categories.map((cat) => {
                const catKeys = cat.permissions.map((p) => p.key);
                const selectedCount = catKeys.filter((k) => form.values.permissions.includes(k)).length;
                const isAllSelected = selectedCount === catKeys.length;

                return (
                  <div key={cat.category} className="rounded-xl border bg-muted/20 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          {cat.category}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {selectedCount}/{catKeys.length}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => toggleCategory(cat)}
                      >
                        {isAllSelected ? 'Deselect Category' : 'Select All'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.permissions.map((perm) => {
                        const isChecked = form.values.permissions.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            onClick={() => togglePerm(perm.key)}
                            className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                              isChecked
                                ? 'bg-primary/5 border-primary/40 text-foreground'
                                : 'bg-background hover:bg-muted/40 border-border text-muted-foreground'
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => togglePerm(perm.key)}
                              className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-semibold ${isChecked ? 'text-foreground' : ''}`}>
                                  {perm.label}
                                </span>
                                <code className="text-[9px] px-1 py-0.2 rounded bg-muted font-mono text-muted-foreground">
                                  {perm.key}
                                </code>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-tight">
                                {perm.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Role"
        variant="destructive"
        description={`Delete role "${deleteTarget?.name}"? Users with this role will need reassignment.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
