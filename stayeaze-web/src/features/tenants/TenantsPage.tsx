import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Pencil, Trash2, Eye, Phone, Mail, LogOut, CreditCard, Zap, Wallet, Calendar, QrCode, KeyRound, ShieldCheck, CheckCircle2, Copy, Printer, ExternalLink, Check, Archive, RotateCcw, FileSpreadsheet, UserPlus, Sparkles } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { RoomSelect } from '@/components/common/RoomSelect';
import { BulkImportTenantsModal } from './BulkImportTenantsModal';
import { QuickAddTenantModal } from './QuickAddTenantModal';
import { Tenant360Drawer } from './Tenant360Drawer';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import type { Tenant, Property, Room, Bed } from '@/lib/types';
import { formatCurrency, formatDate, initials, formatRoomName } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

import { validateEmail, validatePhone, validatePan, validateAadhaar, validateRequired, validateIdNumber } from '@/lib/validation';

const ENDPOINT = '/tenants';
const genders = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }];
const statuses = [
  { value: 'active', label: 'Checked In (Active)' },
  { value: 'pending_checkin', label: 'Pending Check-in' },
  { value: 'notice_period', label: 'Notice Period' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'archived', label: 'Archived' },
];
const idTypes = [
  { value: 'aadhaar', label: 'Aadhaar' }, { value: 'pan', label: 'PAN' },
  { value: 'passport', label: 'Passport' }, { value: 'driving_license', label: 'Driving License' },
];

const emptyForm = {
  name: '', email: '', phone: '', gender: 'male' as Tenant['gender'], dob: '',
  occupation: '', idType: 'aadhaar' as Tenant['idType'], idNumber: '',
  emergencyName: '', emergencyContact: '',
  propertyId: '', roomId: '', roomNumber: '', bedNumber: '',
  rent: 8000, deposit: 16000,
  leaseStart: new Date().toISOString().slice(0, 10),
  leaseEnd: '',
  status: 'active' as Tenant['status'],
};

