import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, CheckCircle2, Shield, Calendar, Building, Home,
  Printer, AlertCircle, Clock, User, PlusCircle, History, Lock, Edit3
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import api from '@/lib/api';

import { getMasterAgreementTemplate, populateAgreementTemplate } from '@/lib/agreement-policy';

interface Agreement {
  id: string;
  terms: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'SIGNED';
  signatureUrl?: string;
  signedAt?: string;
  createdAt: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: any;
  propertyName?: string;
  buildingName?: string;
  isOwnerOrManager?: boolean;
}

export default function DigitalAgreementModal({
  open,
  onOpenChange,
  tenant,
  propertyName,
  buildingName,
  isOwnerOrManager = true,
}: Props) {
  const queryClient = useQueryClient();
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const [termsText, setTermsText] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const tenantId = tenant?.id;

  // Fetch all Agreements history for this tenant
  const { data: agreements = [], isLoading } = useQuery<Agreement[]>({
    queryKey: ['tenant-agreements', tenantId],
    queryFn: () =>
      api.get(`/tenants/${tenantId}/agreements`).then((r) => {
        const payload = r.data as any;
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.data)) return payload.data;
        return [];
      }),
    enabled: !!tenantId && open,
  });

  // Select active agreement (default to latest or previously selected)
  const activeAgreement =
    agreements.find((a) => a.id === selectedAgreementId) ||
    agreements[agreements.length - 1] ||
    null;

  const isSigned = Boolean(
    activeAgreement?.status === 'SIGNED' ||
      (!activeAgreement && tenant?.isAgreementAccepted)
  );

  useEffect(() => {
    if (activeAgreement?.terms) {
      setSelectedAgreementId(activeAgreement.id);
      setTermsText(activeAgreement.terms);
    } else {
      // Auto-populate from active Global Master Agreement Template
      const masterTemplate = getMasterAgreementTemplate();
      const populated = populateAgreementTemplate(
        masterTemplate,
        tenant,
        propertyName,
        buildingName
      );
      setTermsText(populated);
    }
    setAgreedToTerms(false);
  }, [activeAgreement?.id, tenant?.id, open]);

  // Sign Agreement Mutation (Checkbox Acceptance)
  const signMutation = useMutation({
    mutationFn: async () => {
      let agreementId = activeAgreement?.id;

      // If no agreement exists in DB yet, create one first
      if (!agreementId) {
        const res = await api.post(`/tenants/${tenantId}/agreements`, {
          terms: termsText,
          startDate: tenant?.leaseStart || new Date().toISOString().split('T')[0],
          endDate:
            tenant?.leaseEnd ||
            new Date(Date.now() + 335 * 86400000).toISOString().split('T')[0],
          status: 'DRAFT',
        });
        agreementId = res.data?.id;
      }

      return api.put(`/tenants/${tenantId}/agreements/${agreementId}/sign`, null, {
        params: { signatureUrl: 'CHECKBOX_TERMS_ACCEPTED' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-agreements', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast.success('Digital Tenancy Agreement signed & accepted successfully!');
      setAgreedToTerms(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to sign agreement.');
    },
  });

  // Clean Isolated Print Routine (Prints ONLY the official agreement without website UI)
  const handlePrintOnlyAgreement = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      toast.error('Please allow popups in your browser to print the agreement.');
      return;
    }

    const residentName = tenant?.name || tenant?.firstName || 'Resident';
    const residentPhone = tenant?.phone || tenant?.mobile || '—';
    const residentEmail = tenant?.email || '—';
    const roomBed = `Room ${tenant?.roomNumber || '—'} · Bed ${tenant?.bedNumber || '—'}`;
    const rentAmount = formatCurrency(tenant?.rent || 0);
    const depositAmount = formatCurrency(tenant?.securityDeposit || tenant?.deposit || 0);
    const propName = propertyName || 'StayEaze PG & Co-Living';
    const bldName = buildingName || 'Main Wing';
    const signedTimestamp = isSigned
      ? formatDateTime(activeAgreement?.signedAt || tenant?.agreementAcceptedAt || new Date())
      : 'PENDING SIGNATURE';

    const agreementBody = termsText;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tenancy Agreement — ${residentName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 800;
      color: #1e1b4b;
      margin: 0 0 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header .sub {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .box-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #4f46e5;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
      font-size: 11px;
    }
    .row .lbl { color: #64748b; }
    .row .val { font-weight: 600; color: #0f172a; }
    .terms-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 14px;
      background: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10.5px;
      line-height: 1.6;
      white-space: pre-wrap;
      color: #1e293b;
      margin-bottom: 16px;
    }
    .sign-box {
      border: 1.5px solid ${isSigned ? '#10b981' : '#f59e0b'};
      background: ${isSigned ? '#f0fdf4' : '#fffbeb'};
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 16px;
    }
    .sign-title {
      font-size: 12px;
      font-weight: 700;
      color: ${isSigned ? '#065f46' : '#92400e'};
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .sign-meta {
      font-size: 11px;
      color: ${isSigned ? '#047857' : '#b45309'};
    }
    .footer-note {
      text-align: center;
      font-size: 9.5px;
      color: #94a3b8;
      margin-top: 20px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Residential Tenancy Agreement</h1>
    <div class="sub">Official Legally Binding Co-Living &amp; PG Accommodation Lease</div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="box-title">Party A: Premises &amp; Management</div>
      <div class="row"><span class="lbl">Property:</span><span class="val">${propName}</span></div>
      <div class="row"><span class="lbl">Building/Wing:</span><span class="val">${bldName}</span></div>
      <div class="row"><span class="lbl">Allocated Space:</span><span class="val">${roomBed}</span></div>
    </div>
    <div class="box">
      <div class="box-title">Party B: Resident Details</div>
      <div class="row"><span class="lbl">Resident Name:</span><span class="val">${residentName}</span></div>
      <div class="row"><span class="lbl">Mobile / Contact:</span><span class="val">${residentPhone}</span></div>
      <div class="row"><span class="lbl">Email Address:</span><span class="val">${residentEmail}</span></div>
    </div>
  </div>

  <div class="grid" style="margin-top: -4px;">
    <div class="box">
      <div class="box-title">Monthly Rental Consideration</div>
      <div class="row"><span class="lbl">Agreed Monthly Rent:</span><span class="val" style="color: #4f46e5; font-weight: 700;">${rentAmount}</span></div>
      <div class="row"><span class="lbl">Rent Due Date:</span><span class="val">5th of every month</span></div>
    </div>
    <div class="box">
      <div class="box-title">Security Deposit &amp; Terms</div>
      <div class="row"><span class="lbl">Security Deposit:</span><span class="val" style="font-weight: 700;">${depositAmount}</span></div>
      <div class="row"><span class="lbl">Mandatory Notice Period:</span><span class="val">30 Days</span></div>
    </div>
  </div>

  <div style="font-weight: 700; font-size: 11px; margin: 12px 0 6px 0; text-transform: uppercase; color: #334155;">
    Tenancy Terms, House Rules &amp; Statutory Clauses
  </div>

  <div class="terms-box">${agreementBody}</div>

  <div class="sign-box">
    <div class="sign-title">
      ${isSigned ? '✓ Legally Acknowledged &amp; Signed via Digital Checkbox' : '⚠ Digital Signature Pending'}
    </div>
    <div class="sign-meta">
      ${
        isSigned
          ? `Signatory: <strong>${residentName}</strong> (Contact: ${residentPhone}) · Verified Timestamp: <strong>${signedTimestamp}</strong>`
          : `This tenancy agreement has been generated by management and is awaiting resident electronic acceptance.`
      }
    </div>
  </div>

  <div class="footer-note">
    Computer-generated verified tenancy agreement executed via StayEaze Cloud Platform under the Information Technology Act, 2000.
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] flex flex-col p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Digital Tenancy Agreement
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Official lease terms for {tenant?.name || tenant?.firstName || 'Tenant'}
                </DialogDescription>
              </div>
            </div>

            <div>
              {isSigned ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold gap-1 py-1 px-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Legally Signed
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-amber-600 border-amber-300 bg-amber-50/50 text-xs font-semibold gap-1 py-1 px-2.5"
                >
                  <Clock className="h-3.5 w-3.5" /> Pending Signature
                </Badge>
              )}
            </div>
          </div>

          {/* Agreement Version History Selector */}
          {agreements.length > 1 && (
            <div className="flex items-center gap-2 pt-2 text-xs">
              <History className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium text-[11px]">Agreement Versions:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {agreements.map((a, idx) => {
                  const isSelected = (activeAgreement?.id || '') === a.id;
                  const isVerSigned = a.status === 'SIGNED';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgreementId(a.id);
                        setTermsText(a.terms);
                      }}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
                      }`}
                    >
                      v{idx + 1} {isVerSigned ? '✓ (Signed)' : '(Draft)'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Agreement Document Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1 text-xs">
          {/* Metadata Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-[11px]">
            <div>
              <span className="text-slate-500 block">Resident</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {tenant?.name || tenant?.firstName}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Allotment</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Room {tenant?.roomNumber || '—'} (Bed {tenant?.bedNumber || '—'})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Monthly Rent</span>
              <span className="font-bold text-indigo-600">
                {formatCurrency(tenant?.rent || 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Security Deposit</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatCurrency(tenant?.securityDeposit || tenant?.deposit || 0)}
              </span>
            </div>
          </div>

          {/* Terms Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                Agreement Terms &amp; Conditions
                {isSigned ? (
                  <span className="text-[10px] text-emerald-600 font-normal flex items-center gap-1">
                    <Lock className="h-3 w-3 text-emerald-600" /> (Legally Verified Record)
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-normal">
                    (Pending Resident Signature)
                  </span>
                )}
              </Label>
            </div>

            <div className="p-4 rounded-xl bg-card border border-slate-200 dark:border-slate-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300 max-h-[260px] overflow-y-auto shadow-inner">
              {termsText}
            </div>
          </div>

          {/* Signed Status or Checkbox Signing Section */}
          {isSigned ? (
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3">
              <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                  Legally Acknowledged &amp; Signed via Digital Checkbox
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Signatory: <strong>{tenant?.name || tenant?.firstName}</strong> (Phone:{' '}
                  {tenant?.phone || tenant?.mobile}) · Verified on{' '}
                  {formatDateTime(
                    activeAgreement?.signedAt ||
                      tenant?.agreementAcceptedAt ||
                      new Date()
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-3">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="agree-checkbox"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(Boolean(checked))}
                  className="mt-0.5 rounded-md border-indigo-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <label
                  htmlFor="agree-checkbox"
                  className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-normal cursor-pointer select-none"
                >
                  I have read, understood, and agree to the{' '}
                  <strong>Terms &amp; Conditions, House Rules, Notice Period,</strong> and
                  financial policies outlined in this tenancy agreement.
                </label>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/30 text-[11px] text-slate-500">
                <span>Signatory: {tenant?.name || tenant?.firstName}</span>
                <span>Date: {formatDate(new Date())}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-2 pt-3 border-t">
          {/* Print / Save PDF Button -> Generates clean standalone agreement document */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintOnlyAgreement}
            className="rounded-xl h-9 text-xs font-semibold gap-1.5 w-full sm:w-auto text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/40"
          >
            <Printer className="h-3.5 w-3.5" /> Print / Save PDF
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-9 text-xs font-semibold flex-1 sm:flex-none"
            >
              Close
            </Button>

            {!isSigned && (
              <Button
                type="button"
                size="sm"
                disabled={!agreedToTerms || signMutation.isPending}
                onClick={() => signMutation.mutate()}
                className="rounded-xl h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 flex-1 sm:flex-none shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {signMutation.isPending ? 'Signing...' : 'Acknowledge & Sign Agreement'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
