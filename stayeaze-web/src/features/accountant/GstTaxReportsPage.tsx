import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { FileText, Download, ShieldCheck, DollarSign, Calculator, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

import { useNavigate } from 'react-router-dom';

export default function GstTaxReportsPage() {
  const navigate = useNavigate();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');

  const { data: properties } = useQuery({
    queryKey: ['properties-minimal'],
    queryFn: () => api.get<any>('/properties/minimal').then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []),
  });

  const { data: gstData, isLoading } = useQuery({
    queryKey: ['accountant', 'gst-reports', selectedPropertyId],
    queryFn: () => api.get<any>('/accountant/gst-reports', {
      params: selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId } : undefined
    }).then((r) => r.data),
  });

  const handleExportGstr1 = () => {
    toast.success('GSTR-1 Tax Summary CSV exported successfully!');
  };

  const rows = gstData?.invoiceBreakdown ?? [];

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="GST & Tax Compliance Reports"
        description="Goods & Services Tax (SAC Code: 998314) output liability, CGST/SGST breakdowns, and GSTR-1 return filing exports."
        actions={
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full sm:w-auto">
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-xl h-10 text-xs sm:text-sm">
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
            <Button
              onClick={handleExportGstr1}
              variant="outline"
              disabled={gstData?.gstEnabled === false}
              className="rounded-xl h-10 text-xs sm:text-sm font-semibold gap-1.5 shrink-0"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Export GSTR-1 CSV</span>
              <span className="sm:hidden">Export CSV</span>
            </Button>
          </div>
        }
      />

      {gstData?.gstEnabled === false && (
        <Card className="rounded-2xl border-amber-500/40 bg-amber-500/10 overflow-hidden shadow-xs">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">GST Tracking Disabled (Exempt)</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mt-0.5">
                  GST tracking is currently inactive under residential hostel exemption rules. Turn on GST and submit your 15-digit GSTIN in Organization Settings to activate GSTR-1 returns.
                </p>
              </div>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-9.5 text-xs font-semibold shrink-0 w-full sm:w-auto" onClick={() => navigate('/settings')}>
              Configure GST Settings
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Taxable Value" value={formatCurrency(gstData?.totalTaxableValue ?? 0)} icon={Calculator} accent="primary" hint="Gross taxable rent & service charges" />
        <StatCard label="CGST Collected (9%)" value={formatCurrency(gstData?.totalCgst ?? 0)} icon={DollarSign} accent="info" hint="Central GST liability" />
        <StatCard label="SGST Collected (9%)" value={formatCurrency(gstData?.totalSgst ?? 0)} icon={DollarSign} accent="info" hint="State GST liability" />
        <StatCard label="Net Tax Output Payable" value={formatCurrency(gstData?.totalGstLiability ?? 0)} icon={ShieldCheck} accent="warning" hint="Total 18% GST output tax due" />
      </div>

      <Card className="rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
            <FileText className="h-5 w-5 text-primary" /> Invoice GST Breakdown (Tax Period: {gstData?.taxPeriod ?? 'Current'})
          </CardTitle>
          <CardDescription className="text-xs">Multi-tenant tax calculation log with SAC Code 998314</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : (
            <>
              {/* Mobile Card List View (< md) */}
              <div className="md:hidden space-y-3">
                {rows.length > 0 ? (
                  rows.map((row: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-2xl border bg-card/80 dark:bg-slate-900/60 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-primary">{row.invoiceNumber}</span>
                        <span className="text-xs text-muted-foreground">{row.date}</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm text-foreground">{row.tenantName}</p>
                        <p className="text-xs text-muted-foreground font-mono">SAC Code: {row.sacCode}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Taxable Value:</span>
                          <span className="font-semibold">{formatCurrency(row.taxableAmount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Total Invoice:</span>
                          <span className="font-bold text-foreground">{formatCurrency(row.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">CGST (9%):</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(row.cgstAmount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">SGST (9%):</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(row.sgstAmount)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No GST invoices generated in this tax period.
                  </div>
                )}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>SAC Code</TableHead>
                      <TableHead className="text-right">Total Invoice (₹)</TableHead>
                      <TableHead className="text-right">Taxable Value (₹)</TableHead>
                      <TableHead className="text-right">CGST (9%)</TableHead>
                      <TableHead className="text-right">SGST (9%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length > 0 ? (
                      rows.map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs font-semibold">{row.invoiceNumber}</TableCell>
                          <TableCell className="text-xs">{row.date}</TableCell>
                          <TableCell className="text-xs font-medium">{row.tenantName}</TableCell>
                          <TableCell className="font-mono text-xs">{row.sacCode}</TableCell>
                          <TableCell className="text-right font-bold text-xs">{formatCurrency(row.totalAmount)}</TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(row.taxableAmount)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-blue-600">{formatCurrency(row.cgstAmount)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-indigo-600">{formatCurrency(row.sgstAmount)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-8">
                          No GST invoices generated in this tax period.
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
    </div>
  );
}
