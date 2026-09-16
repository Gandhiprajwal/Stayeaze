import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, Plus, Pencil, Trash2, Lock, Users, Info, Search, Sparkles, Wand2
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
    category: 'Space & Visual Inventory',
    icon: 'Building2',
    permissions: [
      { key: 'space.matrix.view', label: 'Visual Floor & Bed Matrix', description: 'Inspect live graphical floor layouts, occupied beds, and vacant slots' },
      { key: 'space.matrix.manage', label: 'Configure Rooms & Beds', description: 'Configure sharing types (Single/Double/Triple), bed numbers, and base rents' },
      { key: 'space.batch.generate', label: 'Batch Space Generator', description: 'Bulk generate multi-floor rooms and beds across wings' },
      { key: 'building.manage', label: 'Buildings & Wings', description: 'Add, edit, or archive buildings and floor wings' },
    ],
  },
  {
    category: 'Resident Lifecycle & Digital KYC',
    icon: 'Users',
    permissions: [
      { key: 'tenant.read', label: 'View Resident Profiles', description: 'View tenant directory, room allocations, emergency contacts, and active status' },
      { key: 'tenant.write', label: 'Onboard & Edit Residents', description: 'Onboard new residents, edit profiles, and record initial rent/deposit' },
      { key: 'tenant.kyc.verify', label: 'Verify Digital KYC', description: 'Approve or reject Aadhaar, PAN, and student/employee ID documents' },
      { key: 'tenant.transfer.execute', label: 'Room Transfer Wizard', description: 'Execute room/bed transfers with automatic pro-rata rent & deposit recalculation' },
      { key: 'booking.manage', label: 'Bookings & Token Advances', description: 'Process prospective bookings, token deposits, and space hold requests' },
    ],
  },
  {
    category: 'Rental Agreements & Legal Lock-in',
    icon: 'FileSignature',
    permissions: [
      { key: 'agreement.read', label: 'View Digital Agreements', description: 'View tenant e-sign contracts, lock-in clauses, and notice periods' },
      { key: 'agreement.generate', label: 'Generate & E-Sign Agreements', description: 'Create digital rental agreements with custom rules & download PDF contracts' },
      { key: 'agreement.terminate', label: 'Agreement Termination & Move-Out', description: 'Execute move-outs, early lock-in penalties, and settlement approvals' },
    ],
  },
  {
    category: 'Billing, Utility Meters & Finance',
    icon: 'CreditCard',
    permissions: [
      { key: 'billing.read', label: 'View Invoices & Tariffs', description: 'Access monthly rent invoices, utility bills, and payment records' },
      { key: 'billing.write', label: 'Create Invoices & Adjustments', description: 'Create custom bills, apply discounts, exit cleaning fees, and penalties' },
      { key: 'billing.bulk.run', label: 'Bulk Monthly Rent Run', description: 'Execute 1-click automated monthly rent generation for all occupied rooms' },
      { key: 'utility.meter.record', label: 'Sub-Meter Electricity Split', description: 'Record sub-meter electricity readings and auto-split units across roommates' },
      { key: 'payment.record', label: 'Log Payments & Bank Accounts', description: 'Record cash/UPI payments, reconcile transactions, and verify refund accounts' },
      { key: 'deposit.manage', label: 'Security Deposit Settlements', description: 'Process deposit deductions, damage penalties, and net refund payouts' },
    ],
  },
  {
    category: 'Gate Pass, Visitors & Security',
    icon: 'ShieldCheck',
    permissions: [
      { key: 'gate.visitor.read', label: 'View Visitor Gate Logs', description: 'Inspect guest entry/exit times, vehicle numbers, and host tenants' },
      { key: 'gate.visitor.log', label: 'Issue Visitor Gate Pass', description: 'Register guests, issue gate entry passes, and trigger tenant approval' },
      { key: 'gate.parcel.manage', label: 'Parcel & Courier Desk', description: 'Log arriving courier deliveries, send OTP pickup notifications to residents' },
      { key: 'security.incident.log', label: 'Safety Incident Escalation', description: 'Record security incidents, curfew violations, and warden escalations' },
    ],
  },
  {
    category: 'Facilities & Complaints SLA',
    icon: 'Wrench',
    permissions: [
      { key: 'complaint.read', label: 'View Complaints & Photos', description: 'View resident grievances, issue photos, and live chat updates' },
      { key: 'complaint.resolve', label: 'Assign & Close Complaints', description: 'Assign maintenance staff, track SLA timelines, and resolve issues' },
      { key: 'maintenance.manage', label: 'Asset Maintenance & Repairs', description: 'Log recurring maintenance jobs, contractor costs, and equipment assets' },
    ],
  },
  {
    category: 'WhatsApp & Omnichannel Automations',
    icon: 'MessageSquare',
    permissions: [
      { key: 'messaging.whatsapp.send', label: '1-Click WhatsApp Reminders', description: 'Dispatch instant WhatsApp rent due notices, welcome links, and receipts' },
      { key: 'messaging.logs.view', label: 'Notification Delivery Logs', description: 'Audit WhatsApp/SMS message delivery statuses and failure reasons' },
    ],
  },
  {
    category: 'Compliance, Tax & Governance',
    icon: 'FileText',
    permissions: [
      { key: 'reports.gst.export', label: 'GSTR-1 Tax Reports', description: 'Export monthly GST B2B/B2C summaries and tax ledgers' },
      { key: 'reports.hra.generate', label: 'HRA Section 10(13A) Receipts', description: 'Generate official tax rent receipts with landlord PAN verification QR' },
      { key: 'audit.logs.view', label: 'Audit Logs & Security Sessions', description: 'View multi-branch user audit trails, IP logs, and active login sessions' },
      { key: 'settings.manage', label: 'System & Gateway Settings', description: 'Configure Razorpay credentials, bank details, invoice prefixes, and branding' },
    ],
  },
];

