import { useState } from 'react';
import { LogOut, Plus, Pencil, Trash2, BadgeCheck, DollarSign, Calendar } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { CheckOut, Property, Room, Bed, Tenant } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT = '/check-outs';
const statuses = [{ value: 'notice_period', label: 'Notice Period' }, { value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }];
const reasons = ['Relocating', 'Lease ended', 'Personal', 'Job change', 'Upgrade'];

const emptyForm = {
  tenantName: '', propertyId: '', roomNumber: '', bedNumber: 'B1',
  checkOutDate: new Date().toISOString().slice(0, 10), noticeDate: new Date().toISOString().slice(0, 10),
  depositRefund: 14000, deductions: 0, reason: 'Lease ended', status: 'notice_period' as CheckOut['status'],
};

export default function CheckOutsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CheckOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CheckOut | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CheckOut | null>(null);
  const [effectiveCheckOutDate, setEffectiveCheckOutDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [completing, setCompleting] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');

  const { data: properties } = useQuery({
    queryKey: ['checkouts-properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

  // Fetch active tenants for selector dropdown
  const { data: activeTenants } = useQuery({
    queryKey: ['checkouts-active-tenants'],
    queryFn: () => api.get<Tenant[]>('/tenants', { params: { pageSize: 200 } }).then((r) => {
      const payload = r.data as unknown;
      const list = Array.isArray(payload) ? payload : ((payload as { data: Tenant[] }).data ?? []);
      return list.filter((t) => t.status !== 'ARCHIVED' && t.status !== 'archived');
    }),
    enabled: dialogOpen,
  });

  // Fetch all rooms for dropdown
  const { data: allRooms } = useQuery({
    queryKey: ['checkouts-rooms'],
    queryFn: () => api.get<Room[]>('/rooms', { params: { pageSize: 500 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    enabled: dialogOpen,
  });

  const roomOptions = (allRooms ?? []).filter((r) => r.status !== 'archived');

  // Fetch beds for selected room
  const { data: bedsForRoom } = useQuery({
    queryKey: ['checkouts-beds', selectedRoomId],
    queryFn: () => api.get<Bed[]>(`/rooms/${selectedRoomId}/beds`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Bed[];
      return (payload as { data: Bed[] }).data ?? [];
    }),
    enabled: !!selectedRoomId,
  });

  const createMut = useCreate<CheckOut>(ENDPOINT, 'Check-out');
  const updateMut = useUpdate<CheckOut>(ENDPOINT, 'Check-out');
  const deleteMut = useDelete(ENDPOINT, 'Check-out');
  const form = useForm(emptyForm);

  function openCreate() {
    setEditing(null);
    setSelectedRoomId('');
    setSelectedTenantId('');
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: CheckOut) {
    setEditing(row);
    setSelectedTenantId('');
    const matchedRoom = (allRooms ?? []).find((r) => r.number === row.roomNumber);
    setSelectedRoomId(matchedRoom?.id ?? '');
    form.reset({
      tenantName: row.tenantName, propertyId: row.propertyId, roomNumber: row.roomNumber, bedNumber: row.bedNumber,
      checkOutDate: row.checkOutDate, noticeDate: row.noticeDate ?? '', depositRefund: row.depositRefund,
      deductions: row.deductions ?? 0, reason: row.reason ?? 'Lease ended', status: row.status,
    });
    setDialogOpen(true);
  }

  function onSelectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    const tenant = (activeTenants ?? []).find((t) => t.id === tenantId);
    if (tenant) {
      form.setValue('tenantName', tenant.name);
      if (tenant.propertyId) form.setValue('propertyId', String(tenant.propertyId));
      if (tenant.roomNumber) {
        form.setValue('roomNumber', tenant.roomNumber);
        const rm = (allRooms ?? []).find((r) => r.number === tenant.roomNumber);
        if (rm) setSelectedRoomId(rm.id);
      }
      if (tenant.bedNumber) form.setValue('bedNumber', tenant.bedNumber);
      if (tenant.deposit) form.setValue('depositRefund', Number(tenant.deposit));
    }
  }

  function submit() {
    if (!form.validate({ tenantName: (v) => !v ? 'Required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = { ...form.values, code: editing?.code ?? `CO-${String(Date.now()).slice(-4)}` };
    if (editing) updateMut.mutate({ id: editing.id, payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  function openCompleteModal(row: CheckOut) {
    setCompleteTarget(row);
    setEffectiveCheckOutDate(row.checkOutDate || new Date().toISOString().slice(0, 10));
  }

  async function handleCompleteCheckOut() {
    if (!completeTarget) return;
    try {
      setCompleting(true);
      await api.post(`/check-outs/${completeTarget.id}/mark-completed`, {
        checkOutDate: effectiveCheckOutDate,
        depositRefund: completeTarget.depositRefund,
        deductions: completeTarget.deductions,
        reason: completeTarget.reason,
      });
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['checkouts-active-tenants'] });
      setCompleteTarget(null);
    } catch (err) {
      console.error('Check-out completion error:', err);
    } finally {
      setCompleting(false);
    }
  }

  const columns: Column<CheckOut>[] = [
    { key: 'code', header: 'Check-out ID', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.code}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{propMap.get(r.propertyId) ?? '—'}</span> },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => <span className="text-sm">Room {r.roomNumber} · {r.bedNumber}</span> },
    { key: 'noticeDate', header: 'Notice Date', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.noticeDate)}</span> },
    { key: 'checkOutDate', header: 'Check-out Date', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.checkOutDate)}</span> },
    { key: 'depositRefund', header: 'Refund', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.depositRefund)}</span> },
    { key: 'deductions', header: 'Deductions', sortable: true, cell: (r) => <span className="text-sm text-destructive tabular-nums">{r.deductions ? `- ${formatCurrency(r.deductions)}` : '₹0'}</span> },
    {
      key: 'netRefund' as keyof CheckOut,
      header: 'Net Refund',
      sortable: true,
      cell: (r) => {
        const net = (r.depositRefund || 0) - (r.deductions || 0);
        return <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(net > 0 ? net : 0)}</span>;
      },
    },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
    {
      key: 'actions' as keyof CheckOut,
      header: 'Action',
      cell: (r) => (
        r.status !== 'completed' ? (
          <Button
            size="sm"
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/60 font-medium h-8 text-xs"
            onClick={() => openCompleteModal(r)}>
            <BadgeCheck className="mr-1 h-3.5 w-3.5" /> Mark Checked Out
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Move-out Complete
          </span>
        )
      ),
    },
  ];

  const propertyFilterOptions = (properties ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Check-out" description="Manage tenant move-outs, deposit refunds, and bed releases." icon={LogOut}
        actions={<Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> New Check-out</Button>} />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search check-outs..." exportFilename="check-outs" initialSortBy="checkOutDate"
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        rowActions={(row) => (
          <RowActions items={[
            ...(row.status !== 'completed' ? [{
              label: 'Mark Checked Out (Archive)', icon: LogOut, onSelect: () => openCompleteModal(row)
            }] : []),
            { label: 'Edit', icon: Pencil, onSelect: () => openEdit(row) },
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />

      {/* Form Dialog for New/Edit Check-out */}
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit Check-out' : 'New Check-out'} onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending} submitLabel={editing ? 'Save' : 'Process Check-out'} size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2 bg-muted/30 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-primary">Select Active Tenant (Auto-fill)</Label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {activeTenants?.length ?? 0} active tenants
                </span>
              </div>
              <input
                type="text"
                placeholder="Search tenant name, room, bed or mobile..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Select value={selectedTenantId} onValueChange={onSelectTenant}>
                <SelectTrigger><SelectValue placeholder="Choose an active tenant to check out..." /></SelectTrigger>
                <SelectContent>
                  {(activeTenants ?? [])
                    .filter((t) => {
                      if (!tenantSearch.trim()) return true;
                      const q = tenantSearch.toLowerCase();
                      return (
                        (t.name && t.name.toLowerCase().includes(q)) ||
                        (t.roomNumber && t.roomNumber.toLowerCase().includes(q)) ||
                        (t.bedNumber && t.bedNumber.toLowerCase().includes(q)) ||
                        (t.mobile && t.mobile.toLowerCase().includes(q))
                      );
                    })
                    .slice(0, 50)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} — Room {t.roomNumber || 'N/A'} ({t.bedNumber || 'N/A'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <div className="space-y-1.5">
            <Label>Property</Label>
            <Select value={form.values.propertyId} onValueChange={(v) => form.setValue('propertyId', v)}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{(properties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
          </div>

          {/* Room Number Dropdown */}
          <div className="space-y-1.5">
            <Label>Room Number</Label>
            <Select
              value={selectedRoomId}
              onValueChange={(roomId) => {
                setSelectedRoomId(roomId);
                const rm = roomOptions.find((r) => r.id === roomId);
                if (rm) form.setValue('roomNumber', rm.number);
              }}>
              <SelectTrigger>
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {roomOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    Room {r.number} ({r.sharing ? `${r.sharing} share` : 'Room'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && !selectedRoomId && (
              <p className="text-xs text-muted-foreground">Current: Room {form.values.roomNumber || '—'}</p>
            )}
          </div>

          {/* Bed Number Dropdown */}
          <div className="space-y-1.5">
            <Label>Bed Number</Label>
            <Select
              value={form.values.bedNumber}
              onValueChange={(v) => form.setValue('bedNumber', v)}
              disabled={!selectedRoomId}>
              <SelectTrigger>
                <SelectValue placeholder={!selectedRoomId ? 'Select room first' : (bedsForRoom?.length === 0 ? 'No beds' : 'Select bed')} />
              </SelectTrigger>
              <SelectContent>
                {(bedsForRoom ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.number}>
                    {b.number} ({b.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && !selectedRoomId && form.values.bedNumber && (
              <p className="text-xs text-muted-foreground">Current: {form.values.bedNumber}</p>
            )}
          </div>

          <FormInput label="Notice Date" type="date" id="noticeDate" value={form.values.noticeDate} onChange={(e) => form.setValue('noticeDate', e.target.value)} />
          <FormInput label="Check-out Date" type="date" id="checkOutDate" value={form.values.checkOutDate} onChange={(e) => form.setValue('checkOutDate', e.target.value)} />
          <FormInput label="Deposit Refund (₹)" type="number" id="depositRefund" value={String(form.values.depositRefund)} onChange={(e) => form.setValue('depositRefund', Number(e.target.value))} />
          <FormInput label="Deductions (₹)" type="number" id="deductions" value={String(form.values.deductions)} onChange={(e) => form.setValue('deductions', Number(e.target.value))} />
          <div className="space-y-1.5"><Label>Reason</Label><Select value={form.values.reason} onValueChange={(v) => form.setValue('reason', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as CheckOut['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </FormDialog>

      {/* Confirmation Modal for Complete Check-out */}
      <FormDialog
        open={!!completeTarget}
        onOpenChange={(o) => !o && setCompleteTarget(null)}
        title="Complete Tenant Move-out & Check-out"
        description="Verify move-out details, deposit refund, and release assigned bed."
        onSubmit={handleCompleteCheckOut}
        loading={completing}
        submitLabel="Confirm & Release Bed">
        {completeTarget && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="font-semibold text-base text-foreground">{completeTarget.tenantName}</h4>
                  <p className="text-xs text-muted-foreground">Check-out Code: <span className="font-mono">{completeTarget.code}</span></p>
                </div>
                <StatusBadge status={completeTarget.status} tone={statusTone(completeTarget.status)} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Property:</span>
                  <span className="font-medium text-foreground">{propMap.get(completeTarget.propertyId) ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Room & Bed:</span>
                  <span className="font-medium text-foreground">Room {completeTarget.roomNumber} ({completeTarget.bedNumber})</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Notice Date:</span>
                  <span className="font-medium text-foreground">{completeTarget.noticeDate ? formatDate(completeTarget.noticeDate) : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reason:</span>
                  <span className="font-medium text-foreground">{completeTarget.reason || 'Lease ended'}</span>
                </div>
              </div>

              {/* Refund Breakdown */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-md border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <div className="flex justify-between text-xs text-emerald-900 dark:text-emerald-200">
                  <span>Deposit Paid Refund:</span>
                  <span className="font-medium">{formatCurrency(completeTarget.depositRefund || 0)}</span>
                </div>
                <div className="flex justify-between text-xs text-destructive">
                  <span>Deductions:</span>
                  <span className="font-medium">- {formatCurrency(completeTarget.deductions || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-emerald-700 dark:text-emerald-400 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                  <span>Net Refund Payable:</span>
                  <span>{formatCurrency((completeTarget.depositRefund || 0) - (completeTarget.deductions || 0))}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Effective Move-out Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm pl-9 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={effectiveCheckOutDate}
                  onChange={(e) => setEffectiveCheckOutDate(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Marking checked-out will archive tenant record and revert Bed {completeTarget.bedNumber} in Room {completeTarget.roomNumber} back to Available.
              </p>
            </div>
          </div>
        )}
      </FormDialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Check-out" variant="destructive"
        description={`Delete check-out record "${deleteTarget?.code}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}

