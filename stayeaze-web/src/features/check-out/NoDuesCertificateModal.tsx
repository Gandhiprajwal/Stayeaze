import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  Share2,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  Award,
  Star,
  ExternalLink,
  MessageCircle,
  Copy,
  Check
} from 'lucide-react';
import api from '@/lib/api';

interface NoDuesCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkOutId: string;
}

export const NoDuesCertificateModal: React.FC<NoDuesCertificateModalProps> = ({
  isOpen,
  onClose,
  checkOutId
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [rating, setRating] = useState<number>(5);
  const [ratingSubmitted, setRatingSubmitted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && checkOutId) {
      setLoading(true);
      api.get(`/check-outs/${checkOutId}/no-dues-certificate`)
        .then((res) => {
          setData(res.data);
        })
        .catch((err) => {
          console.error('Error fetching No-Dues Certificate:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, checkOutId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    if (data?.alumniReferralCode) {
      navigator.clipboard.writeText(data.alumniReferralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleWhatsAppShare = () => {
    if (!data) return;
    const msg = `🎓 *StayEaze No-Dues Clearance Certificate*\n\n` +
      `Resident: *${data.tenantName}*\n` +
      `Room / Bed: *Room ${data.roomNumber} - Bed ${data.bedNumber}*\n` +
      `Certificate No: *${data.certificateNumber}*\n` +
      `Status: *CLEARANCE APPROVED (ALL DUES SETTLED)*\n` +
      `Net Settlement: *₹${Number(data.netRefundAmount || 0).toLocaleString('en-IN')}*\n\n` +
      `🎁 Alumni Referral Code for Friends: *${data.alumniReferralCode}* (₹500 off on first month)\n\n` +
      `Verified by: *${data.organizationName}*`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col my-auto print:max-h-none print:border-none print:shadow-none print:w-full">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="px-5 py-3 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Official No-Dues Clearance Certificate
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  VERIFIED & SIGNED
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Certificate Paper Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white space-y-6 print:p-8 print:overflow-visible">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-500">Generating Official Clearance Certificate...</p>
            </div>
          ) : data ? (
            <div className="border-4 border-double border-slate-300 p-6 sm:p-8 rounded-2xl relative bg-gradient-to-b from-slate-50/40 via-white to-slate-50/40 shadow-inner">
              {/* Background Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
                <ShieldCheck className="w-96 h-96 text-slate-900" />
              </div>

              {/* Certificate Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b-2 border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-indigo-700" />
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                      {data.organizationName}
                    </h1>
                  </div>
                  <p className="text-xs font-medium text-slate-600 mt-1">{data.propertyAddress}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 font-medium">
                    <span>GSTIN: <strong className="font-mono text-slate-700">{data.gstin}</strong></span>
                    <span>•</span>
                    <span>Contact: {data.contactPhone}</span>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-300 sm:pl-6">
                  <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-widest">Document Ref</div>
                  <div className="text-xs font-black font-mono text-indigo-900">{data.certificateNumber}</div>
                  <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Date: {data.issueDate}</div>
                </div>
              </div>

              {/* Certificate Title */}
              <div className="text-center py-6">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black tracking-widest uppercase rounded-full border border-emerald-300">
                  Clearance & Settlement Statement
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-2 tracking-tight">
                  NO-DUES CLEARANCE CERTIFICATE
                </h2>
                <p className="text-xs text-slate-600 max-w-xl mx-auto mt-1 font-medium leading-relaxed">
                  This certifies that the resident named below has formally completed check-out, vacated the premises, and cleared all dues, utility splits, and deposit accounting.
                </p>
              </div>

              {/* Resident Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/80 rounded-xl border border-slate-200 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Resident Name</div>
                  <div className="font-extrabold text-slate-900 text-sm mt-0.5">{data.tenantName}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Room & Bed</div>
                  <div className="font-bold text-indigo-900 mt-0.5">Room {data.roomNumber} (Bed {data.bedNumber})</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Check-In Date</div>
                  <div className="font-bold text-slate-800 mt-0.5">{data.checkInDate}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Vacated Date</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">{data.checkOutDate}</div>
                </div>
              </div>

              {/* Audited Settlement Ledger Table */}
              <div className="mt-6 space-y-2">
                <div className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-slate-700" />
                  Audited Settlement Statement
                </div>

                <div className="rounded-xl border border-slate-300 overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-2.5">Ledger Item & Verification</th>
                        <th className="p-2.5 text-right">Amount (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                      {data.itemizedLedger && data.itemizedLedger.map((item: string, idx: number) => {
                        const isCredit = item.includes('+₹');
                        const isDeduction = item.includes('-₹');
                        return (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="p-2.5 font-medium">{item.replace(/\+₹|\-₹.*/, '')}</td>
                            <td className={`p-2.5 text-right font-mono font-bold ${
                              isCredit ? 'text-emerald-700' : isDeduction ? 'text-rose-700' : 'text-slate-800'
                            }`}>
                              {item.includes('₹') ? item.substring(item.indexOf('₹')) : item}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-900 text-white font-black text-xs">
                        <td className="p-3 uppercase">Net Settlement Amount</td>
                        <td className="p-3 text-right font-mono text-emerald-400 text-sm">
                          ₹{Number(data.netRefundAmount || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Digital Seal & Signatures */}
              <div className="mt-8 pt-6 border-t-2 border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 p-1 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <QrCode className="h-12 w-12 text-slate-800" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-extrabold text-slate-400">Digital Token</div>
                    <div className="text-[11px] font-mono font-bold text-slate-800">{data.verificationHash}</div>
                    <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Digitally Verified
                    </div>
                  </div>
                </div>

                <div className="sm:text-center">
                  <div className="inline-block p-2 rounded-full border-2 border-emerald-600 bg-emerald-50 text-emerald-800 font-black text-[10px] tracking-widest uppercase rotate-[-6deg] shadow-xs">
                    ★ STAYEAZE APPROVED NOC ★
                  </div>
                </div>

                <div className="sm:text-right space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Authorized Signatory</div>
                  <div className="font-serif italic font-bold text-slate-900 text-sm">StayEaze Clearance Cell</div>
                  <div className="text-[10px] text-slate-500 font-medium">Auto-generated Digital Clearance</div>
                </div>
              </div>

              {/* Alumni Referral Card (P3 Enhancement) */}
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 text-white flex flex-wrap justify-between items-center gap-3 print:hidden shadow-md">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Your Lifetime StayEaze Alumni Referral Code</div>
                    <div className="text-[11px] text-slate-300">Share with colleagues or friends: they get ₹500 off, you get ₹500 UPI reward!</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/20">
                  <span className="font-mono font-black text-amber-300 tracking-wider text-xs">{data.alumniReferralCode}</span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1 text-slate-300 hover:text-white transition-colors"
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Exit Rating / Google Review Booster (P3 Enhancement) */}
              <div className="mt-4 p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-wrap justify-between items-center gap-3 print:hidden">
                <div>
                  <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-amber-600 fill-amber-500" />
                    Rate Your Experience with StayEaze
                  </div>
                  <div className="text-[11px] text-amber-800">
                    {ratingSubmitted ? 'Thank you for your rating!' : 'How was your stay with us?'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => {
                        setRating(star);
                        setRatingSubmitted(true);
                      }}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star className={`h-5 w-5 ${star <= rating ? 'text-amber-500 fill-amber-400' : 'text-slate-300'}`} />
                    </button>
                  ))}

                  {rating === 5 && ratingSubmitted && (
                    <a
                      href="https://google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="ml-3 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 flex items-center gap-1 shadow-sm transition-colors"
                    >
                      Post to Google Reviews <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-xs font-medium text-slate-500">
              No certificate record found for this checkout.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NoDuesCertificateModal;
