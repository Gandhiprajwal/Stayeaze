import { useState } from 'react';
import {
  MessageSquareWarning, Plus, Trash2, CheckCircle, Search, UserCheck, Check, X,
  Phone, Mail, Eye, User as UserIcon, Home, Building2, Loader2, MessageSquare,
  DollarSign, Receipt, Wrench, Flame, AlertTriangle, Clock, ShieldAlert, RefreshCw,
  Zap, TrendingUp, AlertCircle
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ComplaintChatDialog } from './ComplaintChatDialog';

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
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePropertyStore } from '@/lib/stores/property-store';
import { useWebSocket } from '@/lib/websocket/WebSocketProvider';

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
  const { selectedPropertyId } = usePropertyStore();
  const user = currentUser;
  const userRole = (currentUser?.role ?? '').toUpperCase();
  const isTenant = userRole === 'TENANT';
  const canChangeStatus = ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'].includes(userRole);

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Complaint | null>(null);
  const [statusVal, setStatusVal] = useState<Complaint['status']>('open');
  const [assignedVal, setAssignedVal] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<Complaint | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [chatComplaint, setChatComplaint] = useState<Complaint | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | number | null>(null);

  // Damage & Maintenance Chargeback State (P3.2)
  const [chargebackComplaint, setChargebackComplaint] = useState<Complaint | null>(null);
  const [chargebackAmount, setChargebackAmount] = useState<string>('');
  const [chargeMode, setChargeMode] = useState<'INDIVIDUAL' | 'SPLIT_ROOMMATES'>('INDIVIDUAL');
  const [chargeRemarks, setChargeRemarks] = useState<string>('');
  const [isSubmittingChargeback, setIsSubmittingChargeback] = useState<boolean>(false);

  function openChargebackDialog(row: Complaint) {
    setChargebackComplaint(row);
    setChargebackAmount('');
    setChargeMode('INDIVIDUAL');
    setChargeRemarks(`Repair/damage charge for ${row.category} ticket (${row.ticketNumber || 'TKT'})`);
  }

  async function handleExecuteChargeback() {
    if (!chargebackComplaint) return;
    const amt = parseFloat(chargebackAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid chargeback amount greater than 0');
      return;
    }

    setIsSubmittingChargeback(true);
    try {
      const res = await api.post(`/complaints/${chargebackComplaint.id}/chargeback`, {
        amount: amt,
        chargeMode,
        remarks: chargeRemarks,
      });
      toast.success(res.data?.message || 'Complaint resolved and chargeback invoices generated!');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['complaints-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/invoices'] });
      setChargebackComplaint(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to apply chargeback');
    } finally {
      setIsSubmittingChargeback(false);
    }
  }

  const { data: slaMetrics, refetch: refetchSlaMetrics } = useQuery({
    queryKey: ['complaints-sla-metrics'],
    queryFn: () => api.get<any>('/complaints/sla-metrics').then((r) => r.data || {}),
  });

  const [isCheckingSla, setIsCheckingSla] = useState(false);
  async function handleCheckSlaBreaches() {
    setIsCheckingSla(true);
    try {
      const res = await api.post('/complaints/check-sla-breaches');
      toast.success(res.data?.message || 'SLA breach sweep completed');
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['complaints-stats'] });
      queryClient.invalidateQueries({ queryKey: ['complaints-sla-metrics'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to trigger SLA breach check');
    } finally {
      setIsCheckingSla(false);
    }
  }

  // Escalation State
  const [escalateTarget, setEscalateTarget] = useState<Complaint | null>(null);
  const [escalationReason, setEscalationReason] = useState<string>('');
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState<boolean>(false);

  function openEscalateDialog(row: Complaint) {
    setEscalateTarget(row);
    setEscalationReason('');
  }

  async function handleExecuteEscalation() {
    if (!escalateTarget) return;
    if (!escalationReason.trim()) {
      toast.error('Please specify an escalation reason');
      return;
    }
    setIsSubmittingEscalation(true);
    try {
      await api.post(`/complaints/${escalateTarget.id}/escalate`, { reason: escalationReason.trim() });
      toast.success(`Complaint ${escalateTarget.ticketNumber || 'ticket'} has been escalated to leadership!`);
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      queryClient.invalidateQueries({ queryKey: ['complaints-stats'] });
      queryClient.invalidateQueries({ queryKey: ['complaints-sla-metrics'] });
      if (selectedComplaint?.id === escalateTarget.id) {
        setSelectedComplaint((prev) => prev ? { ...prev, isEscalated: true, escalationReason: escalationReason.trim() } : null);
      }
      setEscalateTarget(null);
      setEscalationReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to escalate complaint');
    } finally {
      setIsSubmittingEscalation(false);
    }
  }

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

  const staffUsers = (users ?? []).filter((u: any) => {
    const role = (u.role || '').toUpperCase();
    return role !== 'TENANT' && role !== 'ROLE_TENANT';
  });

  const { data: complaints } = useQuery<Complaint[]>({
    queryKey: ['complaints-stats', selectedPropertyId],
    queryFn: () => {
      const p = selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId, pageSize: 100 } : { pageSize: 100 };
      return api.get<any>(ENDPOINT, { params: p }).then((r) => {
        const raw = r.data;
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw?.data)) return raw.data;
        if (Array.isArray(raw?.content)) return raw.content;
        return [];
      });
    },
  });
  const safeComplaints: Complaint[] = Array.isArray(complaints) ? complaints : [];
  const open = safeComplaints.filter((c) => c.status === 'open').length;
  const inProgress = safeComplaints.filter((c) => c.status === 'in_progress').length;
  const resolved = safeComplaints.filter((c) => c.status === 'resolved' || c.status === 'closed').length;

  const createMut = useCreate<Complaint>(ENDPOINT, 'Complaint');
  const updateMut = useUpdate<Complaint>(ENDPOINT, 'Complaint');
  const deleteMut = useDelete(ENDPOINT, 'Complaint');
  const bulkDeleteMut = useBulkDelete(ENDPOINT, 'complaints');
  const form = useForm(emptyForm);

  function openCreate() {
    form.reset(emptyForm);
    setSelectedTenantId(null);
    if (isTenant && user) {
      form.setValue('tenantName', user.name || user.email || 'Tenant');
      const t = (tenants ?? []).find((tenant: any) => tenant.email?.toLowerCase() === user.email?.toLowerCase());
      if (t) {
        setSelectedTenantId(t.id);
        if (t.propertyId) form.setValue('propertyId', t.propertyId);
        if (t.roomNumber) form.setValue('roomNumber', t.roomNumber);
      }
    }
    setDialogOpen(true);
  }

  function openStatusDialog(row: Complaint) {
    if (!canChangeStatus) return;
    setStatusTarget(row);
    setStatusVal(normalizeStatus(row.status));
    setAssignedVal(row.assignedTo ?? (row as any).assignedStaff ?? '');
  }

  function submitCreate() {
    if (isTenant) {
      if (!form.validate({ description: (v) => (!v ? 'Description is required' : undefined) })) return;
    } else {
      if (
        !form.validate({
          tenantName: (v) => (!v ? 'Required' : undefined),
          description: (v) => (!v ? 'Description is required' : undefined),
          propertyId: (v) => (!v ? 'Select a property' : undefined),
        })
      )
        return;
    }

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

  const { hasUnreadChat, markChatAsRead } = useWebSocket();

  const columns: Column<Complaint>[] = [
    {
      key: 'ticketNumber',
      header: 'Ticket',
      sortable: true,
      cell: (r) => (
        <span className="font-mono text-xs font-medium flex items-center gap-1.5">
          {hasUnreadChat(r.id) && (
            <span className="relative flex h-2 w-2 shrink-0" title="New unread message">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
          {r.ticketNumber}
        </span>
      ),
    },
    { key: 'tenantName', header: 'Tenant', sortable: true, cell: (r) => <span className="font-medium">{r.tenantName}</span> },
    { key: 'roomNumber', header: 'Room', sortable: true, cell: (r) => <span className="font-semibold text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-mono">{r.roomNumber ? `Room ${r.roomNumber}` : '—'}</span> },
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) => <span className="text-sm">{String(propMap.get(r.propertyId) ?? '—')}</span> },
    { key: 'category', header: 'Category', sortable: true, cell: (r) => <span className="text-sm capitalize">{r.category}</span> },
    { key: 'priority', header: 'Priority', sortable: true, cell: (r) => {
      const prio = normalizePriority(r.priority);
      return <StatusBadge status={prio} tone={prio === 'critical' ? 'destructive' : prio === 'high' ? 'warning' : prio === 'medium' ? 'info' : 'neutral'} />;
    } },
    {
      key: 'slaStatus',
      header: 'SLA Status',
      sortable: false,
      cell: (r) => {
        const isResolved = r.status === 'resolved' || r.status === 'closed' || !!r.resolvedAt;
        if (r.isEscalated) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 border border-rose-500/30 dark:text-rose-400">
              <Flame className="h-3 w-3 animate-pulse" /> Escalated
            </span>
          );
        }
        if (r.slaBreached) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 border border-red-500/30 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" /> Breached
            </span>
          );
        }
        if (isResolved) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 dark:text-emerald-400">
              <CheckCircle className="h-3 w-3" /> Met SLA
            </span>
          );
        }
        if (r.slaMinutesRemaining !== undefined && r.slaMinutesRemaining !== null) {
          const hours = Math.round(r.slaMinutesRemaining / 60);
          if (r.slaMinutesRemaining <= 0) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 border border-red-500/30">
                <AlertTriangle className="h-3 w-3" /> Overdue
              </span>
            );
          }
          if (r.slaMinutesRemaining <= 360) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30 dark:text-amber-400">
                <Clock className="h-3 w-3" /> {hours > 0 ? `${hours}h left` : `${r.slaMinutesRemaining}m left`}
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:text-blue-400">
              <Clock className="h-3 w-3" /> {hours}h left
            </span>
          );
        }
        return <span className="text-xs text-muted-foreground">Standard SLA</span>;
      }
    },
    { key: 'description', header: 'Description', cell: (r) => <span className="line-clamp-1 max-w-[240px] text-sm text-muted-foreground">{r.description}</span> },
    { key: 'assignedTo', header: 'Assigned', sortable: true, cell: (r) => <span className="text-sm">{r.assignedTo || (r as any).assignedStaff || '—'}</span> },
    { key: 'createdAt', header: 'Created', sortable: true, cell: (r) => <span className="text-sm">{formatDate(r.createdAt)}</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const propertyFilterOptions = (properties ?? []).map((p: any) => ({ value: p.id, label: p.name }));

  const slaComplianceRate = slaMetrics?.slaCompliance ?? 100.0;
  const escalatedCount = slaMetrics?.escalatedTickets ?? safeComplaints.filter((c) => c.isEscalated).length;
  const breachedCount = slaMetrics?.breachedTickets ?? safeComplaints.filter((c) => c.slaBreached).length;
  const avgHours = slaMetrics?.avgResolutionHours ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Complaint Management & SLA Engine"
        description="Review tickets, monitor category SLAs, escalate breaches, and resolve tenant complaints."
        icon={MessageSquareWarning}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckSlaBreaches}
              disabled={isCheckingSla}
              className="gap-1.5 border-border shadow-xs"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isCheckingSla && "animate-spin text-primary")} />
              {isCheckingSla ? 'Checking SLAs...' : 'Sync SLA Breaches'}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Log Complaint
            </Button>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Open Tickets" value={open} icon={MessageSquareWarning} accent="warning" />
        <StatCard label="In Progress" value={inProgress} icon={Clock} accent="info" />
        <StatCard
          label="SLA Compliance"
          value={`${slaComplianceRate}%`}
          icon={TrendingUp}
          accent={slaComplianceRate >= 90 ? 'success' : slaComplianceRate >= 75 ? 'warning' : 'destructive'}
        />
        <StatCard
          label="SLA Breached"
          value={breachedCount}
          icon={AlertTriangle}
          accent={breachedCount > 0 ? 'destructive' : 'primary'}
        />
        <StatCard
          label="Escalated Tickets"
          value={escalatedCount}
          icon={Flame}
          accent={escalatedCount > 0 ? 'destructive' : 'primary'}
        />
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
            {
              label: hasUnreadChat(row.id) ? '🔴 Live Ticket Chat' : 'Live Ticket Chat',
              icon: MessageSquare,
              onSelect: () => {
                markChatAsRead(row.id);
                setChatComplaint(row);
              },
            },
            { label: 'View Details', icon: Eye, onSelect: () => setSelectedComplaint(row) },
            {
              label: row.isEscalated ? '🔥 Already Escalated' : 'Escalate Ticket',
              icon: Flame,
              disabled: row.isEscalated || row.status === 'resolved' || row.status === 'closed',
              onSelect: () => openEscalateDialog(row),
            },
            ...(canChangeStatus ? [
              { label: 'Update Status', icon: CheckCircle, onSelect: () => openStatusDialog(row) },
              { label: 'Resolve & Chargeback', icon: DollarSign, onSelect: () => openChargebackDialog(row) },
            ] : []),
            { label: 'Delete', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteTarget(row) },
          ]} />
        )} />

      <ComplaintChatDialog open={!!chatComplaint} onOpenChange={(o) => !o && setChatComplaint(null)} complaint={chatComplaint} />

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
                    {selectedComplaint.isEscalated && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm">
                        <Flame className="h-3 w-3 animate-pulse" /> Escalated
                      </span>
                    )}
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
                {/* SLA Status Card */}
                <div className={cn(
                  "p-3.5 rounded-xl border flex items-center justify-between text-xs",
                  selectedComplaint.isEscalated
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                    : selectedComplaint.slaBreached
                    ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                    : "bg-muted/40 border-border/80 text-muted-foreground"
                )}>
                  <div className="flex items-center gap-2.5">
                    {selectedComplaint.isEscalated ? (
                      <Flame className="h-4 w-4 text-rose-500 shrink-0" />
                    ) : selectedComplaint.slaBreached ? (
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold text-foreground">
                        {selectedComplaint.isEscalated
                          ? 'Escalated Ticket Alert'
                          : selectedComplaint.slaBreached
                          ? 'SLA Target Breached'
                          : 'SLA Resolution Window'}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {selectedComplaint.isEscalated && selectedComplaint.escalationReason
                          ? `Reason: ${selectedComplaint.escalationReason}`
                          : selectedComplaint.slaDueAt
                          ? `Target Deadline: ${formatDate(selectedComplaint.slaDueAt)}`
                          : 'Standard Category Target Active'}
                      </p>
                    </div>
                  </div>
                  {!selectedComplaint.isEscalated && selectedComplaint.status !== 'resolved' && selectedComplaint.status !== 'closed' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs gap-1 font-semibold"
                      onClick={() => {
                        const target = selectedComplaint;
                        setSelectedComplaint(null);
                        openEscalateDialog(target);
                      }}
                    >
                      <Flame className="h-3 w-3" /> Escalate
                    </Button>
                  )}
                </div>

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
        loading={createMut.isPending} submitLabel="Create" size="lg">
        <div className="grid gap-4 sm:grid-cols-2">
          {!isTenant ? (
            <>
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
              <div className="space-y-1.5">
                <Label required>Property</Label>
                <SearchableSelect
                  options={(properties ?? []).map((p: any) => ({
                    value: String(p.id),
                    label: p.name,
                    sublabel: p.city || p.code || 'Property',
                    badge: p.type || 'PG',
                  }))}
                  value={form.values.propertyId ? String(form.values.propertyId) : ''}
                  onChange={(v) => form.setValue('propertyId', v)}
                  placeholder="Search & select property..."
                  searchPlaceholder="Search properties..."
                />
                {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
              </div>
              <FormInput label="Room Number" id="roomNumber" value={form.values.roomNumber} onChange={(e) => form.setValue('roomNumber', e.target.value)} />
            </>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Logging complaint as</p>
                  <p className="font-bold text-sm text-foreground">{user?.name || user?.email}</p>
                </div>
                {form.values.roomNumber ? (
                  <span className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary rounded-full font-mono border border-primary/20">
                    📍 Room {form.values.roomNumber}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground italic">
                    Assigned Room
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5"><Label>Category</Label><Select value={form.values.category} onValueChange={(v) => form.setValue('category', v as Complaint['category'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Priority</Label><Select value={form.values.priority} onValueChange={(v) => form.setValue('priority', v as Complaint['priority'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div>

          {!isTenant && (
            <div className="space-y-1.5"><Label>Status</Label><Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Complaint['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
          )}

          <FormTextarea label="Description" required className="sm:col-span-2" id="description" value={form.values.description} onChange={(e) => form.setValue('description', e.target.value)} error={form.errors.description} rows={3} />

          {!isTenant && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assign To Staff</Label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Unassigned', sublabel: 'No staff assigned' },
                  ...staffUsers.map((u) => ({
                    value: u.name,
                    label: u.name,
                    sublabel: u.role || u.email || 'Staff',
                  })),
                ]}
                value={form.values.assignedTo || ''}
                onChange={(v) => form.setValue('assignedTo', v)}
                placeholder="Search & assign staff..."
                searchPlaceholder="Search staff by name, role..."
              />
            </div>
          )}
        </div>
      </FormDialog>
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Complaint" variant="destructive"
        description={`Delete complaint "${deleteTarget?.ticketNumber}"?`} confirmLabel="Delete" onConfirm={confirmDelete} loading={deleteMut.isPending} />

      {/* Resolve & Chargeback Invoicing Modal (P3.2) */}
      <Dialog open={!!chargebackComplaint} onOpenChange={(o) => !o && setChargebackComplaint(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <DollarSign className="h-5 w-5 text-amber-600" /> Resolve &amp; Issue Damage Chargeback
            </DialogTitle>
            <DialogDescription className="text-xs">
              Resolve this complaint ticket and bill repair or damage costs directly into tenant rent accounts with itemized invoice line items.
            </DialogDescription>
          </DialogHeader>

          {chargebackComplaint && (
            <div className="space-y-4 py-1 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-foreground">{chargebackComplaint.ticketNumber}</span>
                  <span className="capitalize font-semibold text-primary">{chargebackComplaint.category} Issue</span>
                </div>
                <p className="text-muted-foreground line-clamp-2 italic">"{chargebackComplaint.description}"</p>
                <div className="pt-1 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40">
                  <span>Resident: <b>{chargebackComplaint.tenantName}</b></span>
                  <span>Room: <b>{chargebackComplaint.roomNumber ? `Room ${chargebackComplaint.roomNumber}` : 'General'}</b></span>
                </div>
              </div>

              {/* Allocation Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Charge Allocation Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChargeMode('INDIVIDUAL')}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all",
                      chargeMode === 'INDIVIDUAL'
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <p className="text-xs">Individual Resident</p>
                    <p className="text-[10px] font-normal opacity-80">Bill 100% to reporting resident</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChargeMode('SPLIT_ROOMMATES')}
                    className={cn(
                      "p-2.5 rounded-lg border text-left transition-all",
                      chargeMode === 'SPLIT_ROOMMATES'
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border bg-background hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <p className="text-xs">Split Across Room</p>
                    <p className="text-[10px] font-normal opacity-80">Equal split among active roommates</p>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Total Chargeback Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 1500"
                    value={chargebackAmount}
                    onChange={(e) => setChargebackAmount(e.target.value)}
                    className="w-full h-9 pl-7 pr-3 text-sm font-mono font-bold rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Invoice Item Description / Remarks</Label>
                <textarea
                  rows={2}
                  value={chargeRemarks}
                  onChange={(e) => setChargeRemarks(e.target.value)}
                  placeholder="Explain the repair, replacement, or technician cost..."
                  className="w-full p-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setChargebackComplaint(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  onClick={handleExecuteChargeback}
                  disabled={isSubmittingChargeback || !chargebackAmount}
                >
                  {isSubmittingChargeback ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                  {isSubmittingChargeback ? 'Issuing Invoices...' : 'Resolve & Issue Chargeback'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
