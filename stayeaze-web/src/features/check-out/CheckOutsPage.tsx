import { useState } from 'react';
import { LogOut, Plus, Trash2, BadgeCheck, DollarSign, Calendar, CreditCard, Wallet, Building2, CheckCircle2, Clock, Copy, Check, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
import { useAuthStore } from '@/lib/stores/auth-store';

import { TenantSelect } from '@/components/common/TenantSelect';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { RoomSelect } from '@/components/common/RoomSelect';

const ENDPOINT = '/check-outs';
const statuses = [{ value: 'notice_period', label: 'Notice Period' }, { value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }];
const reasons = ['Relocating', 'Lease ended', 'Personal', 'Job change', 'Upgrade'];

const emptyForm = {
  tenantName: '', propertyId: '', roomNumber: '', bedNumber: 'B1',
  checkOutDate: new Date().toISOString().slice(0, 10), noticeDate: new Date().toISOString().slice(0, 10),
  depositRefund: 0, deductions: 0, reason: 'Lease ended', status: 'notice_period' as CheckOut['status'],
  beneficiaryUpi: '', beneficiaryAccount: '', beneficiaryIfsc: '', beneficiaryBank: '',
};

export default function CheckOutsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const userRole = (currentUser?.role ?? '').toUpperCase();
  const canChangeStatus = ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'SUPER_ADMIN'].includes(userRole);
  // Security deposit refund approval strictly restricted to Accountant, Admin, and Owner (Super Admin excluded)
  const canApproveRefund = ['ACCOUNTANT', 'ADMIN', 'OWNER'].includes(userRole);

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CheckOut | null>(null);
  const [completeTarget, setCompleteTarget] = useState<CheckOut | null>(null);
  const [refundTarget, setRefundTarget] = useState<CheckOut | null>(null);
  const [refundPaymentMode, setRefundPaymentMode] = useState<'UPI' | 'BANK_TRANSFER' | 'RAZORPAY' | 'CASH'>('UPI');
  const [refundTxRef, setRefundTxRef] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [beneficiaryUpi, setBeneficiaryUpi] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [beneficiaryIfsc, setBeneficiaryIfsc] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [approvingRefund, setApprovingRefund] = useState(false);
  const [effectiveCheckOutDate, setEffectiveCheckOutDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [completing, setCompleting] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');

  const { data: properties } = useQuery({
    queryKey: ['checkouts-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

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
  const deleteMut = useDelete(ENDPOINT, 'Check-out');
  const form = useForm(emptyForm);

  function openCreate() {
    setSelectedRoomId('');
    setSelectedTenantId('');
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function onSelectTenant(tenantId: string) {
    setSelectedTenantId(tenantId);
    const tenant = (activeTenants ?? []).find((t) => t.id === tenantId);
    if (tenant) {
      const displayName = tenant.name || `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim();
      form.setValue('tenantName', displayName);
      if (tenant.propertyId) form.setValue('propertyId', String(tenant.propertyId));
      if (tenant.roomNumber) {
        form.setValue('roomNumber', tenant.roomNumber);
        const rm = (allRooms ?? []).find((r) => r.number === tenant.roomNumber);
        if (rm) setSelectedRoomId(rm.id);
      }
      if (tenant.bedNumber) form.setValue('bedNumber', tenant.bedNumber);
      if (tenant.deposit !== undefined && tenant.deposit !== null && Number(tenant.deposit) > 0) {
        form.setValue('depositRefund', Number(tenant.deposit));
      } else {
        form.setValue('depositRefund', 0);
      }
      if (tenant.refundUpi) form.setValue('beneficiaryUpi', tenant.refundUpi);
      if (tenant.refundAccountNumber) form.setValue('beneficiaryAccount', tenant.refundAccountNumber);
      if (tenant.refundIfsc) form.setValue('beneficiaryIfsc', tenant.refundIfsc);
      if (tenant.refundBankName) form.setValue('beneficiaryBank', tenant.refundBankName);
    }
  }

  function submit() {
    if (!form.validate({ tenantName: (v) => !v ? 'Required' : undefined, propertyId: (v) => !v ? 'Select a property' : undefined })) return;
    const payload = { ...form.values, code: `CO-${String(Date.now()).slice(-4)}` };
    createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  }

  function confirmDelete() { if (deleteTarget) deleteMut.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }

  function openCompleteModal(row: CheckOut) {
    if (!canChangeStatus) return;
    setCompleteTarget(row);
    setEffectiveCheckOutDate(row.checkOutDate || new Date().toISOString().slice(0, 10));
  }

  async function handleCompleteCheckOut() {
    if (!completeTarget || !canChangeStatus) return;
    try {
      setCompleting(true);
      await api.post(`/check-outs/${completeTarget.id}/mark-completed`, {
        checkOutDate: effectiveCheckOutDate,
        depositRefund: completeTarget.depositRefund,
        deductions: completeTarget.deductions,
        reason: completeTarget.reason,
      });
      toast.success('Check-out completed! Bed released and moved to refund settlement queue.');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['checkouts-active-tenants'] });
      setCompleteTarget(null);
    } catch (err) {
      console.error('Check-out completion error:', err);
      toast.error('Failed to complete check-out');
    } finally {
      setCompleting(false);
    }
  }

  function handleCopy(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function openRefundModal(row: CheckOut) {
    if (!canApproveRefund) {
      toast.error('Only Accountant, Admin, or Owner can approve security deposit refunds.');
      return;
    }
    if (row.status !== 'completed') {
      toast.error('Deposit refund can only be approved after move-out check-out is completed (not during notice period).');
      return;
    }
    setRefundTarget(row);
    setRefundPaymentMode(row.beneficiaryUpi ? 'UPI' : (row.beneficiaryAccount ? 'BANK_TRANSFER' : 'UPI'));
    setRefundTxRef('');
    setRefundNotes('');
    setBeneficiaryUpi(row.beneficiaryUpi || '');
    setBeneficiaryAccount(row.beneficiaryAccount || '');
    setBeneficiaryIfsc(row.beneficiaryIfsc || '');
    setBeneficiaryBank(row.beneficiaryBank || '');
  }

  async function handleApproveRefund() {
    if (!refundTarget || !canApproveRefund) return;
    try {
      setApprovingRefund(true);
      await api.post(`/check-outs/${refundTarget.id}/approve-refund`, {
        paymentMode: refundPaymentMode,
        transactionRef: refundTxRef,
        notes: refundNotes,
        beneficiaryUpi,
        beneficiaryAccount,
        beneficiaryIfsc,
        beneficiaryBank,
      });
      toast.success('🎉 Security Deposit Refund Approved & Settled!');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      setRefundTarget(null);
      setRefundTxRef('');
      setRefundNotes('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Refund approval failed');
    } finally {
      setApprovingRefund(false);
    }
  }

  const columns: Column<CheckOut>[] = [
    { key: 'code', header: 'Check-out ID', sortable: true, cell: (r) => <span className="font-mono text-xs font-medium">{r.code}</span> },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{String(propMap.get(r.propertyId) || '—')}</span> },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => <span className="text-sm">Room {r.roomNumber} · {r.bedNumber}</span> },
    { key: 'noticeDate', header: 'Notice Date', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.noticeDate)}</span> },
    { key: 'checkOutDate', header: 'Check-out Date', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.checkOutDate)}</span> },
    { key: 'depositRefund', header: 'Deposit Paid', sortable: true, cell: (r) => <span className="font-medium tabular-nums text-foreground">{formatCurrency(r.depositRefund)}</span> },
    { key: 'deductions', header: 'Deductions', sortable: true, cell: (r) => <span className="text-sm text-destructive tabular-nums">{r.deductions ? `- ${formatCurrency(r.deductions)}` : '₹0'}</span> },
    {
      key: 'netRefundAmount' as keyof CheckOut,
      header: 'Refund Amount (Net)',
      sortable: true,
      cell: (r) => {
        const net = r.netRefundAmount !== undefined && r.netRefundAmount !== null
          ? Number(r.netRefundAmount)
          : Math.max(0, (r.depositRefund || 0) - (r.deductions || 0));
        return <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(net)}</span>;
      },
    },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
    {
      key: 'refundStatus' as keyof CheckOut,
      header: 'Refund Settlement',
      sortable: true,
      cell: (r) => {
        if (r.status === 'notice_period') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <Clock className="w-3 h-3 mr-1" /> Notice Period
            </span>
          );
        }
        if (r.refundStatus === 'REFUNDED') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <BadgeCheck className="w-3 h-3 mr-1" /> Refund Settled ({r.refundPaymentMode || 'BANK'})
            </span>
          );
        }
        if (r.status === 'completed') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
              <Clock className="w-3 h-3 mr-1" /> Refund Pending
            </span>
          );
        }
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: 'actions' as keyof CheckOut,
      header: 'Action',
      cell: (r) => {
        if (r.status !== 'completed') {
          if (canChangeStatus) {
            return (
              <Button
                size="sm"
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/60 font-medium h-8 text-xs"
                onClick={() => openCompleteModal(r)}>
                <BadgeCheck className="mr-1 h-3.5 w-3.5" /> Mark Checked Out
              </Button>
            );
          }
          return <StatusBadge status={r.status} tone={statusTone(r.status)} />;
        }

        // Status is completed
        if (r.refundStatus === 'REFUNDED') {
          return (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <BadgeCheck className="h-3.5 w-3.5" /> Settled
            </span>
          );
        }

        // Completed and awaiting refund approval
        if (canApproveRefund) {
          return (
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-8 text-xs shadow-sm"
              onClick={() => openRefundModal(r)}>
              <DollarSign className="mr-1 h-3.5 w-3.5" /> Settle Refund
            </Button>
          );
        }

        return (
          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Awaiting Accounts
          </span>
        );
      },
    },
  ];

  const propertyFilterOptions = (properties ?? []).map((p: any) => ({ value: p.id, label: p.name }));

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
            ...(row.status !== 'completed' && canChangeStatus ? [{
              label: 'Mark Checked Out (Archive)', icon: LogOut, onSelect: () => openCompleteModal(row)
            }] : []),
            ...(row.status === 'completed' && row.refundStatus !== 'REFUNDED' && canApproveRefund ? [{
              label: 'Approve & Settle Refund', icon: DollarSign, onSelect: () => openRefundModal(row)
            }] : []),
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />

      {/* Form Dialog for New Check-out */}
      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title="New Check-out" onSubmit={submit}
        loading={createMut.isPending} submitLabel="Process Check-out" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Active Tenant (Auto-fill Move-out Details)</Label>
            <TenantSelect
              tenants={activeTenants ?? []}
              selectedTenantId={selectedTenantId}
              onSelectTenant={(t) => {
                if (!t) {
                  setSelectedTenantId('');
                  return;
                }
                setSelectedTenantId(t.id);
                onSelectTenant(t.id);
              }}
            />
          </div>

          <FormInput label="Tenant Name" required id="tenantName" value={form.values.tenantName} onChange={(e) => form.setValue('tenantName', e.target.value)} error={form.errors.tenantName} />
          <div className="space-y-1.5">
            <Label>Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: any) => ({
                value: p.id,
                label: p.name,
                sublabel: p.city || p.code || 'Property',
                badge: p.type || 'PG',
              }))}
              value={form.values.propertyId}
              onChange={(v) => {
                form.setValue('propertyId', v);
                form.setValue('roomNumber', '');
                form.setValue('bedNumber', '');
                setSelectedRoomId('');
              }}
              placeholder="Search & select property..."
              searchPlaceholder="Search properties..."
            />
            {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
          </div>

          {/* Room & Bed Allocation with interactive bed cards */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Room &amp; Bed Allocation</Label>
            <RoomSelect
              rooms={roomOptions}
              beds={bedsForRoom}
              selectedRoomNumber={form.values.roomNumber || selectedRoomId}
              selectedBedNumber={form.values.bedNumber}
              onSelectRoom={(rNum, rId) => {
                form.setValue('roomNumber', rNum);
                setSelectedRoomId(rId || rNum);
                if (rId) {
                  queryClient.invalidateQueries({ queryKey: ['checkouts-beds', rId] });
                }
                form.setValue('bedNumber', '');
              }}
              onSelectBed={(bNum) => form.setValue('bedNumber', bNum)}
            />
          </div>

          <FormInput label="Notice Date" type="date" id="noticeDate" value={form.values.noticeDate} onChange={(e) => form.setValue('noticeDate', e.target.value)} />
          <FormInput label="Check-out Date" type="date" id="checkOutDate" value={form.values.checkOutDate} onChange={(e) => form.setValue('checkOutDate', e.target.value)} />
          <div className="space-y-1.5">
            <Label>Deposit Paid Refund (₹)</Label>
            <input
              type="number"
              className="flex h-9 w-full rounded-md border border-input bg-muted/60 px-3 py-1 text-sm font-semibold shadow-sm cursor-not-allowed text-foreground"
              value={String(form.values.depositRefund)}
              readOnly
              disabled
            />
            <p className="text-[11px] text-muted-foreground">Auto-mapped from tenant record (Non-editable)</p>
          </div>
          <FormInput label="Deductions (₹)" type="number" id="deductions" value={String(form.values.deductions)} onChange={(e) => form.setValue('deductions', Number(e.target.value))} />
          {/* Tenant Self-Service Refund Payout Info Banner */}
          <div className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              Tenant Self-Service Refund Account
            </div>
            <p className="text-[11px] text-muted-foreground">
              {form.values.beneficiaryUpi || form.values.beneficiaryAccount
                ? `✓ Payout details linked: ${form.values.beneficiaryUpi ? `UPI: ${form.values.beneficiaryUpi}` : `A/C: ${form.values.beneficiaryAccount}`}`
                : 'Resident manages their refund UPI ID & Bank Account directly in their Tenant Portal.'}
            </p>
          </div>

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
                  <span className="font-medium text-foreground">{String(propMap.get(completeTarget.propertyId) || '—')}</span>
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

      {/* Settle Security Deposit Refund Modal (Accountant / Admin / Owner ONLY) */}
      <FormDialog
        open={!!refundTarget}
        onOpenChange={(o) => !o && setRefundTarget(null)}
        title="Settle Security Deposit Refund"
        description="Verify move-out settlement, choose payout mode, and approve deposit refund."
        onSubmit={handleApproveRefund}
        loading={approvingRefund}
        submitLabel="Approve & Mark Refunded">
        {refundTarget && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="font-semibold text-base text-foreground">{refundTarget.tenantName}</h4>
                  <p className="text-xs text-muted-foreground">Check-out Ref: <span className="font-mono">{refundTarget.code}</span></p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <Clock className="w-3 h-3 mr-1" /> Awaiting Refund Approval
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Property:</span>
                  <span className="font-medium text-foreground">{String(propMap.get(refundTarget.propertyId) || '—')}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Room & Bed:</span>
                  <span className="font-medium text-foreground">Room {refundTarget.roomNumber} ({refundTarget.bedNumber})</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Move-Out Date:</span>
                  <span className="font-medium text-foreground">{refundTarget.checkOutDate ? formatDate(refundTarget.checkOutDate) : '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Reason:</span>
                  <span className="font-medium text-foreground">{refundTarget.reason || 'Lease ended'}</span>
                </div>
              </div>

              {/* Refund Calculation Box */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3 rounded-md border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                <div className="flex justify-between text-xs text-emerald-900 dark:text-emerald-200">
                  <span>Original Security Deposit Paid:</span>
                  <span className="font-semibold">{formatCurrency(refundTarget.depositRefund || 0)}</span>
                </div>
                <div className="flex justify-between text-xs text-destructive">
                  <span>Damage / Bill Deductions:</span>
                  <span className="font-semibold">- {formatCurrency(refundTarget.deductions || 0)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-emerald-700 dark:text-emerald-400 pt-1.5 border-t border-emerald-200 dark:border-emerald-800">
                  <span>Net Refund Payable:</span>
                  <span className="font-mono">{formatCurrency(Math.max(0, (refundTarget.depositRefund || 0) - (refundTarget.deductions || 0)))}</span>
                </div>
              </div>
            </div>

            {/* Resident's Verified Refund Destination (Self-Service from Tenant Portal) */}
            <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-foreground">Resident's Refund Destination</Label>
                </div>
                {(beneficiaryUpi || beneficiaryAccount) ? (
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Verified in Tenant Portal
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-600" /> Awaiting Portal Entry
                  </span>
                )}
              </div>

              {(!beneficiaryUpi && !beneficiaryAccount) ? (
                <div className="p-2.5 rounded-md bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200">
                  Resident has not yet saved payout details in the Tenant Portal. They can enter their UPI ID or Bank Account under <strong>Rent & Billing</strong> in their portal.
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground font-medium">Resident UPI ID</Label>
                    {beneficiaryUpi && (
                      <Button type="button" variant="outline" size="sm" className="h-5 px-1.5 text-[10px] bg-background" onClick={() => handleCopy(beneficiaryUpi, 'UPI ID')}>
                        {copiedField === 'UPI ID' ? <Check className="h-3 w-3 text-emerald-600 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedField === 'UPI ID' ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </div>
                  <input
                    type="text"
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs"
                    placeholder="e.g. tenant@okhdfcbank"
                    value={beneficiaryUpi}
                    onChange={(e) => setBeneficiaryUpi(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground font-medium">Bank Name</Label>
                  </div>
                  <input
                    type="text"
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs"
                    placeholder="e.g. HDFC Bank"
                    value={beneficiaryBank}
                    onChange={(e) => setBeneficiaryBank(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground font-medium">Bank Account Number</Label>
                    {beneficiaryAccount && (
                      <Button type="button" variant="outline" size="sm" className="h-5 px-1.5 text-[10px] bg-background" onClick={() => handleCopy(beneficiaryAccount, 'Account Number')}>
                        {copiedField === 'Account Number' ? <Check className="h-3 w-3 text-emerald-600 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedField === 'Account Number' ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </div>
                  <input
                    type="text"
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs shadow-xs"
                    placeholder="e.g. 50100234891234"
                    value={beneficiaryAccount}
                    onChange={(e) => setBeneficiaryAccount(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-muted-foreground font-medium">IFSC Code</Label>
                    {beneficiaryIfsc && (
                      <Button type="button" variant="outline" size="sm" className="h-5 px-1.5 text-[10px] bg-background" onClick={() => handleCopy(beneficiaryIfsc, 'IFSC')}>
                        {copiedField === 'IFSC' ? <Check className="h-3 w-3 text-emerald-600 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedField === 'IFSC' ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </div>
                  <input
                    type="text"
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs uppercase shadow-xs"
                    placeholder="e.g. HDFC0001234"
                    value={beneficiaryIfsc}
                    onChange={(e) => setBeneficiaryIfsc(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>

            {/* Payout Method Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Payout Mode</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'UPI', label: 'Direct UPI', desc: 'GPay / PhonePe / Paytm' },
                  { id: 'BANK_TRANSFER', label: 'Bank IMPS/NEFT', desc: 'Direct A/C Transfer' },
                  { id: 'RAZORPAY', label: 'Razorpay Online', desc: 'Gateway Auto-Refund' },
                  { id: 'CASH', label: 'Cash at Desk', desc: 'Physical Handover' },
                ].map((mode) => (
                  <div
                    key={mode.id}
                    onClick={() => setRefundPaymentMode(mode.id as any)}
                    className={`cursor-pointer p-2.5 rounded-lg border-2 text-left transition-all ${
                      refundPaymentMode === mode.id
                        ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm'
                        : 'border-border hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold text-foreground">{mode.label}</div>
                    <div className="text-[10px] text-muted-foreground">{mode.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction Reference / Bank UTR Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {refundPaymentMode === 'CASH'
                  ? 'Cash Receipt / Voucher Ref # (Optional)'
                  : 'Bank UTR / Transaction Reference Number *'}
              </Label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={refundPaymentMode === 'UPI' ? 'e.g. UPI/423871239841' : refundPaymentMode === 'BANK_TRANSFER' ? 'e.g. UTR-HDFC9821381239' : 'e.g. TXN-REF-12345'}
                value={refundTxRef}
                onChange={(e) => setRefundTxRef(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Settlement Notes / Remarks (Optional)</Label>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. Settled in full after room inspection and key handover."
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </FormDialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Check-out" variant="destructive"
        description={`Delete check-out record "${deleteTarget?.code}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />
    </div>
  );
}

