import { useState } from 'react';
import { MessageSquareWarning, Plus, Trash2, CheckCircle, Search, UserCheck, Check, X, Phone, Mail, Eye, User as UserIcon, Home, Building2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Complaint, Property, User } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm, useBulkDelete } from '@/lib/hooks/use-crud';
import { cn } from '@/lib/utils';
import { TenantSelect } from '@/components/common/TenantSelect';
import { useAuthStore } from '@/lib/stores/auth-store';

const ENDPOINT = '/complaints';
const categories = [
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'cleanliness', label: 'Cleanliness' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'wifi', label: 'WiFi / Internet' },
  { value: 'noise', label: 'Noise' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];
const priorities = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' },
];
const statuses = [
  { value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
];

function normalizeCategory(cat?: string): Complaint['category'] {
  if (!cat) return 'electrical';
  const lower = cat.toLowerCase();
  if (lower === 'housekeeping') return 'cleanliness';
  if (['electrical', 'plumbing', 'cleanliness', 'wifi', 'noise', 'security', 'other'].includes(lower)) {
    return lower as Complaint['category'];
  }
  return 'other';
}

function normalizeStatus(st?: string): Complaint['status'] {
  if (!st) return 'open';
  const lower = st.toLowerCase();
  if (['open', 'in_progress', 'resolved', 'closed'].includes(lower)) {
    return lower as Complaint['status'];
  }
  return 'open';
}

function normalizePriority(p?: string): Complaint['priority'] {
  if (!p) return 'medium';
  const lower = p.toLowerCase();
  if (['low', 'medium', 'high', 'critical'].includes(lower)) {
    return lower as Complaint['priority'];
  }
  return 'medium';
}

const emptyForm = {
  tenantName: '', propertyId: '', roomNumber: '', category: 'electrical' as Complaint['category'],
  priority: 'medium' as Complaint['priority'], description: '', status: 'open' as Complaint['status'],
  assignedTo: '',
};

function formatRoomBadge(rawRoom?: any): string {
  if (!rawRoom) return '';
  let str = String(rawRoom).trim();
  while (str.toLowerCase().startsWith('room')) {
    str = str.substring(4).trim();
  }
  return str ? `Room ${str}` : '';
}

export default function ComplaintsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const userRole = (currentUser?.role ?? '').toUpperCase();
  const canChangeStatus = ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(userRole);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Complaint | null>(null);
  const [statusVal, setStatusVal] = useState<Complaint['status']>('open');
  const [assignedVal, setAssignedVal] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Complaint | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | number | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['complaints-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

  const { data: tenants } = useQuery({
    queryKey: ['complaints-tenants'],
    queryFn: () => api.get<any[]>('/tenants').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });

  const activeTenants = (tenants ?? []).filter((t: any) => {
    const status = (t.status ?? 'ACTIVE').toString().toUpperCase();
    const isActive = status === 'ACTIVE' || status === 'CHECKED_IN' || status === 'OCCUPIED';
    if (!isActive) return false;
    if (!tenantSearch.trim()) return true;
    const q = tenantSearch.toLowerCase();
    const name = (t.name || t.fullName || '').toLowerCase();
    const phone = (t.phone || t.mobileNumber || '').toLowerCase();
    const room = (t.roomNumber || t.room || '').toString().toLowerCase();
    const email = (t.email || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || room.includes(q) || email.includes(q);
  });

  const { data: users } = useQuery({
    queryKey: ['complaints-users'],
    queryFn: () => api.get<{ data: User[] }>('/users', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });

  const { data: complaints } = useQuery({
    queryKey: ['complaints-stats'],
    queryFn: () => api.get<{ data: Complaint[] }>(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const open = complaints?.filter((c) => c.status === 'open').length ?? 0;
  const inProgress = complaints?.filter((c) => c.status === 'in_progress').length ?? 0;
  const resolved = complaints?.filter((c) => c.status === 'resolved' || c.status === 'closed').length ?? 0;

  const createMut = useCreate<Complaint>(ENDPOINT, 'Complaint');
  const updateMut = useUpdate<Complaint>(ENDPOINT, 'Complaint');
  const deleteMut = useDelete(ENDPOINT, 'Complaint');
  const bulkDeleteMut = useBulkDelete(ENDPOINT, 'complaints');
  const form = useForm(emptyForm);

  function openCreate() {
    form.reset(emptyForm);
    setSelectedTenantId(null);
    setDialogOpen(true);
  }

  function openStatusDialog(row: Complaint) {
    if (!canChangeStatus) return;
    setStatusTarget(row);
    setStatusVal(normalizeStatus(row.status));
    setAssignedVal(row.assignedTo ?? (row as any).assignedStaff ?? '');
  }

  function submitCreate() {
    if (!form.validate({
      tenantName: (v) => !v ? 'Required' : undefined,
      description: (v) => !v ? 'Description is required' : undefined,
      propertyId: (v) => !v ? 'Select a property' : undefined
    })) return;

    const payload = {
      ...form.values,
      assignedTo: form.values.assignedTo || undefined,
      ticketNumber: `CMP-${String(Date.now()).slice(-4)}`,
      createdAt: new Date().toISOString(),
    };
    createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function submitStatusUpdate() {
    if (!statusTarget || !canChangeStatus) return;
    updateMut.mutate(
      {
        id: statusTarget.id,
        payload: {
          status: statusVal,
          assignedTo: assignedVal || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          setStatusTarget(null);
          if (selectedComplaint?.id === statusTarget.id) {
            setSelectedComplaint((prev) => prev ? { ...prev, status: statusVal, assignedTo: assignedVal } : null);
          }
        },
      }
    );
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  const columns: Column<Complaint>[] = [
    { key: 'ticketNumber', header: 'Ticket', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.ticketNumber}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{String(propMap.get(r.propertyId) ?? '—')}</span> },
    { key: 'category', header: 'Category', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.category}</span> },
    { key: 'priority', header: 'Priority', sortable: true, cell: (r) => {
      const prio = normalizePriority(r.priority);
      return <StatusBadge status={prio} tone={prio === 'critical' ? 'destructive' : prio === 'high' ? 'warning' : prio === 'medium' ? 'info' : 'neutral'} />;
    } },
    { key: 'description', header: 'Description', cell: (r) => <span className="line-clamp-1 max-w-[240px] text-sm text-muted-foreground">{r.description}</span> },
    { key: 'assignedTo', header: 'Assigned', sortable: true, cell: (r) => <span className="text-sm">{r.assignedTo || (r as any).assignedStaff || '—'}</span> },
    { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p: any) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Complaint Management" description="Review and resolve tenant complaints (management view)." icon={MessageSquareWarning}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Log Complaint</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={open} icon={MessageSquareWarning} accent="warning" />
        <StatCard label="In Progress" value={inProgress} icon={CheckCircle} accent="info" />
        <StatCard label="Resolved" value={resolved} icon={CheckCircle} accent="success" />
      </div>
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search tickets, tenants..." exportFilename="complaints" initialSortBy="createdAt"
        onRowClick={(row) => setSelectedComplaint(row)}
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'priority', label: 'Priority', options: priorities },
          { key: 'category', label: 'Category', options: categories },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        dateRangeFilter={{ key: 'createdAt', label: 'Created Date', field: 'createdAt' }}
        bulkActions={[{ label: 'Delete Selected', icon: Trash2, variant: 'destructive', onAction: (ids) => bulkDeleteMut.mutate(ids) }]}
        rowActions={(row) => (
          <RowActions items={[
            { label: 'View Details', icon: Eye, onSelect: () => setSelectedComplaint(row) },
            ...(canChangeStatus ? [{ label: 'Update Status', icon: CheckCircle, onSelect: () => openStatusDialog(row) }] : []),
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />

      {/* Complaint Details Modal */}
      <Dialog open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl">
          {selectedComplaint && (
            <div className="space-y-0">
              {/* Banner Header */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white relative">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
                      {selectedComplaint.ticketNumber}
                    </span>
                    <StatusBadge status={normalizePriority(selectedComplaint.priority)} tone={normalizePriority(selectedComplaint.priority) === 'critical' ? 'destructive' : normalizePriority(selectedComplaint.priority) === 'high' ? 'warning' : 'neutral'} />
                  </div>
                  <StatusBadge status={selectedComplaint.status} tone={statusTone(selectedComplaint.status)} />
                </div>
                <h2 className="text-xl font-black capitalize tracking-tight flex items-center gap-2 text-white">
                  <MessageSquareWarning className="h-5 w-5 text-indigo-400" />
                  {selectedComplaint.category} Complaint
                </h2>
                <p className="text-xs text-indigo-200/80 mt-1">
                  Logged on {formatDate(selectedComplaint.createdAt)}
                </p>
              </div>

              {/* Details Content */}
              <div className="p-6 space-y-5 bg-background">
                {/* Key Info Grid */}
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <UserIcon className="h-3.5 w-3.5 text-primary" /> Resident / Tenant
                    </span>
                    <p className="font-bold text-sm text-foreground">{selectedComplaint.tenantName}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Home className="h-3.5 w-3.5 text-primary" /> Room Number
                    </span>
                    <p className="font-bold text-sm text-foreground">
                      {selectedComplaint.roomNumber ? `Room ${selectedComplaint.roomNumber}` : '—'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> Property
                    </span>
                    <p className="font-bold text-sm text-foreground">
                      {String(propMap.get(selectedComplaint.propertyId) ?? '—')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                      <UserCheck className="h-3.5 w-3.5 text-primary" /> Assigned Staff
                    </span>
                    <p className="font-bold text-sm text-foreground">
                      {selectedComplaint.assignedTo || (selectedComplaint as any).assignedStaff || 'Unassigned'}
                    </p>
                  </div>
                </div>

                {/* Issue Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Issue Description
                  </Label>
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {selectedComplaint.description}
                  </div>
                </div>

                {/* Quick Actions Footer */}
                <div className="pt-2 flex items-center justify-between border-t border-border/60 gap-3">
                  {canChangeStatus ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const row = selectedComplaint;
                        openStatusDialog(row);
                      }}
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Update Status
                    </Button>
                  ) : (
                    <div />
                  )}
                  <Button
                    size="sm"
                    onClick={() => setSelectedComplaint(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Complaint Status Dialog */}
      <Dialog open={!!statusTarget} onOpenChange={(o) => !o && setStatusTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" /> Update Complaint Status
            </DialogTitle>
            <DialogDescription>
              Change status or assign staff for ticket <span className="font-mono font-bold text-foreground">{statusTarget?.ticketNumber}</span>
            </DialogDescription>
          </DialogHeader>
          {statusTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                <p className="font-medium text-foreground"><span className="text-muted-foreground">Tenant:</span> {statusTarget.tenantName}</p>
                <p className="font-medium text-foreground"><span className="text-muted-foreground">Category:</span> <span className="capitalize">{statusTarget.category}</span></p>
                <p className="text-muted-foreground line-clamp-2 mt-1">{statusTarget.description}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Complaint Status</Label>
                <Select value={statusVal} onValueChange={(v) => setStatusVal(v as Complaint['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Assign Staff Member</Label>
                <Select value={assignedVal || 'unassigned'} onValueChange={(v) => setAssignedVal(v === 'unassigned' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {(users ?? []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={updateMut.isPending}>
              Cancel
            </Button>
            <Button onClick={submitStatusUpdate} disabled={updateMut.isPending}>
              {updateMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Save Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Complaint Dialog */}
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title="Log Complaint" onSubmit={submitCreate}
        loading={createMut.isPending} submitLabel="Create">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <UserCheck className="h-4 w-4" /> Select Registered Tenant
            </Label>
            <TenantSelect
              tenants={tenants ?? []}
              selectedTenantId={String(selectedTenantId ?? '')}
              onSelectTenant={(t) => {
                if (t) {
                  setSelectedTenantId(t.id);
                  form.setValue('tenantName', t.name || '');
                  if (t.propertyId) form.setValue('propertyId', t.propertyId);
                  if (t.roomNumber) form.setValue('roomNumber', t.roomNumber);
                } else {
                  setSelectedTenantId(null);
                  form.setValue('tenantName', '');
                  form.setValue('roomNumber', '');
                }
              }}
              placeholder="Search tenant by Name, Phone (+91), Room #, or Email..."
            />
          </div>
          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <div className="space-y-1.5"><Label>Property</Label><Select value={form.values.propertyId ? String(form.values.propertyId) : ''} onValueChange={(v) => form.setValue('propertyId', v)}><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger><SelectContent>{(properties ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent></Select>{form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}</div>
          <FormInput label="Room Number" id="roomNumber" value={form.values.roomNumber} onChange={(e) => form.setValue('roomNumber', e.target.value)} />
          <div className="space-y-1.5"><Label>Category</Label><Select value={form.values.category} onValueChange={(v) => form.setValue('category', v as Complaint['category'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Priority</Label><Select value={form.values.priority} onValueChange={(v) => form.setValue('priority', v as Complaint['priority'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Complaint['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          <FormTextarea label="Description" required className="sm:col-span-2" id="description" value={form.values.description} onChange={(e) => form.setValue('description', e.target.value)} error={form.errors.description} rows={3} />
          <div className="space-y-1.5 sm:col-span-2"><Label>Assign To</Label><Select value={form.values.assignedTo || 'unassigned'} onValueChange={(v) => form.setValue('assignedTo', v === 'unassigned' ? '' : v)}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{(users ?? []).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Complaint" variant="destructive"
        description={`Delete complaint "${deleteTarget?.ticketNumber}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}
