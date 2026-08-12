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

const ENDPOINT = '/users';
const statuses = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'suspended', label: 'Suspended' }];

const emptyForm = {
  name: '', email: '', phone: '', role: 'PROPERTY_MANAGER' as UserRole, status: 'active' as User['status'], propertyIds: [] as string[],
};

export default function UsersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const currentUser = useAuthStore((s) => s.user);

  const { data: dbRoles } = useQuery({
    queryKey: ['roles-list-dropdown'],
    queryFn: () => api.get<{ data: Role[] }>('/roles', { params: { pageSize: 100 } }).then((r) => r.data?.data || []),
  });

  const { data: dbProperties } = useQuery({
    queryKey: ['properties-minimal-dropdown'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });

  const propertyFilterOptions = (dbProperties ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const roleOptions = (dbRoles ?? []).map((r) => {
    let label = r.name;
    if (r.name === 'ADMIN') label = 'Admin (Owner)';
    else if (r.name === 'PROPERTY_MANAGER') label = 'Property Manager';
    else if (r.name === 'SUPER_ADMIN') label = 'Super Admin';
    return { value: r.name as UserRole, label };
  }).filter((r) => {
    if (r.value === 'SUPER_ADMIN') {
      return currentUser?.role === 'SUPER_ADMIN';
    }
    return true;
  });

  const createMut = useCreate<User>(ENDPOINT, 'User');
  const updateMut = useUpdate<User>(ENDPOINT, 'User');
  const deleteMut = useDelete(ENDPOINT, 'User');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: User) {
    setEditing(row);
    form.reset({ name: row.name, email: row.email, phone: row.phone, role: row.role, status: row.status, propertyIds: row.propertyIds || [] });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({
      name: (v) => !v ? 'Required' : undefined,
      email: (v) => !v ? 'Required' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? 'Invalid email' : undefined,
    })) return;
    const payload = {
      ...form.values, propertyIds: form.values.propertyIds ?? [], avatar: undefined,
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
    { key: 'role', header: 'Role', sortable: true, cell: (r) => (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />{formatRoleName(r.role)}
      </span>
    )},
    { key: 'phone', header: 'Phone', cell: (r) => <span className="text-sm">{r.phone}</span> },
    { key: 'propertyIds', header: 'Assigned Properties', cell: (r) => {
      if (r.role === 'SUPER_ADMIN') {
        return <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">All Properties (System-Wide)</span>;
      }

      // Check explicit propertyIds mapping first
      if (r.propertyIds && r.propertyIds.length > 0) {
        const names = r.propertyIds
          .map((id) => (dbProperties ?? []).find((p: any) => String(p.id).toLowerCase() === String(id).toLowerCase())?.name)
          .filter(Boolean);
        if (names.length > 0) {
          return <span className="text-sm font-medium">{names.join(', ')}</span>;
        }
      }

      // Fallback: match by email or name overlap with dbProperties
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

      // Fallback: If user was created for a specific property (e.g. Testproperty01)
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
      <PageHeader title="User Management" description="Manage back-office user accounts and access." icon={UserCog}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Add User</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search users by name or email..." exportFilename="users" initialSortBy="name"
        filters={[
          { key: 'role', label: 'Role', options: roleOptions },
          { key: 'propertyId', label: 'Property', options: propertyFilterOptions },
          { key: 'status', label: 'Status', options: statuses }
        ]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit User' : 'Add User'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Full Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} />
          <FormInput label="Email" required type="email" id="email" value={form.values.email} onChange={(e) => form.setValue('email', e.target.value)} error={form.errors.email} />
          <FormInput label="Phone" id="phone" value={form.values.phone} onChange={(e) => form.setValue('phone', e.target.value)} />
          <div className="space-y-1.5"><Label>Role</Label><Select value={form.values.role} onValueChange={(v) => form.setValue('role', v as UserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roleOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as User['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Assigned Properties</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3 max-h-[120px] overflow-y-auto">
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
    </div>
  );
}
