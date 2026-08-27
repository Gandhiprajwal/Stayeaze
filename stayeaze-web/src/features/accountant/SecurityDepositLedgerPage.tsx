import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { Wallet, ShieldCheck, RefreshCw, CheckCircle2, UserCheck, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { CheckoutSettlementModal } from '@/features/check-out/CheckoutSettlementModal';

export default function SecurityDepositLedgerPage() {
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');
  const [settlementTenant, setSettlementTenant] = useState<{ id: string; name: string } | null>(null);

  const { data: properties } = useQuery({
    queryKey: ['properties-minimal'],
    queryFn: () => api.get<any>('/properties/minimal').then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []),
  });

  const { data: depositData, isLoading } = useQuery({
    queryKey: ['accountant', 'security-deposits', selectedPropertyId],
    queryFn: () => api.get<any>('/accountant/security-deposits', {
      params: selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId } : undefined
    }).then((r) => r.data),
  });

  const handleProcessRefund = (tenantId: string, tenantName: string) => {
    setSettlementTenant({ id: tenantId, name: tenantName });
  };

  const rows = depositData?.tenantsDeposits ?? [];

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="Security Deposit Escrow Ledger"
        description="Track active tenant security deposit holdings, notice-period refund claims, and damage deductions."
        actions={
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-[200px] rounded-xl h-10 text-xs sm:text-sm">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Properties</SelectItem>
              {(properties || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total Escrow Holding" value={formatCurrency(depositData?.totalEscrowHolding ?? 0)} icon={Wallet} accent="primary" hint="Escrow funds held in trust" />
        <StatCard label="Active Holding Tenants" value={rows.length} icon={UserCheck} accent="success" hint="Tenants with active deposit records" />
        <StatCard label="Refund Settlement SLA" value="24 Hours" icon={ShieldCheck} accent="info" hint="Average turnaround for deposit payouts" />
      </div>

      <Card className="rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
            <Wallet className="h-5 w-5 text-primary shrink-0" /> Tenant Security Deposits
          </CardTitle>
          <CardDescription className="text-xs">Escrow funds ledger and exit refund settlement queue</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : (
            <>
              {/* Mobile Card List View (< md) */}
              <div className="md:hidden space-y-3">
                {rows.length > 0 ? (
                  rows.map((row: any) => (
                    <div key={row.tenantId} className="p-4 rounded-xl border bg-card/80 dark:bg-slate-900/60 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm text-foreground">{row.tenantName}</p>
                          <p className="text-xs text-muted-foreground">{row.email || 'No email'}</p>
                          <p className="text-xs text-muted-foreground">📞 {row.phone || 'No phone'}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                          row.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {row.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <span className="text-xs text-muted-foreground font-medium">Deposit Held:</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatCurrency(row.depositAmount)}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleProcessRefund(row.tenantId, row.tenantName)}
                        className="w-full rounded-xl h-10 px-4 py-2 text-xs sm:text-sm font-semibold border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 gap-2 shadow-2xs mt-2 transition-all"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> Settle Refund
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No security deposit records found.
                  </div>
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-3 px-4">Tenant Name</TableHead>
                      <TableHead className="py-3 px-4">Email</TableHead>
                      <TableHead className="py-3 px-4">Phone</TableHead>
                      <TableHead className="py-3 px-4">Occupancy Status</TableHead>
                      <TableHead className="py-3 px-4 text-right">Deposit Held (₹)</TableHead>
                      <TableHead className="py-3 px-4 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length > 0 ? (
                      rows.map((row: any) => (
                        <TableRow key={row.tenantId} className="hover:bg-muted/40">
                          <TableCell className="font-medium text-xs py-3.5 px-4">{row.tenantName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3.5 px-4">{row.email || 'N/A'}</TableCell>
                          <TableCell className="text-xs py-3.5 px-4">{row.phone || 'N/A'}</TableCell>
                          <TableCell className="py-3.5 px-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              row.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            }`}>
                              {row.status.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs text-emerald-600 py-3.5 px-4 font-mono">{formatCurrency(row.depositAmount)}</TableCell>
                          <TableCell className="text-right py-3.5 px-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcessRefund(row.tenantId, row.tenantName)}
                              className="rounded-xl h-9 px-4 py-2 text-xs font-semibold border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 gap-2 shadow-2xs transition-all shrink-0"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" /> Settle Refund
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">
                          No security deposit records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Interactive Settlement & Refund Modal */}
      {settlementTenant && (
        <CheckoutSettlementModal
          isOpen={!!settlementTenant}
          onClose={() => setSettlementTenant(null)}
          tenantId={settlementTenant.id}
          tenantName={settlementTenant.name}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['accountant', 'security-deposits'] });
            queryClient.invalidateQueries({ queryKey: ['accountant', 'ledger'] });
            queryClient.invalidateQueries({ queryKey: ['accountant', 'overview'] });
            toast.success(`Deposit settlement processed successfully!`);
          }}
        />
      )}
    </div>
  );
}
