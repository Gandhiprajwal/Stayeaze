import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Phone, Mail, MapPin, Calendar, Briefcase,
  CreditCard, ShieldCheck, Wallet, Home, FileText, Upload, CheckCircle2, XCircle, Trash2, ExternalLink, AlertCircle
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { formatCurrency, formatDate, initials } from '@/lib/format';

export default function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState<'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENSE' | 'OTHER'>('AADHAAR');
  const [docNumber, setDocNumber] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<TenantDocument | null>(null);

  const resolveFileUrl = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `http://localhost:8080${url}`;
    return `http://localhost:8080/${url}`;
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

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild><Link to="/tenants"><ArrowLeft className="mr-1.5 h-4 w-4" /> Tenants</Link></Button>
      <PageHeader
        title={tenant.name}
        description={`${tenant.occupation || 'Tenant'} · ${tenant.email || tenant.phone}`}
        icon={Users}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Rent" value={formatCurrency(Number(tenant.rent || 0))} icon={Wallet} accent="primary" />
        <StatCard label="Deposit Paid" value={formatCurrency(Number(tenant.deposit || 0))} icon={CreditCard} accent="info" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Wallet} accent={outstanding > 0 ? 'destructive' : 'success'} />
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
              <InfoRow icon={CreditCard} label="ID Type" value={(tenant.idType || 'aadhaar').replace('_', ' ')} />
              <InfoRow icon={ShieldCheck} label="ID Number" value={tenant.idNumber || '—'} />
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
          ) : (documents && documents.length > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {documents.map((doc) => (
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
                        onClick={() => verifyMutation.mutate({ docId: doc.id, status: 'VERIFIED' })}
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
                        onClick={() => verifyMutation.mutate({ docId: doc.id, status: 'REJECTED' })}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5 text-rose-600" /> Reject
                      </Button>
                    )}
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No KYC documents uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Recent invoices for this tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(invoices && invoices.length > 0) ? invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{inv.period} · Due {formatDate(inv.dueDate)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums">{formatCurrency(inv.amount)}</span>
                <StatusBadge status={inv.status} tone={statusTone(inv.status)} />
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No recent invoices found for this tenant.</p>}
        </CardContent>
      </Card>

      {/* Upload KYC Document Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload KYC Document</DialogTitle>
            <DialogDescription>Provide mandatory document details and file upload for background verification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Document Type <span className="text-destructive">*</span></Label>
                <span className="text-[10px] text-destructive font-medium">Required</span>
              </div>
              <Select value={docType} onValueChange={(val: any) => setDocType(val)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AADHAAR">Aadhaar Card</SelectItem>
                  <SelectItem value="PAN">PAN Card</SelectItem>
                  <SelectItem value="PASSPORT">Passport</SelectItem>
                  <SelectItem value="DRIVING_LICENSE">Driving License</SelectItem>
                  <SelectItem value="OTHER">Other Proof</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Document Number / ID <span className="text-destructive">*</span></Label>
                <span className="text-[10px] text-destructive font-medium">Required</span>
              </div>
              <Input
                placeholder="e.g. 1234-5678-9012"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-xs">Select Document File <span className="text-destructive">*</span></Label>
                <span className="text-[10px] text-emerald-600 font-medium">Auto-saved to Local Storage / S3</span>
              </div>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              {selectedFile && (
                <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-muted"></div>
              <span className="mx-2 flex-shrink text-[10px] font-semibold uppercase text-muted-foreground">OR Provide Direct File URL</span>
              <div className="flex-grow border-t border-muted"></div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Document File URL (Optional if file selected above)</Label>
              <Input
                placeholder="https://storage.example.com/docs/aadhaar.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button
              disabled={(!selectedFile && !fileUrl) || !docNumber || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate({ documentType: docType, documentNumber: docNumber, fileUrl })}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview KYC Document Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
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
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4.5 w-4.5" /></div>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium capitalize">{value}</p></div>
    </div>
  );
}
