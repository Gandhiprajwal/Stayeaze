import { useState } from 'react';
import { UserCog, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';

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
import type { User, UserRole, Role, Property } from '@/lib/types';
import { formatDate, initials, timeAgo } from '@/lib/format';
import { formatRoleName } from '@/lib/role-utils';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { validateEmail, validateMobile } from '@/lib/validation';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { FeatureUpgradeDialog } from '@/components/subscription/FeatureUpgradeDialog';

const ENDPOINT = '/users';
const statuses = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'suspended', label: 'Suspended' }];

const emptyForm = {
  name: '', email: '', phone: '', role: 'PROPERTY_MANAGER' as UserRole, status: 'active' as User['status'], propertyIds: [] as string[], orgId: '' as string,
};

export default function UsersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const planFeatures = usePlanFeatures();

  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isPropertyManager = currentUser?.role === 'PROPERTY_MANAGER';

  const { data: dbRoles } = useQuery({
    queryKey: ['roles-list-dropdown'],
    queryFn: () => api.get<{ data: Role[] }>('/roles', { params: { pageSize: 100 } }).then((r) => r.data?.data || []),
  });

  const { data: dbProperties } = useQuery({
    queryKey: ['properties-minimal-dropdown'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });

  const { data: subscribersData } = useQuery({
    queryKey: ['subscribers-dropdown-users'],
    queryFn: () => api.get<any[]>('/super-admin/subscribers/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any)?.data || []),
    enabled: isSuperAdmin,
  });

  const propertyFilterOptions = (dbProperties ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const orgFilterOptions = (subscribersData ?? []).map((s: any) => ({
    value: s.id,
    label: s.name,
  }));

  const roleOptionsMap = new Map<UserRole, string>();

  // Only Owners/Admins/SuperAdmins can assign Admin (Owner) role
  if (!isPropertyManager) {
    roleOptionsMap.set('OWNER', 'Admin (Owner)');
  }

  // Hierarchy roles available to Property Manager and above
  roleOptionsMap.set('PROPERTY_MANAGER', 'Property Manager');
  roleOptionsMap.set('RECEPTIONIST', 'Receptionist');
  roleOptionsMap.set('ACCOUNTANT', 'Accountant');
  roleOptionsMap.set('SECURITY_GUARD', 'Security Guard');
  roleOptionsMap.set('STAFF', 'Maintenance Staff');
  roleOptionsMap.set('TENANT', 'Tenant / Resident');

  if (isSuperAdmin) {
    roleOptionsMap.set('SUPPORT', 'Platform Support (Application)');
    roleOptionsMap.set('SUPER_ADMIN', 'Platform Super Admin');
  }

  const roleOptions = Array.from(roleOptionsMap.entries())
    .map(([value, label]) => ({ value, label }));

  const createMut = useCreate<User>(ENDPOINT, 'User');
  const updateMut = useUpdate<User>(ENDPOINT, 'User');
  const deleteMut = useDelete(ENDPOINT, 'User');
  const form = useForm(emptyForm);

  function openCreate() {
    if (!isSuperAdmin && !planFeatures.canAddStaff()) {
      setUpgradeDialogOpen(true);
      return;
    }
    setEditing(null);
    const initialRole: UserRole = isPropertyManager ? 'RECEPTIONIST' : 'PROPERTY_MANAGER';
    form.reset({ ...emptyForm, role: initialRole });
    setDialogOpen(true);
  }
  function openEdit(row: User & { orgId?: string }) {
    setEditing(row);
    const mappedRole: UserRole = (row.role === ('ADMIN' as any) || row.role === 'OWNER') ? 'OWNER' : row.role;
    form.reset({
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: mappedRole,
      status: row.status,
      propertyIds: row.propertyIds || [],
      orgId: row.orgId || '',
    });
    setDialogOpen(true);
  }

  function submit() {
    if (!form.validate({
      name: (v) => !v ? 'Required' : undefined,
      email: (v) => {
        if (!v) return 'Required';
        const res = validateEmail(String(v));
        return res.isValid ? undefined : res.error;
      },
      phone: (v) => {
        if (!v) return undefined;
        const res = validateMobile(String(v));
        return res.isValid ? undefined : res.error;
      },
    })) return;
    const payload = {
      ...form.values,
      propertyIds: form.values.propertyIds ?? [],
      avatar: undefined,
      orgId: isSuperAdmin && form.values.orgId ? form.values.orgId : undefined,
      lastActive: editing?.lastActive ?? new Date().toISOString(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name & Email', sortable: true, cell: (r) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initials(r.name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium leading-none">{r.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{r.email}</p>
        </div>
      </div>
    )},
    ...(isSuperAdmin ? [{
      key: 'orgName' as any,
      header: 'Organization / Subscriber',
      sortable: true,
      cell: (r: any) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
          {r.orgName || 'StayEaze Platform'}
        </span>
      ),
    }] : []),
    { key: 'role', header: 'Role', sortable: true, cell: (r) => (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />{formatRoleName(r.role)}
      </span>
    )},
    { key: 'phone', header: 'Phone', cell: (r) => <span className="text-sm">{r.phone || '—'}</span> },
    { key: 'propertyIds', header: 'Assigned Properties', cell: (r) => {
      if (r.role === 'SUPER_ADMIN' || r.role === 'SUPPORT') {
        return <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">All Platform Properties</span>;
      }

      if (r.propertyIds && r.propertyIds.length > 0) {
        const names = r.propertyIds
          .map((id) => (dbProperties ?? []).find((p: any) => String(p.id).toLowerCase() === String(id).toLowerCase())?.name)
          .filter(Boolean);
        if (names.length > 0) {
          return <span className="text-sm font-medium">{names.join(', ')}</span>;
        }
      }

      const matched = (dbProperties ?? []).filter((p: any) => {
        const pEmail = (p.email || '').toLowerCase();
        const pName = (p.name || '').toLowerCase();
        const uEmail = (r.email || '').toLowerCase();
        const uName = (r.name || '').toLowerCase();
        return (
          (pEmail && pEmail === uEmail) ||
          (pName && uEmail.includes(pName)) ||
          (pName && uName === pName)
        );
      });

      if (matched.length > 0) {
        return <span className="text-sm font-medium">{matched.map((p: any) => p.name).join(', ')}</span>;
      }

      if (r.name && r.name !== 'Superadmin' && r.name !== 'Admin') {
        return <span className="text-sm font-medium">{r.name}</span>;
      }

      return <span className="text-xs text-muted-foreground">—</span>;
    }},
    { key: 'lastActive', header: 'Last Active', sortable: true, cell: (r) => <span className="text-sm text-muted-foreground">{timeAgo(r.lastActive)}</span> },
    { key: 'createdAt', header: 'Joined', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isSuperAdmin ? "Global User Accounts" : "User Management"}
        description={isSuperAdmin ? "View and manage all registered user accounts and staff across all client organizations." : "Manage your organization's staff, managers, and access roles."}
        icon={UserCog}
        actions={<Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"><Plus className="mr-1.5 h-4 w-4" /> Add User</Button>}
      />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search users by name, email, or role..." exportFilename="users" initialSortBy="name"
        filters={[
          { key: 'role', label: 'Role', options: roleOptions },
          ...(isSuperAdmin && orgFilterOptions.length > 0 ? [{ key: 'orgId', label: 'Organization', options: orgFilterOptions }] : []),
          { key: 'propertyId', label: 'Property', options: propertyFilterOptions },
          { key: 'status', label: 'Status', options: statuses }
        ]}
        rowActions={(row) => {
          const isTargetAdmin = row.role === 'OWNER' || row.role === ('ADMIN' as any) || row.role === 'SUPER_ADMIN';
          if (isPropertyManager && isTargetAdmin) {
            return null; // Property Managers cannot modify or delete Admin / Owner accounts
          }
          return (
            <RowActions items={[
              { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
              { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
            ]} />
          );
        }} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit User' : 'Add User'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          {isSuperAdmin && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Target Organization / Tenant</Label>
              <Select value={form.values.orgId || 'system_root'} onValueChange={(v) => form.setValue('orgId', v === 'system_root' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="StayEaze Platform (System Root)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_root">StayEaze Platform (System Root)</SelectItem>
                  {(subscribersData ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.subdomain})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <FormInput label="Full Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} placeholder="e.g. Anita Sharma" />
          <FormInput label="Email" required type="email" id="email" value={form.values.email} onChange={(e) => form.setValue('email', e.target.value)} error={form.errors.email} placeholder="e.g. manager@stayeaze.com" />
          <FormInput label="Phone" id="phone" value={form.values.phone} onChange={(e) => form.setValue('phone', e.target.value)} placeholder="e.g. +91 98765 43210" />
          <div className="space-y-1.5"><Label>Role</Label><Select value={form.values.role} onValueChange={(v) => form.setValue('role', v as UserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as User['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Assigned Properties</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3 max-h-[120px] overflow-y-auto">
              {(dbProperties ?? []).map((p) => {
                const checked = form.values.propertyIds?.includes(p.id) ?? false;
                return (
                  <label key={p.id} className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const current = form.values.propertyIds ?? [];
                        const next = e.target.checked
                          ? [...current, p.id]
                          : current.filter((id) => id !== p.id);
                        form.setValue('propertyIds', next);
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    {p.name}
                  </label>
                );
              })}
              {(dbProperties ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">No properties available</span>
              )}
            </div>
          </div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete User" variant="destructive"
        description={`Delete user "${deleteTarget?.name}"? They will lose access immediately.`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />

      <FeatureUpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        featureTitle="Staff Accounts Limit Reached"
        featureDescription={`Your current plan (${planFeatures.planName}) allows up to ${planFeatures.maxStaffUsers} staff user accounts. Upgrade to add more managers, accountants, and staff.`}
        requiredTier={planFeatures.isStarter ? 'GROWTH' : 'ENTERPRISE'}
      />
    </div>
  );
}
