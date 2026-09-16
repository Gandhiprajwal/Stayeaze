import React, { useState, useEffect, useRef } from 'react';
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
  UserCheck,
  ShieldAlert,
  Send,
  Lock
} from 'lucide-react';
import api from '@/lib/api';
import NoDuesCertificateModal from './NoDuesCertificateModal';

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
  const [expectedCheckoutDate, setExpectedCheckoutDate] = useState<string>('');
  const [overstayMultiplier, setOverstayMultiplier] = useState<number>(1.0);
  const [waiveOverstayPenalty, setWaiveOverstayPenalty] = useState<boolean>(false);
  const [noticeDate, setNoticeDate] = useState<string>('');
  const [requiredNoticeDays, setRequiredNoticeDays] = useState<number>(30);
  const [waiveNoticePenalty, setWaiveNoticePenalty] = useState<boolean>(false);
  const [bedTurnoverStatus, setBedTurnoverStatus] = useState<string>('NEEDS_CLEANING');

  // Lock-In Period Enforcement (P3.3)
  const [lockInMonths, setLockInMonths] = useState<number>(3);
  const [waiveLockInPenalty, setWaiveLockInPenalty] = useState<boolean>(false);

  // Asset Inspection Checklist (P2.1)
  const [lostRoomKey, setLostRoomKey] = useState<boolean>(false);
  const [lostBiometricCard, setLostBiometricCard] = useState<boolean>(false);
  const [lostRemote, setLostRemote] = useState<boolean>(false);
  const [deepCleaningRequired, setDeepCleaningRequired] = useState<boolean>(false);

  // Interim Electricity Meter Split (P2.3)
  const [currentMeterReading, setCurrentMeterReading] = useState<string>('');
  const [previousMeterReading, setPreviousMeterReading] = useState<string>('');
  const [perUnitRate, setPerUnitRate] = useState<number>(10.0);
  const [activeRoommates, setActiveRoommates] = useState<number>(1);

  // Custom Input Deductions
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

  // Sensitive Payout Double Confirmation Security Guard (P3)
  const [showPayoutGuard, setShowPayoutGuard] = useState<boolean>(false);
  const [payoutAuthorizedChecked, setPayoutAuthorizedChecked] = useState<boolean>(false);

  // Post-Checkout No-Dues Certificate State (P3)
  const [completedCheckOutId, setCompletedCheckOutId] = useState<string | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const initializedPolicyRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      initializedPolicyRef.current = false;
    }
  }, [isOpen, tenantId]);

  useEffect(() => {
    if (isOpen && tenantId) {
      fetchSettlementPreview();
    }
  }, [
    isOpen,
    tenantId,
    checkOutDate,
    expectedCheckoutDate,
    overstayMultiplier,
    waiveOverstayPenalty,
    noticeDate,
    requiredNoticeDays,
    waiveNoticePenalty,
    lockInMonths,
    waiveLockInPenalty,
    lostRoomKey,
    lostBiometricCard,
    lostRemote,
    deepCleaningRequired,
    currentMeterReading,
    previousMeterReading,
    perUnitRate,
    activeRoommates,
    damageCharges,
    cleaningFee,
    otherDeductions
  ]);

  const fetchSettlementPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/check-outs/settlement-preview/${tenantId}`, {
        checkOutDate,
        expectedCheckoutDate: expectedCheckoutDate || null,
        overstayMultiplier,
        waiveOverstayPenalty,
        noticeDate: noticeDate || null,
        requiredNoticeDays,
        waiveNoticePenalty,
        lockInMonths,
        waiveLockInPenalty,
        lostRoomKey,
        lostBiometricCard,
        lostRemote,
        deepCleaningRequired,
        currentMeterReading: currentMeterReading ? Number(currentMeterReading) : null,
        previousMeterReading: previousMeterReading ? Number(previousMeterReading) : null,
        perUnitRate,
        activeRoommates,
        damageCharges,
        cleaningFee,
        otherDeductions,
        refundUpi,
        refundAccountNumber,
        refundIfsc,
        refundBankName
      });
      setPreview(res.data);
      if (!initializedPolicyRef.current && res.data) {
        if (res.data.lockInMonths !== undefined && res.data.lockInMonths !== null) setLockInMonths(res.data.lockInMonths);
        if (res.data.requiredNoticeDays !== undefined && res.data.requiredNoticeDays !== null) setRequiredNoticeDays(res.data.requiredNoticeDays);
        if (res.data.cleaningFee !== undefined && res.data.cleaningFee !== null) setCleaningFee(Number(res.data.cleaningFee));
        if (res.data.perUnitRate !== undefined && res.data.perUnitRate !== null) setPerUnitRate(Number(res.data.perUnitRate));
        initializedPolicyRef.current = true;
      }
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

  const handleInitialClick = () => {
    // If there is a net refund payout, show Double Confirmation Security Guard first!
    if (preview && Number(preview.netPayableRefund) > 0) {
      setShowPayoutGuard(true);
    } else {
      handleExecuteCheckout();
    }
  };

  const handleExecuteCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/check-outs/execute-settlement/${tenantId}`, {
        checkOutDate,
        expectedCheckoutDate: expectedCheckoutDate || null,
        overstayMultiplier,
        waiveOverstayPenalty,
        noticeDate: noticeDate || null,
        requiredNoticeDays,
        waiveNoticePenalty,
        lockInMonths,
        waiveLockInPenalty,
        bedTurnoverStatus,
        lostRoomKey,
        lostBiometricCard,
        lostRemote,
        deepCleaningRequired,
        currentMeterReading: currentMeterReading ? Number(currentMeterReading) : null,
        previousMeterReading: previousMeterReading ? Number(previousMeterReading) : null,
        perUnitRate,
        activeRoommates,
        damageCharges,
        cleaningFee,
        otherDeductions,
        reason,
        refundUpi,
        refundAccountNumber,
        refundIfsc,
        refundBankName
      });

      setShowPayoutGuard(false);
      if (res.data?.checkOutId) {
        setCompletedCheckOutId(res.data.checkOutId);
        setShowCertificateModal(true);
      } else {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Checkout settlement execution failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen && !showCertificateModal) return null;

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
                  P2 Suite Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Overstay tracking, asset loss checklists, interim electricity splits, and deposit refund reconciliation.
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
              {/* Section 1: Dates & Overstay */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Dates, Notice & Overstay</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      <label className="block text-xs font-semibold text-slate-700">Agreed Vacate Date</label>
                      <span className="text-[10px] text-slate-400">Lease/Agreed</span>
                    </div>
                    <input
                      type="date"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-semibold text-slate-800 bg-slate-50/50"
                      value={expectedCheckoutDate}
                      onChange={(e) => setExpectedCheckoutDate(e.target.value)}
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

                {/* Overstay Warning & Controls (P2) */}
                {preview && preview.overstayDays > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Overstay Detected: {preview.overstayDays} days past agreed date
                      </span>
                      <span className="text-[10px] font-extrabold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full font-mono">
                        Rate: ₹{preview.overstayDailyRate}/day
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 text-xs">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-amber-900">Penalty Multiplier:</label>
                        <select
                          value={overstayMultiplier}
                          onChange={(e) => setOverstayMultiplier(Number(e.target.value))}
                          disabled={waiveOverstayPenalty}
                          className="px-2 py-1 text-xs border border-amber-300 rounded-lg bg-white font-bold text-amber-900 focus:outline-none"
                        >
                          <option value={1.0}>1.0x (Standard Daily Rent)</option>
                          <option value={1.5}>1.5x (Penalty Tier)</option>
                          <option value={2.0}>2.0x (Peak / Strict)</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-amber-950">
                        <input
                          type="checkbox"
                          checked={waiveOverstayPenalty}
                          onChange={(e) => setWaiveOverstayPenalty(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        Waive Overstay Fee
                      </label>
                    </div>
                  </div>
                )}

                {/* Lock-In Period Early Exit Warning & Controls (P3.3) */}
                {preview && preview.isLockInBreached && (
                  <div className="mt-3 p-3 rounded-xl bg-purple-50 border border-purple-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-purple-600" />
                        Minimum Lock-In Early Exit: Stayed {preview.stayedMonths || 0} of {preview.lockInMonths || lockInMonths} months
                      </span>
                      <span className="text-[10px] font-extrabold text-purple-900 bg-purple-200/70 px-2 py-0.5 rounded-full font-mono">
                        Penalty: ₹{preview.lockInBreakDeduction || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-purple-200/60 text-xs">
                      <p className="text-[10px] text-purple-800">
                        Contractual lock-in penalty applied for vacating before lease minimum term.
                      </p>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-purple-950">
                        <input
                          type="checkbox"
                          checked={waiveLockInPenalty}
                          onChange={(e) => setWaiveLockInPenalty(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-purple-400 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        Waive Lock-In Fee
                      </label>
                    </div>
                  </div>
                )}

                {/* Owner Notice Waiver & Bed Turnover Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100/80 transition-all">
                    <label htmlFor="waiveNoticeToggle" className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="waiveNoticeToggle"
                        checked={waiveNoticePenalty}
                        onChange={(e) => setWaiveNoticePenalty(e.target.checked)}
                        className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Waive Notice Shortfall</span>
                        <span className="text-[10px] text-slate-500 block">Exempt from 30-day notice</span>
                      </div>
                    </label>
                    {waiveNoticePenalty && (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/90 border border-emerald-300/60 px-2 py-0.5 rounded-full shrink-0 shadow-xs">
                        ₹0
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Vacated Bed Turnover Status
                    </label>
                    <select
                      value={bedTurnoverStatus}
                      onChange={(e) => setBedTurnoverStatus(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="NEEDS_CLEANING">🧹 Needs Housekeeping (Recommended)</option>
                      <option value="AVAILABLE">✨ Immediate Available for Check-In</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Asset & Key Loss Checklist (P2.1) */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3 pt-2">
                  <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Asset Handover & Key Checklist</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <label className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${lostRoomKey ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">🔑 Room Key</span>
                      <input
                        type="checkbox"
                        checked={lostRoomKey}
                        onChange={(e) => setLostRoomKey(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] mt-1 font-semibold text-rose-600">Lost: -₹300</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${lostBiometricCard ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">🪪 RFID Card</span>
                      <input
                        type="checkbox"
                        checked={lostBiometricCard}
                        onChange={(e) => setLostBiometricCard(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] mt-1 font-semibold text-rose-600">Lost: -₹500</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${lostRemote ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">📺 AC/TV Remote</span>
                      <input
                        type="checkbox"
                        checked={lostRemote}
                        onChange={(e) => setLostRemote(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] mt-1 font-semibold text-rose-600">Lost: -₹1,000</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${deepCleaningRequired ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/70'}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">🧹 Touchup Cleaning</span>
                      <input
                        type="checkbox"
                        checked={deepCleaningRequired}
                        onChange={(e) => setDeepCleaningRequired(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                    <span className="text-[10px] mt-1 font-semibold text-rose-600">Extra: -₹800</span>
                  </label>
                </div>
              </div>

              {/* Section 3: Interim Electricity Meter Reading (P2.3) */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3 pt-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Zap className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Checkout Day Electricity Meter Split</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Current Reading</label>
                    <input
                      type="number"
                      placeholder="e.g. 1450"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-slate-50/50"
                      value={currentMeterReading}
                      onChange={(e) => setCurrentMeterReading(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Previous Reading</label>
                    <input
                      type="number"
                      placeholder="e.g. 1400"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-slate-50/50"
                      value={previousMeterReading}
                      onChange={(e) => setPreviousMeterReading(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Rate / Unit (₹)</label>
                    <input
                      type="number"
                      placeholder="10"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-slate-50/50"
                      value={perUnitRate}
                      onChange={(e) => setPerUnitRate(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Roommates Count</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-slate-800 bg-slate-50/50"
                      value={activeRoommates}
                      onChange={(e) => setActiveRoommates(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Deductions */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3 pt-2">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Other Damage & Cleaning</h3>
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

              {/* Section 5: Beneficiary Details */}
              <div>
                <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100 mb-3 pt-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">5. Refund Beneficiary Destination</h3>
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

                    {/* Overstay Penalty (P2) */}
                    {preview.overstayDays > 0 && (
                      <div className="flex justify-between items-center text-amber-300">
                        <span>Overstay ({preview.overstayDays} days {preview.waiveOverstayPenalty ? 'waived' : `@ ₹${preview.overstayDailyRate}/day`}):</span>
                        <span className="font-bold font-mono">
                          {preview.waiveOverstayPenalty ? '₹0 (Waived)' : `-₹${Number(preview.overstayPenalty).toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    )}

                    {/* Asset Loss & Key Handover Deductions (P2.1) */}
                    {preview.assetDeductions > 0 && (
                      <div className="flex justify-between items-center text-rose-300">
                        <span>Asset Loss / Key Handover:</span>
                        <span className="font-bold font-mono">-₹{Number(preview.assetDeductions).toLocaleString('en-IN')}</span>
                      </div>
                    )}

                    {/* Interim Electricity Split (P2.3) */}
                    {preview.interimUtilitySplit > 0 && (
                      <div className="flex justify-between items-center text-amber-300">
                        <span>Interim Electricity Split ({preview.interimUnitsConsumed} units):</span>
                        <span className="font-bold font-mono">-₹{Number(preview.interimUtilitySplit).toLocaleString('en-IN')}</span>
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
                            ? 'Will automatically generate a RECOVERY invoice' 
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
            onClick={handleInitialClick}
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

      {/* Sensitive Payout Double Confirmation Security Guard Modal (P3) */}
      {showPayoutGuard && preview && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border-2 border-rose-500 overflow-hidden space-y-4 p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider">
                  SECURITY DOUBLE-CONFIRMATION
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  Authorize Real-Time Refund Disbursal
                </h3>
              </div>
            </div>

            {/* Payout Details Card */}
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-inner">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-xs text-slate-300">Exact Refund Payout:</span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  ₹{Number(preview.netPayableRefund || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-xs space-y-1 text-slate-300 font-medium">
                <div>Recipient: <strong className="text-white">{preview.tenantName}</strong></div>
                <div>UPI VPA: <strong className="text-indigo-300 font-mono">{refundUpi || preview.beneficiaryUpi || 'Not Provided'}</strong></div>
                {(refundAccountNumber || preview.beneficiaryAccount) && (
                  <div>Bank A/C: <strong className="text-indigo-300 font-mono">{refundAccountNumber || preview.beneficiaryAccount}</strong> ({refundBankName || preview.beneficiaryBank || 'Bank'})</div>
                )}
              </div>
            </div>

            {/* Irreversible Warning Alert */}
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-xs font-semibold flex gap-2.5 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-snug">
                <strong>Irreversible Action:</strong> You are about to initiate an immediate refund fund transfer from your business payout balance. Once authorized, real money will be disbursed and cannot be recalled.
              </p>
            </div>

            {/* Mandatory Checkbox Confirmation */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={payoutAuthorizedChecked}
                onChange={(e) => setPayoutAuthorizedChecked(e.target.checked)}
                className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 mt-0.5 cursor-pointer"
              />
              <span className="text-xs font-bold text-rose-950 leading-tight">
                I verify that the beneficiary details are accurate and explicitly authorize the immediate transfer of ₹{Number(preview.netPayableRefund || 0).toLocaleString('en-IN')}.
              </span>
            </label>

            {/* Guard Modal Actions */}
            <div className="flex justify-end items-center gap-3 pt-2">
              <button
                onClick={() => setShowPayoutGuard(false)}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Go Back / Review
              </button>
              <button
                onClick={handleExecuteCheckout}
                disabled={submitting || !payoutAuthorizedChecked}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-md flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Disbursing Funds...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Authorize & Disburse Payout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Checkout Instant No-Dues Certificate Modal (P3) */}
      {showCertificateModal && completedCheckOutId && (
        <NoDuesCertificateModal
          isOpen={showCertificateModal}
          checkOutId={completedCheckOutId}
          onClose={() => {
            setShowCertificateModal(false);
            if (onSuccess) onSuccess();
            onClose();
          }}
        />
      )}
    </div>,
    document.body
  );
};

export default CheckoutSettlementModal;