const PRESET_TEMPLATES: Record<string, { label: string; perms: string[] }> = {
  MANAGER: {
    label: 'Property Manager',
    perms: [
      'space.matrix.view', 'space.matrix.manage', 'space.batch.generate', 'building.manage',
      'tenant.read', 'tenant.write', 'tenant.kyc.verify', 'tenant.transfer.execute', 'booking.manage',
      'agreement.read', 'agreement.generate', 'agreement.terminate',
      'billing.read', 'billing.write', 'billing.bulk.run', 'utility.meter.record', 'payment.record', 'deposit.manage',
      'gate.visitor.read', 'gate.visitor.log', 'gate.parcel.manage', 'security.incident.log',
      'complaint.read', 'complaint.resolve', 'maintenance.manage',
      'messaging.whatsapp.send', 'reports.gst.export', 'reports.hra.generate'
    ],
  },
  ACCOUNTANT: {
    label: 'Accountant',
    perms: [
      'billing.read', 'billing.write', 'billing.bulk.run', 'utility.meter.record',
      'payment.record', 'deposit.manage', 'reports.gst.export', 'reports.hra.generate',
      'messaging.whatsapp.send'
    ],
  },
  RECEPTIONIST: {
    label: 'Receptionist / Front Desk',
    perms: [
      'space.matrix.view', 'tenant.read', 'tenant.write', 'tenant.kyc.verify',
      'booking.manage', 'agreement.read', 'agreement.generate',
      'gate.visitor.read', 'gate.visitor.log', 'gate.parcel.manage', 'complaint.read'
    ],
  },
  SECURITY: {
    label: 'Security Guard',
    perms: ['gate.visitor.read', 'gate.visitor.log', 'gate.parcel.manage', 'security.incident.log'],
  },
  STAFF: {
    label: 'Maintenance / Staff',
    perms: ['space.matrix.view', 'complaint.read', 'complaint.resolve', 'maintenance.manage'],
  },
};

const emptyForm = { name: '', description: '', permissions: [] as string[] };

