import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, ScrollText, Upload, CheckCircle2, AlertCircle, ArrowRight,
  Sparkles, Lock, FileText, Check, ChevronRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import api from '@/lib/api';

interface TenantComplianceGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: any;
}

export function TenantComplianceGateModal({ open, onOpenChange, overview }: TenantComplianceGateModalProps) {
  const queryClient = useQueryClient();

  const hasKyc = Boolean(overview?.hasUploadedKyc || overview?.idNumber);
  const hasAgreement = Boolean(overview?.hasSignedAgreement || overview?.isAgreementAccepted);

  const initialStep = !hasKyc ? 1 : !hasAgreement ? 2 : 2;
  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  // Step 1 Form State
  const [idType, setIdType] = useState(overview?.idType || 'AADHAAR');
  const [idNumber, setIdNumber] = useState(overview?.idNumber || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 Form State
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signingAgreement, setSigningAgreement] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 3 * 1024 * 1024) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        setFileError(`Selected file is too large (${sizeMb} MB). Maximum allowed size is 3MB.`);
        toast.error(`File size exceeds 3MB limit (${sizeMb} MB). Please choose a smaller file.`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFileError(null);
      setSelectedFile(file);
    }
  }

  async function handleKycSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idNumber.trim()) {
      toast.error('Please enter your identity proof number.');
      return;
    }

    setUploadingKyc(true);
    try {
      let fileUrl = null;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('folder', 'kyc');

        const uploadRes = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = uploadRes.data?.fileUrl || `/uploads/kyc/${selectedFile.name}`;
      }

      await api.post('/tenant-portal/documents', {
        documentType: idType,
        documentNumber: idNumber.trim(),
        fileUrl: fileUrl,
      });

      queryClient.invalidateQueries({ queryKey: ['tenant-documents'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-overview'] });
      toast.success('✓ Identity proof uploaded successfully!');

      if (!hasAgreement) {
        setCurrentStep(2);
      } else {
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit identity document.');
    } finally {
      setUploadingKyc(false);
    }
  }

  async function handleAgreementSign() {
    if (!agreedToTerms) {
      toast.error('Please review and check the agreement terms acceptance box.');
      return;
    }

    setSigningAgreement(true);
    try {
      await api.post('/tenant-portal/lease/sign', {
        signatureUrl: 'TENANT_PORTAL_DIGITAL_SIGNATURE',
      });

      queryClient.invalidateQueries({ queryKey: ['tenant-lease'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-overview'] });

      toast.success('🎉 Digital Tenancy Agreement Signed! Your stay operations are fully activated.');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to sign digital agreement.');
    } finally {
      setSigningAgreement(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-indigo-200 dark:border-indigo-900 shadow-2xl rounded-2xl">
        {/* Modal Header with Progress */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-900 p-5 text-white">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Resident Onboarding Activation</span>
            </div>
            <Badge variant="outline" className="border-white/30 text-white text-[11px] font-bold">
              Step {currentStep} of 2
            </Badge>
          </div>
          <DialogTitle className="text-xl font-black text-white">
            {currentStep === 1 ? 'Step 1: Upload Identity Proof' : 'Step 2: Sign Tenancy Agreement'}
          </DialogTitle>
          <DialogDescription className="text-indigo-100 text-xs mt-1">
            {currentStep === 1
              ? 'Provide a valid government ID to comply with residency safety and verification regulations.'
              : 'Review your accommodation terms and authorize digital execution of your lease.'}
          </DialogDescription>

          {/* Stepper Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all ${
                currentStep === 1
                  ? 'bg-white text-indigo-950 shadow-md'
                  : hasKyc
                  ? 'bg-white/20 text-emerald-200 hover:bg-white/30'
                  : 'bg-white/10 text-indigo-200'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                {hasKyc ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <div className="h-3.5 w-3.5 rounded-full bg-indigo-500 text-[10px] flex items-center justify-center">1</div>}
                <span className="truncate">1. ID Proof</span>
              </div>
              {hasKyc && <span className="text-[10px] text-emerald-300 font-semibold">Done</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                if (hasKyc) setCurrentStep(2);
                else toast.info('Please submit your identity proof first.');
              }}
              className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all ${
                currentStep === 2
                  ? 'bg-white text-indigo-950 shadow-md'
                  : hasAgreement
                  ? 'bg-white/20 text-emerald-200 hover:bg-white/30'
                  : 'bg-white/10 text-indigo-200'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                {hasAgreement ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> : <div className="h-3.5 w-3.5 rounded-full bg-indigo-500 text-[10px] flex items-center justify-center">2</div>}
                <span className="truncate">2. Lease Agreement</span>
              </div>
              {hasAgreement && <span className="text-[10px] text-emerald-300 font-semibold">Done</span>}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {currentStep === 1 ? (
            <form onSubmit={handleKycSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Government regulations require mandatory ID verification for all PG &amp; Hostel residents prior to facility operations.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Government Document Type *</Label>
                <Select value={idType} onValueChange={setIdType}>
                  <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="Select ID Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AADHAAR">Aadhaar Card</SelectItem>
                    <SelectItem value="PAN">PAN Card</SelectItem>
                    <SelectItem value="PASSPORT">Passport</SelectItem>
                    <SelectItem value="DRIVING_LICENSE">Driving License</SelectItem>
                    <SelectItem value="VOTER_ID">Voter ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Document Identification Number *</Label>
                <Input
                  required
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 1234 5678 9012"
                  className="h-10 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold">Attach ID Document Copy (Optional / Recommended)</Label>
                  <span className="text-[10px] text-muted-foreground font-medium">Max size: 3MB</span>
                </div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center transition-all"
                >
                  <Upload className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {selectedFile ? selectedFile.name : 'Click to upload PDF, JPG, or PNG file'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Supported formats: PDF, PNG, JPG (Max: 3MB)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                {fileError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1.5 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    {fileError}
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="submit"
                  disabled={uploadingKyc || !idNumber.trim()}
                  className="w-full sm:w-auto h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md"
                >
                  {uploadingKyc ? 'Uploading...' : 'Save & Proceed to Agreement'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Agreement Highlight Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Accommodation Summary:</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    Room {overview?.roomNumber || '—'} • Bed {overview?.bedNumber || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div>Monthly Rent: <strong className="text-slate-900 dark:text-slate-100">{formatCurrency(Number(overview?.rent || 0))}</strong></div>
                  <div>Security Deposit: <strong className="text-slate-900 dark:text-slate-100">{formatCurrency(Number(overview?.deposit || 0))}</strong></div>
                  <div>Notice Period: <strong className="text-slate-900 dark:text-slate-100">30 Days Mandatory</strong></div>
                  <div>Lease Duration: <strong className="text-slate-900 dark:text-slate-100">11 Months Standard</strong></div>
                </div>
              </div>

              {/* Terms Viewer */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 max-h-36 overflow-y-auto space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-900 dark:text-white">Standard Tenancy Lease Terms:</p>
                <p>1. <strong>Payment:</strong> Rent is payable in advance on or before the 1st day of each month.</p>
                <p>2. <strong>Conduct &amp; Property:</strong> Residents must maintain peaceful enjoyment and avoid property damage.</p>
                <p>3. <strong>Check-Out Notice:</strong> 30-day prior written notice via portal is required before move-out settlement.</p>
                <p>4. <strong>Digital Execution:</strong> Checking the agreement acceptance box constitutes a legally binding electronic signature.</p>
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <Checkbox
                  id="modal-accept-agreement"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                  className="mt-0.5"
                />
                <Label htmlFor="modal-accept-agreement" className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-snug cursor-pointer select-none">
                  I confirm that I have read and agree to all Tenancy Lease Terms &amp; House Rules. I authorize digital execution of this agreement. *
                </Label>
              </div>

              <div className="pt-2 flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="h-10 px-4 rounded-xl text-xs font-semibold"
                >
                  Back to ID Proof
                </Button>
                <Button
                  type="button"
                  onClick={handleAgreementSign}
                  disabled={signingAgreement || !agreedToTerms}
                  className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 shadow-md disabled:opacity-50"
                >
                  {signingAgreement ? 'Signing...' : 'Sign Agreement & Complete Activation'}
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
