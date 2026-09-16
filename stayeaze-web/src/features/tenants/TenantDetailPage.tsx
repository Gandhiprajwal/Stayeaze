import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Phone, Mail, MapPin, Calendar, Briefcase,
  CreditCard, ShieldCheck, Wallet, Home, FileText, Upload, CheckCircle2, XCircle, Trash2, ExternalLink, AlertCircle,
  KeyRound, LogOut, Archive, RotateCcw, Pencil, Eye, ScrollText, Calculator, FileCheck, DoorOpen,
  Check
} from 'lucide-react';
import CheckoutSettlementModal from '@/features/check-out/CheckoutSettlementModal';
import TenantAdjustmentsLedgerCard from '@/features/tenants/TenantAdjustmentsLedgerCard';
import DigitalAgreementModal from '@/features/tenants/DigitalAgreementModal';
import { HraStatementModal } from '@/features/billing/HraStatementModal';
import RoomTransferWizardModal from '@/features/tenants/RoomTransferWizardModal';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { RowActions } from '@/components/common/RowActions';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';
import { propertyService } from '@/lib/services';
import type { Tenant, Invoice, TenantDocument } from '@/lib/types';
import { formatCurrency, formatDate, initials, resolveBackendUrl } from '@/lib/format';

export default function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState<'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE' | 'OTHER'>('AADHAAR');
  const [docNumber, setDocNumber] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<TenantDocument | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [paymentApprovalTarget, setPaymentApprovalTarget] = useState<{
    type: 'DESK_ONBOARDING' | 'SINGLE_INVOICE';
    invoiceId?: string;
    invoiceNumber?: string;
    amount?: number;
  } | null>(null);
  const kycFileInputRef = useRef<HTMLInputElement>(null);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [checkoutSettlementOpen, setCheckoutSettlementOpen] = useState(false);
  const [hraStatementOpen, setHraStatementOpen] = useState(false);
  const [transferWizardOpen, setTransferWizardOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const resolveFileUrl = resolveBackendUrl;

  const formatIdTypeName = (rawType?: string): string => {
    if (!rawType || rawType.trim() === '' || rawType.trim() === '—') return '—';
    const clean = rawType.toUpperCase().replace(/[\s_-]+/g, '_');
    switch (clean) {
      case 'AADHAAR':
      case 'AADHAR':
        return 'Aadhaar Card';
      case 'PAN':
        return 'PAN Card';
      case 'PASSPORT':
        return 'Passport';
      case 'DRIVING_LICENSE':
      case 'DRIVINGLICENSE':
      case 'DL':
        return 'Driving License';
      case 'VOTER_ID':
      case 'VOTERID':
        return 'Voter ID';
      default:
        return rawType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get<Tenant>(`/tenants/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['tenant-documents', id],
    queryFn: () => api.get<TenantDocument[]>(`/tenants/${id}/documents`).then((r) => {
      const payload = r.data as any;
      if (Array.isArray(payload)) return payload as TenantDocument[];
      if (payload && Array.isArray(payload.data)) return payload.data as TenantDocument[];
      return [] as TenantDocument[];
    }),
    enabled: !!id,
  });

  const { data: minimalProperties } = useQuery({
    queryKey: ['properties-minimal'],
    queryFn: () => propertyService.getMinimal(),
  });
  const propList = Array.isArray(minimalProperties) ? minimalProperties : (minimalProperties as any)?.data || [];
  const propertyName = propList.find((p: any) => p.id === tenant?.propertyId)?.name;

  const { data: buildings } = useQuery({
    queryKey: ['tenant-detail-buildings'],
    queryFn: () => api.get<any[]>('/buildings', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] }).data ?? [];
    }),
  });
  const matchedBuilding = (buildings ?? []).find((b: any) => b.propertyId === tenant?.propertyId || b.id === (tenant as any)?.buildingId);
  const displayBuildingName = tenant?.buildingName || matchedBuilding?.name || 'Main Building';

  const { data: invoices } = useQuery({
    queryKey: ['tenant-invoices', id],
    queryFn: () => api.get<Invoice[]>(`/tenants/${id}/invoices`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Invoice[];
      return (payload as { data: Invoice[] }).data ?? [];
    }),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { documentType: string; documentNumber: string; fileUrl?: string }) => {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('documentType', data.documentType);
        if (data.documentNumber) formData.append('documentNumber', data.documentNumber);
        const res = await api.post(`/tenants/${id}/documents/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      }
      return (await api.post(`/tenants/${id}/documents`, data)).data;
    },
    onSuccess: () => {
      toast.success('KYC Document uploaded successfully');
      setUploadOpen(false);
      setSelectedFile(null);
      setDocNumber('');
      setFileUrl('');
      queryClient.invalidateQueries({ queryKey: ['tenant-documents', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to upload document');
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ docId, status }: { docId: string; status: 'VERIFIED' | 'REJECTED' }) =>
      api.put(`/tenants/${id}/documents/${docId}/verify?status=${status}`),
    onSuccess: (_, variables) => {
      toast.success(`Document marked as ${variables.status.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ['tenant-documents', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Verification failed');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/tenants/${id}/documents/${docId}`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['tenant-documents', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    },
  });

  const handleSendCredentials = async () => {
    try {
      const res = await api.post(`/tenants/${id}/send-credentials`);
      toast.success(res.data.message || `Credentials dispatched to ${tenant?.email}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch credentials.');
    }
  };

  const approvePaymentMut = useMutation({
    mutationFn: async (target: { type: 'DESK_ONBOARDING' | 'SINGLE_INVOICE'; invoiceId?: string }) => {
      if (target.type === 'SINGLE_INVOICE' && target.invoiceId) {
        const res = await api.post(`/invoices/${target.invoiceId}/approve-payment`);
        return res.data;
      } else {
        const res = await api.post(`/tenants/${id}/approve-desk-payment`);
        return res.data;
      }
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Payment successfully verified & marked as PAID.');
      setPaymentApprovalTarget(null);
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to approve payment.');
    },
  });

  const hasKycDocuments = Boolean(
    (documents && documents.length > 0) ||
    (tenant as any)?.idDocumentUrl ||
    (tenant as any)?.idNumber
  );

  const handleVerifyKyc = async () => {
    if (!hasKycDocuments) {
      toast.error('Cannot approve KYC: No identity or verification documents have been uploaded for this resident.');
      return;
    }
    try {
      await api.post(`/tenants/${id}/verify-document`, { status: 'VERIFIED' });
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenant-documents', id] });
      toast.success('Tenant KYC verified successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to verify KYC.');
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await api.delete(`/tenants/${id}`);
      toast.success(`Tenant "${tenant?.name}" archived successfully.`);
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      setArchiveOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to archive tenant.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    try {
      await api.put(`/tenants/${id}/unarchive`);
      toast.success(`Tenant "${tenant?.name}" unarchived successfully.`);
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to unarchive tenant.');
    }
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (!tenant) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate('/tenants')}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Tenants</Button>
      <p className="text-muted-foreground">Tenant profile not found.</p>
    </div>
  );

  const outstanding = (invoices ?? []).filter((i) => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount || 0) - Number(i.paidAmount || 0)), 0);

  const emName = tenant.emergencyName || tenant.emergencyContactName || '';
  const emPhone = tenant.emergencyContact || tenant.emergencyContactMobile || '';
  const emergencyText = (emName || emPhone)
    ? `${emName} ${emPhone ? `(${emPhone})` : ''}`.trim()
    : '—';

  const kycUpper = (tenant.kycStatus || 'PENDING').toUpperCase();
  const kycTone = kycUpper === 'VERIFIED'
    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
    : kycUpper === 'REJECTED'
    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20';

  const effectiveDocs = (documents && documents.length > 0)
    ? documents
    : (tenant?.idNumber ? [{
        id: 'registered-id',
        documentType: (tenant.idType || 'AADHAAR').toUpperCase() as any,
        documentNumber: tenant.idNumber,
        verificationStatus: (tenant.kycStatus || 'PENDING').toUpperCase() as any,
        fileUrl: (tenant as any).idFileUrl || null,
      }] : []);

  const statusClean = String(tenant.status || '').toLowerCase();
  const unpaidInvoices = (invoices ?? []).filter((i) => String(i.status || '').toLowerCase() !== 'paid');
  const hasUnpaidInvoice = unpaidInvoices.length > 0;
  const totalUnpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount || 0) - Number(inv.paidAmount || 0)), 0);

  // Approve Payment shows ONLY when there are pending / unpaid invoices
  const showApprovePaymentBtn = hasUnpaidInvoice && statusClean !== 'checked_out' && statusClean !== 'archived';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild><Link to="/tenants"><ArrowLeft className="mr-1.5 h-4 w-4" /> Tenants</Link></Button>
      <PageHeader
        title={tenant.name}
        description={`${tenant.occupation || 'Tenant'} · ${tenant.email || tenant.phone}`}
        icon={Users}
        actions={
          <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 shrink-0">
            {showApprovePaymentBtn && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-semibold h-9 px-3.5 text-xs gap-1.5"
                onClick={() => setPaymentApprovalTarget({
                  type: 'DESK_ONBOARDING',
                  amount: totalUnpaidAmount,
                })}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Approve Payment</span>
                <span className="sm:hidden">Approve</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setUploadOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Upload KYC</span>
              <span className="sm:hidden">KYC</span>
            </Button>
            {kycUpper !== 'VERIFIED' && (
              <Button
                size="sm"
                variant="outline"
                className="text-indigo-600 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-semibold h-9 px-3.5 text-xs gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleVerifyKyc}
                disabled={!hasKycDocuments}
                title={!hasKycDocuments ? 'Upload identity proof documents to enable KYC verification' : 'Verify Tenant KYC'}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Verify KYC</span>
                <span className="sm:hidden">Verify</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendCredentials}
              className="h-9 px-3.5 text-xs font-semibold gap-1.5"
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Send Credentials</span>
              <span className="sm:hidden">Credentials</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHraStatementOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-900 bg-indigo-50/50 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-200"
            >
              <FileCheck className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="hidden sm:inline">HRA Statement</span>
              <span className="sm:hidden">HRA</span>
            </Button>
            {tenant.status !== 'checked_out' && tenant.status !== 'archived' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransferWizardOpen(true)}
                  className="h-9 px-3.5 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <DoorOpen className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">Transfer Room</span>
                  <span className="sm:hidden">Transfer</span>
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs gap-1.5 h-9 px-3.5 text-xs"
                  onClick={() => setCheckoutSettlementOpen(true)}
                >
                  <Calculator className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">1-Click Settle & Checkout</span>
                  <span className="sm:hidden">Checkout</span>
                </Button>
              </>
            )}
            <RowActions
              className="w-60"
              label="More Actions"
              items={[
                ...(tenant.status === 'archived' ? [{
                  label: 'Unarchive Resident',
                  icon: RotateCcw,
                  variant: 'indigo' as const,
                  sectionHeader: 'Status & Lifecycle',
                  description: 'Restore resident to Active status',
                  onSelect: handleUnarchive,
                }] : [{
                  label: 'Archive Resident',
                  icon: Archive,
                  variant: 'default' as const,
                  sectionHeader: 'Record Status',
                  description: 'Frees bed allocation, preserves ledger',
                  onSelect: () => setArchiveOpen(true),
                }]),
              ]}
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Monthly Rent" value={formatCurrency(Number(tenant.rent || 0))} icon={Wallet} accent="primary" />
        <StatCard label="Deposit Paid" value={formatCurrency(Number(tenant.deposit || 0))} icon={CreditCard} accent="info" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Wallet} accent={outstanding > 0 ? 'destructive' : 'success'} />
        <StatCard label="Advance Wallet" value={formatCurrency(Number((tenant as any).advanceBalance || 0))} icon={ShieldCheck} accent={Number((tenant as any).advanceBalance || 0) > 0 ? 'success' : 'primary'} hint="Auto-offsets rent" />
        <StatCard label="Lease Ends" value={tenant.leaseEnd ? formatDate(tenant.leaseEnd) : 'Ongoing / None'} icon={Calendar} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tenant Profile</span>
              <Badge className={`text-xs font-semibold ${kycTone}`}>
                KYC: {kycUpper}
              </Badge>
            </CardTitle>
            <CardDescription>Personal and identity information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials(tenant.name)}</AvatarFallback></Avatar>
              <div>
                <h3 className="font-heading text-lg font-semibold">{tenant.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={tenant.status} tone={statusTone(tenant.status)} />
                  {tenant.createdAt && <span className="text-xs text-muted-foreground">Registered {formatDate(tenant.createdAt)}</span>}
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Phone} label="Phone" value={tenant.phone || '—'} />
              <InfoRow icon={Mail} label="Email" value={tenant.email || '—'} />
              <InfoRow icon={Calendar} label="Date of Birth" value={tenant.dob ? formatDate(tenant.dob) : '—'} />
              <InfoRow icon={Briefcase} label="Occupation" value={tenant.occupation || '—'} />
              {(() => {
                const docMatch = (effectiveDocs ?? []).find((d: any) => d.documentNumber && d.documentNumber.trim().length > 0) || (effectiveDocs ?? [])[0];
                const rawIdType = docMatch?.documentType || tenant.idType || (tenant.idNumber ? 'AADHAAR' : undefined);
                const resolvedIdType = formatIdTypeName(rawIdType);
                const resolvedIdNumber = docMatch?.documentNumber || tenant.idNumber || '—';
                return (
                  <>
                    <InfoRow icon={CreditCard} label="ID Type" value={resolvedIdType} />
                    <InfoRow icon={ShieldCheck} label="ID Number" value={resolvedIdNumber} />
                  </>
                );
              })()}
              <InfoRow icon={Users} label="Emergency Contact" value={emergencyText} />
              <InfoRow icon={MapPin} label="Location" value={`Room ${tenant.roomNumber || '—'} · Bed ${tenant.bedNumber || '—'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
            <CardDescription>Property &amp; room allocation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={Home} label="Property" value={propertyName ?? '—'} />
            <InfoRow icon={MapPin} label="Building" value={displayBuildingName} />
            <InfoRow icon={Home} label="Room / Bed" value={`Room ${tenant.roomNumber || '—'} · Bed ${tenant.bedNumber || '—'}`} />
            <Separator />
            <InfoRow icon={Calendar} label="Lease Start" value={tenant.leaseStart ? formatDate(tenant.leaseStart) : '—'} />
            <InfoRow icon={Calendar} label="Lease End" value={tenant.leaseEnd ? formatDate(tenant.leaseEnd) : 'Ongoing / None'} />
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Digital Agreement</span>
              </div>
              <div className="flex items-center gap-2">
                {(tenant as any).isAgreementAccepted ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Signed &amp; Accepted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">
                    Pending Signature
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAgreementOpen(true)}
                  className="h-7 text-xs px-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/40"
                >
                  <Eye className="mr-1 h-3 w-3" /> View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KYC Documents Management Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              KYC Documents & Verification
            </CardTitle>
            <CardDescription>Upload and verify identity documents for tenant background verification</CardDescription>
          </div>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Upload Document
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {docsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (effectiveDocs && effectiveDocs.length > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {effectiveDocs.map((doc: any) => (
                <div key={doc.id} className="flex items-start justify-between rounded-lg border p-4 shadow-sm bg-card">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{doc.documentType.replace('_', ' ')}</span>
                      <Badge className={`text-[10px] ${doc.verificationStatus === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-600' : doc.verificationStatus === 'REJECTED' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {doc.verificationStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">ID: {doc.documentNumber}</p>
                    {doc.fileUrl && (
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 gap-1.5"
                          onClick={() => setPreviewDoc(doc)}
                        >
                          <FileText className="h-3.5 w-3.5 text-primary" /> View / Preview
                        </Button>
                        <a
                          href={resolveFileUrl(doc.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          Open <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {doc.verificationStatus !== 'VERIFIED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-medium"
                        title="Approve Document"
                        disabled={verifyMutation.isPending}
                        onClick={() => {
                          if (doc.id === 'registered-id') {
                            handleVerifyKyc();
                          } else {
                            verifyMutation.mutate({ docId: doc.id, status: 'VERIFIED' });
                          }
                        }}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Approve
                      </Button>
                    )}
                    {doc.verificationStatus !== 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-2.5 border-rose-500/40 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-medium"
                        title="Reject Document"
                        disabled={verifyMutation.isPending}
                        onClick={() => {
                          if (doc.id !== 'registered-id') {
                            verifyMutation.mutate({ docId: doc.id, status: 'REJECTED' });
                          }
                        }}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5 text-rose-600" /> Reject
                      </Button>
                    )}
                    {doc.id !== 'registered-id' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete Document"
                        disabled={deleteDocMutation.isPending}
                        onClick={() => deleteDocMutation.mutate(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No KYC documents uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Penalties & Discounts Adjustment Ledger */}
      <TenantAdjustmentsLedgerCard tenantId={tenant.id} isArchived={(tenant?.status || '').toUpperCase() === 'ARCHIVED'} />

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Recent invoices and payment settlements for this tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(invoices && invoices.length > 0) ? invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border p-3.5 bg-card/60 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground font-mono">{inv.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{inv.period || 'Onboarding / Rent'} · Due {formatDate(inv.dueDate)}</p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap justify-end">
                <span className="text-sm font-bold tabular-nums font-mono">{formatCurrency(inv.amount)}</span>
                <StatusBadge status={inv.status} tone={statusTone(inv.status)} />
                {String(inv.status || '').toLowerCase() !== 'paid' && (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-xs"
                    disabled={approvePaymentMut.isPending}
                    onClick={() => setPaymentApprovalTarget({
                      type: 'SINGLE_INVOICE',
                      invoiceId: inv.id,
                      invoiceNumber: inv.invoiceNumber,
                      amount: Number(inv.amount || 0),
                    })}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                )}
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No recent invoices found for this tenant.</p>}
        </CardContent>
      </Card>

      {/* Upload KYC Document Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md md:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                <FileCheck className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">Upload KYC Document</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Provide mandatory document details and file upload for background verification.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(85vh-130px)]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Document Type <span className="text-destructive">*</span></Label>
                <span className="text-[10px] text-destructive font-medium">Required</span>
              </div>
              <Select value={docType} onValueChange={(val: any) => setDocType(val)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AADHAAR">Aadhaar Card</SelectItem>
                  <SelectItem value="PAN">PAN Card</SelectItem>
                  <SelectItem value="PASSPORT">Passport</SelectItem>
                  <SelectItem value="DRIVING_LICENSE">Driving License</SelectItem>
                  <SelectItem value="OTHER">Other Proof</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Document Number / ID <span className="text-destructive">*</span></Label>
                <span className="text-[10px] text-destructive font-medium">Required</span>
              </div>
              <Input
                placeholder="e.g. 1234-5678-9012"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Select Document File <span className="text-destructive">*</span></Label>
                <span className="text-[10px] text-muted-foreground font-medium">Max: 3MB</span>
              </div>
              <input
                ref={kycFileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setSelectedFile(null);
                    setFileError(null);
                    return;
                  }
                  if (file.size > 3 * 1024 * 1024) {
                    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
                    setFileError(`Selected file is too large (${sizeMb} MB). Maximum allowed size is 3MB.`);
                    toast.error(`File size exceeds 3MB limit (${sizeMb} MB). Please choose a smaller file.`);
                    setSelectedFile(null);
                    if (kycFileInputRef.current) kycFileInputRef.current.value = '';
                    return;
                  }
                  setFileError(null);
                  setSelectedFile(file);
                }}
              />
              {selectedFile ? (
                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                      <FileCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{selectedFile.name}</p>
                      <p className="text-[11px] text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB • Ready to upload</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileError(null);
                      if (kycFileInputRef.current) kycFileInputRef.current.value = '';
                    }}
                    className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => kycFileInputRef.current?.click()}
                  className="p-4 rounded-xl border-2 border-dashed border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-muted/30 text-center space-y-1.5 cursor-pointer transition"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                    <Upload className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">Click to browse or drop file</p>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, PDF (Max: 3MB)</p>
                </div>
              )}
              {fileError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1.5 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  {fileError}
                </p>
              )}
            </div>
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-muted"></div>
              <span className="mx-2 flex-shrink text-[10px] font-semibold uppercase text-muted-foreground">OR Provide Direct File URL</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Document File URL (Optional if file selected above)</Label>
              <Input
                placeholder="https://storage.example.com/docs/aadhaar.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-2 shrink-0">
            <Button variant="ghost" onClick={() => setUploadOpen(false)} className="rounded-xl h-9 text-xs font-semibold">Cancel</Button>
            <Button
              disabled={(!selectedFile && !fileUrl) || !docNumber || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate({ documentType: docType, documentNumber: docNumber, fileUrl })}
              className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-9 text-xs shadow-xs"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview KYC Document Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {previewDoc?.documentType?.replace('_', ' ')} Document
              </DialogTitle>
              <DialogDescription className="font-mono text-xs mt-0.5">
                ID Number: {previewDoc?.documentNumber} · Verification Status: {previewDoc?.verificationStatus}
              </DialogDescription>
            </div>
            {previewDoc?.fileUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={resolveFileUrl(previewDoc.fileUrl)} target="_blank" rel="noopener noreferrer">
                  Open Original <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-auto p-2 bg-muted/20 rounded-lg flex items-center justify-center min-h-[500px]">
            {previewDoc?.fileUrl ? (
              previewDoc.fileUrl.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={resolveFileUrl(previewDoc.fileUrl)}
                  className="w-full h-[600px] rounded border shadow-sm bg-white"
                  title="KYC PDF Document Preview"
                />
              ) : (
                <img
                  src={resolveFileUrl(previewDoc.fileUrl)}
                  alt="KYC Document Preview"
                  className="max-h-[600px] w-auto max-w-full object-contain rounded border shadow-sm"
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">No file attached to this document record.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Digital Tenancy Agreement Viewer & Terms Manager Modal */}
      <DigitalAgreementModal
        open={agreementOpen}
        onOpenChange={setAgreementOpen}
        tenant={tenant}
        propertyName={propertyName}
        buildingName={displayBuildingName}
        isOwnerOrManager={true}
      />

      {/* Archive Confirm Dialog */}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive Resident (Soft Delete)"
        description={`Archive "${tenant.name}"? The tenant will be marked as archived, their room/bed will be vacated, and all financial ledgers and invoices will be safely preserved.`}
        confirmLabel="Archive Resident"
        onConfirm={handleArchive}
        loading={isArchiving}
      />
      {/* Checkout Settlement Modal */}
      {tenant && (
        <CheckoutSettlementModal
          isOpen={checkoutSettlementOpen}
          onClose={() => setCheckoutSettlementOpen(false)}
          tenantId={tenant.id}
          tenantName={tenant.name}
          onSuccess={() => {
            queryClient.invalidateQueries();
            navigate('/check-outs');
          }}
        />
      )}

      {/* HRA Annual Statement Modal */}
      {tenant && (
        <HraStatementModal
          open={hraStatementOpen}
          onOpenChange={setHraStatementOpen}
          tenantId={id!}
          tenantName={tenant.name}
        />
      )}

      {/* P2.2: Room Transfer Reconciliation Wizard Modal */}
      {tenant && (
        <RoomTransferWizardModal
          open={transferWizardOpen}
          onClose={() => setTransferWizardOpen(false)}
          tenant={tenant}
        />
      )}

      {/* Double Verification Payment Approval Modal */}
      <Dialog open={!!paymentApprovalTarget} onOpenChange={(open) => !open && setPaymentApprovalTarget(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md rounded-2xl border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 border-b bg-emerald-500/5 dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  Confirm Payment Approval
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Sensitive financial action: Please double verify transaction details.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {paymentApprovalTarget && (
            <div className="p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
              <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Financial Ledger & Settlement Warning</p>
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    Confirming will mark the invoice(s) as <strong>PAID</strong>, issue an official payment receipt, and update resident status to <strong>Active</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 rounded-xl p-3.5 bg-muted/40 border">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Resident</span>
                  <span className="font-bold text-foreground">{tenant.name}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Room / Bed</span>
                  <span className="font-medium text-foreground">Room {tenant.roomNumber || '—'} / Bed {tenant.bedNumber || '—'}</span>
                </div>
                {paymentApprovalTarget.invoiceNumber ? (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Invoice Reference</span>
                    <span className="font-mono font-bold text-primary">{paymentApprovalTarget.invoiceNumber}</span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Scope</span>
                    <span className="font-medium text-primary">All Outstanding Onboarding Invoices</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-2 border-t font-semibold">
                  <span className="text-muted-foreground">Settlement Amount</span>
                  <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(paymentApprovalTarget.amount || 0)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={approvePaymentMut.isPending}
                  onClick={() => setPaymentApprovalTarget(null)}
                  className="rounded-xl h-9 text-xs font-semibold px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={approvePaymentMut.isPending}
                  onClick={() => paymentApprovalTarget && approvePaymentMut.mutate(paymentApprovalTarget)}
                  className="rounded-xl h-9 text-xs font-bold px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-1.5"
                >
                  {approvePaymentMut.isPending ? 'Confirming...' : 'Confirm & Mark Paid'}
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  const isEmailOrId = label.toLowerCase().includes('email') || label.toLowerCase().includes('id') || label.toLowerCase().includes('phone');
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4.5 w-4.5" /></div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-medium ${isEmailOrId ? 'normal-case' : 'capitalize'}`}>{value}</p>
      </div>
    </div>
  );
}
