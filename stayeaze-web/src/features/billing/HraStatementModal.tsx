import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Printer,
  FileCheck,
  Building2,
  Calendar,
  CreditCard,
  ShieldCheck,
  Wallet,
  Download,
  CheckCircle2,
  Receipt,
  User,
  MapPin
} from 'lucide-react';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

interface HraStatementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName?: string;
}

export const HraStatementModal: React.FC<HraStatementModalProps> = ({
  open,
  onOpenChange,
  tenantId,
  tenantName,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | undefined>(currentYear);

  const { data: statement, isLoading } = useQuery({
    queryKey: ['tenant-financial-statement', tenantId, selectedYear],
    queryFn: async () => {
      const url = selectedYear
        ? `/tenants/${tenantId}/financial-statement?year=${selectedYear}`
        : `/tenants/${tenantId}/financial-statement`;
      const res = await api.get(url);
      return res.data;
    },
    enabled: open && !!tenantId,
  });

  const handlePrint = () => {
    const printContent = document.getElementById('hra-statement-print-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>HRA_Rent_Statement_${statement?.tenantName || 'Resident'}_${statement?.financialYear || ''}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .title { font-size: 18px; font-weight: 800; text-transform: uppercase; color: #1e1b4b; }
            .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              background: #e0e7ff;
              color: #3730a3;
              font-weight: 700;
              border-radius: 4px;
              font-size: 11px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 16px;
            }
            .card {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px 12px;
              background: #f8fafc;
            }
            .card-title {
              font-size: 10px;
              text-transform: uppercase;
              font-weight: 700;
              color: #475569;
              margin-bottom: 6px;
              border-bottom: 1px dashed #cbd5e1;
              padding-bottom: 3px;
            }
            .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .label { color: #64748b; font-size: 11px; }
            .value { font-weight: 600; font-size: 11px; }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
            }
            .table th {
              background: #0f172a;
              color: #ffffff;
              text-align: left;
              padding: 6px 8px;
              font-size: 10px;
              text-transform: uppercase;
            }
            .table td {
              border-bottom: 1px solid #e2e8f0;
              padding: 6px 8px;
              font-size: 11px;
            }
            .table tr:nth-child(even) td { background: #f8fafc; }
            .total-row td {
              font-weight: 800;
              border-top: 2px solid #0f172a;
              background: #eef2ff !important;
            }
            .footer {
              margin-top: 24px;
              border-top: 1px solid #cbd5e1;
              padding-top: 12px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 10px;
              color: #64748b;
            }
            .sign-box {
              text-align: center;
              border-top: 1px solid #0f172a;
              width: 180px;
              padding-top: 4px;
              font-weight: 700;
              color: #0f172a;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-950 dark:text-indigo-100">
              <FileCheck className="h-5 w-5 text-indigo-600" />
              Annual Rent Ledger & HRA Proof Certificate
            </DialogTitle>
            <DialogDescription className="text-xs mt-0.5">
              Certified annual tenancy statement for Income Tax HRA Exemption (Section 10(13A)) & audit records.
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedYear || ''}
              onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : undefined)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-900 shadow-xs"
            >
              <option value={currentYear}>FY {currentYear - 1}–{String(currentYear).substring(2)} (Current)</option>
              <option value={currentYear - 1}>FY {currentYear - 2}–{String(currentYear - 1).substring(2)} (Previous)</option>
              <option value="">All-Time Tenancy</option>
            </select>
            <Button
              size="sm"
              onClick={handlePrint}
              disabled={isLoading || !statement}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground animate-pulse">
            Loading certified financial statement...
          </div>
        ) : !statement ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No statement data found for this tenant.
          </div>
        ) : (
          <div id="hra-statement-print-area" className="space-y-6 pt-2">
            {/* Header Banner */}
            <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4">
              <div>
                <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">
                  Form 12BB Proof Document
                </span>
                <h2 className="text-xl font-extrabold text-slate-950 dark:text-white mt-1">
                  ANNUAL RENT PAYMENT & HRA STATEMENT
                </h2>
                <p className="text-xs text-slate-500">
                  Statement ID: <span className="font-mono font-bold text-slate-800">{statement.statementNumber}</span> • Issued: {formatDate(statement.generatedDate)}
                </p>
              </div>
              <div className="text-right">
                <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1">
                  {statement.financialYear}
                </Badge>
              </div>
            </div>

            {/* Entity Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Resident / Tenant Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-600" /> Resident (Tenant) Details
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Full Name:</span><span className="font-bold text-slate-900">{statement.tenantName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Mobile / Email:</span><span className="font-medium text-slate-800">{statement.mobile} {statement.email ? `• ${statement.email}` : ''}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Room & Bed:</span><span className="font-bold text-indigo-700">Room {statement.roomNumber || '—'}, Bed {statement.bedNumber || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Lease Period:</span><span className="font-medium text-slate-800">{formatDate(statement.leaseStart)} to {statement.leaseEnd ? formatDate(statement.leaseEnd) : 'Ongoing'}</span></div>
                </div>
              </div>

              {/* Landlord / Facility Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-indigo-600" /> Landlord / Property Details
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Legal Entity:</span><span className="font-bold text-slate-900">{statement.landlordLegalName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Landlord PAN:</span><span className="font-mono font-bold text-indigo-900">{statement.landlordPan || 'AVAILABLE ON FILE'}</span></div>
                  {statement.landlordGstin && (
                    <div className="flex justify-between"><span className="text-slate-500">GSTIN:</span><span className="font-mono font-semibold text-slate-800">{statement.landlordGstin}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-slate-500">Premises Address:</span><span className="font-medium text-slate-800 text-right max-w-[200px] truncate">{statement.propertyName}, {statement.propertyAddress || 'India'}</span></div>
                </div>
              </div>
            </div>

            {/* Financial Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/60">
                <span className="text-[10px] font-bold uppercase text-indigo-800">Agreed Rent</span>
                <p className="text-lg font-extrabold text-indigo-950 font-mono mt-0.5">{formatCurrency(statement.monthlyRent)}<span className="text-xs font-normal">/mo</span></p>
              </div>
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <span className="text-[10px] font-bold uppercase text-emerald-800">Total Rent Paid</span>
                <p className="text-lg font-extrabold text-emerald-700 font-mono mt-0.5">{formatCurrency(statement.totalRentPaid)}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] font-bold uppercase text-slate-600">Security Deposit</span>
                <p className="text-lg font-extrabold text-slate-800 font-mono mt-0.5">{formatCurrency(statement.securityDepositPaid)}</p>
              </div>
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <span className="text-[10px] font-bold uppercase text-emerald-800">Advance Credit</span>
                <p className="text-lg font-extrabold text-emerald-700 font-mono mt-0.5">{formatCurrency(statement.advanceWalletBalance)}</p>
              </div>
            </div>

            {/* Itemized Invoices & Payments Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Itemized Rental Ledger & Payment Receipts
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Invoice</th>
                      <th className="py-2.5 px-3 text-left">Period / Description</th>
                      <th className="py-2.5 px-3 text-left">Issue Date</th>
                      <th className="py-2.5 px-3 text-right">Billed</th>
                      <th className="py-2.5 px-3 text-right">Paid</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(statement.invoices || []).map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono font-medium text-indigo-600">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-3 text-slate-700">{inv.description}</td>
                        <td className="py-2.5 px-3 text-slate-600">{formatDate(inv.issueDate)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">{formatCurrency(inv.amountDue)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(inv.amountPaid)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50/80 font-bold border-t-2 border-slate-900">
                      <td colSpan={3} className="py-3 px-3 text-indigo-950 font-extrabold uppercase">
                        Total Rent Settled & Certified
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                        {formatCurrency(statement.totalRentBilled)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700">
                        {formatCurrency(statement.totalRentPaid)}
                      </td>
                      <td className="py-3 px-3 text-center text-emerald-700 text-xs font-extrabold">
                        ✓ VERIFIED
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Declaration & Digital Signatures */}
            <div className="pt-6 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
              <div className="space-y-1 max-w-md text-[11px]">
                <p className="font-semibold text-slate-700">Landlord Declaration (Section 10(13A)):</p>
                <p>
                  This certifies that the above rental payments have been fully received from the tenant for the specified accommodation during {statement.financialYear}.
                </p>
              </div>
              <div className="text-center space-y-1">
                <div className="w-44 border-t-2 border-slate-900 pt-1 font-bold text-slate-900 text-xs">
                  Authorized Signatory
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Digitally Certified via StayEaze</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
