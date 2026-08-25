import React, { useState, useEffect } from 'react';
import {
  X,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  Zap,
  Sparkles,
  Wrench,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import api from '@/lib/api';

interface CheckoutSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName?: string;
  onSuccess?: () => void;
}

export const CheckoutSettlementModal: React.FC<CheckoutSettlementModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [checkOutDate, setCheckOutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [noticeDate, setNoticeDate] = useState<string>('');
  const [requiredNoticeDays, setRequiredNoticeDays] = useState<number>(30);
  const [damageCharges, setDamageCharges] = useState<number>(0);
  const [cleaningFee, setCleaningFee] = useState<number>(500);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [reason, setReason] = useState<string>('Standard Lease End Checkout');

  // Refund Beneficiary
  const [refundUpi, setRefundUpi] = useState<string>('');
  const [refundAccountNumber, setRefundAccountNumber] = useState<string>('');
  const [refundIfsc, setRefundIfsc] = useState<string>('');
  const [refundBankName, setRefundBankName] = useState<string>('');

  // Live Math Preview Data
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchSettlementPreview();
    }
  }, [isOpen, tenantId, checkOutDate, noticeDate, requiredNoticeDays, damageCharges, cleaningFee, otherDeductions]);

  const fetchSettlementPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/check-outs/settlement-preview/${tenantId}`, {
        checkOutDate,
        noticeDate: noticeDate || null,
        requiredNoticeDays,
        damageCharges,
        cleaningFee,
        otherDeductions,
        refundUpi,
        refundAccountNumber,
        refundIfsc,
        refundBankName
      });
      setPreview(res.data);
      if (!refundUpi && res.data.beneficiaryUpi) setRefundUpi(res.data.beneficiaryUpi);
      if (!refundAccountNumber && res.data.beneficiaryAccount) setRefundAccountNumber(res.data.beneficiaryAccount);
      if (!refundIfsc && res.data.beneficiaryIfsc) setRefundIfsc(res.data.beneficiaryIfsc);
      if (!refundBankName && res.data.beneficiaryBank) setRefundBankName(res.data.beneficiaryBank);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to calculate settlement preview');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/check-outs/execute-settlement/${tenantId}`, {
        checkOutDate,
        noticeDate: noticeDate || null,
        requiredNoticeDays,
        damageCharges,
        cleaningFee,
        otherDeductions,
        reason,
        refundUpi,
        refundAccountNumber,
        refundIfsc,
        refundBankName
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Checkout settlement execution failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">1-Click Checkout & Deposit Settlement</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Automated Math
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Settles pending rent, utilities, notice shortfalls, and prepares refund or exit invoices.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tenant Quick Info */}
          {preview && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold">Tenant Name</div>
                <div className="text-base font-extrabold text-slate-900">{preview.tenantName || tenantName}</div>
                <div className="text-xs text-slate-500">Mobile: {preview.mobile}</div>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Assigned Room</div>
                  <div className="text-sm font-bold text-slate-800">Room {preview.roomNumber || '-'} (Bed {preview.bedNumber || '-'})</div>
                </div>
                <div className="h-8 w-[1px] bg-slate-200 my-auto" />
                <div className="text-right">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Original Deposit</div>
                  <div className="text-sm font-black text-indigo-600">₹{preview.depositPaid}</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Settlement Inputs */}
            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pb-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                1. Dates & Notice Period
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Check-Out Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notice Served Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    value={noticeDate}
                    onChange={(e) => setNoticeDate(e.target.value)}
                  />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pt-3 pb-2">
                <Wrench className="h-4 w-4 text-amber-600" />
                2. Deductions & Asset Damage
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Damage Repair (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                    value={damageCharges}
                    onChange={(e) => setDamageCharges(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Deep Cleaning (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                    value={cleaningFee}
                    onChange={(e) => setCleaningFee(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Other Misc (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-800"
                    value={otherDeductions}
                    onChange={(e) => setOtherDeductions(Number(e.target.value))}
                  />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b pt-3 pb-2">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                3. Refund Beneficiary Destination
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">UPI ID (VPA)</label>
                  <input
                    type="text"
                    placeholder="tenant@okaxis"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={refundUpi}
                    onChange={(e) => setRefundUpi(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank Account No.</label>
                  <input
                    type="text"
                    placeholder="Account Number"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={refundAccountNumber}
                    onChange={(e) => setRefundAccountNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="HDFC0001234"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                    value={refundIfsc}
                    onChange={(e) => setRefundIfsc(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="HDFC Bank"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={refundBankName}
                    onChange={(e) => setRefundBankName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Formula Breakdown */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-5 rounded-2xl text-white shadow-lg space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Settlement Calculation</span>
                  {loading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />}
                </div>

                {preview && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">Security Deposit Paid:</span>
                      <span className="font-bold text-emerald-400 font-mono">+₹{preview.depositPaid}</span>
                    </div>

                    {preview.pendingRentDue > 0 && (
                      <div className="flex justify-between items-center text-rose-300">
                        <span>Unpaid Monthly Rent:</span>
                        <span className="font-bold font-mono">-₹{preview.pendingRentDue}</span>
                      </div>
                    )}

                    {preview.pendingUtilityDue > 0 && (
                      <div className="flex justify-between items-center text-amber-300">
                        <span>Unpaid Electricity & Utilities:</span>
                        <span className="font-bold font-mono">-₹{preview.pendingUtilityDue}</span>
                      </div>
                    )}

                    {preview.damageCharges > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Damage Repair Fee:</span>
                        <span className="font-bold text-rose-400 font-mono">-₹{preview.damageCharges}</span>
                      </div>
                    )}

                    {preview.cleaningFee > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Deep Cleaning Fee:</span>
                        <span className="font-bold text-rose-400 font-mono">-₹{preview.cleaningFee}</span>
                      </div>
                    )}

                    {preview.noticePeriodPenalty > 0 && (
                      <div className="flex justify-between items-center text-rose-300">
                        <span>Notice Shortfall Penalty:</span>
                        <span className="font-bold font-mono">-₹{preview.noticePeriodPenalty}</span>
                      </div>
                    )}

                    {preview.otherDeductions > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Other Deductions:</span>
                        <span className="font-bold text-rose-400 font-mono">-₹{preview.otherDeductions}</span>
                      </div>
                    )}

                    <div className="h-[1px] bg-white/10 my-2" />

                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-400">Total Deductions:</span>
                      <span className="text-rose-400 font-mono">₹{preview.totalDeductions}</span>
                    </div>

                    {/* Net Result Card */}
                    <div className={`p-4 rounded-xl mt-3 flex items-center justify-between border ${
                      preview.isTenantOwingMoney 
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-200' 
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                    }`}>
                      <div>
                        <div className="text-[11px] uppercase font-bold tracking-wider">
                          {preview.isTenantOwingMoney ? 'Tenant Deficit Owed' : 'Net Refund Payable to Tenant'}
                        </div>
                        <div className="text-xs text-white/70">
                          {preview.isTenantOwingMoney 
                            ? 'Will automatically generate a final exit invoice' 
                            : 'Logged in refund ledger for 1-click payout approval'}
                        </div>
                      </div>
                      <div className={`text-2xl font-black font-mono ${preview.isTenantOwingMoney ? 'text-rose-300' : 'text-emerald-300'}`}>
                        ₹{preview.isTenantOwingMoney ? preview.amountOwedByTenant : preview.netPayableRefund}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic System Actions Notice */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-900 text-xs space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  Automatic Actions upon Confirmation:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-800">
                  <li>Tenant status updated to <span className="font-semibold text-slate-800">CHECKED_OUT</span>.</li>
                  <li>Assigned Bed automatically freed and marked <span className="font-semibold text-emerald-700">AVAILABLE</span>.</li>
                  <li>All pending unpaid invoices marked settled against deposit.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteCheckout}
            disabled={submitting || loading || !preview}
            className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Executing Settlement...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirm & Execute Checkout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSettlementModal;
