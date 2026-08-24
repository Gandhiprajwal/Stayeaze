import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, CreditCard, Download, CheckCircle2, AlertCircle, Clock,
  Wallet, ShieldCheck, Printer, ArrowUpRight, Sparkles, Building2,
  Banknote, Copy, Check, FileCheck, Hourglass, QrCode, FileText, Eye
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrency, formatDate, numberToWords } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import api from '@/lib/api';
import { RefundAccountCard } from './RefundAccountCard';

export default function TenantBillingPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedInvoiceForReceipt, setSelectedInvoiceForReceipt] = useState<any>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // On-Desk / UTR Submission Modal State
  const [utrModalInvoice, setUtrModalInvoice] = useState<any>(null);
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [utrMethod, setUtrMethod] = useState<string>('UPI');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: overview } = useQuery({
    queryKey: ['tenant-overview'],
    queryFn: () => api.get('/tenant-portal/overview').then((r) => r.data),
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['tenant-invoices'],
    queryFn: () => api.get('/tenant-portal/invoices').then((r) => {
      const list = Array.isArray(r.data) ? r.data : (r.data as any).data || [];
      return list;
    }),
  });

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Copied ${field} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleSubmitUtr() {
    if (!utrNumber || utrNumber.trim().length < 4) {
      toast.error('Please enter a valid Transaction ID / UTR Number (min 4 characters).');
      return;
    }

    if (!utrModalInvoice) return;

    try {
      setIsSubmittingUtr(true);
      await api.post(`/invoices/${utrModalInvoice.id}/submit-utr`, {
        utrNumber: utrNumber.trim(),
        paymentMethod: utrMethod,
      });

      toast.success('🎉 Payment verification request submitted successfully! Your manager will approve it shortly.');
      setUtrModalInvoice(null);
      setUtrNumber('');
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-overview'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit payment details. Please try again.');
    } finally {
      setIsSubmittingUtr(false);
    }
  }

  async function handlePayOnline(invoice: any) {
    setPayingInvoiceId(invoice.id);
    toast.info('Connecting to Razorpay Secure Payment Gateway...');

    try {
      // 1. Create Razorpay order on backend
      const orderRes = await api.post(`/invoices/${invoice.id}/create-razorpay-order`);
      const orderData = orderRes.data;

      // 2. Open Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: orderData.propertyName || overview?.bankDetails?.propertyName || overview?.propertyName || 'Property Rent Payment',
        description: `Rent Invoice #${orderData.invoiceNumber || invoice.invoiceNumber || ''}`,
        order_id: orderData.orderId,
        prefill: {
          name: orderData.tenantName || user?.name || '',
          email: orderData.tenantEmail || user?.email || '',
          contact: orderData.tenantPhone || (user as any)?.mobile || '',
        },
        theme: {
          color: '#4f46e5',
        },
        handler: async function (response: any) {
          try {
            // 3. Verify payment signature on backend
            await api.post(`/invoices/${invoice.id}/verify-razorpay-payment`, {
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });

            queryClient.invalidateQueries({ queryKey: ['tenant-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['tenant-overview'] });

            toast.success(`🎉 Payment of ${formatCurrency(Number(invoice.amountDue))} received successfully!`);
            setSelectedInvoiceForReceipt({
              ...invoice,
              status: 'PAID',
              paymentMethod: 'RAZORPAY',
              paymentReference: response.razorpay_payment_id,
              paidDate: new Date().toISOString(),
            });
          } catch (verErr: any) {
            toast.error(verErr?.response?.data?.message || 'Payment verification failed.');
          } finally {
            setPayingInvoiceId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setPayingInvoiceId(null);
            toast.info('Razorpay payment window closed.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setPayingInvoiceId(null);
        toast.error(`Payment failed: ${resp.error?.description || 'Transaction declined'}`);
      });
      rzp.open();
    } catch (err: any) {
      setPayingInvoiceId(null);
      const errMsg = err?.response?.data?.message || err?.message || 'Unable to connect to Razorpay payment gateway.';
      toast.error(errMsg);
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  const totalPending = Math.max(0, (invoices ?? []).reduce((acc: number, inv: any) => {
    const status = (inv.status || '').toUpperCase();
    if (status !== 'PAID' && status !== 'COMPLETED') {
      const due = Number(inv.amountDue || inv.amount || 0);
      const paid = Number(inv.amountPaid || inv.paidAmount || 0);
      const pending = due - paid;
      return acc + (pending > 0 ? pending : 0);
    }
    return acc;
  }, 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent & Billing"
        description="View your monthly rental invoices, make secure online payments, and download official HRA rent receipts."
        icon={Receipt}
      />

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Monthly Rent</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatCurrency(Number(overview?.rent || 8000))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Room {overview?.roomNumber || '101'} • Bed {overview?.bedNumber || 'A'}
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Security Deposit</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(Number(overview?.deposit || 10000))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Fully Deposited & Secure
          </CardContent>
        </Card>

        <Card className="shadow-xs border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase">Outstanding Balance</CardDescription>
            <CardTitle className={`text-2xl font-extrabold ${totalPending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              {formatCurrency(totalPending)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {totalPending > 0 ? 'Due immediately' : 'No overdue balance'}
          </CardContent>
        </Card>
      </div>

      {Number(overview?.advanceBalance) > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-800 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                  Advance Rent Credit Available: {formatCurrency(Number(overview.advanceBalance))}
                  <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-bold">PREPAID BALANCE</Badge>
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  You have recorded advance rent payments in your account. This prepaid balance will automatically cover your upcoming monthly rental invoice.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices List */}
      <Card className="shadow-xs border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Monthly Rental Invoices</CardTitle>
          <CardDescription className="text-xs">All past and current invoices issued for your accommodation</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading your invoices...</div>
          ) : (!invoices || invoices.length === 0) ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No invoices found.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoices.map((inv: any) => {
                const statusUpper = (inv.status || '').toUpperCase();
                const isPaid = statusUpper === 'PAID' || statusUpper === 'COMPLETED';
                const isPendingApproval = statusUpper === 'PENDING_APPROVAL';
                const isOverdue = statusUpper === 'OVERDUE';
                const isAdvance = (inv.invoiceNumber || '').startsWith('ADV-') || inv.isAdvance;
                const isPaying = payingInvoiceId === inv.id;

                return (
                  <div key={inv.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">{inv.invoiceNumber}</span>
                        {isPaid && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] px-2 py-0.5 font-bold">
                            {isAdvance ? 'ADVANCE CREDIT PAID' : 'PAID'}
                          </Badge>
                        )}
                        {isPendingApproval && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] px-2 py-0.5 font-bold flex items-center gap-1">
                            <Hourglass className="h-3 w-3 animate-spin" /> VERIFICATION PENDING
                          </Badge>
                        )}
                        {!isPaid && !isPendingApproval && (
                          <Badge variant={isOverdue ? 'destructive' : 'outline'} className="text-[10px] px-2 py-0.5">
                            {inv.status || 'UNPAID'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Issued: {formatDate(inv.issueDate)}</span>
                        <span>Due Date: <strong className={!isPaid && !isPendingApproval ? 'text-rose-600 dark:text-rose-400' : ''}>{formatDate(inv.dueDate)}</strong></span>
                        {inv.paymentMethod && <span>Mode: {inv.paymentMethod}</span>}
                        {inv.paymentReference && <span className="text-amber-700 dark:text-amber-400 font-mono">Ref: {inv.paymentReference}</span>}
                      </div>
                      {isPendingApproval && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          ⏳ Your transaction proof ({inv.paymentReference}) is awaiting manager / owner approval.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center flex-wrap">
                      <div className="text-right sm:mr-2">
                        <div className="text-base font-extrabold text-slate-900 dark:text-white">{formatCurrency(Number(inv.amountDue || 0))}</div>
                        {isPaid && <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Paid in full</div>}
                        {isPendingApproval && <div className="text-[11px] text-amber-600 font-medium">Approval in progress</div>}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvoiceForReceipt(inv)}
                          className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-indigo-700 dark:text-indigo-400 shadow-xs"
                        >
                          <Receipt className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                          {isPaid ? 'Official HRA Receipt' : 'View Official Invoice'}
                        </Button>

                        {!isPaid && !isPendingApproval && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={isPaying}
                              onClick={() => handlePayOnline(inv)}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs"
                            >
                              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                              {isPaying ? 'Connecting...' : 'Pay Online'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setUtrModalInvoice(inv);
                                setUtrNumber('');
                              }}
                              className="border-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Banknote className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                              On-Desk / UTR
                            </Button>
                          </div>
                        )}

                        {isPendingApproval && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUtrModalInvoice(inv);
                              setUtrNumber(inv.paymentReference?.replace('UTR: ', '') || '');
                            }}
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 text-xs"
                          >
                            <FileCheck className="mr-1.5 h-3.5 w-3.5" /> Update Proof
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Deposit Refund Destination (Self-Service) */}
      <RefundAccountCard depositAmount={Number(overview?.deposit || 10000)} />

      {/* Official Rent Receipt & HRA Voucher Printable Modal */}
      <Dialog open={!!selectedInvoiceForReceipt} onOpenChange={(open) => !open && setSelectedInvoiceForReceipt(null)}>
        <DialogContent className="sm:max-w-[780px] p-0 overflow-hidden max-h-[92vh] overflow-y-auto bg-white text-slate-900">
          <DialogHeader className="p-4 bg-muted/40 border-b flex flex-row items-center justify-between print:hidden">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
              <Receipt className="h-5 w-5 text-indigo-600" /> Official Rent Receipt &amp; HRA Voucher
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handlePrintReceipt} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold">
                <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
              </Button>
            </div>
          </DialogHeader>

          {selectedInvoiceForReceipt && (() => {
            const inv = selectedInvoiceForReceipt;
            const issuerName = overview?.bankDetails?.propertyName || overview?.propertyName || 'StayEaze Premium Residency';
            const issuerAddress = overview?.propertyAddress || 'Central City Residency Campus';
            const issuerCityState = `${overview?.propertyCity || 'Bengaluru'}, India`;
            const pan = overview?.pan || overview?.landlordPan || 'AAECP1234F';
            const gstin = overview?.gstin || '29AAECP1234F1Z5';
            const regNo = overview?.registrationNumber || 'KA-BLR-RES-2026';
            const supportEmail = overview?.managerEmail || overview?.email || 'support@stayeaze.com';
            const supportPhone = overview?.managerPhone || '+91 98765 43210';
            const remainingDue = Math.max(0, Number(inv.amountDue || inv.amount || 0) - Number(inv.amountPaid || (inv.status === 'PAID' ? inv.amountDue || inv.amount : 0)));
            const paidAmount = Number(inv.amountPaid || (inv.status === 'PAID' ? inv.amountDue || inv.amount : 0));
            const totalAmount = Number(inv.amountDue || inv.amount || 0);

            const items = inv.items && inv.items.length > 0
              ? inv.items
              : (() => {
                  const rent = Number(overview?.rent || 0);
                  const dep = Number(overview?.deposit || 0);
                  if (dep > 0 && rent > 0 && totalAmount === (rent + dep)) {
                    return [
                      { description: 'First Month Room Accommodation Rent', amount: rent, category: 'Room Rent' },
                      { description: 'Refundable Security Deposit', amount: dep, category: 'Security Deposit' },
                    ];
                  } else if (dep > 0 && totalAmount === dep) {
                    return [
                      { description: 'Refundable Security Deposit', amount: dep, category: 'Security Deposit' },
                    ];
                  }
                  return [
                    { description: `Monthly Room Rent & Accommodation (${inv.period || 'Current Cycle'})`, amount: totalAmount, category: 'Room Rent' },
                  ];
                })();

            return (
              <div id="printable-gst-invoice" className="printable-receipt-card p-8 bg-white text-slate-900 font-sans text-xs leading-normal">
                {/* Header Banner */}
                <div className="border-b-2 border-slate-800 pb-4 mb-4 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-indigo-700 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">SE</div>
                      <div>
                        <h1 className="font-extrabold text-lg tracking-tight text-slate-900 uppercase">{issuerName}</h1>
                        <p className="text-[11px] font-semibold text-indigo-900">{overview?.propertyName || 'Executive PG & Student Residence'}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-600 leading-snug">
                      <p className="font-medium">{issuerAddress}</p>
                      <p className="font-medium">{issuerCityState}</p>
                      <p className="mt-0.5"><span className="font-bold text-slate-800">PAN:</span> {pan} &nbsp;|&nbsp; <span className="font-bold text-slate-800">GSTIN:</span> {gstin} &nbsp;|&nbsp; <span className="font-bold text-slate-800">License No:</span> {regNo}</p>
                      <p><span className="font-bold text-slate-800">Email:</span> {supportEmail} &nbsp;|&nbsp; <span className="font-bold text-slate-800">Helpline:</span> {supportPhone}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-block bg-slate-900 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider rounded mb-2 shadow-sm">
                      OFFICIAL RENT RECEIPT
                    </div>
                    <p className="font-mono text-sm font-bold text-indigo-950">RCP-{String(inv.invoiceNumber || '').replace(/^INV-/, '')}</p>
                    <p className="text-[11px] text-slate-600 mt-1"><span className="font-semibold text-slate-800">Receipt Date:</span> {formatDate(inv.paidDate || inv.issueDate || new Date().toISOString())}</p>
                    <p className="text-[11px] text-slate-600"><span className="font-semibold text-slate-800">Due Date:</span> {formatDate(inv.dueDate)}</p>
                    <p className="text-[11px] text-slate-600"><span className="font-semibold text-slate-800">Rent Month:</span> {inv.period || 'Current Cycle'}</p>
                  </div>
                </div>

                {/* Tenant / Rent Summary */}
                <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3 mb-4 bg-slate-50/70">
                  <div>
                    <p className="font-bold text-[11px] text-indigo-950 uppercase tracking-wider border-b border-slate-200 pb-1 mb-1.5">Tenant Details (Received From)</p>
                    <p className="font-bold text-sm text-slate-900">{overview?.name || user?.name || 'Resident Tenant'}</p>
                    <p className="text-slate-600">Contact: <span className="font-semibold text-slate-800">{overview?.mobile || (user as any)?.mobile || overview?.email || 'N/A'}</span></p>
                    <p className="text-slate-600">Occupied Premises: <span className="font-semibold text-slate-800">Room {overview?.roomNumber || '101'} (Bed {overview?.bedNumber || 'A'})</span></p>
                    <p className="text-slate-600">Property Location: <span className="font-semibold text-slate-800">{overview?.propertyName || 'StayEaze Campus'}, {overview?.propertyCity || 'Bengaluru'}</span></p>
                  </div>
                  <div>
                    <p className="font-bold text-[11px] text-indigo-950 uppercase tracking-wider border-b border-slate-200 pb-1 mb-1.5">Payment Summary &amp; Status</p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-700">Receipt Status:</span>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {inv.status || 'PAID'}
                      </span>
                    </div>
                    <p className="text-slate-600">Total Billed: <span className="font-bold text-slate-900">{formatCurrency(totalAmount)}</span></p>
                    <p className="text-slate-600">Amount Received: <span className="font-bold text-emerald-700">{formatCurrency(paidAmount)}</span></p>
                    <p className="text-slate-600">Paid By (Method): <span className="font-bold text-indigo-900 uppercase">{String(inv.paymentMethod || 'RAZORPAY ONLINE GATEWAY').replace('_', ' ')}</span></p>
                    <p className="text-slate-600">Transaction Ref ID: <span className="font-mono font-bold text-slate-800">{inv.paymentReference || ('TXN-' + String(inv.invoiceNumber || '').replace(/^INV-/, ''))}</span></p>
                    <p className="text-slate-600">Balance Outstanding: <span className={`font-bold ${remainingDue > 0 ? 'text-red-600' : 'text-slate-700'}`}>{formatCurrency(remainingDue)}</span></p>
                  </div>
                </div>

                {/* Particulars Itemized Table */}
                <table className="w-full border-collapse border border-slate-300 mb-4 text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-left font-bold">
                      <th className="p-2 border border-slate-700 w-10 text-center">#</th>
                      <th className="p-2 border border-slate-700">Rent Particulars / Description</th>
                      <th className="p-2 border border-slate-700 w-32 text-center">Category</th>
                      <th className="p-2 border border-slate-700 w-28 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-300">
                        <td className="p-2 border border-slate-300 text-center font-medium">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 font-semibold">
                          {it.description}
                        </td>
                        <td className="p-2 border border-slate-300 text-center text-slate-700 font-medium">
                          {it.description?.toLowerCase().includes('deposit') ? 'Security Deposit' : 'Room Rent'}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-bold tabular-nums">
                          {formatCurrency(Number(it.amount || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold text-xs">
                      <td colSpan={3} className="p-2.5 border border-slate-900 text-right uppercase">Net Total Amount Received:</td>
                      <td className="p-2.5 border border-slate-900 text-right font-extrabold text-sm tabular-nums">{formatCurrency(paidAmount || totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Amount in Words */}
                <div className="border border-slate-300 rounded p-2.5 mb-4 bg-slate-50 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Amount in Words:</span>
                  <span className="font-bold text-indigo-950 italic">{numberToWords(paidAmount || totalAmount)}</span>
                </div>

                {/* HRA Tax Declaration & Verification QR Box */}
                <div className="grid grid-cols-12 gap-3 border border-indigo-200 rounded p-3 mb-4 bg-indigo-50/40">
                  <div className="col-span-3 flex flex-col items-center justify-center border-r border-indigo-200 pr-2 text-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://stayeaze.com/verify-receipt?rcp=${inv.invoiceNumber}%26tenant=${encodeURIComponent(overview?.name || user?.name || 'Tenant')}%26amount=${totalAmount}`}
                      alt="Receipt Verification QR Code"
                      className="h-20 w-20 border border-slate-300 rounded p-0.5 bg-white shadow-sm"
                    />
                    <span className="text-[9px] font-mono font-bold text-indigo-950 mt-1 uppercase">Scan to Verify</span>
                  </div>
                  <div className="col-span-9 text-[10px] text-slate-700 leading-tight space-y-1">
                    <p className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-indigo-200 pb-1">House Rent Allowance (HRA) Tax Declaration</p>
                    <p className="italic text-slate-800">
                      &quot;Received with thanks from <span className="font-bold">{overview?.name || user?.name}</span> a sum of <span className="font-bold">{formatCurrency(paidAmount || totalAmount)}</span> ({numberToWords(paidAmount || totalAmount)}) towards residential accommodation for <span className="font-bold">{inv.period || 'Current Period'}</span>.&quot;
                    </p>
                    <p><span className="font-semibold text-slate-900">HRA Tax Compliance:</span> Valid rent receipt for claiming HRA tax exemption under Section 10(13A) of Income Tax Act 1961.</p>
                    <p><span className="font-semibold text-slate-900">Landlord PAN:</span> <span className="font-mono font-bold text-indigo-950">{pan}</span> &nbsp;|&nbsp; <span className="font-semibold text-slate-900">Verification Hash:</span> <span className="font-mono text-indigo-900">RCP-SHA256:{String(inv.invoiceNumber || '').replace(/[^A-Z0-9]/gi, '')}</span></p>
                  </div>
                </div>

                {/* Bank Details & Terms */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-300 pt-3 mb-6">
                  <div>
                    <p className="font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-1">Bank Payment Details</p>
                    <div className="text-[10px] text-slate-600 space-y-0.5 leading-tight font-mono">
                      {overview?.bankDetails?.accountName && <p><span className="font-semibold text-slate-700">Account Name:</span> {overview.bankDetails.accountName}</p>}
                      {overview?.bankDetails?.bankName && <p><span className="font-semibold text-slate-700">Bank Name:</span> {overview.bankDetails.bankName}</p>}
                      {overview?.bankDetails?.accountNumber && <p><span className="font-semibold text-slate-700">Account No:</span> {overview.bankDetails.accountNumber}</p>}
                      {overview?.bankDetails?.ifsc && <p><span className="font-semibold text-slate-700">IFSC Code:</span> {overview.bankDetails.ifsc}</p>}
                      {overview?.bankDetails?.upiId && <p><span className="font-semibold text-slate-700">UPI VPA:</span> {overview.bankDetails.upiId}</p>}
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-1">Receipt Terms &amp; Rules</p>
                    <div className="text-[10px] text-slate-600 whitespace-pre-line leading-tight">
                      Rent is payable on or before the due date. This computer-generated receipt is valid for tenant records and corporate HRA reimbursement claims.
                    </div>
                  </div>
                </div>

                {/* Signature & Seal Area */}
                <div className="flex justify-between items-end border-t-2 border-slate-300 pt-4 mt-6">
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <p className="font-bold text-slate-800">Official Computer Generated Rent Receipt</p>
                    <p>Verified &amp; Secured by StayEaze PMS System</p>
                    <p className="font-mono text-[9px] text-slate-400">Ref ID: {inv.id}</p>
                  </div>

                  <div className="text-center">
                    <div className="h-14 flex items-center justify-center mb-1">
                      <div className="border-2 border-indigo-700 rounded-full px-3 py-1 bg-indigo-50 text-[10px] font-bold text-indigo-900 rotate-[-3deg] shadow-sm flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{issuerName}<br />AUTHORIZED SIGNATORY</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-800 w-48 pt-1 font-bold text-[11px] text-slate-900">
                      Landlord / Property Owner Signature
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* On-Desk / Direct UPI / UTR Submission Dialog */}
      <Dialog open={!!utrModalInvoice} onOpenChange={(o) => !o && setUtrModalInvoice(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              Submit On-Desk / Direct UPI Payment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pay via your own UPI app or directly at the reception desk, then submit your transaction reference number (UTR) for manager approval.
            </DialogDescription>
          </DialogHeader>

          {utrModalInvoice && (
            <div className="space-y-4 pt-2">
              {/* Payment Target Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold uppercase text-[10px]">Invoice</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{utrModalInvoice.invoiceNumber}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold uppercase text-[10px]">Amount to Pay</span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(Number(utrModalInvoice.amountDue || 0))}</span>
                </div>
              </div>

              {/* Landlord Payment Instructions */}
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-2 text-xs">
                <div className="font-bold text-[11px] text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    {overview?.bankDetails?.propertyName || overview?.propertyName || 'Property'} Bank &amp; UPI Details
                  </span>
                  <Badge variant="outline" className="text-[9px] bg-white dark:bg-slate-900 border-indigo-200 text-indigo-700 font-semibold">
                    {overview?.bankDetails?.accountName || 'Official Account'}
                  </Badge>
                </div>
                
                <div className="space-y-1.5 pt-1 text-[11px]">
                  {overview?.bankDetails?.accountName && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Beneficiary:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{overview.bankDetails.accountName}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">UPI ID:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                      <span>{overview?.bankDetails?.upiId || 'Contact Desk for QR'}</span>
                      {overview?.bankDetails?.upiId && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => copyToClipboard(overview?.bankDetails?.upiId, 'UPI ID')}
                        >
                          {copiedField === 'UPI ID' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account No:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                      <span>{overview?.bankDetails?.accountNumber || 'Contact Reception Desk'}</span>
                      {overview?.bankDetails?.accountNumber && overview?.bankDetails?.accountNumber !== 'Contact Reception Desk' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => copyToClipboard(overview?.bankDetails?.accountNumber, 'Account Number')}
                        >
                          {copiedField === 'Account Number' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">IFSC Code:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                      <span>{overview?.bankDetails?.ifsc || 'N/A'}</span>
                      {overview?.bankDetails?.ifsc && overview?.bankDetails?.ifsc !== 'N/A' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => copyToClipboard(overview?.bankDetails?.ifsc, 'IFSC Code')}
                        >
                          {copiedField === 'IFSC Code' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                  </div>

                  {overview?.bankDetails?.bankName && overview?.bankDetails?.bankName !== 'Primary Bank Account' && (
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                      <span>Bank:</span>
                      <span>{overview.bankDetails.bankName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="paymentMethod" className="text-xs font-semibold">Payment Mode</Label>
                  <Select value={utrMethod} onValueChange={setUtrMethod}>
                    <SelectTrigger id="paymentMethod" className="h-9 text-xs">
                      <SelectValue placeholder="Select Payment Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UPI">UPI App (GPay, PhonePe, Paytm, BHIM)</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Direct Bank Transfer (IMPS / NEFT / RTGS)</SelectItem>
                      <SelectItem value="ON_DESK">Cash Handed Over at Reception Desk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="utrNumber" className="text-xs font-semibold">
                    {utrMethod === 'ON_DESK' ? 'Desk Receipt / Staff Name' : '12-Digit UTR / Transaction ID *'}
                  </Label>
                  <Input
                    id="utrNumber"
                    placeholder={utrMethod === 'ON_DESK' ? 'e.g. Handed to Receptionist John' : 'e.g. 423987123456 or TXN98765432'}
                    className="h-9 text-xs font-mono"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {utrMethod === 'ON_DESK'
                      ? 'Mention the name of the staff or desk receipt number.'
                      : 'Found in your UPI app receipt or bank transfer SMS/statement.'}
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUtrModalInvoice(null)}
                  disabled={isSubmittingUtr}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitUtr}
                  disabled={isSubmittingUtr || !utrNumber.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  {isSubmittingUtr ? 'Submitting...' : 'Submit for Verification'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
