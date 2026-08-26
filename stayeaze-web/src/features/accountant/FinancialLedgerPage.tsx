import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { ArrowUpRight, ArrowDownRight, Search, ScrollText, Filter, Building2 } from 'lucide-react';
import api from '@/lib/api';

export default function FinancialLedgerPage() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const { data: properties } = useQuery({
    queryKey: ['properties-minimal'],
    queryFn: () => api.get<any>('/properties/minimal').then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []),
  });

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ['accountant', 'ledger', selectedPropertyId],
    queryFn: () => api.get<any>('/accountant/ledger', {
      params: selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId } : undefined
    }).then((r) => r.data),
  });

  const ledger = Array.isArray(ledgerData)
    ? ledgerData
    : Array.isArray(ledgerData?.data)
    ? ledgerData.data
    : Array.isArray(ledgerData?.content)
    ? ledgerData.content
    : [];

  const filteredEntries = ledger.filter((e: any) => {
    const matchesSearch = (e.category?.toLowerCase() || '').includes(search.toLowerCase()) ||
                          (e.description?.toLowerCase() || '').includes(search.toLowerCase()) ||
                          (e.id?.toLowerCase() || '').includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || e.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="General Ledger & Cashbook"
        description="Complete audit-ready double-entry transaction record for rent income credits and property debits."
        actions={
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-[200px] rounded-xl h-10 text-xs sm:text-sm">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Properties</SelectItem>
              {(properties || []).map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card className="rounded-2xl border shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" /> Journal Entries
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Real-time credits and debits balance sheet
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ledger..."
                  className="pl-9 rounded-xl h-10 text-xs sm:text-sm w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-36 rounded-xl h-10 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
                  <SelectItem value="CREDIT" className="text-xs">Credits Only</SelectItem>
                  <SelectItem value="DEBIT" className="text-xs">Debits Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {isLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Mobile View: High-Density Breakdown Cards */}
              <div className="block md:hidden space-y-3.5">
                {filteredEntries.length > 0 ? (
                  filteredEntries.map((entry) => (
                    <div key={entry.id} className="p-4 rounded-2xl border bg-card shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground truncate">{entry.category}</h4>
                          <span className="text-xs text-muted-foreground">{entry.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            entry.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                          }`}>
                            {entry.type === 'CREDIT' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {entry.type}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                            {entry.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between pt-1 border-t border-border/40">
                        <span className="text-xs text-muted-foreground">Transaction Amount</span>
                        <span className={`font-black font-mono text-lg ${entry.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {entry.type === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                        </span>
                      </div>

                      {entry.description && (
                        <p className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl leading-relaxed">
                          {entry.description}
                        </p>
                      )}

                      <div className="text-[11px] font-mono text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded-xl border border-border/40 truncate">
                        Ref: {entry.id}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-xs text-muted-foreground py-12">
                    No matching financial ledger records found.
                  </div>
                )}
              </div>

              {/* Desktop View: Full Tabular View */}
              <div className="hidden md:block rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount (₹)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length > 0 ? (
                      filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-xs font-semibold whitespace-nowrap">{entry.id}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{entry.date}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                              entry.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                            }`}>
                              {entry.type === 'CREDIT' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {entry.type}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-xs">{entry.category}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{entry.description}</TableCell>
                          <TableCell className={`text-right font-bold text-sm whitespace-nowrap ${entry.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {entry.type === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {entry.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                          No matching financial ledger records found.
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