export default function TenantsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Tenant | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Tenant | null>(null);
  const [isDeletingPermanent, setIsDeletingPermanent] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [drawerTenantId, setDrawerTenantId] = useState<string | null>(null);

  // Fetch properties for dropdown
  const { data: properties } = useQuery({
    queryKey: ['tenants-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
    staleTime: 300000,
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

  // Fetch all rooms — filtered in-memory by selected property
  const { data: allRooms } = useQuery({
    queryKey: ['tenants-rooms'],
    queryFn: () => api.get<Room[]>('/rooms', { params: { pageSize: 500 } }).then((r) => {
      // DataTable wraps in { data: [] }, but flat /rooms returns an array directly
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    enabled: dialogOpen,
    staleTime: 300000,
  });

  const form = useForm(emptyForm);
  const [selectedBldId, setSelectedBldId] = useState<string>('');

  const { data: buildings } = useQuery({
    queryKey: ['tenants-buildings', form.values.propertyId],
    queryFn: () => api.get<any[]>('/buildings', { params: { propertyId: form.values.propertyId || undefined, pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] })?.data ?? [];
    }),
    enabled: dialogOpen,
  });

  const roomOptions = useMemo(() => {
    return (allRooms ?? []).filter((r: any) => {
      if (r.status === 'archived' || r.status === 'maintenance' || r.status === 'blocked') return false;
      if (form.values.propertyId && r.propertyId && r.propertyId !== form.values.propertyId) return false;
      if (selectedBldId && r.buildingId && r.buildingId !== selectedBldId) return false;
      return true;
    });
  }, [allRooms, form.values.propertyId, selectedBldId]);

  // Fetch beds for the selected room
  const { data: bedsForRoom } = useQuery({
    queryKey: ['tenants-beds', selectedRoomId],
    queryFn: () => api.get<Bed[]>(`/rooms/${selectedRoomId}/beds`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Bed[];
      return (payload as { data: Bed[] }).data ?? [];
    }),
    enabled: !!selectedRoomId,
    staleTime: 0,
  });

  // Fetch all tenants to check which beds are already taken
  const { data: existingTenants } = useQuery({
    queryKey: ['tenants-minimal'],
    queryFn: () => api.get<any[]>('/tenants/minimal').then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as any[];
      return (payload as { data: any[] }).data ?? [];
    }),
    enabled: dialogOpen,
  });

  const { data: defaultDepData } = useQuery({
    queryKey: ['org-billing-profile-deposit-tenants'],
    queryFn: () => api.get<any>('/organization-billing-profile/default-deposit').then((r) => r.data),
  });

  const createMut = useCreate<Tenant>(ENDPOINT, 'Tenant');
  const updateMut = useUpdate<Tenant>(ENDPOINT, 'Tenant');
  const deleteMut = useDelete(ENDPOINT, 'Tenant');

  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cash' | 'later'>('cash');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrPropertyId, setQrPropertyId] = useState('');

  // Auto-select first property for QR when properties load
  const firstPropId = (properties ?? [])[0]?.id || '';
  const effectiveQrPropId = qrPropertyId || firstPropId;
  const qrPropertyName = propMap.get(effectiveQrPropId) || 'Select Property';

  const onboardUrl = effectiveQrPropId
    ? `${window.location.origin}/onboard?p=${effectiveQrPropId}`
    : `${window.location.origin}/onboard`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(onboardUrl)}&color=4f46e5&bgcolor=ffffff`;

  function openCreate() {
    queryClient.invalidateQueries({ queryKey: ['tenants-rooms'] });
    queryClient.invalidateQueries({ queryKey: ['tenants-beds'] });
    setEditing(null);
    setPaymentMethod('cash');
    const defaultDep = Number(defaultDepData?.defaultSecurityDeposit || 0);
    form.reset({ ...emptyForm, deposit: defaultDep });
    setSelectedRoomId('');
    setDialogOpen(true);
  }

  async function openEdit(row: Tenant) {
    setEditing(row);
    let fullTenant = row;
    try {
      const res = await api.get<Tenant>(`/tenants/${row.id}`);
      if (res.data) fullTenant = res.data;
    } catch (err) {
      console.warn('Could not fetch full tenant details for editing:', err);
    }

    const idNum = fullTenant.idNumber || fullTenant.idProofNumber || (fullTenant as any).identityNumber || '';
    const emName = fullTenant.emergencyName || fullTenant.emergencyContactName || (fullTenant as any).emergencyContactPerson || '';
    const emContact = fullTenant.emergencyContact || fullTenant.emergencyContactMobile || (fullTenant as any).emergencyPhone || '';

    const toDateInput = (val?: string | null) => {
      if (!val) return '';
      const s = String(val).trim();
      if (s.includes('T')) return s.split('T')[0];
      if (s.length >= 10 && s.includes('-')) return s.slice(0, 10);
      return s;
    };

    form.reset({
      name: fullTenant.name || (fullTenant.firstName ? `${fullTenant.firstName} ${fullTenant.lastName}`.trim() : ''),
      email: fullTenant.email ?? '',
      phone: fullTenant.phone ?? fullTenant.mobile ?? '',
      gender: fullTenant.gender ?? 'male',
      dob: toDateInput(fullTenant.dob),
      occupation: fullTenant.occupation ?? '',
      idType: fullTenant.idType ?? (fullTenant as any).idProofType ?? 'aadhaar',
      idNumber: idNum,
      emergencyName: emName,
      emergencyContact: emContact,
      propertyId: String(fullTenant.propertyId ?? ''),
      roomId: '',
      roomNumber: fullTenant.roomNumber ?? '',
      bedNumber: fullTenant.bedNumber ?? '',
      rent: Number(fullTenant.rent ?? 0),
      deposit: Number(fullTenant.deposit ?? 0),
      leaseStart: toDateInput(fullTenant.leaseStart),
      leaseEnd: toDateInput(fullTenant.leaseEnd),
      status: fullTenant.status,
    });
    setSelectedRoomId('');
    setDialogOpen(true);
  }

  function onRoomChange(roomId: string) {
    setSelectedRoomId(roomId);
    form.setValue('roomId', roomId);
    if (roomId) {
      queryClient.invalidateQueries({ queryKey: ['tenants-beds', roomId] });
    }
    const room = (allRooms ?? []).find((r) => r.id === roomId || r.roomNumber === roomId || r.number === roomId);
    if (room) {
      const roomNum = room.roomNumber || room.number || roomId;
      form.setValue('roomNumber', roomNum);
      const storedRent = Number(room.rent ?? (room as any).baseRent ?? 0);
      if (storedRent > 0) {
        form.setValue('rent', storedRent);
      }
    }
    form.setValue('bedNumber', ''); // reset bed when room changes
  }

  function submit() {
    if (!form.validate({
      name: (v) => validateRequired(v, 'Full Name'),
      phone: (v) => validatePhone(String(v || ''), true),
      email: (v) => validateEmail(String(v || ''), false),
      emergencyContact: (v) => validatePhone(String(v || ''), false),
      idNumber: (v) => validateIdNumber(form.values.idType, String(v || ''), false),
      propertyId: (v) => !v ? 'Select a property' : undefined,
    })) return;

    const nameParts = String(form.values.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '.';

    const payload = {
      firstName,
      lastName,
      email: form.values.email,
      mobile: form.values.phone,
      phone: form.values.phone,
      gender: form.values.gender,
      dob: form.values.dob || undefined,
      occupation: form.values.occupation || undefined,
      idType: form.values.idType,
      idNumber: form.values.idNumber || undefined,
      emergencyContactName: form.values.emergencyName || undefined,
      emergencyName: form.values.emergencyName || undefined,
      emergencyContactMobile: form.values.emergencyContact || undefined,
      emergencyContact: form.values.emergencyContact || undefined,
      propertyId: form.values.propertyId || undefined,
      roomNumber: form.values.roomNumber || undefined,
      bedNumber: form.values.bedNumber || undefined,
      rent: form.values.rent,
      deposit: form.values.deposit,
      leaseStart: form.values.leaseStart || undefined,
      leaseEnd: form.values.leaseEnd || undefined,
      status: form.values.status,
    };

    const totalDue = Number(form.values.rent || 0) + Number(form.values.deposit || 0);

    if (!editing && paymentMethod === 'razorpay' && totalDue > 0) {
      setProcessingPayment(true);
      api.post('/tenants/onboarding-order', {
        propertyId: form.values.propertyId,
        rent: form.values.rent,
        deposit: form.values.deposit,
        tenantName: `${firstName} ${lastName}`,
        tenantEmail: form.values.email,
        tenantPhone: form.values.phone,
      }).then((res) => {
        const orderData = res.data;
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'StayEaze Onboarding Payment',
          description: `Rent + Deposit for ${firstName} ${lastName}`,
          order_id: orderData.orderId,
          handler: function (response: any) {
            setProcessingPayment(false);
            const rzpPayload = {
              ...payload,
              paymentMethod: 'RAZORPAY',
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              status: 'active' as any,
            };
            createMut.mutate(rzpPayload as any, {
              onSuccess: () => {
                queryClient.invalidateQueries();
                toast({ title: 'Tenant Onboarded & Paid', description: `Razorpay payment ${response.razorpay_payment_id} recorded successfully.` });
                setDialogOpen(false);
              },
            });
          },
          modal: {
            ondismiss: function () {
              setProcessingPayment(false);
              toast({ title: 'Payment Dismissed', description: 'Razorpay checkout was closed without completing payment.', variant: 'destructive' });
            },
          },
          prefill: {
            name: `${firstName} ${lastName}`,
            email: form.values.email || '',
            contact: form.values.phone || '',
          },
          theme: { color: '#4f46e5' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }).catch((err) => {
        setProcessingPayment(false);
        const errMsg = err?.response?.data?.message || err?.message || 'Failed to initialize Razorpay checkout.';
        toast({ title: 'Payment Setup Error', description: errMsg, variant: 'destructive' });
      });
      return;
    }

    const finalPayload = {
      ...payload,
      paymentMethod: paymentMethod === 'cash' ? 'CASH' : 'LATER',
      status: (paymentMethod === 'cash' ? 'active' : 'pending_checkin') as any,
    };

    if (editing) updateMut.mutate({ id: editing.id, payload: payload as any }, { onSuccess: () => { queryClient.invalidateQueries(); setDialogOpen(false); } });
    else createMut.mutate(finalPayload as any, { onSuccess: () => { queryClient.invalidateQueries(); setDialogOpen(false); } });
  }

  const archiveMut = useDelete(ENDPOINT, 'Tenant');

  async function confirmArchive() {
    if (!archiveTarget) return;
    archiveMut.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast({ title: 'Tenant Archived', description: `Tenant "${archiveTarget.name}" archived successfully and bed freed.` });
        queryClient.invalidateQueries();
        setArchiveTarget(null);
      },
    });
  }

  async function confirmPermanentDelete() {
    if (!permanentDeleteTarget) return;
    setIsDeletingPermanent(true);
    try {
      await api.delete(`/tenants/${permanentDeleteTarget.id}/permanent`);
      toast({ title: 'Tenant Permanently Deleted', description: `Tenant "${permanentDeleteTarget.name}" and all historical records removed.` });
      queryClient.invalidateQueries();
      setPermanentDeleteTarget(null);
    } catch (err: any) {
      toast({
        title: 'Delete Failed',
        description: err?.response?.data?.message || 'Failed to permanently delete tenant.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingPermanent(false);
    }
  }

  async function handleUnarchive(row: Tenant) {
    try {
      await api.put(`/tenants/${row.id}/unarchive`);
      toast({ title: 'Tenant Restored', description: `Tenant "${row.name}" unarchived successfully and marked Active.` });
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast({
        title: 'Action Failed',
        description: err?.response?.data?.message || 'Failed to unarchive tenant.',
        variant: 'destructive',
      });
    }
  }

  const columns: Column<Tenant>[] = [
    { key: 'name', header: 'Tenant', sortable: true, cell: (r) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(r.name)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.occupation}</p>
        </div>
      </div>
    )},
    { key: 'contact' as keyof Tenant, header: 'Contact', cell: (r) => (
      <div>
        <p className="text-sm"><Phone className="mr-1 inline h-3 w-3 text-muted-foreground" />{r.phone}</p>
        <p className="text-xs text-muted-foreground"><Mail className="mr-1 inline h-3 w-3" />{r.email}</p>
      </div>
    )},
    { key: 'propertyId', header: 'Property', sortable: true, cell: (r) =>
      <span className="text-sm">{String(propMap.get(String(r.propertyId)) ?? '—')}</span>
    },
    { key: 'roomNumber', header: 'Room / Bed', sortable: true, cell: (r) => (
      <span className="text-sm">
        {formatRoomName(r.roomNumber)}
        {r.bedNumber ? ` · ${r.bedNumber}` : ''}
      </span>
    )},
    { key: 'rent', header: 'Rent', sortable: true, cell: (r) =>
      <span className="font-medium tabular-nums">{formatCurrency(Number(r.rent ?? 0))}</span>
    },
    { key: 'leaseEnd', header: 'Lease Ends', sortable: true, cell: (r) =>
      <span className="text-sm">{r.leaseEnd ? formatDate(r.leaseEnd) : <span className="text-muted-foreground">—</span>}</span>
    },
    { key: 'kycStatus' as keyof Tenant, header: 'KYC & Agreement', sortable: true, cell: (r) => {
      const kyc = (r.kycStatus || 'PENDING').toUpperCase();
      const tone = kyc === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : kyc === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
      const isSigned = Boolean(r.isAgreementAccepted);
      return (
        <div className="space-y-1">
          <Badge className={`text-[10px] font-semibold ${tone}`}>KYC: {kyc}</Badge>
          {isSigned ? (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Agreement Signed
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">
              Agreement: Pending
            </div>
          )}
        </div>
      );
    }},
    { key: 'status', header: 'Status', sortable: true, cell: (r) =>
      <StatusBadge status={r.status} tone={statusTone(r.status)} />
    },
  ];

  const propertyFilterOptions = (properties ?? []).map((p: any) => ({ value: p.id, label: p.name }));

  async function handleSendCredentials(row: Tenant) {
    try {
      const res = await api.post(`/tenants/${row.id}/send-credentials`);
      toast({
        title: 'Welcome Credentials Dispatched',
        description: res.data.message || `Credentials sent to ${row.email} via Email & SMS.`,
      });
    } catch (err: any) {
      toast({
        title: 'Dispatch Error',
        description: err.response?.data?.message || 'Failed to dispatch credentials.',
        variant: 'destructive',
      });
    }
  }

  async function handleVerifyDocument(row: Tenant, status: 'VERIFIED' | 'REJECTED') {
    try {
      await api.post(`/tenants/${row.id}/verify-document`, { status });
      queryClient.invalidateQueries();
      toast({
        title: 'KYC Document Updated',
        description: `Tenant KYC status updated to ${status}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Update Error',
        description: err.response?.data?.message || 'Failed to update KYC status.',
        variant: 'destructive',
      });
    }
  }

  async function handleApproveDeskPayment(row: Tenant) {
    try {
      const res = await api.post(`/tenants/${row.id}/approve-desk-payment`);
      queryClient.invalidateQueries();
      toast({
        title: 'Desk Payment Approved',
        description: res.data.message || 'Payment marked as received and tenant is now Active.',
      });
    } catch (err: any) {
      toast({
        title: 'Approval Error',
        description: err.response?.data?.message || 'Failed to approve desk payment.',
        variant: 'destructive',
      });
    }
  }

  function handlePrintQRCode() {
    const printWindow = window.open('', '_blank', 'width=550,height=700');
    if (!printWindow) {
      toast({ title: 'Print Error', description: 'Please allow popups to print the QR poster.', variant: 'destructive' });
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reception Express QR Onboarding - StayEaze</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 40px 20px;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
            background: #ffffff;
            color: #0f172a;
          }
          .icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #eef2ff;
            color: #4f46e5;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px auto;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
            color: #1e1b4b;
          }
          .subtitle {
            font-size: 13px;
            color: #64748b;
            margin-bottom: 28px;
            max-width: 380px;
          }
          .qr-box {
            background: #ffffff;
            border: 4px solid #818cf8;
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 12px 35px rgba(79, 70, 229, 0.15);
            display: inline-block;
            margin-bottom: 28px;
          }
          .qr-img {
            width: 260px;
            height: 260px;
            display: block;
            margin: 0 auto;
          }
          .scan-label {
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 2px;
            color: #4338ca;
            margin-top: 14px;
            text-transform: uppercase;
          }
          .link-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px 20px;
            max-width: 400px;
            width: 100%;
          }
          .link-title {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .link-url {
            font-family: monospace;
            font-size: 14px;
            font-weight: 700;
            color: #4f46e5;
            word-break: break-all;
          }
          @media print {
            body { padding: 20px; min-height: auto; }
          }
        </style>
      </head>
      <body>
        <div class="icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        </div>
        <div class="title">Reception Express QR Onboarding</div>
        <div class="subtitle">Display or print this QR Standee poster at reception for instant smartphone guest check-in.</div>
        <div class="qr-box">
          <img class="qr-img" src="${qrCodeImageUrl}" alt="Reception QR Code" />
          <div class="scan-label">Scan to Onboard & Pay</div>
        </div>
        <div class="link-box">
          <div class="link-title">Onboarding Link</div>
          <div class="link-url">${onboardUrl}</div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Manage tenant records and lease information." icon={Users}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setBulkImportOpen(true)} className="gap-1.5 border-emerald-600/30 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Import Excel / CSV
            </Button>
            <Button variant="outline" onClick={() => setQrModalOpen(true)} className="gap-1.5">
              <QrCode className="h-4 w-4 text-indigo-600" /> Reception QR
            </Button>
            <Button variant="secondary" onClick={() => setQuickAddOpen(true)} className="gap-1.5 font-semibold">
              <UserPlus className="h-4 w-4 text-primary" /> Quick Add
            </Button>
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Full Form
            </Button>
          </div>
        }
      />
      <DataTable endpoint={ENDPOINT} columns={columns} searchPlaceholder="Search by name, email or room..." exportFilename="tenants" initialSortBy="name"
        emptyAction={{ label: 'Quick Add Resident', onClick: () => setQuickAddOpen(true), icon: UserPlus }}
        emptyDescription="No residents found. Onboard your first resident via quick add or display the Reception QR poster."
        filters={[
          { key: 'status', label: 'Status', options: statuses },
          { key: 'kycStatus', label: 'KYC Status', options: [
            { value: 'PENDING', label: 'Pending KYC' },
            { value: 'VERIFIED', label: 'Verified KYC' },
            { value: 'REJECTED', label: 'Rejected KYC' },
          ]},
          { key: 'gender', label: 'Gender', options: genders },
          ...(propertyFilterOptions.length > 0 ? [{ key: 'propertyId', label: 'Property', options: propertyFilterOptions }] : []),
        ]}
        onRowClick={(row) => setDrawerTenantId(row.id)}
        rowActions={(row) => {
          const isArchived = row.status?.toLowerCase() === 'archived';
          const isPendingCheckin = row.status?.toLowerCase() === 'pending_checkin';
          const isKycPending = (row.kycStatus || 'PENDING').toUpperCase() !== 'VERIFIED';
          const canCheckout = !isArchived && row.status?.toLowerCase() !== 'checked_out';

          return (
            <RowActions
              className="w-64"
              items={[
                // 1. Primary Actions
                { label: 'Quick 360 View', icon: Sparkles, onSelect: () => setDrawerTenantId(row.id) },
                { label: 'View Profile', icon: Eye, onSelect: () => navigate(`/tenants/${row.id}`) },
                { label: 'Edit Details', icon: Pencil, onSelect: () => openEdit(row) },

                // 2. Contextual Check-in & KYC
                ...(isPendingCheckin ? [{
                  label: 'Approve Desk Payment',
                  icon: CheckCircle2,
                  variant: 'success' as const,
                  badge: 'Pending',
                  separatorBefore: true,
                  sectionHeader: 'Desk Operations',
                  onSelect: () => handleApproveDeskPayment(row),
                }] : []),

                ...(isKycPending ? [{
                  label: 'Approve KYC Document',
                  icon: ShieldCheck,
                  variant: 'indigo' as const,
                  badge: 'Verify',
                  separatorBefore: !isPendingCheckin,
                  sectionHeader: !isPendingCheckin ? 'Compliance' : undefined,
                  onSelect: () => handleVerifyDocument(row, 'VERIFIED'),
                }] : []),

                // 3. Resident Operations
                {
                  label: 'Send Credentials',
                  icon: KeyRound,
                  separatorBefore: !isPendingCheckin && !isKycPending,
                  sectionHeader: !isPendingCheckin && !isKycPending ? 'Operations' : undefined,
                  onSelect: () => handleSendCredentials(row),
                },

                ...(canCheckout ? [{
                  label: 'Initiate Check-out',
                  icon: LogOut,
                  onSelect: () => navigate('/check-outs'),
                }] : []),

                // 4. Record Lifecycle & Deletion
                ...(isArchived ? [{
                  label: 'Unarchive Tenant',
                  icon: RotateCcw,
                  variant: 'indigo' as const,
                  separatorBefore: true,
                  sectionHeader: 'Record Status',
                  description: 'Restore resident to Active',
                  onSelect: () => handleUnarchive(row),
                }] : [{
                  label: 'Archive Tenant',
                  icon: Archive,
                  separatorBefore: true,
                  sectionHeader: 'Danger Zone',
                  description: 'Frees bed, preserves invoices',
                  onSelect: () => setArchiveTarget(row),
                }]),

                {
                  label: 'Permanent Delete',
                  icon: Trash2,
                  variant: 'destructive' as const,
                  badge: 'Erase',
                  description: 'Irreversibly deletes all history',
                  onSelect: () => setPermanentDeleteTarget(row),
                },
              ]}
            />
          );
        }} />

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen}
        title={editing ? 'Edit Tenant' : 'Add New Tenant'}
        description="Personal, contact and lease details."
        onSubmit={submit}
        loading={createMut.isPending || updateMut.isPending || processingPayment}
        submitLabel={editing ? 'Save Changes' : (processingPayment ? 'Opening Razorpay...' : 'Create Tenant')}
        size="xl">
        <div className="space-y-4">

          {/* Personal Details */}
          <section className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personal Details</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormInput label="Full Name" required id="name" value={form.values.name}
                error={form.errors.name}
                onChange={(e) => {
                  form.setValue('name', e.target.value);
                  if (form.errors.name) form.handleBlur('name', (v) => validateRequired(v, 'Full Name'));
                }}
                onBlur={() => form.handleBlur('name', (v) => validateRequired(v, 'Full Name'))} />
              <FormInput label="Email" type="email" id="email" value={form.values.email}
                error={form.errors.email}
                onChange={(e) => {
                  form.setValue('email', e.target.value);
                  if (form.errors.email) form.handleBlur('email', (v) => validateEmail(String(v || ''), false));
                }}
                onBlur={() => form.handleBlur('email', (v) => validateEmail(String(v || ''), false))} />
              <FormInput label="Phone" required id="phone" value={form.values.phone}
                error={form.errors.phone}
                onChange={(e) => {
                  form.setValue('phone', e.target.value);
                  if (form.errors.phone) form.handleBlur('phone', (v) => validatePhone(String(v || ''), true));
                }}
                onBlur={() => form.handleBlur('phone', (v) => validatePhone(String(v || ''), true))} />
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.values.gender} onValueChange={(v) => form.setValue('gender', v as Tenant['gender'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{genders.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <FormInput label="Date of Birth" type="date" id="dob" value={form.values.dob}
                onChange={(e) => form.setValue('dob', e.target.value)} />
              <FormInput label="Occupation" id="occupation" value={form.values.occupation}
                onChange={(e) => form.setValue('occupation', e.target.value)} />
              <div className="space-y-1.5">
                <Label>ID Type</Label>
                <Select value={form.values.idType} onValueChange={(v) => {
                  form.setValue('idType', v as Tenant['idType']);
                  if (form.values.idNumber) {
                    form.handleBlur('idNumber', (val) => validateIdNumber(v, String(val || ''), false));
                  }
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{idTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <FormInput label="ID Number" id="idNumber" className="sm:col-span-2" value={form.values.idNumber}
                error={form.errors.idNumber}
                onChange={(e) => {
                  form.setValue('idNumber', e.target.value);
                  if (form.errors.idNumber) form.handleBlur('idNumber', (v) => validateIdNumber(form.values.idType, String(v || ''), false));
                }}
                onBlur={() => form.handleBlur('idNumber', (v) => validateIdNumber(form.values.idType, String(v || ''), false))} />
            </div>
          </section>

          {/* Emergency Contact */}
          <section className="space-y-4 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emergency Contact</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormInput label="Contact Name" id="emergencyName" value={form.values.emergencyName}
                onChange={(e) => form.setValue('emergencyName', e.target.value)} />
              <FormInput label="Contact Phone" id="emergencyContact" value={form.values.emergencyContact}
                error={form.errors.emergencyContact}
                onChange={(e) => {
                  form.setValue('emergencyContact', e.target.value);
                  if (form.errors.emergencyContact) form.handleBlur('emergencyContact', (v) => validatePhone(String(v || ''), false));
                }}
                onBlur={() => form.handleBlur('emergencyContact', (v) => validatePhone(String(v || ''), false))} />
            </div>
          </section>

          {/* Lease & Assignment */}
          <section className="space-y-4 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lease &amp; Assignment</h4>
            <div className="space-y-4">
              {/* Property Searchable Select */}
              <div className="space-y-1.5">
                <Label>Property <span className="text-destructive">*</span></Label>
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
                    form.setValue('roomId', '');
                    form.setValue('roomNumber', '');
                    form.setValue('bedNumber', '');
                    setSelectedRoomId('');
                  }}
                  placeholder="Search & select property..."
                  searchPlaceholder="Search properties by name, city..."
                />
                {form.errors.propertyId && <p className="text-xs text-destructive">{form.errors.propertyId}</p>}
              </div>

              {/* Building Filter */}
              <div className="space-y-1.5">
                <Label>Building / Tower</Label>
                <SearchableSelect
                  options={(buildings ?? [])
                    .filter((b: any) => !form.values.propertyId || b.propertyId === form.values.propertyId)
                    .map((b: any) => ({
                      value: b.id,
                      label: b.name,
                      sublabel: `${b.propertyName || 'Property'} • ${b.code || 'Building'}`,
                    }))}
                  value={selectedBldId}
                  onChange={(v) => {
                    setSelectedBldId(v);
                    form.setValue('roomId', '');
                    form.setValue('roomNumber', '');
                    form.setValue('bedNumber', '');
                    setSelectedRoomId('');
                  }}
                  placeholder={form.values.propertyId ? "Filter by building (or view all in property)..." : "All buildings..."}
                  searchPlaceholder="Search buildings by name..."
                />
              </div>

              {/* Room & Bed Allocation with interactive bed cards */}
              <div className="space-y-1.5">
                <Label>Room &amp; Bed Allocation</Label>
                <RoomSelect
                  rooms={roomOptions}
                  beds={bedsForRoom}
                  selectedRoomNumber={form.values.roomNumber || form.values.roomId}
                  selectedBedNumber={form.values.bedNumber}
                  existingTenants={existingTenants}
                  currentTenantId={editing?.id}
                  onSelectRoom={(rNum, rId, rentVal) => {
                    form.setValue('roomNumber', rNum);
                    form.setValue('roomId', rId || rNum);
                    setSelectedRoomId(rId || rNum);
                    if (rId) {
                      queryClient.invalidateQueries({ queryKey: ['tenants-beds', rId] });
                    }
                    if (rentVal && rentVal > 0) {
                      form.setValue('rent', rentVal);
                    }
                    form.setValue('bedNumber', '');
                  }}
                  onSelectBed={(bNum) => {
                    form.setValue('bedNumber', bNum);
                  }}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput label="Monthly Rent (₹)" type="number" id="rent" value={String(form.values.rent)}
                  onChange={(e) => form.setValue('rent', Number(e.target.value))} />
                <FormInput label="Deposit (₹)" type="number" id="deposit" value={String(form.values.deposit)}
                  onChange={(e) => form.setValue('deposit', Number(e.target.value))} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Tenant['status'])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <FormInput label="Lease Start" type="date" id="leaseStart" value={form.values.leaseStart}
                  onChange={(e) => form.setValue('leaseStart', e.target.value)} />
                <FormInput label="Lease End (optional)" type="date" id="leaseEnd" value={form.values.leaseEnd}
                  onChange={(e) => form.setValue('leaseEnd', e.target.value)} />
              </div>
            </div>

            {!editing && (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                    <CreditCard className="h-4 w-4" /> Initial Onboarding Payment (Rent + Deposit)
                  </span>
                  <span className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">
                    Total: ₹{Number(form.values.rent || 0) + Number(form.values.deposit || 0)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('razorpay')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      paymentMethod === 'razorpay'
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Zap className="h-4 w-4 mb-1" />
                    <span>Razorpay Online</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Wallet className="h-4 w-4 mb-1" />
                    <span>Cash / Offline</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('later')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      paymentMethod === 'later'
                        ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar className="h-4 w-4 mb-1" />
                    <span>Pay Later</span>
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {paymentMethod === 'razorpay' && 'Launches Razorpay checkout for immediate online payment (UPI, Cards, Netbanking).'}
                  {paymentMethod === 'cash' && 'Marks tenant as active and records initial rent & deposit paid via cash/offline.'}
                  {paymentMethod === 'later' && 'Creates tenant record and issues an onboarding invoice due in 7 days.'}
                </p>
              </div>
            )}
          </section>
        </div>
      </FormDialog>

      <ConfirmDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive Tenant (Soft Delete)" variant="default"
        description={`Archive resident "${archiveTarget?.name}"? The tenant will be marked as archived, their assigned room/bed will be freed up, and all financial ledger records and invoices will be safely preserved.`}
        confirmLabel="Archive Resident" onConfirm={confirmArchive} loading={archiveMut.isPending} />

      <ConfirmDialog open={!!permanentDeleteTarget} onOpenChange={(o) => !o && setPermanentDeleteTarget(null)}
        title="Permanent Delete Tenant" variant="destructive"
        description={`Are you sure you want to PERMANENTLY delete "${permanentDeleteTarget?.name}"? This action cannot be undone. All linked records, invoices, receipts, and tenant accounts will be permanently erased.`}
        confirmLabel="Permanently Delete" onConfirm={confirmPermanentDelete} loading={isDeletingPermanent} />

      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent id="reception-qr-print-poster" className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 shadow-2xl max-h-[88vh] overflow-hidden">
          <div className="p-5 space-y-3 overflow-y-auto max-h-[86vh]">
            <DialogHeader className="space-y-1.5">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
                <QrCode className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white text-center">Reception QR Onboarding</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-center">
                Print this QR poster at reception for guest check-in.
              </DialogDescription>
            </DialogHeader>

            <div className="text-left space-y-1.5">
              <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Property</Label>
              <Select value={effectiveQrPropId} onValueChange={setQrPropertyId}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-foreground h-10 text-xs sm:text-sm font-medium rounded-xl shadow-2xs">
                  <SelectValue placeholder="Select property..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm shadow-xl">
                  {(properties ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-white p-3 rounded-2xl border-2 border-primary/30 shadow-sm mx-auto w-fit">
              <img src={qrCodeImageUrl} alt="Reception QR Code" className="h-36 w-36 sm:h-40 sm:w-40 rounded-lg mx-auto" />
              <div className="mt-1.5 text-[10px] font-extrabold tracking-widest text-slate-800 uppercase text-center">Scan to Onboard & Pay</div>
            </div>

            <div className="text-xs text-foreground bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] uppercase font-bold tracking-wide text-slate-500 dark:text-slate-400">Link</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(onboardUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                    toast({ title: 'Copied!', description: 'Onboarding URL copied to clipboard.' });
                  }}
                  className="text-primary hover:underline flex items-center gap-1 font-mono text-[10px] no-print font-semibold"
                >
                  {copiedLink ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="font-mono text-[11px] text-primary truncate">{onboardUrl}</div>
            </div>

            <div className="flex items-center gap-2.5 no-print pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrintQRCode}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs h-10 px-4 text-xs sm:text-sm font-semibold gap-2 transition-all"
              >
                <Printer className="h-4 w-4 shrink-0" /> Print Poster
              </Button>
              <Button
                type="button"
                onClick={() => window.open(`/onboard?p=${effectiveQrPropId}`, '_blank')}
                className="flex-1 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs h-10 px-4 text-xs sm:text-sm gap-2 transition-all"
              >
                <ExternalLink className="h-4 w-4 shrink-0" /> Test Portal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Existing Tenant Bulk CSV / Excel Import */}
      <BulkImportTenantsModal
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onSuccess={() => queryClient.invalidateQueries()}
        properties={properties || []}
      />

      {/* 3-Step Quick Add Resident Wizard */}
      <QuickAddTenantModal
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onSuccess={() => queryClient.invalidateQueries()}
        properties={properties || []}
        rooms={allRooms || []}
        beds={bedsForRoom || []}
      />

      {/* Instant 360 Resident Slide-Out Drawer */}
      <Tenant360Drawer
        tenantId={drawerTenantId}
        open={Boolean(drawerTenantId)}
        onOpenChange={(open) => !open && setDrawerTenantId(null)}
      />
    </div>
  );
}
