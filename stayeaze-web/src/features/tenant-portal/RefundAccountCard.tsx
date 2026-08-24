import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Wallet, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import api from '@/lib/api';

export function RefundAccountCard({ depositAmount }: { depositAmount?: number }) {
  const queryClient = useQueryClient();
  const [payoutType, setPayoutType] = useState<'UPI' | 'BANK'>('UPI');
  const [refundUpi, setRefundUpi] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [refundIfsc, setRefundIfsc] = useState('');
  const [refundBankName, setRefundBankName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: accountData, isLoading } = useQuery({
    queryKey: ['tenant-refund-account'],
    queryFn: async () => {
      const res = await api.get('/tenant-portal/refund-account');
      return res.data;
    },
  });

  // Sync initial state once fetched
  if (accountData && !loaded) {
    if (accountData.refundUpi) {
      setRefundUpi(accountData.refundUpi);
      setPayoutType('UPI');
    }
    if (accountData.refundAccountNumber) {
      setRefundAccountNumber(accountData.refundAccountNumber);
      setRefundAccountName(accountData.refundAccountName || '');
      setRefundIfsc(accountData.refundIfsc || '');
      setRefundBankName(accountData.refundBankName || '');
      if (!accountData.refundUpi) setPayoutType('BANK');
    }
    setLoaded(true);
  }

  async function handleSaveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (payoutType === 'UPI' && (!refundUpi || !refundUpi.includes('@'))) {
      toast.error('Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm)');
      return;
    }
    if (payoutType === 'BANK' && (!refundAccountNumber || !refundIfsc)) {
      toast.error('Please enter your Bank Account Number and IFSC Code');
      return;
    }

    try {
      setSaving(true);
      await api.post('/tenant-portal/refund-account', {
        refundUpi: payoutType === 'UPI' ? refundUpi : '',
        refundAccountName,
        refundAccountNumber: payoutType === 'BANK' ? refundAccountNumber : '',
        refundIfsc: payoutType === 'BANK' ? refundIfsc.toUpperCase() : '',
        refundBankName: payoutType === 'BANK' ? refundBankName : '',
      });
      toast.success('🎉 Security deposit refund account details saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['tenant-refund-account'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save refund account details');
    } finally {
      setSaving(false);
    }
  }

  const isConfigured = Boolean(accountData?.refundUpi || accountData?.refundAccountNumber);

  return (
    <Card className="shadow-xs border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10">
      <CardHeader className="pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <CardTitle className="text-base font-bold text-foreground">
                Security Deposit Refund Destination (UPI / Bank Account)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Provide your personal UPI ID or Bank Account to receive your net security deposit refund when you check out.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isConfigured ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Account Linked
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs">
                <AlertCircle className="h-3.5 w-3.5 mr-1" /> Action Required
              </Badge>
            )}
            {Boolean((accountData?.depositAmount ?? depositAmount) && Number(accountData?.depositAmount ?? depositAmount) > 0) && (
              <Badge variant="outline" className="border-emerald-300 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/60">
                Deposit Paid: {formatCurrency(Number(accountData?.depositAmount ?? depositAmount))}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="py-4 text-xs text-muted-foreground">Loading your refund payout preferences...</div>
        ) : (
          <form onSubmit={handleSaveAccount} className="space-y-4">
            {/* Payout Method Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayoutType('UPI')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  payoutType === 'UPI'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                <Wallet className="h-4 w-4" />
                Direct UPI (GPay / PhonePe / Paytm)
              </button>
              <button
                type="button"
                onClick={() => setPayoutType('BANK')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                  payoutType === 'BANK'
                    ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-xs'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                Bank Account (IMPS / NEFT)
              </button>
            </div>

            {payoutType === 'UPI' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Your UPI ID (VPA)</label>
                <input
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                  placeholder="e.g. mobile@okhdfcbank or yourname@paytm"
                  value={refundUpi}
                  onChange={(e) => setRefundUpi(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Your net refundable deposit will be credited directly to this UPI address upon move-out clearance.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Account Holder Name</label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                    placeholder="e.g. Rahul Sharma"
                    value={refundAccountName}
                    onChange={(e) => setRefundAccountName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Bank Name</label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                    placeholder="e.g. HDFC Bank / SBI / ICICI"
                    value={refundBankName}
                    onChange={(e) => setRefundBankName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Bank Account Number</label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                    placeholder="e.g. 50100234891234"
                    value={refundAccountNumber}
                    onChange={(e) => setRefundAccountNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">IFSC Code</label>
                  <input
                    type="text"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm uppercase shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600"
                    placeholder="e.g. HDFC0001234"
                    value={refundIfsc}
                    onChange={(e) => setRefundIfsc(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Encrypted & used solely for security deposit refunds
              </div>
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs"
              >
                {saving ? 'Saving Details...' : isConfigured ? 'Update Refund Destination' : 'Save Refund Destination'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
