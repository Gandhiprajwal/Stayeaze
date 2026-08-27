import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [waiveNoticePenalty, setWaiveNoticePenalty] = useState<boolean>(false);
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
  }, [isOpen, tenantId, checkOutDate, noticeDate, requiredNoticeDays, waiveNoticePenalty, damageCharges, cleaningFee, otherDeductions]);

  const fetchSettlementPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/check-outs/settlement-preview/${tenantId}`, {
        checkOutDate,
        noticeDate: noticeDate || null,
        requiredNoticeDays,
        waiveNoticePenalty,
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
        waiveNoticePenalty,
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">1-Click Checkout & Deposit Settlement</h2>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Automated Math
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/70">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs shadow-sm">
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Tenant Quick Info Card */}
          {preview && (
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                  {(preview.tenantName || tenantName || 'T').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tenant Profile</div>
                  <div className="text-sm font-extrabold text-slate-900 leading-tight">{preview.tenantName || tenantName}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">📱 {preview.mobile || '-'}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Assigned Bed</div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono text-[11px]">
                      Room {preview.roomNumber || '-'}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-mono text-[11px]">
                      Bed {preview.bedNumber || '-'}
                    </span>
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-slate-200" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Security Deposit</div>
                  <div className="text-sm font-extrabold text-emerald-600 font-mono mt-0.5">
                    ₹{Number(preview.depositPaid || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Settlement Inputs (7 cols) */}
            <div className="lg:col-span-7 space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              {/* Section 1: Dates */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Dates & Notice Period</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Check-Out Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-semibold text-slate-800 bg-slate-50/50"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Notice Served Date</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <input
                      type="date"
                      disabled={waiveNoticePenalty}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-semibold text-slate-800 bg-slate-50/50 disabled:opacity-50 disabled:bg-slate-100"
                      value={noticeDate}
                      onChange={(e) => setNoticeDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Owner Notice Waiver Toggle */}
                <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100/80 transition-all">
                  <label htmlFor="waiveNoticeToggle" className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="waiveNoticeToggle"
                      checked={waiveNoticePenalty}
                      onChange={(e) => setWaiveNoticePenalty(e.target.checked)}
                      className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Waive Notice Shortfall Penalty</span>
                      <span className="text-[10px] text-slate-500 block">Exempt resident from 30-day notice deductions (Owner Discretion)</span>
                    </div>
                  </label>
                  {waiveNoticePenalty && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/90 border border-emerald-300/60 px-2.5 py-0.5 rounded-full shrink-0 shadow-xs">
                      Penalty: ₹0
                    </span>
                  )}
                </div>
              </div>

              {/* Section 2: Deductions */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3 pt-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Deductions & Asset Damage</h3>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Damage Repair</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full pl-6 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800 bg-slate-50/50"
                        value={damageCharges || ''}
                        onChange={(e) => setDamageCharges(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Deep Cleaning</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="500"
                        className="w-full pl-6 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800 bg-slate-50/50"
                        value={cleaningFee || ''}
                        onChange={(e) => setCleaningFee(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Other Misc</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full pl-6 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800 bg-slate-50/50"
                        value={otherDeductions || ''}
                        onChange={(e) => setOtherDeductions(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Beneficiary Details */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3 pt-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Refund Beneficiary Destination</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">UPI ID (VPA)</label>
                    <input
                      type="text"
                      placeholder="e.g. tenant@okaxis"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 bg-slate-50/50"
                      value={refundUpi}
                      onChange={(e) => setRefundUpi(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="Account Number"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 bg-slate-50/50"
                      value={refundAccountNumber}
                      onChange={(e) => setRefundAccountNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase font-mono font-medium text-slate-800 bg-slate-50/50"
                      value={refundIfsc}
                      onChange={(e) => setRefundIfsc(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800 bg-slate-50/50"
                      value={refundBankName}
                      onChange={(e) => setRefundBankName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Formula Breakdown (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-xl border border-indigo-900/40 space-y-3.5">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Settlement Calculation</span>
                  </div>
                  {loading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />}
                </div>

                {preview && (
                  <div className="space-y-2.5 text-xs">
                    {/* Security Deposit Paid */}
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-slate-300 font-medium">Security Deposit Paid:</span>
                      <span className="font-extrabold text-emerald-400 font-mono text-sm">
                        +₹{Number(preview.depositPaid || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Advance Balance Credit (Multi-Month / Rolling Advance) */}
                    {Number(preview.advanceBalance) > 0 && (
                      <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                        <span className="font-semibold flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Advance Rent Balance Credit:
                        </span>
                        <span className="font-extrabold font-mono text-sm">
                          +₹{Number(preview.advanceBalance).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}

                    {/* Current Month Rent Consumption & Prepaid Credit Breakdown */}
                    {preview.monthlyRent > 0 && (
                      <div className="p-3 rounded-xl bg-indigo-950/70 border border-indigo-500/30 space-y-1.5 text-[11px] shadow-inner">
                        <div className="flex justify-between items-center text-slate-200 font-semibold">
                          <span>Current Month Rent Cycle:</span>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            preview.isCurrentMonthRentPaid 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {preview.isCurrentMonthRentPaid 
                              ? `Paid (₹${Number(preview.monthlyRent).toLocaleString('en-IN')})` 
                              : `Unpaid (₹${Number(preview.monthlyRent).toLocaleString('en-IN')})`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400">
                          <span>Stayed / Consumed ({preview.stayedDaysInMonth}/{preview.daysInMonth} days):</span>
                          <span className="font-mono text-slate-300 font-semibold">
                            ₹{Number(preview.consumedRent || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {preview.isCurrentMonthRentPaid && preview.unconsumedPrepaidRent > 0 && (
                          <div className="flex justify-between items-center text-emerald-300 font-semibold pt-1 border-t border-indigo-500/20">
                            <span>Prepaid Rent Credit ({preview.unconsumedDaysInMonth} unused days):</span>
                            <span className="font-mono font-bold">
                              +₹{Number(preview.unconsumedPrepaidRent || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Deductions breakdown */}
                    {preview.pendingRentDue > 0 && (
                      <div className="flex justify-between items-center text-rose-300">
                        <span>Unpaid Prior Monthly Rent:</span>
                        <span className="font-bold font-mono">-₹{Number(preview.pendingRentDue).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    {preview.pendingUtilityDue > 0 && (
                      <div className="flex justify-between items-center text-amber-300">
                        <span>Unpaid Electricity & Utilities:</span>
                        <span className="font-bold font-mono">-₹{Number(preview.pendingUtilityDue).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    {preview.damageCharges > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Damage Repair Fee:</span>
                        <span className="font-bold text-rose-400 font-mono">-₹{Number(preview.damageCharges).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    {preview.cleaningFee > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Deep Cleaning Fee:</span>
                        <span className="font-bold text-rose-400 font-mono">-₹{Number(preview.cleaningFee).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    {preview.waiveNoticePenalty && (
                      <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex justify-between items-center text-[11px] text-indigo-300">
                        <span>Notice Shortfall Penalty:</span>
                        <span className="font-bold font-mono text-emerald-400">₹0 (Waived by Owner)</span>
                      </div>
                    )}

                    {!preview.waiveNoticePenalty && preview.grossNoticePenalty > 0 && (
                      <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 space-y-1 text-[11px]">
                        <div className="flex justify-between items-center text-rose-300 font-semibold">
                          <span>Notice Shortfall Penalty ({preview.noticePeriodShortfallDays} days):</span>
                          <span className="font-bold font-mono">-₹{Number(preview.grossNoticePenalty).toLocaleString('en-IN')}</span>
                        </div>
                        {preview.noticePrepaidOffset > 0 && (
                          <div className="flex justify-between items-center text-emerald-300 text-[10px]">
                            <span>↳ Offset by Prepaid Rent Credit (Anti-Double Charge):</span>
                            <span className="font-mono font-bold">+₹{Number(preview.noticePrepaidOffset).toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center font-bold text-rose-200 pt-1 border-t border-rose-500/20">
                          <span>Net Notice Deduction from Deposit:</span>
                          <span className="font-mono">-₹{Number(preview.netNoticePenalty).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    )}

                    {preview.otherDeductions > 0 && (
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Other Deductions:</span>
                        <span className="font-bold text-rose-400 font-mono">-₹{Number(preview.otherDeductions).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    <div className="h-[1px] bg-white/10 my-2" />

                    <div className="flex justify-between items-center font-bold">
                      <span className="text-slate-400">Total Deductions:</span>
                      <span className="text-rose-400 font-mono">₹{Number(preview.totalDeductions || 0).toLocaleString('en-IN')}</span>
                    </div>

                    {/* Net Result Card */}
                    <div className={`p-4 rounded-xl mt-3 flex items-center justify-between border shadow-lg ${
                      preview.isTenantOwingMoney 
                        ? 'bg-rose-950/60 border-rose-500/50 text-rose-200' 
                        : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    }`}>
                      <div>
                        <div className="text-[11px] uppercase font-extrabold tracking-wider">
                          {preview.isTenantOwingMoney ? 'Tenant Deficit Owed' : 'Net Refund Payable to Tenant'}
                        </div>
                        <div className="text-[11px] text-white/70 mt-0.5">
                          {preview.isTenantOwingMoney 
                            ? 'Will automatically generate a final exit invoice' 
                            : 'Logged in refund ledger for 1-click payout approval'}
                        </div>
                      </div>
                      <div className={`text-2xl font-black font-mono tracking-tight ${preview.isTenantOwingMoney ? 'text-rose-300' : 'text-emerald-300'}`}>
                        ₹{Number(preview.isTenantOwingMoney ? preview.amountOwedByTenant : preview.netPayableRefund).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic System Actions Notice */}
              <div className="bg-amber-50/90 border border-amber-200/80 p-4 rounded-2xl text-amber-900 text-xs space-y-1.5 shadow-sm">
                <div className="font-bold flex items-center gap-1.5 text-amber-950">
                  <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                  Automatic Actions upon Confirmation:
                </div>
                <ul className="list-disc pl-4 space-y-1 text-amber-900/90 font-medium text-[11px]">
                  <li>Tenant status updated to <span className="font-bold text-slate-900">CHECKED_OUT</span>.</li>
                  <li>Assigned Bed automatically freed and marked <span className="font-bold text-emerald-700">AVAILABLE</span>.</li>
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
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExecuteCheckout}
            disabled={submitting || loading || !preview}
            className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-700 rounded-xl transition-all shadow-md hover:shadow-indigo-500/25 flex items-center gap-2 disabled:opacity-50 active:scale-95"
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
    </div>,
    document.body
  );
};

export default CheckoutSettlementModal;
