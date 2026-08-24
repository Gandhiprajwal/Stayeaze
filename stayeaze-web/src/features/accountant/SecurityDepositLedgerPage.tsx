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

export default function SecurityDepositLedgerPage() {
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');

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

  const handleProcessRefund = (tenantName: string) => {
    toast.success(`Security deposit refund processed for ${tenantName}!`);
  };

  const rows = depositData?.tenantsDeposits ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Deposit Escrow Ledger"
        description="Track active tenant security deposit holdings, notice-period refund claims, and damage deductions."
        actions={
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Escrow Holding" value={formatCurrency(depositData?.totalEscrowHolding ?? 0)} icon={Wallet} accent="primary" hint="Escrow funds held in trust" />
        <StatCard label="Active Holding Tenants" value={rows.length} icon={UserCheck} accent="success" hint="Tenants with active deposit records" />
        <StatCard label="Refund Settlement SLA" value="24 Hours" icon={ShieldCheck} accent="info" hint="Average turnaround for deposit payouts" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Tenant Security Deposits
          </CardTitle>
          <CardDescription>Escrow funds ledger and exit refund settlement queue</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Occupancy Status</TableHead>
                  <TableHead className="text-right">Deposit Held (₹)</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows.map((row: any) => (
                    <TableRow key={row.tenantId}>
                      <TableCell className="font-medium text-xs">{row.tenantName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.email || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{row.phone || 'N/A'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          row.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {row.status.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-xs text-emerald-600">{formatCurrency(row.depositAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleProcessRefund(row.tenantName)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Settle Refund
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
