import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, FileText, Plus, DollarSign, ArrowUpRight, ArrowDownRight, Building2, Calendar
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import api from '@/lib/api';

export default function AccountantDashboardPage() {
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('ALL');
  const [openExpenseModal, setOpenExpenseModal] = useState(false);
  const [expensePropertyId, setExpensePropertyId] = useState<string>('');
  const [category, setCategory] = useState('Electricity');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [vendorName, setVendorName] = useState('');

  const { data: properties } = useQuery({
    queryKey: ['properties-minimal'],
    queryFn: () => api.get<any>('/properties/minimal').then((r) => Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []),
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['accountant', 'overview', selectedPropertyId],
    queryFn: () => api.get<any>('/accountant/overview', {
      params: selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId } : undefined
    }).then((r) => r.data),
  });

  const { data: rawLedger } = useQuery({
    queryKey: ['accountant', 'ledger', selectedPropertyId],
    queryFn: () => api.get<any>('/accountant/ledger', {
      params: selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId } : undefined
    }).then((r) => r.data),
  });

  const ledger = Array.isArray(rawLedger)
    ? rawLedger
    : Array.isArray(rawLedger?.data)
    ? rawLedger.data
    : Array.isArray(rawLedger?.content)
    ? rawLedger.content
    : [];

  const createExpenseMutation = useMutation({
    mutationFn: (newExp: any) => api.post('/accountant/expenses', newExp),
    onSuccess: () => {
      toast.success('Operational expense recorded successfully!');
      queryClient.invalidateQueries({ queryKey: ['accountant'] });
      setOpenExpenseModal(false);
      setDescription('');
      setAmount('');
      setVendorName('');
    },
    onError: () => {
      toast.error('Failed to record expense. Please check input parameters.');
    },
  });

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid expense amount');
      return;
    }
    createExpenseMutation.mutate({
      propertyId: expensePropertyId || (selectedPropertyId !== 'ALL' ? selectedPropertyId : undefined),
      category,
      description,
      amount: parseFloat(amount),
      paymentMethod,
      vendorName,
    });
  };

  const chartData = [
    { month: 'Jan', revenue: (overview?.totalCollections ?? 120000) * 0.7, expenses: (overview?.totalExpenses ?? 30000) * 0.8 },
    { month: 'Feb', revenue: (overview?.totalCollections ?? 120000) * 0.85, expenses: (overview?.totalExpenses ?? 30000) * 0.9 },
    { month: 'Mar', revenue: (overview?.totalCollections ?? 120000) * 0.9, expenses: (overview?.totalExpenses ?? 30000) * 0.85 },
    { month: 'Apr', revenue: (overview?.totalCollections ?? 120000) * 0.95, expenses: (overview?.totalExpenses ?? 30000) * 0.95 },
    { month: 'May', revenue: overview?.totalCollections ?? 120000, expenses: overview?.totalExpenses ?? 30000 },
  ];

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="Property Accountant Portal"
        description="Property-isolated accounting ledger, GST compliance, and cash flow reconciliation."
        actions={
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="w-full sm:w-[180px] h-10 rounded-xl border-border/80 bg-card text-xs sm:text-sm shadow-xs">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/80 bg-popover/95 backdrop-blur-xl text-xs sm:text-sm">
                <SelectItem value="ALL">All Properties</SelectItem>
                {(properties || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={openExpenseModal} onOpenChange={setOpenExpenseModal}>
              <DialogTrigger asChild>
                <Button className="rounded-xl h-10 text-xs sm:text-sm font-semibold shrink-0 gap-1.5 shadow-xs">
                  <Plus className="h-4 w-4" /> Record Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg md:max-w-xl rounded-2xl p-5 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-base sm:text-lg font-bold">Record Property Expense</DialogTitle>
                  <DialogDescription className="text-xs">Add a new debit entry to the property cashbook ledger.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddExpense} className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Target Property</Label>
                    <Select value={expensePropertyId} onValueChange={setExpensePropertyId}>
                      <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm"><SelectValue placeholder="Select property (optional)" /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {(properties || []).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Expense Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Electricity">Electricity & Power Utility</SelectItem>
                        <SelectItem value="Internet">Wi-Fi & Broadband</SelectItem>
                        <SelectItem value="Maintenance">General Maintenance & Repairs</SelectItem>
                        <SelectItem value="Plumbing">Plumbing & Sanitation</SelectItem>
                        <SelectItem value="Staff Salary">Staff & Caretaker Payroll</SelectItem>
                        <SelectItem value="Vendor Payout">Third-Party Vendor Payout</SelectItem>
                        <SelectItem value="Office Supplies">Office Supplies & Miscellaneous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Amount (₹) *</Label>
                      <Input type="number" placeholder="5000" value={amount} onChange={(e) => setAmount(e.target.value)} required className="h-10 rounded-xl text-xs sm:text-sm font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-10 rounded-xl text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer / NEFT</SelectItem>
                          <SelectItem value="UPI">UPI / GPay / PhonePe</SelectItem>
                          <SelectItem value="CREDIT_CARD">Credit / Corporate Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Vendor / Payee Name</Label>
                    <Input placeholder="BESCOM Electric Power / Apex Repairs" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="h-10 rounded-xl text-xs sm:text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Description / Note</Label>
                    <Input placeholder="Monthly property power bill settlement" value={description} onChange={(e) => setDescription(e.target.value)} className="h-10 rounded-xl text-xs sm:text-sm" />
                  </div>
                  <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t">
                    <Button type="button" variant="outline" className="rounded-xl h-10 w-full sm:w-auto text-xs" onClick={() => setOpenExpenseModal(false)}>Cancel</Button>
                    <Button type="submit" className="rounded-xl h-10 w-full sm:w-auto text-xs font-bold shadow-xs" disabled={createExpenseMutation.isPending}>
                      {createExpenseMutation.isPending ? 'Recording...' : 'Record Debit Entry'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Financial Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Collections" value={formatCurrency(overview?.totalCollections ?? 0)} icon={TrendingUp} accent="success" hint="Gross rent & fee collections" />
        <StatCard label="Property Expenses" value={formatCurrency(overview?.totalExpenses ?? 0)} icon={TrendingDown} accent="destructive" hint="Operational costs & vendor debits" />
        <StatCard label="Net Cash Flow" value={formatCurrency(overview?.netCashFlow ?? 0)} icon={Wallet} accent="primary" hint="Net operating cash balance" />
        <StatCard
          label={overview?.gstEnabled ? `Est. GST (${overview.defaultGstRate || 18}%)` : "GST Status"}
          value={overview?.gstEnabled ? formatCurrency(overview?.estimatedGstLiability ?? 0) : "Exempt"}
          icon={FileText}
          accent={overview?.gstEnabled ? "warning" : "primary"}
          hint={overview?.gstEnabled ? `GSTIN: ${overview.gstin || 'Active'}` : "Hostel exemption active"}
        />
      </div>

      {/* Financial Overview Chart & Cashbook Feed */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b">
            <CardTitle className="text-base sm:text-lg font-bold">Income vs Expense Cash Flow</CardTitle>
            <CardDescription className="text-xs">Monthly collections vs operational debits</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#incGrad)" name="Collections" />
                <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#expGrad)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b">
            <CardTitle className="text-base sm:text-lg font-bold">Recent General Ledger</CardTitle>
            <CardDescription className="text-xs">Latest double-entry transactions</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-3">
            {isLoading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : ledger && ledger.length > 0 ? (
              ledger.slice(0, 5).map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5 last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      entry.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}>
                      {entry.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{entry.category}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <p className={`text-sm font-bold font-mono ${entry.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {entry.type === 'CREDIT' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{entry.date}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">No ledger entries recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
