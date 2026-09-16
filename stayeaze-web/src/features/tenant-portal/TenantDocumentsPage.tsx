import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, FileText, Upload, CheckCircle2, AlertCircle, Clock,
  Lock, Eye, Sparkles, Building2, ScrollText, Check, X, File, Image as ImageIcon,
  ExternalLink
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatCurrency, formatDate, resolveBackendUrl } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import api from '@/lib/api';

export default function TenantDocumentsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [docType, setDocType] = useState('AADHAAR');
  const [docNumber, setDocNumber] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signingLease, setSigningLease] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('documents');
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveFileUrl = resolveBackendUrl;

  const { data: overview } = useQuery({
    queryKey: ['tenant-overview'],
    queryFn: () => api.get('/tenant-portal/overview').then((r) => r.data),
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['tenant-documents'],
    queryFn: () => api.get('/tenant-portal/documents').then((r) => {
      const list = Array.isArray(r.data) ? r.data : (r.data as any).data || [];
      return list;
    }),
  });

  const { data: lease, isLoading: leaseLoading } = useQuery({
    queryKey: ['tenant-lease'],
    queryFn: () => api.get('/tenant-portal/lease').then((r) => r.data),
  });

  const effectiveDocs = (documents && documents.length > 0)
    ? documents
    : (overview?.idNumber ? [{
        id: 'registered-id',
        documentType: (overview.idType || 'AADHAAR').toUpperCase(),
        documentNumber: overview.idNumber,
        verificationStatus: overview.kycStatus || 'PENDING',
        fileUrl: (overview as any).idFileUrl || null,
      }] : []);

  function handleFileSelect(file: File) {
    if (file.size > 3 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(`Selected file is too large (${sizeMb} MB). Maximum allowed size is 3MB.`);
      toast.error(`File size exceeds 3MB limit (${sizeMb} MB). Please choose a smaller file.`);
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setFileError(null);
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setFilePreview(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleUploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docNumber.trim()) {
      toast.error('Please enter the document identity number.');
      return;
    }

    if (!selectedFile) {
      toast.error('Please attach a document file (PDF, PNG, or JPG).');
      return;
    }

    setUploading(true);
    try {
      // Step 1: Upload physical document file to /api/v1/files/upload
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('folder', 'kyc');

      const uploadRes = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedFileUrl = uploadRes.data?.fileUrl || `/uploads/kyc/${selectedFile.name}`;

      // Step 2: Attach document record to tenant KYC profile
      await api.post('/tenant-portal/documents', {
        documentType: docType,
        documentNumber: docNumber.trim(),
        fileUrl: uploadedFileUrl,
      });

      queryClient.invalidateQueries({ queryKey: ['tenant-documents'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-overview'] });

      toast.success('Document uploaded successfully for KYC verification review!');
      setDocNumber('');
      clearSelectedFile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit document. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSignLease() {
    if (!acceptedTerms) {
      toast.error('Please accept the tenancy agreement terms first.');
      return;
    }

    setSigningLease(true);
    try {
      await api.post('/tenant-portal/lease/sign', {});
      queryClient.invalidateQueries({ queryKey: ['tenant-lease'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-overview'] });

      toast.success('🎉 Digital Tenancy Agreement Signed & KYC Status Verified!');
    } catch (err: any) {
      toast.error('Failed to sign agreement.');
    } finally {
      setSigningLease(false);
    }
  }

  const isLeaseSigned = Boolean(lease?.isSigned || overview?.isAgreementAccepted);

  return (
    <div className="space-y-6">
      <PageHeader
        title="KYC & Tenancy Agreement"
        description="Upload your identity proofs for KYC verification and review your digital residency agreement."
        icon={ShieldCheck}
      />

      <Tabs defaultValue="kyc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kyc" className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> KYC Verification
          </TabsTrigger>
          <TabsTrigger value="lease" className="flex items-center gap-1.5">
            <ScrollText className="h-4 w-4" /> Digital Tenancy Agreement
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: KYC Verification */}
        <TabsContent value="kyc" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Upload Form */}
            <Card className="md:col-span-1 shadow-xs border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base font-bold">Submit Identity Proof</CardTitle>
                <CardDescription className="text-xs">Required by property management & local police regulations</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUploadDoc} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Document Type</Label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AADHAAR">Aadhaar Card (National ID)</SelectItem>
                        <SelectItem value="PAN">PAN Card</SelectItem>
                        <SelectItem value="PASSPORT">Passport</SelectItem>
                        <SelectItem value="DRIVING_LICENSE">Driving License</SelectItem>
                        <SelectItem value="COLLEGE_EMPLOYEE_ID">College / Employee ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Document Number *</Label>
                    <Input
                      required
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder="e.g. 1234 5678 9012"
                      className="h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Attach Document File (PDF / PNG / JPG) *</Label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      className="hidden"
                    />

                    {!selectedFile ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleFileSelect(e.dataTransfer.files[0]);
                          }
                        }}
                        className="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4 text-center cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all group"
                      >
                        <Upload className="h-6 w-6 mx-auto text-indigo-500 mb-1.5 group-hover:scale-110 transition-transform" />
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Click or drag file to upload</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Supports PDF, PNG, JPG (Max: 3MB)</div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/80 bg-indigo-50/40 dark:bg-indigo-950/40 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {filePreview ? (
                              <img src={filePreview} alt="Preview" className="h-10 w-10 object-cover rounded-lg border border-indigo-200 shrink-0" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 shrink-0">
                                <File className="h-5 w-5" />
                              </div>
                            )}
                            <div className="overflow-hidden text-left">
                              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{selectedFile.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={clearSelectedFile}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {fileError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1.5 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        {fileError}
                      </p>
                    )}
                  </div>

                  <Button type="submit" disabled={uploading || !selectedFile} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-9 shadow-sm">
                    {uploading ? 'Uploading...' : 'Upload & Submit for KYC'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Uploaded Documents List */}
            <Card className="md:col-span-2 shadow-xs border-slate-200 dark:border-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Uploaded Documents & Status</CardTitle>
                    <CardDescription className="text-xs">Live verification tracker from management</CardDescription>
                  </div>
                  <Badge variant={overview?.kycStatus === 'VERIFIED' ? 'default' : 'outline'} className="text-xs">
                    Overall KYC: {overview?.kycStatus || 'PENDING'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {docsLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">Loading documents...</div>
                ) : (!effectiveDocs || effectiveDocs.length === 0) ? (
                  <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                    <ShieldCheck className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-700" />
                    <div>No documents submitted yet. Please attach your identity proof on the left.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {effectiveDocs.map((doc: any) => (
                      <div key={doc.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold capitalize">{doc.documentType?.replace(/_/g, ' ')}</div>
                            <div className="text-xs font-mono text-muted-foreground">{doc.documentNumber}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {doc.fileUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewDoc(doc)}
                              className="h-8 text-xs font-semibold"
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (doc.documentNumber) setDocNumber(doc.documentNumber);
                                if (doc.documentType) setDocType(doc.documentType);
                                fileInputRef.current?.click();
                              }}
                              className="h-8 text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/50"
                            >
                              <Upload className="mr-1 h-3.5 w-3.5" /> Attach File
                            </Button>
                          )}
                          <Badge
                            variant={doc.verificationStatus === 'VERIFIED' ? 'default' : doc.verificationStatus === 'REJECTED' ? 'destructive' : 'outline'}
                            className="text-[11px] px-2 py-0.5"
                          >
                            {doc.verificationStatus || 'PENDING_REVIEW'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Document Preview Modal */}
        <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
          <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                {previewDoc?.documentType?.replace(/_/g, ' ')} Document Preview
              </DialogTitle>
              <DialogDescription className="text-xs">
                Identity Number: <span className="font-mono font-bold text-slate-900 dark:text-white">{previewDoc?.documentNumber}</span>
              </DialogDescription>
            </DialogHeader>

            {previewDoc && (
              <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center">
                {previewDoc.fileUrl?.startsWith('data:image') || previewDoc.fileUrl?.match(/\.(jpg|jpeg|png|webp)/i) ? (
                  <img src={resolveFileUrl(previewDoc.fileUrl)} alt="Document" className="max-h-[60vh] mx-auto rounded-lg object-contain shadow-sm" />
                ) : (
                  <div className="py-8 space-y-3">
                    <FileText className="h-12 w-12 mx-auto text-indigo-500" />
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">PDF / Document File Attached</div>
                    <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                      <a href={resolveFileUrl(previewDoc.fileUrl)} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open Full Document
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tab 2: Digital Tenancy Agreement */}
        <TabsContent value="lease" className="space-y-4">
          <Card className="shadow-xs border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="text-lg font-bold">Standard Residential Tenancy Agreement</CardTitle>
                <CardDescription className="text-xs">Binding terms & house rules between Resident and StayEaze Management</CardDescription>
              </div>
              {isLeaseSigned ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Signed & Active Agreement
                </div>
              ) : (
                <Badge variant="destructive" className="text-xs">Signature Pending</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              {/* Summary Terms Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-slate-400 uppercase text-[10px] font-semibold">Resident Name</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">{lease?.tenantName || overview?.name || user?.name}</div>
                </div>
                <div>
                  <div className="text-slate-400 uppercase text-[10px] font-semibold">Allocated Unit</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">Room {lease?.roomNumber || '101'} • Bed {lease?.bedNumber || 'A'}</div>
                </div>
                <div>
                  <div className="text-slate-400 uppercase text-[10px] font-semibold">Monthly Rent</div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{formatCurrency(Number(lease?.monthlyRent || 8000))}</div>
                </div>
                <div>
                  <div className="text-slate-400 uppercase text-[10px] font-semibold">Security Deposit</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(Number(lease?.securityDeposit || 10000))}</div>
                </div>
              </div>

              {/* Tenancy Rules Text */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-slate-600 dark:text-slate-400 space-y-2.5 max-h-64 overflow-y-auto p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950">
                <p><strong>1. Rent Payment:</strong> Rent is payable on or before the 5th day of every calendar month via the StayEaze online payment portal.</p>
                <p><strong>2. Gate & Curfew Hours:</strong> Main hostel gate will close at 10:30 PM. Late entries require prior intimation to the property warden.</p>
                <p><strong>3. Notice Period:</strong> A mandatory 30-day notice to vacate is required before check-out. Failure to provide 30 days notice will result in one month rent deduction from the security deposit.</p>
                <p><strong>4. House Rules:</strong> Smoking, alcohol consumption, and unauthorized overnight visitors are strictly prohibited inside the residency premises.</p>
                <p><strong>5. Maintenance & Care:</strong> Residents are expected to keep the room and common areas clean. Any property damages will be billed to the respective resident.</p>
              </div>

              {/* E-Signing Action */}
              {!isLeaseSigned ? (
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      I have read, understood, and agree to abide by all the terms, house rules, and notice period policies stated in this agreement.
                    </span>
                  </label>
                  <Button
                    onClick={handleSignLease}
                    disabled={!acceptedTerms || signingLease}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                  >
                    <Check className="mr-1.5 h-4 w-4" /> {signingLease ? 'Signing...' : 'Sign Tenancy Agreement (E-Sign)'}
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Agreement Digitally Signed by {lease?.tenantName || user?.name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">Timestamp Verified</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
