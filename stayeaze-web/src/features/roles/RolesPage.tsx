import { useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, Lock, Users } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormDialog } from '@/components/common/FormDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Role } from '@/lib/types';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/roles';
const allPermissions = [
  'property.read', 'property.write', 'tenant.read', 'tenant.write',
  'booking.read', 'booking.write', 'billing.read', 'billing.write',
  'payment.read', 'payment.write', 'complaint.read', 'complaint.write',
  'maintenance.read', 'maintenance.write', 'visitor.read', 'visitor.write',
  'reporting.read', 'user.read', 'user.write', 'audit.read',
];

const emptyForm = { name: '', description: '', permissions: [] as string[] };

export default function RolesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const { data: roles } = useQuery({
    queryKey: [ENDPOINT],
    queryFn: () => api.get<{ data: Role[] }>(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const createMut = useCreate<Role>(ENDPOINT, 'Role');
  const updateMut = useUpdate<Role>(ENDPOINT, 'Role');
  const deleteMut = useDelete(ENDPOINT, 'Role');
  const form = useForm(emptyForm);

  function openCreate() { setEditing(null); form.reset(emptyForm); setDialogOpen(true); }
  function openEdit(row: Role) {
    setEditing(row);
    form.reset({
      name: row.name,
      description: row.description || '',
      permissions: row.permissions.includes('*') ? [...allPermissions] : row.permissions
    });
    setDialogOpen(true);
  }
  function submit() {
    if (!form.validate({ name: (v) => !v ? 'Role name is required' : undefined })) return;
    
    const finalPermissions = form.values.permissions.length === allPermissions.length
      ? ['*']
      : form.values.permissions;

    const payload = {
      ...form.values,
      permissions: finalPermissions,
      userCount: editing?.userCount ?? 0,
      isSystem: editing?.isSystem ?? false,
      createdAt: editing?.createdAt ?? new Date().toISOString()
    };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => { setDialogOpen(false); qc.invalidateQueries({ queryKey: [ENDPOINT] }); } });
    else createMut.mutate(payload, { onSuccess: () => { setDialogOpen(false); qc.invalidateQueries({ queryKey: [ENDPOINT] }); } });
  }
  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => { setDeleteTarget(null); qc.invalidateQueries({ queryKey: [ENDPOINT] }); } }); }
  function togglePerm(perm: string) {
    form.setValue('permissions', form.values.permissions.includes(perm)
      ? form.values.permissions.filter((p) => p !== perm)
      : [...form.values.permissions, perm]);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Role Management" description="Define roles and granular permissions." icon={ShieldCheck}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Create Role</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Roles" value={roles?.length ?? 0} icon={ShieldCheck} accent="primary" />
        <StatCard label="System Roles" value={roles?.filter((r) => r.isSystem).length ?? 0} icon={Lock} accent="warning" hint="Cannot be deleted" />
        <StatCard label="Assigned Users" value={roles?.reduce((s, r) => s + r.userCount, 0) ?? 0} icon={Users} accent="info" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles?.map((role) => (
          <Card key={role.id} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
                  <div>
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    {role.isSystem && <Badge variant="secondary" className="mt-1 text-[10px]"><Lock className="mr-1 h-3 w-3" /> System</Badge>}
                  </div>
                </div>
              </div>
              <CardDescription className="mt-2">{role.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.includes('*') ? <Badge>Full access</Badge> : role.permissions.slice(0, 4).map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px] font-normal">{p}</Badge>
                ))}
                {role.permissions.length > 4 && !role.permissions.includes('*') && <Badge variant="outline" className="text-[10px]">+{role.permissions.length - 4}</Badge>}
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">{role.userCount} users assigned</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(role)}><Pencil className="h-4 w-4" /></Button>
                  {!role.isSystem && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(role)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Role' : 'Create Role'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Create'} size="lg">
        <div className="space-y-4">
          <FormInput label="Role Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} />
          <FormTextarea label="Description" id="description" value={form.values.description} onChange={(e) => form.setValue('description', e.target.value)} rows={2} />
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-3">
              {allPermissions.map((perm) => (
                <label key={perm} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={form.values.permissions.includes(perm)} onCheckedChange={() => togglePerm(perm)} />
                  <span className="font-mono text-xs">{perm}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Role" variant="destructive"
        description={`Delete role "${deleteTarget?.name}"? Users with this role will need reassignment.`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
