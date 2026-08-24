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
    <div className="space-y-6">
      <PageHeader
        title="General Ledger & Cashbook"
        description="Complete audit-ready double-entry transaction record for rent income credits and property debits."
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

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" /> Journal Entries
              </CardTitle>
              <CardDescription>Real-time credits and debits balance sheet</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search ledger..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="CREDIT">Credits Only</SelectItem>
                  <SelectItem value="DEBIT">Debits Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
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
                      <TableCell className="font-mono text-xs font-semibold">{entry.id}</TableCell>
                      <TableCell className="text-xs">{entry.date}</TableCell>
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
                      <TableCell className={`text-right font-bold text-sm ${entry.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
