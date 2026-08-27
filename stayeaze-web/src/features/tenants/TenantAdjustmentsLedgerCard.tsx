import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusCircle, RotateCcw, AlertTriangle, Tag, CheckCircle2, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import api from '@/lib/api';

interface PenaltyDiscount {
  id: string;
  type: 'PENALTY' | 'DISCOUNT';
  amount: number;
  description: string;
  status: 'APPLIED' | 'REVERSED';
  createdAt: string;
}

interface Props {
  tenantId: string;
  isArchived?: boolean;
}

export default function TenantAdjustmentsLedgerCard({ tenantId, isArchived }: Props) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<PenaltyDiscount | null>(null);

  const [form, setForm] = useState({
    type: 'PENALTY' as 'PENALTY' | 'DISCOUNT',
    amount: '',
    description: '',
    reasonPreset: 'LATE_FEE',
  });

  const { data: adjustments = [], isLoading } = useQuery<PenaltyDiscount[]>({
    queryKey: ['tenant-penalties-discounts', tenantId],
    queryFn: () =>
      api.get(`/tenants/${tenantId}/penalties-discounts`).then((r) => {
        const payload = r.data as any;
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload.data)) return payload.data;
        return [];
      }),
    enabled: !!tenantId,
  });

  const applyMutation = useMutation({
    mutationFn: (payload: { type: string; amount: number; description: string }) =>
      api.post(`/tenants/${tenantId}/penalties-discounts`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-penalties-discounts', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices', tenantId] });
      toast.success('Adjustment successfully recorded in tenant ledger.');
      setModalOpen(false);
      setForm({ type: 'PENALTY', amount: '', description: '', reasonPreset: 'LATE_FEE' });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to apply adjustment.');
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/tenants/${tenantId}/penalties-discounts/${id}/reverse`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-penalties-discounts', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices', tenantId] });
      toast.success('Adjustment has been successfully reversed.');
      setReverseTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reverse adjustment.');
    },
  });

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(form.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount greater than ₹0.');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Please enter a description / reason for this adjustment.');
      return;
    }

    applyMutation.mutate({
      type: form.type,
      amount: numAmount,
      description: form.description.trim(),
    });
  };

  const totalPenalties = adjustments
    .filter((a) => a.type === 'PENALTY' && a.status === 'APPLIED')
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const totalDiscounts = adjustments
    .filter((a) => a.type === 'DISCOUNT' && a.status === 'APPLIED')
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  const netAdjustment = totalPenalties - totalDiscounts;

  return (
    <Card className="shadow-xs border-slate-200 dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-indigo-600" />
            Penalties &amp; Discounts Ledger
          </CardTitle>
          <CardDescription className="text-xs">
            Direct charges, late fees, waivers, and promotional adjustments
          </CardDescription>
        </div>
        {!isArchived && (
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="h-8 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Apply Adjustment
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Ledger Summary Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Total Penalties</span>
            <span className="text-sm sm:text-base font-bold text-rose-600 flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" />
              {formatCurrency(totalPenalties)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Total Discounts</span>
            <span className="text-sm sm:text-base font-bold text-emerald-600 flex items-center gap-1">
              <ArrowDownRight className="h-3.5 w-3.5" />
              {formatCurrency(totalDiscounts)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Net Adjustment</span>
            <span className={`text-sm sm:text-base font-bold ${netAdjustment > 0 ? 'text-rose-600' : netAdjustment < 0 ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
              {netAdjustment > 0 ? `+${formatCurrency(netAdjustment)}` : formatCurrency(netAdjustment)}
            </span>
          </div>
        </div>

        {/* Adjustments List */}
        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading ledger records...</div>
        ) : adjustments.length === 0 ? (
          <div className="py-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs text-slate-500 font-medium">No penalties or discounts recorded for this tenant.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Use "Apply Adjustment" to log late fees, damages, or waivers.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl overflow-hidden">
            {adjustments.map((item) => {
              const isPenalty = item.type === 'PENALTY';
              const isReversed = item.status === 'REVERSED';

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 sm:p-3.5 transition-colors ${
                    isReversed ? 'bg-slate-50/50 dark:bg-slate-900/20 opacity-60' : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        isPenalty
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {isPenalty ? <AlertTriangle className="h-4 w-4" /> : <Tag className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {item.description}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold py-0 px-1.5 ${
                            isPenalty
                              ? 'border-rose-200 text-rose-700 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400'
                          }`}
                        >
                          {item.type}
                        </Badge>
                        {isReversed && (
                          <Badge variant="secondary" className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800">
                            REVERSED
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Recorded on {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs sm:text-sm font-bold ${
                        isReversed
                          ? 'line-through text-slate-400'
                          : isPenalty
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isPenalty ? `+${formatCurrency(item.amount)}` : `-${formatCurrency(item.amount)}`}
                    </span>

                    {!isReversed && !isArchived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReverseTarget(item)}
                        className="h-7 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 rounded-lg"
                        title="Reverse / Waive adjustment"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Reverse
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Apply Adjustment Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5">
          <form onSubmit={handleApply}>
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-bold">Apply Penalty or Discount</DialogTitle>
              <DialogDescription className="text-xs">
                Record a financial charge or credit adjustment for this tenant.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Adjustment Type *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'PENALTY', description: 'Late Payment Fee' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      form.type === 'PENALTY'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                    Penalty (Charge)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'DISCOUNT', description: 'Early Bird Discount' })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      form.type === 'DISCOUNT'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5 text-emerald-500" />
                    Discount (Waiver)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Amount (₹) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 500"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="rounded-xl h-10 text-xs sm:text-sm font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Common Presets</Label>
                <Select
                  value={form.reasonPreset}
                  onValueChange={(val) => {
                    let desc = form.description;
                    if (val === 'LATE_FEE') desc = 'Late Payment Fine';
                    else if (val === 'DAMAGE') desc = 'Room / Asset Damage Charge';
                    else if (val === 'LOST_KEY') desc = 'Lost Key / Gate Pass Fee';
                    else if (val === 'EARLY_BIRD') desc = 'Early Payment Incentive';
                    else if (val === 'REFERRAL') desc = 'Referral Credit Waiver';
                    setForm({ ...form, reasonPreset: val, description: desc });
                  }}
                >
                  <SelectTrigger className="rounded-xl h-9 text-xs">
                    <SelectValue placeholder="Select a preset reason" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="LATE_FEE">Late Payment Fine</SelectItem>
                    <SelectItem value="DAMAGE">Room / Asset Damage</SelectItem>
                    <SelectItem value="LOST_KEY">Lost Key Replacement</SelectItem>
                    <SelectItem value="EARLY_BIRD">Early Bird Discount</SelectItem>
                    <SelectItem value="REFERRAL">Referral Bonus / Credit</SelectItem>
                    <SelectItem value="CUSTOM">Custom Reason</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Description / Reason *</Label>
                <Textarea
                  placeholder="e.g. ₹500 fee for delayed rent payment beyond the 5th of the month"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="rounded-xl text-xs sm:text-sm min-h-[70px] resize-none"
                  required
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl h-9 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={applyMutation.isPending || !form.amount || !form.description}
                className="rounded-xl h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {applyMutation.isPending ? 'Applying...' : 'Apply to Ledger'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reverse Confirmation Dialog */}
      <ConfirmDialog
        open={!!reverseTarget}
        onOpenChange={(open) => !open && setReverseTarget(null)}
        title="Reverse Ledger Adjustment?"
        description={`Are you sure you want to reverse this ${reverseTarget?.type.toLowerCase()} of ${formatCurrency(
          reverseTarget?.amount || 0
        )}? The adjustment will be voided while preserving the audit history.`}
        confirmLabel="Confirm Reversal"
        cancelLabel="Cancel"
        variant="destructive"
        loading={reverseMutation.isPending}
        onConfirm={() => reverseTarget && reverseMutation.mutate(reverseTarget.id)}
      />
    </Card>
  );
}
