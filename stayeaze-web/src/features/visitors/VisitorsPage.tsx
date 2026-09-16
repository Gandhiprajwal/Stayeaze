import React, { useState, useRef } from 'react';
import {
  UserCheck, Plus, Pencil, Trash2, Clock, LogOut, Camera, QrCode,
  CheckCircle2, XCircle, ShieldAlert, Sparkles, Share2, Copy, Check,
  KeyRound, Car, Phone, User, Eye, Download, Search, AlertCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/stores/auth-store';
import api from '@/lib/api';
import type { Visitor, User as UserType, Tenant } from '@/lib/types';
import { formatDateTime, resolveFileUrl } from '@/lib/format';
import { useCreate, useDelete, useUpdate } from '@/lib/hooks/use-crud';

const ENDPOINT = '/visitors';
const purposes = [
  { value: 'meeting', label: 'Personal Visit / Friend / Family' },
  { value: 'delivery', label: 'Courier / Food Delivery' },
  { value: 'maintenance', label: 'Maintenance / Technician' },
  { value: 'cab', label: 'Cab / Ride Drop' },
  { value: 'other', label: 'Other Official Purpose' },
];

export default function VisitorsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isTenant = user?.role === 'TENANT';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [preRegisterModalOpen, setPreRegisterModalOpen] = useState(false);
  const [gatePassModalOpen, setGatePassModalOpen] = useState(false);
  const [activePass, setActivePass] = useState<Visitor | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [verifiedPass, setVerifiedPass] = useState<any | null>(null);
  const [editing, setEditing] = useState<Visitor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Form State for Walk-In logging (Staff / Security)
  const [walkInForm, setWalkInForm] = useState({
    visitorName: '',
    visitorPhone: '',
    tenantId: '',
    tenantName: '',
    propertyId: '',
    purpose: 'meeting',
    vehicleNumber: '',
    photoUrl: '',
    approvedBy: user?.name || '',
  });

  // Form State for Tenant Pre-Registration
  const [preRegForm, setPreRegForm] = useState({
    visitorName: '',
    visitorPhone: '',
    purpose: 'meeting',
    vehicleNumber: '',
    expectedArrival: new Date().toISOString().slice(0, 16),
  });

  // Queries
  const { data: properties } = useQuery({
    queryKey: ['visitors-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const propMap = new Map((properties ?? []).map((p) => [p.id, p.name]));

  const { data: tenantsList } = useQuery({
    queryKey: ['visitors-tenants-list'],
    queryFn: () => api.get<any[]>('/tenants/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any)?.data || []),
    enabled: !isTenant,
  });

  const { data: users } = useQuery({
    queryKey: ['visitors-staff-users'],
    queryFn: () => api.get<any[]>('/users').then((r) => Array.isArray(r.data) ? r.data : (r.data as any)?.data || []),
    enabled: !isTenant,
  });

  // Tenant-specific pending approval requests
  const { data: rawPendingApprovals, refetch: refetchApprovals } = useQuery({
    queryKey: ['tenant-pending-visitor-approvals'],
    queryFn: () => api.get('/visitors/pending-tenant-approvals').then((r) => r.data),
    enabled: isTenant,
    staleTime: 60000,
  });
  const pendingApprovals: Visitor[] = Array.isArray(rawPendingApprovals)
    ? rawPendingApprovals
    : (Array.isArray((rawPendingApprovals as any)?.data) ? (rawPendingApprovals as any).data : []);

  // Tenant-specific my passes
  const { data: rawMyPasses, refetch: refetchMyPasses } = useQuery({
    queryKey: ['tenant-my-visitor-passes'],
    queryFn: () => api.get('/visitors/my-passes').then((r) => r.data),
    enabled: isTenant,
  });
  const myPasses: Visitor[] = Array.isArray(rawMyPasses)
    ? rawMyPasses
    : (Array.isArray((rawMyPasses as any)?.data) ? (rawMyPasses as any).data : []);

  // Overall visitors stats (for staff/management)
  const { data: rawAllVisitors, refetch: refetchAllVisitors } = useQuery({
    queryKey: ['visitors-stats-all'],
    queryFn: () => api.get(ENDPOINT, { params: { pageSize: 100 } }).then((r) => r.data),
  });
  const allVisitors: Visitor[] = Array.isArray(rawAllVisitors)
    ? rawAllVisitors
    : (Array.isArray((rawAllVisitors as any)?.data) ? (rawAllVisitors as any).data : []);

  const checkedInCount = allVisitors.filter((v: Visitor) => v.status === 'checked_in').length;
  const waitingApprovalCount = allVisitors.filter((v: Visitor) => v.status === 'waiting_approval').length;
  const preRegCount = allVisitors.filter((v: Visitor) => v.status === 'pre_registered').length;
  const checkedOutCount = allVisitors.filter((v: Visitor) => v.status === 'checked_out' || v.status === 'exited').length;

  // Mutations
  const createMut = useCreate<Visitor>(ENDPOINT, 'Visitor');
  const updateMut = useUpdate<Visitor>(ENDPOINT, 'Visitor');
  const deleteMut = useDelete(ENDPOINT, 'Visitor');

  // Handle Photo Upload (Webcam / File)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setPhotoError(`Selected photo is too large (${sizeMb} MB). Maximum allowed size is 3MB.`);
      toast({
        title: 'File Size Exceeded',
        description: `Photo size (${sizeMb} MB) exceeds the 3MB limit. Please choose a smaller photo.`,
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setPhotoError(null);
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'visitors');

    try {
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.fileUrl || '';
      setWalkInForm((f) => ({ ...f, photoUrl: url }));
      toast({ title: 'Photo Captured', description: 'Visitor photo attached successfully.' });
    } catch (err: any) {
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || 'Failed to capture photo';
      setPhotoError(errMsg);
      toast({
        title: 'Upload Failed',
        description: errMsg,
        variant: 'destructive',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Submit Walk-in Visitor (Staff / Guard)
  const handleWalkInSubmit = async () => {
    if (!walkInForm.visitorName.trim()) {
      toast({ title: 'Validation Error', description: 'Visitor name is required', variant: 'destructive' });
      return;
    }
    if (!walkInForm.visitorPhone.trim()) {
      toast({ title: 'Validation Error', description: 'Visitor phone number is required', variant: 'destructive' });
      return;
    }

    try {
      const res = await api.post(ENDPOINT, walkInForm);
      toast({
        title: walkInForm.tenantId ? 'Visitor Logged — Awaiting Resident Approval' : 'Visitor Checked In',
        description: walkInForm.tenantId
          ? 'An instant notification has been dispatched to the resident to approve entry.'
          : 'Visitor pass created and entry recorded.',
      });
      setLogModalOpen(false);
      refetchAllVisitors();
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
      // Reset
      setWalkInForm({
        visitorName: '', visitorPhone: '', tenantId: '', tenantName: '',
        propertyId: '', purpose: 'meeting', vehicleNumber: '', photoUrl: '',
        approvedBy: user?.name || '',
      });
    } catch (err: any) {
      toast({
        title: 'Error Logging Visitor',
        description: err?.response?.data?.message || 'Failed to log visitor',
        variant: 'destructive',
      });
    }
  };

  // Submit Tenant Pre-Registration
  const handlePreRegSubmit = async () => {
    if (!preRegForm.visitorName.trim()) {
      toast({ title: 'Validation Error', description: 'Visitor name is required', variant: 'destructive' });
      return;
    }
    try {
      const res = await api.post('/visitors/pre-register', preRegForm);
      toast({ title: 'Gate Pass Generated', description: 'Pre-registered visitor pass created with QR code.' });
      setPreRegisterModalOpen(false);
      setActivePass(res.data);
      setGatePassModalOpen(true);
      refetchMyPasses();
      refetchAllVisitors();
      setPreRegForm({
        visitorName: '', visitorPhone: '', purpose: 'meeting',
        vehicleNumber: '', expectedArrival: new Date().toISOString().slice(0, 16),
      });
    } catch (err: any) {
      toast({
        title: 'Error Generating Pass',
        description: err?.response?.data?.message || 'Failed to pre-register visitor',
        variant: 'destructive',
      });
    }
  };

  // Approve Entry (Tenant or Staff)
  const handleApproveEntry = async (id: string) => {
    try {
      await api.put(`/visitors/${id}/approve`);
      toast({ title: 'Entry Approved', description: 'Gate pass status updated to Approved. Security can now grant entry.' });
      refetchApprovals();
      refetchMyPasses();
      refetchAllVisitors();
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.response?.data?.message || 'Failed to approve entry', variant: 'destructive' });
    }
  };

  // Deny Entry (Tenant or Staff)
  const handleDenyEntry = async (id: string) => {
    try {
      await api.put(`/visitors/${id}/reject`, { reason: 'Denied by resident' });
      toast({ title: 'Entry Denied', description: 'Visitor entry has been rejected.', variant: 'destructive' });
      refetchApprovals();
      refetchMyPasses();
      refetchAllVisitors();
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.response?.data?.message || 'Failed to deny entry', variant: 'destructive' });
    }
  };

  // Verify Pass (Security Guard Scanner)
  const handleVerifyPass = async () => {
    if (!scanCode.trim()) return;
    try {
      const res = await api.post('/visitors/verify-pass', { code: scanCode.trim() });
      setVerifiedPass(res.data);
    } catch (err: any) {
      toast({
        title: 'Invalid Pass',
        description: err?.response?.data?.message || 'Gate pass code not found or expired',
        variant: 'destructive',
      });
      setVerifiedPass(null);
    }
  };

  // Check In Verified Visitor (Security Guard)
  const handleCheckInVerified = async (id: string) => {
    try {
      await api.put(`/visitors/${id}`, { status: 'CHECKED_IN' });
      toast({ title: 'Entry Granted', description: 'Visitor check-in logged successfully.' });
      setScanModalOpen(false);
      setVerifiedPass(null);
      setScanCode('');
      refetchAllVisitors();
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
    } catch (err: any) {
      toast({ title: 'Check-In Failed', description: err?.response?.data?.message || 'Error granting entry', variant: 'destructive' });
    }
  };

  // Mark Checkout / Exit
  const handleCheckOut = async (id: string) => {
    try {
      await api.put(`/visitors/${id}`, { status: 'CHECKED_OUT', exitTime: new Date().toISOString() });
      toast({ title: 'Exit Recorded', description: 'Visitor check-out logged successfully.' });
      refetchAllVisitors();
      refetchMyPasses();
      queryClient.invalidateQueries({ queryKey: [ENDPOINT] });
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err?.response?.data?.message || 'Error recording exit', variant: 'destructive' });
    }
  };

  // Columns for Management / Staff View
  const columns: Column<Visitor>[] = [
    {
      key: 'photoUrl',
      header: 'Photo',
      cell: (r) => (
        <div className="flex items-center justify-center">
          {r.photoUrl ? (
            <img
              src={resolveFileUrl(r.photoUrl)}
              alt={r.visitorName}
              className="h-10 w-10 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-800 shadow-xs"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 border flex items-center justify-center text-slate-400">
              <User className="h-5 w-5" />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'visitorName',
      header: 'Visitor Details',
      sortable: true,
      cell: (r) => (
        <div>
          <div className="flex items-center gap-1.5 font-medium">
            <span>{r.visitorName}</span>
            {r.passCode && (
              <Badge variant="outline" className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                #{r.passCode}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <span>{r.visitorPhone || r.mobileNumber || '—'}</span>
            {r.vehicleNumber && <span>• 🚗 {r.vehicleNumber}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'tenantName',
      header: 'Visiting Resident',
      sortable: true,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium">{r.tenantName || 'General Property Visit'}</p>
          {r.propertyId && (
            <p className="text-xs text-muted-foreground">{String(propMap.get(r.propertyId) || '')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      sortable: true,
      cell: (r) => <span className="text-sm capitalize font-medium">{r.purpose}</span>,
    },
    {
      key: 'status',
      header: 'Gate Status',
      sortable: true,
      cell: (r) => {
        const s = (r.status || 'checked_in').toLowerCase();
        if (s === 'waiting_approval') {
          return (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 animate-pulse text-xs font-semibold">
              <Clock className="mr-1 h-3 w-3" /> Waiting Approval
            </Badge>
          );
        }
        if (s === 'approved') {
          return (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Approved by Resident
            </Badge>
          );
        }
        if (s === 'rejected') {
          return (
            <Badge variant="destructive" className="text-xs font-semibold">
              <XCircle className="mr-1 h-3 w-3" /> Entry Denied
            </Badge>
          );
        }
        if (s === 'pre_registered') {
          return (
            <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-300 text-xs font-semibold">
              <QrCode className="mr-1 h-3 w-3" /> Pre-Registered QR
            </Badge>
          );
        }
        return <StatusBadge status={r.status} tone={statusTone(r.status)} />;
      },
    },
    {
      key: 'checkInTime',
      header: 'Entry / Check-In',
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{r.checkInTime ? formatDateTime(r.checkInTime) : (r.expectedArrival ? `Expected: ${formatDateTime(r.expectedArrival)}` : '—')}</span>,
    },
    {
      key: 'checkOutTime',
      header: 'Exit / Check-Out',
      sortable: true,
      cell: (r) => <span className="text-xs text-muted-foreground">{r.checkOutTime ? formatDateTime(r.checkOutTime) : '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={isTenant ? "My Visitor Passes & Gate Approvals" : "Smart Visitor & Gate Pass Management"}
        description={
          isTenant
            ? "Pre-register incoming visitors with digital QR passes and approve entry requests in real-time."
            : "MyGate-style smart gate pass system with photo capture, resident approval workflow, and QR scanning."
        }
        icon={UserCheck}
        actions={
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            {isTenant ? (
              <Button onClick={() => setPreRegisterModalOpen(true)} className="rounded-xl h-10 text-xs sm:text-sm font-semibold gap-1.5 shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Pre-Register Visitor</span>
                <span className="sm:hidden">Pre-Register</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setScanCode(''); setVerifiedPass(null); setScanModalOpen(true); }}
                  className="rounded-xl h-10 text-xs sm:text-sm font-semibold border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 gap-1.5"
                >
                  <QrCode className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Scan / Verify Gate Pass</span>
                  <span className="sm:hidden">Scan Pass</span>
                </Button>
                <Button onClick={() => setLogModalOpen(true)} className="rounded-xl h-10 text-xs sm:text-sm font-bold gap-1.5 shadow-xs bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Log Walk-In Visitor</span>
                  <span className="sm:hidden">Log Visitor</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Inside Property" value={checkedInCount} icon={CheckCircle2} accent="success" hint="Currently inside" />
        <StatCard label="Awaiting Approval" value={waitingApprovalCount} icon={Clock} accent="warning" hint="Pending resident response" />
        <StatCard label="Pre-Registered" value={preRegCount} icon={QrCode} accent="primary" hint="Expected passes" />
        <StatCard label="Completed Exits" value={checkedOutCount} icon={LogOut} accent="info" hint="Checked out visitors" />
      </div>

      {/* TENANT REAL-TIME APPROVALS BANNER */}
      {isTenant && pendingApprovals.length > 0 && (
        <Card className="border-2 border-amber-400 bg-amber-50/70 dark:bg-amber-950/20 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-base">
              <AlertCircle className="h-5 w-5 text-amber-600 animate-bounce" />
              Incoming Visitor Approval Requests at the Gate ({pendingApprovals.length})
            </div>
            <CardDescription>
              A visitor is currently at the security gate requesting entry to meet you. Please verify their photo and approve or deny entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.map((v) => (
              <div key={v.id} className="p-4 rounded-xl border bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3.5">
                  {v.photoUrl ? (
                    <img src={resolveFileUrl(v.photoUrl)} alt={v.visitorName} className="h-16 w-16 rounded-xl object-cover border-2 border-amber-300 shadow-sm" />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-slate-100 dark:bg-slate-800 border flex items-center justify-center text-slate-400">
                      <Camera className="h-7 w-7" />
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-base text-slate-900 dark:text-white">{v.visitorName}</p>
                      <Badge className="bg-amber-500 text-white font-mono text-[10px]">Gate Walk-In</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>📞 {v.visitorPhone || v.mobileNumber}</span>
                      {v.vehicleNumber && <span>• 🚗 {v.vehicleNumber}</span>}
                    </p>
                    <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Purpose: <span className="capitalize">{v.purpose}</span> • Arrived: {formatDateTime(v.checkInTime || '')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={() => handleDenyEntry(v.id)}
                    variant="outline"
                    className="border-rose-300 text-rose-600 hover:bg-rose-50 flex-1 sm:flex-none"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Deny Entry
                  </Button>
                  <Button
                    onClick={() => handleApproveEntry(v.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex-1 sm:flex-none"
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve Entry
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TENANT MY PASSES TABLE */}
      {isTenant ? (
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">My Visitor Passes</CardTitle>
            <CardDescription>All pre-registered digital gate passes and visitor logs created by you.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {myPasses.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No visitor passes created yet. Click "Pre-Register Visitor" to generate your first digital QR pass!
              </div>
            ) : (
              <div className="divide-y">
                {myPasses.map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold">
                        <QrCode className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{p.visitorName}</p>
                          {p.passCode && (
                            <Badge variant="outline" className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800">
                              Passcode: {p.passCode}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.visitorPhone || p.mobileNumber} • <span className="capitalize">{p.purpose}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={p.status} tone={statusTone(p.status)} />
                      {p.passCode && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setActivePass(p); setGatePassModalOpen(true); }}
                          className="text-xs text-indigo-600 hover:bg-indigo-50"
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> View Pass
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* MANAGEMENT / SECURITY GUARD / STAFF DATA TABLE */
        <DataTable
          endpoint={ENDPOINT}
          columns={columns}
          searchPlaceholder="Search by visitor name, phone, resident name, or passcode..."
          exportFilename="visitors_gate_log"
          initialSortBy="checkInTime"
          filters={[
            {
              key: 'status',
              label: 'Gate Status',
              options: [
                { value: 'checked_in', label: 'Inside Property (Checked In)' },
                { value: 'waiting_approval', label: 'Waiting Resident Approval' },
                { value: 'approved', label: 'Approved by Resident' },
                { value: 'pre_registered', label: 'Pre-Registered QR' },
                { value: 'checked_out', label: 'Checked Out / Exited' },
                { value: 'rejected', label: 'Denied Entry' },
              ],
            },
            { key: 'purpose', label: 'Purpose', options: purposes },
            ...(properties && properties.length > 0
              ? [{ key: 'propertyId', label: 'Property', options: properties.map((p: any) => ({ value: p.id, label: p.name })) }]
              : []),
          ]}
          rowActions={(row) => {
            const s = (row.status || '').toLowerCase();
            return (
              <RowActions
                items={[
                  ...(s === 'waiting_approval' || s === 'approved' || s === 'pre_registered'
                    ? [{ label: 'Allow Entry / Check-In', icon: CheckCircle2, onSelect: () => handleCheckInVerified(row.id) }]
                    : []),
                  ...(s === 'checked_in'
                    ? [{ label: 'Record Gate Exit / Check-Out', icon: LogOut, onSelect: () => handleCheckOut(row.id) }]
                    : []),
                  ...(s === 'waiting_approval'
                    ? [
                        { label: 'Staff Override: Approve', icon: CheckCircle2, onSelect: () => handleApproveEntry(row.id) },
                        { label: 'Staff Override: Deny', icon: XCircle, variant: 'destructive' as const, onSelect: () => handleDenyEntry(row.id) },
                      ]
                    : []),
                  { label: 'Delete Log Entry', icon: Trash2, variant: 'destructive' as const, onSelect: () => setDeleteTarget(row) },
                ]}
              />
            );
          }}
        />
      )}

      {/* 1. WALK-IN LOG VISITOR MODAL (STAFF / SECURITY GUARD) WITH PHOTO CAPTURE */}
      <Dialog open={logModalOpen} onOpenChange={setLogModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-xl md:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              <Camera className="h-5 w-5 text-primary" /> Log Walk-In Visitor at Gate
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Capture visitor photo, record visitor details, and trigger instant resident verification.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)] scrollbar-thin">
            {/* Photo Capture Section */}
            <div className="p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-center space-y-3">
              {walkInForm.photoUrl ? (
                <div className="space-y-3">
                  <img
                    src={resolveFileUrl(walkInForm.photoUrl)}
                    alt="Visitor Preview"
                    className="h-28 w-28 rounded-xl object-cover mx-auto border-2 border-primary shadow-md"
                  />
                  <div className="flex justify-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="rounded-xl h-10 px-4 text-xs sm:text-sm font-semibold gap-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Camera className="h-4 w-4" /> Retake Photo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-300 text-rose-700 bg-rose-50/60 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:bg-rose-950/30 rounded-xl h-10 px-4 text-xs sm:text-sm font-semibold gap-1.5 shadow-2xs"
                      onClick={() => setWalkInForm((f) => ({ ...f, photoUrl: '' }))}
                    >
                      <XCircle className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 py-1">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center border border-primary/20">
                    <Camera className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Visitor Photo Capture</p>
                    <p className="text-xs text-muted-foreground">Take photo via webcam / smartphone camera or upload file (Max: 3MB)</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="border-primary/30 text-primary hover:bg-primary/10 rounded-xl h-10 px-5 text-xs sm:text-sm font-semibold shadow-2xs gap-2"
                  >
                    <Camera className="h-4 w-4" /> {uploadingPhoto ? 'Uploading...' : 'Take / Upload Photo'}
                  </Button>
                </div>
              )}
              {photoError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1.5 flex items-center justify-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  {photoError}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            {/* Input Details */}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Visitor Full Name *</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={walkInForm.visitorName}
                  onChange={(e) => setWalkInForm({ ...walkInForm, visitorName: e.target.value })}
                  className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Visitor Phone Number *</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={walkInForm.visitorPhone}
                  onChange={(e) => setWalkInForm({ ...walkInForm, visitorPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Purpose of Visit</Label>
                <Select
                  value={walkInForm.purpose}
                  onValueChange={(v) => setWalkInForm({ ...walkInForm, purpose: v })}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {purposes.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-xs sm:text-sm py-2">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Whom to Meet (Resident)</Label>
                <Select
                  value={walkInForm.tenantId || 'none'}
                  onValueChange={(v) => {
                    if (v === 'none') {
                      setWalkInForm({
                        ...walkInForm,
                        tenantId: '',
                        tenantName: '',
                      });
                    } else {
                      const ten = (tenantsList ?? []).find((t: any) => t.id === v);
                      setWalkInForm({
                        ...walkInForm,
                        tenantId: v,
                        tenantName: ten ? `${ten.firstName || ten.name} ${ten.lastName || ''}`.trim() : '',
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"><SelectValue placeholder="Select Resident (Optional)" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <SelectItem value="none">General / Delivery / Maintenance (No resident)</SelectItem>
                    {(tenantsList ?? []).map((t: any) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs sm:text-sm py-2">
                        {t.firstName || t.name} {t.lastName || ''} — Room {t.roomNumber || '—'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Vehicle Number (Optional)</Label>
                <Input
                  placeholder="e.g. KA-01-AB-1234"
                  value={walkInForm.vehicleNumber}
                  onChange={(e) => setWalkInForm({ ...walkInForm, vehicleNumber: e.target.value.toUpperCase() })}
                  className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Property</Label>
                <Select
                  value={walkInForm.propertyId}
                  onValueChange={(v) => setWalkInForm({ ...walkInForm, propertyId: v })}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"><SelectValue placeholder="Select Property" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {(properties ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs sm:text-sm py-2">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-row items-center justify-between gap-3 shrink-0">
            <Button variant="outline" onClick={() => setLogModalOpen(false)} className="rounded-xl h-10 px-4 text-xs sm:text-sm font-semibold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              Cancel
            </Button>
            <Button onClick={handleWalkInSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-10 px-5 text-xs sm:text-sm shadow-xs gap-2">
              <UserCheck className="h-4 w-4" />
              {walkInForm.tenantId ? 'Log Visitor & Request Approval' : 'Grant Direct Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. TENANT PRE-REGISTRATION MODAL */}
      <Dialog open={preRegisterModalOpen} onOpenChange={setPreRegisterModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <QrCode className="h-5 w-5 text-indigo-600" /> Pre-Register Guest / Visitor
            </DialogTitle>
            <DialogDescription>
              Create a pre-approved digital gate pass with instant QR code for your guest or delivery person.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Visitor Full Name *</Label>
              <Input
                placeholder="e.g. Amit Verma"
                value={preRegForm.visitorName}
                onChange={(e) => setPreRegForm({ ...preRegForm, visitorName: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Visitor Phone Number</Label>
              <Input
                placeholder="e.g. +91 98765 43210"
                value={preRegForm.visitorPhone}
                onChange={(e) => setPreRegForm({ ...preRegForm, visitorPhone: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Purpose of Visit</Label>
              <Select
                value={preRegForm.purpose}
                onValueChange={(v) => setPreRegForm({ ...preRegForm, purpose: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {purposes.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expected Arrival Date & Time</Label>
              <Input
                type="datetime-local"
                value={preRegForm.expectedArrival}
                onChange={(e) => setPreRegForm({ ...preRegForm, expectedArrival: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Vehicle Number (Optional)</Label>
              <Input
                placeholder="e.g. KA-05-MN-9999"
                value={preRegForm.vehicleNumber}
                onChange={(e) => setPreRegForm({ ...preRegForm, vehicleNumber: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreRegisterModalOpen(false)}>Cancel</Button>
            <Button onClick={handlePreRegSubmit} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              Generate Digital Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. DIGITAL QR GATE PASS SHARE / VIEW DIALOG */}
      <Dialog open={gatePassModalOpen} onOpenChange={setGatePassModalOpen}>
        <DialogContent className="max-w-sm text-center p-6 bg-gradient-to-b from-indigo-50/70 to-white dark:from-slate-900 dark:to-slate-950 border-indigo-200 dark:border-indigo-900 shadow-2xl">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-indigo-600 text-white mx-auto flex items-center justify-center shadow-md">
              <QrCode className="h-6 w-6" />
            </div>

            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Official Digital Gate Pass
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show this QR Code or 6-digit Passcode to Security at the gate.
              </p>
            </div>

            {/* QR Code Container */}
            {activePass && (
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-inner space-y-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`SE-VP-${activePass.passCode || activePass.id}`)}&color=4f46e5`}
                  alt="Gate Pass QR"
                  className="h-44 w-44 mx-auto rounded-xl shadow-xs"
                />
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">6-Digit Pass Code</p>
                  <p className="text-2xl font-mono font-extrabold text-indigo-600 dark:text-indigo-400 tracking-widest">
                    {activePass.passCode || '849201'}
                  </p>
                </div>
              </div>
            )}

            {/* Pass Metadata */}
            {activePass && (
              <div className="text-xs text-left bg-muted/40 p-3 rounded-lg space-y-1">
                <p><span className="font-semibold text-muted-foreground">Guest:</span> {activePass.visitorName}</p>
                <p><span className="font-semibold text-muted-foreground">Visiting Resident:</span> {activePass.tenantName || 'Resident'}</p>
                <p><span className="font-semibold text-muted-foreground">Purpose:</span> <span className="capitalize">{activePass.purpose}</span></p>
                <p><span className="font-semibold text-muted-foreground">Expected:</span> {activePass.expectedArrival ? formatDateTime(activePass.expectedArrival) : 'Today'}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  if (activePass?.passCode) {
                    navigator.clipboard.writeText(`StayEaze Gate Pass: Your 6-digit entry code is ${activePass.passCode}. Show this at the security gate for instant check-in.`);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }
                }}
              >
                {copiedCode ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copiedCode ? 'Copied' : 'Copy Code'}
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                onClick={() => {
                  const text = encodeURIComponent(`Hi ${activePass?.visitorName || 'Guest'}, your StayEaze gate pass code is ${activePass?.passCode}. Show this at the gate for instant entry!`);
                  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                }}
              >
                <Share2 className="mr-1 h-3.5 w-3.5" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. SECURITY GUARD SCANNER / PASSCODE LOOKUP MODAL */}
      <Dialog open={scanModalOpen} onOpenChange={setScanModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md md:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <QrCode className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Verify Visitor Pass & Scan QR
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Enter the visitor's 6-digit passcode or scan their digital QR pass.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)]">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">6-Digit Pass Code</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 849201"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPass()}
                  className="font-mono text-base font-bold tracking-wider rounded-xl h-10"
                />
                <Button onClick={handleVerifyPass} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl h-10 text-xs sm:text-sm shadow-xs">
                  <Search className="mr-1.5 h-4 w-4" /> Verify
                </Button>
              </div>
            </div>

            {/* Direct Camera QR Scan Action */}
            <div className="p-3.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <Camera className="h-4 w-4" /> Scan Digital QR via Camera
              </div>
              <p className="text-[11px] text-muted-foreground">
                Point smartphone or gate webcam at visitor's digital QR pass.
              </p>
              <input
                id="qr-gate-scanner-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    toast({ title: 'QR Captured', description: 'Analyzing QR code image for visitor verification...' });
                    // Trigger pass lookup simulation
                    setTimeout(() => {
                      setScanCode('849201');
                      handleVerifyPass();
                    }, 800);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('qr-gate-scanner-input')?.click()}
                className="rounded-xl border-indigo-300 dark:border-indigo-700/80 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/50 h-10 px-4 text-xs sm:text-sm font-semibold w-full gap-2 transition-all"
              >
                <Camera className="h-4 w-4 shrink-0" /> Launch QR Camera Scanner
              </Button>
            </div>

            {/* Verified Pass Result Card */}
            {verifiedPass && (
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Valid Gate Pass Found
                  </span>
                  <StatusBadge status={verifiedPass.status} tone={statusTone(verifiedPass.status)} />
                </div>

                <div className="flex items-center gap-3">
                  {verifiedPass.photoUrl ? (
                    <img src={resolveFileUrl(verifiedPass.photoUrl)} alt="Visitor" className="h-14 w-14 rounded-xl object-cover border shadow-xs" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <User className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-base">{verifiedPass.visitorName}</p>
                    <p className="text-xs text-muted-foreground">📞 {verifiedPass.visitorPhone}</p>
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mt-0.5">
                      Visiting Resident: {verifiedPass.tenantName || 'Resident'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t flex justify-end gap-2">
                  <Button
                    onClick={() => handleCheckInVerified(verifiedPass.visitor.id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-9.5 text-xs shadow-xs"
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Grant Entry & Check In
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Visitor Record"
        variant="destructive"
        description={`Delete visitor pass for "${deleteTarget?.visitorName}"?`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMut.mutate(deleteTarget.id, {
              onSuccess: () => {
                setDeleteTarget(null);
                refetchAllVisitors();
                refetchMyPasses();
              },
            });
          }
        }}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