export default function RolesPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        permissions: cat.permissions.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            cat.category.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.permissions.length > 0);
  }, [categories, searchQuery]);

  const createMut = useCreate<Role>(ENDPOINT, 'Role');
  const updateMut = useUpdate<Role>(ENDPOINT, 'Role');
  const deleteMut = useDelete(ENDPOINT, 'Role');
  const form = useForm(emptyForm);

  function openCreate() {
    setEditing(null);
    setSearchQuery('');
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: Role) {
    if (!isSuperAdmin) return;
    setEditing(row);
    setSearchQuery('');
    form.reset({
      name: row.name,
      description: row.description || '',
      permissions: row.permissions.includes('*') ? [...allAvailablePermKeys] : row.permissions,
    });
    setDialogOpen(true);
  }

  function applyPreset(presetKey: keyof typeof PRESET_TEMPLATES) {
    const preset = PRESET_TEMPLATES[presetKey];
    if (preset) {
      form.setValue('permissions', [...preset.perms]);
    }
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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard label="Total Roles" value={roles?.length ?? 0} icon={ShieldCheck} accent="primary" />
        <StatCard label="System Roles" value={roles?.filter((r) => r.isSystem).length ?? 0} icon={Lock} accent="warning" hint="Protected system definitions" />
        <StatCard label="Assigned Users" value={roles?.reduce((s, r) => s + r.userCount, 0) ?? 0} icon={Users} accent="info" />
      </div>

      <div className="grid gap-5 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {roles?.map((role) => (
          <Card key={role.id} className="rounded-2xl border bg-card shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all flex flex-col justify-between overflow-hidden">
            <CardHeader className="p-5 pb-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 shadow-xs">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-bold truncate">{role.name}</CardTitle>
                    {role.isSystem && (
                      <Badge variant="secondary" className="mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        <Lock className="mr-1 h-3 w-3" /> System
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <CardDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{role.description || 'Custom role definition with tailored permissions.'}</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3.5">
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.includes('*') ? (
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-bold px-2.5 py-0.5 rounded-lg shadow-2xs">
                    Full Access (*)
                  </Badge>
                ) : (
                  role.permissions.slice(0, 4).map((p) => (
                    <Badge key={p} variant="outline" className="text-[10px] font-medium rounded-md px-2 py-0.5 bg-muted/30">
                      {p}
                    </Badge>
                  ))
                )}
                {role.permissions.length > 4 && !role.permissions.includes('*') && (
                  <Badge variant="outline" className="text-[10px] font-semibold rounded-md px-1.5 py-0.5 bg-muted/50">
                    +{role.permissions.length - 4} more
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <span className="text-xs text-muted-foreground font-medium">{role.userCount} users assigned</span>
                {isSuperAdmin ? (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8.5 w-8.5 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(role)} title="Edit Role">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8.5 w-8.5 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTarget(role)}
                        title="Delete Role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground rounded-md">
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

          {/* 1-Click Role Templates */}
          <div className="p-3 bg-muted/30 rounded-xl border space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <span>1-Click Preset Permission Templates</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PRESET_TEMPLATES).map(([k, v]) => (
                <Button
                  key={k}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] font-medium rounded-lg hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                  onClick={() => applyPreset(k)}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <Label className="text-sm font-semibold">Granular Module Permissions ({form.values.permissions.length}/{allAvailablePermKeys.length})</Label>
                <p className="text-xs text-muted-foreground">
                  Select the explicit functional privileges granted to users with this role.
                </p>
              </div>
              <div className="flex items-center gap-2">
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
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search permissions by name, key, or module..."
                className="pl-8.5 h-8.5 text-xs rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {filteredCategories.map((cat) => {
                const catKeys = cat.permissions.map((p) => p.key);
                const selectedCount = catKeys.filter((k) => form.values.permissions.includes(k)).length;
                const isAllSelected = selectedCount === catKeys.length && catKeys.length > 0;

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
                              <div className="flex items-center gap-1.5 flex-wrap">
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
