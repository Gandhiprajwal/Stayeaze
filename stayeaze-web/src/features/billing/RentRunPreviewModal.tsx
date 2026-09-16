import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Eye, RefreshCw, X, CheckCircle2, Clock, AlertCircle,
  Sparkles, PlayCircle, Users, TrendingUp, Wallet,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/format';
import api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TenantPreviewRow {
  tenantId: string;
  tenantName: string;
  roomNumber: string | null;
  bedNumber: string | null;
  fullRent: number;
  calculatedRent: number;
  isProRata: boolean;
  proRataDays: number;
  daysInMonth: number;
  advanceBalance: number;
  advanceOffset: number;
  netDue: number;
  projectedStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  cycleLabel: string;
}

interface PreviewResponse {
  dryRun: boolean;
  month: string;
  year: number;
  tenantCount: number;
  totalCalculatedRent: number;
  totalAdvanceOffset: number;
  totalNetDue: number;
  tenants: TenantPreviewRow[];
}

interface RentRunPreviewModalProps {
  open: boolean;
  onClose: () => void;
  billingMonth?: number;
  billingYear?: number;
  dueDateDays?: number;
  propertyId?: string;
}

// ─── Status pill ─────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: TenantPreviewRow['projectedStatus'] }) {
  if (status === 'PAID') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" /> Auto-Paid
    </span>
  );
  if (status === 'PARTIALLY_PAID') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <Clock className="h-3 w-3" /> Partial
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <AlertCircle className="h-3 w-3" /> Unpaid
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RentRunPreviewModal({
  open,
  onClose,
  billingMonth,
  billingYear,
  dueDateDays = 5,
  propertyId,
}: RentRunPreviewModalProps) {
  const queryClient = useQueryClient();

  const now = new Date();
  const month = billingMonth ?? (now.getMonth() + 1);
  const year = billingYear ?? now.getFullYear();

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Dry-run preview ─────────────────────────────────────────────────────────
  const previewMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/billing/rent-run-preview', {
        billingMonth: month,
        billingYear: year,
        dueDateDays,
        ...(propertyId && propertyId !== 'ALL' ? { propertyId } : {}),
        excludeTenantIds: [...excluded],
      });
      return res.data as PreviewResponse;
    },
    onSuccess: (data) => setPreview(data),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Preview failed.'),
  });

  // ── Confirm real run ────────────────────────────────────────────────────────
  const confirmMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/billing/monthly-rent-run', {
        billingMonth: month,
        billingYear: year,
        dueDateDays,
        ...(propertyId && propertyId !== 'ALL' ? { propertyId } : {}),
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      const count = data.invoicesGenerated ?? 0;
      if (count > 0) {
        toast.success(data.message || `Generated ${count} invoice(s) for ${data.month} ${data.year}!`);
      } else {
        toast.info(data.message || `All tenants already invoiced for ${data.month} ${data.year}.`);
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/payments'] });
      handleClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to run billing.'),
  });

  function toggleExclude(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setPreview(null); // force re-preview after exclusion change
  }

  const sorted = useMemo(() => {
    if (!preview) return [];
    return [...preview.tenants].sort((a, b) =>
      sortDir === 'asc'
        ? a.tenantName.localeCompare(b.tenantName)
        : b.tenantName.localeCompare(a.tenantName)
    );
  }, [preview, sortDir]);

  const includedCount = preview ? preview.tenants.filter((t) => !excluded.has(t.tenantId)).length : 0;
  const includedNetDue = preview
    ? preview.tenants.filter((t) => !excluded.has(t.tenantId)).reduce((s, t) => s + t.netDue, 0)
    : 0;

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' });

  function handleClose() {
    onClose();
    setPreview(null);
    setExcluded(new Set());
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shrink-0">
              <Eye className="h-4 w-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Rent Run Preview — {monthName} {year}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                Dry run · no invoices created yet. Review and exclude tenants, then confirm to post.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Empty state — before first preview */}
          {!preview && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-indigo-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">See exactly who will be billed before committing</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  The engine calculates rent, pro-rata days and advance offsets without writing anything to the database.
                </p>
              </div>
              <Button
                className="rounded-xl gap-2 font-semibold"
                onClick={() => previewMut.mutate()}
                disabled={previewMut.isPending}
              >
                <Eye className={`h-4 w-4 ${previewMut.isPending ? 'animate-pulse' : ''}`} />
                {previewMut.isPending ? 'Calculating…' : 'Run Preview'}
              </Button>
            </div>
          )}

          {/* Preview results */}
          {preview && (
            <>
              {/* KPI summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border bg-card p-3 text-center space-y-0.5 shadow-xs">
                  <Users className="h-4 w-4 mx-auto text-indigo-500 mb-1" />
                  <p className="text-[11px] text-muted-foreground">To Invoice</p>
                  <p className="text-xl font-bold">{preview.tenantCount}</p>
                </div>
                <div className="rounded-xl border bg-card p-3 text-center space-y-0.5 shadow-xs">
                  <TrendingUp className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
                  <p className="text-[11px] text-muted-foreground">Total Rent</p>
                  <p className="text-xl font-bold">{formatCurrency(preview.totalCalculatedRent)}</p>
                </div>
                <div className="rounded-xl border bg-card p-3 text-center space-y-0.5 shadow-xs">
                  <Wallet className="h-4 w-4 mx-auto text-violet-500 mb-1" />
                  <p className="text-[11px] text-muted-foreground">Net Due</p>
                  <p className="text-xl font-bold">{formatCurrency(preview.totalNetDue)}</p>
                </div>
              </div>

              {/* Exclusion notice */}
              {excluded.size > 0 && (
                <div className="text-xs rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 py-2 flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong>{excluded.size} tenant(s) excluded.</strong> Re-run preview to recalculate totals.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 text-[10px]"
                    onClick={() => previewMut.mutate()}
                    disabled={previewMut.isPending}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                </div>
              )}

              {/* Table */}
              <div className="rounded-xl border overflow-hidden shadow-xs">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_40px] items-center px-3 py-2 bg-muted/50 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider gap-2">
                  <button
                    className="flex items-center gap-1 hover:text-foreground transition text-left"
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  >
                    Tenant {sortDir === 'asc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  </button>
                  <span className="text-center">Room</span>
                  <span className="text-right">Rent</span>
                  <span className="text-right">Advance ↓</span>
                  <span className="text-right">Net Due</span>
                  <span className="text-center">Status</span>
                  <span className="text-center">Skip</span>
                </div>

                {sorted.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    No eligible tenants to bill for {monthName} {year}.
                  </div>
                ) : (
                  <div className="divide-y max-h-72 overflow-y-auto">
                    {sorted.map((row) => {
                      const isExcluded = excluded.has(row.tenantId);
                      return (
                        <div
                          key={row.tenantId}
                          className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto_40px] items-center px-3 py-2.5 text-xs gap-2 transition
                            ${isExcluded ? 'opacity-40 bg-muted/20 line-through' : 'hover:bg-muted/10'}`}
                        >
                          {/* Name */}
                          <span className="font-medium truncate" title={row.tenantName}>
                            {row.tenantName}
                            {row.isProRata && (
                              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400 no-underline">
                                {row.proRataDays}d
                              </Badge>
                            )}
                          </span>

                          {/* Room */}
                          <span className="text-muted-foreground text-center w-16">
                            {row.roomNumber ?? '—'}{row.bedNumber ? `/${row.bedNumber}` : ''}
                          </span>

                          {/* Rent */}
                          <span className="text-right w-20 font-medium tabular-nums">
                            {formatCurrency(row.calculatedRent)}
                          </span>

                          {/* Advance offset */}
                          <span className={`text-right w-20 tabular-nums ${row.advanceOffset > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}`}>
                            {row.advanceOffset > 0 ? `−${formatCurrency(row.advanceOffset)}` : '—'}
                          </span>

                          {/* Net due */}
                          <span className="text-right w-20 font-bold tabular-nums">{formatCurrency(row.netDue)}</span>

                          {/* Status */}
                          <div className="flex justify-center w-24">
                            <StatusPill status={row.projectedStatus} />
                          </div>

                          {/* Exclude checkbox */}
                          <div className="flex justify-center">
                            <Checkbox
                              id={`excl-${row.tenantId}`}
                              checked={isExcluded}
                              onCheckedChange={() => toggleExclude(row.tenantId)}
                              className="data-[state=checked]:border-amber-400 data-[state=checked]:bg-amber-400"
                              title="Skip this tenant in the real run"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Included summary line */}
              {excluded.size > 0 && (
                <p className="text-[11px] text-muted-foreground text-right">
                  <span className="font-semibold text-foreground">{includedCount} tenant(s)</span> will be billed ·{' '}
                  Net Due: <span className="font-semibold text-foreground">{formatCurrency(includedNetDue)}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex items-center gap-2 justify-between flex-wrap">
          <p className="text-[11px] text-muted-foreground">
            {preview
              ? `Preview · ${preview.tenantCount} tenant(s) · ${monthName} ${year} · No DB writes yet`
              : 'No preview yet — run the preview first'}
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button variant="outline" className="rounded-xl h-9 text-xs" onClick={handleClose}>
              <X className="h-3.5 w-3.5 mr-1.5" /> Close
            </Button>
            {!preview && (
              <Button
                className="rounded-xl h-9 text-xs font-semibold gap-1.5"
                onClick={() => previewMut.mutate()}
                disabled={previewMut.isPending}
              >
                <Eye className="h-3.5 w-3.5" />
                {previewMut.isPending ? 'Calculating…' : 'Run Preview'}
              </Button>
            )}
            {preview && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl h-9 text-xs gap-1.5"
                  onClick={() => previewMut.mutate()}
                  disabled={previewMut.isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${previewMut.isPending ? 'animate-spin' : ''}`} />
                  Re-run Preview
                </Button>
                <Button
                  className="rounded-xl h-9 text-xs font-bold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => confirmMut.mutate()}
                  disabled={confirmMut.isPending || preview.tenantCount === 0}
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  {confirmMut.isPending
                    ? 'Posting…'
                    : `Confirm & Post${includedCount > 0 ? ` (${includedCount})` : ''}`}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
