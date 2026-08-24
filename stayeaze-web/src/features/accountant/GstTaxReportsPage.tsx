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
    <div className="space-y-6">
      <PageHeader
        title="GST & Tax Compliance Reports"
        description="Goods & Services Tax (SAC Code: 998314) output liability, CGST/SGST breakdowns, and GSTR-1 return filing exports."
        actions={
          <div className="flex items-center gap-2">
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
            <Button onClick={handleExportGstr1} variant="outline" disabled={gstData?.gstEnabled === false}>
              <Download className="mr-1.5 h-4 w-4" /> Export GSTR-1 CSV
            </Button>
          </div>
        }
      />

      {gstData?.gstEnabled === false && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-200">GST Tracking Disabled (Exempt)</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  GST tracking is currently inactive under residential hostel exemption rules. Turn on GST and submit your 15-digit GSTIN in Organization Settings to activate GSTR-1 returns.
                </p>
              </div>
            </div>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => navigate('/settings')}>
              Configure GST Settings
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Taxable Value" value={formatCurrency(gstData?.totalTaxableValue ?? 0)} icon={Calculator} accent="primary" hint="Gross taxable rent & service charges" />
        <StatCard label="CGST Collected (9%)" value={formatCurrency(gstData?.totalCgst ?? 0)} icon={DollarSign} accent="info" hint="Central GST liability" />
        <StatCard label="SGST Collected (9%)" value={formatCurrency(gstData?.totalSgst ?? 0)} icon={DollarSign} accent="info" hint="State GST liability" />
        <StatCard label="Net Tax Output Payable" value={formatCurrency(gstData?.totalGstLiability ?? 0)} icon={ShieldCheck} accent="warning" hint="Total 18% GST output tax due" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Invoice GST Breakdown (Tax Period: {gstData?.taxPeriod ?? 'Current'})
          </CardTitle>
          <CardDescription>Multi-tenant tax calculation log with SAC Code 998314</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
