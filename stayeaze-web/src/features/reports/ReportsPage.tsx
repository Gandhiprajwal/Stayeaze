import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Download, TrendingUp, Wallet, Building2, Users,
  AlertTriangle, CheckCircle2, FileText, Calendar, Filter, Printer
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';
import { usePropertyStore } from '@/lib/stores/property-store';
import { exportToCSV, formatCurrency } from '@/lib/format';
import type { Property, Tenant, Invoice, Payment, Complaint } from '@/lib/types';

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState<'all' | '30days' | '90days'>('all');
  const { selectedPropertyId } = usePropertyStore();

  const queryParams = selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId, pageSize: 500 } : { pageSize: 500 };

  const { data: properties } = useQuery({ queryKey: ['rep', 'properties-minimal'], queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []), staleTime: 300000 });
  const { data: buildings } = useQuery({ queryKey: ['rep', 'buildings', selectedPropertyId], queryFn: () => api.get<{ data: any[] }>('/buildings', { params: queryParams }).then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])), staleTime: 300000 });
  const { data: floors } = useQuery({ queryKey: ['rep', 'floors', selectedPropertyId], queryFn: () => api.get<{ data: any[] }>('/floors', { params: queryParams }).then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])), staleTime: 300000 });
  const { data: tenants } = useQuery({ queryKey: ['rep', 'tenants', selectedPropertyId], queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: queryParams }).then((r) => r.data.data), staleTime: 300000 });
  const { data: invoices } = useQuery({ queryKey: ['rep', 'invoices', selectedPropertyId], queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { params: queryParams }).then((r) => r.data.data), staleTime: 300000 });
  const { data: payments } = useQuery({ queryKey: ['rep', 'payments', selectedPropertyId], queryFn: () => api.get<{ data: Payment[] }>('/payments', { params: queryParams }).then((r) => r.data.data), staleTime: 300000 });
  const { data: complaints } = useQuery({ queryKey: ['rep', 'complaints', selectedPropertyId], queryFn: () => api.get<{ data: Complaint[] }>('/complaints', { params: queryParams }).then((r) => r.data.data), staleTime: 300000 });

  // Filter Active Tenants
  const activeTenantsList = (tenants ?? []).filter((t) => {
    const st = (t.status || '').toLowerCase();
    return st === 'active' || st === 'checked_in';
  });
  const activeTenantsCount = activeTenantsList.length;

  // Accurate Total & Occupied Beds
  const totalBedsFromProps = properties?.reduce((s, p) => s + (p.totalBeds || 0), 0) ?? 0;
  const occupiedBedsFromProps = properties?.reduce((s, p) => s + (p.occupiedBeds || 0), 0) ?? 0;
  const totalBedsFromBuildings = (buildings ?? []).reduce((s, b) => s + (b.beds || 0), 0);
  const occupiedBedsFromBuildings = (buildings ?? []).reduce((s, b) => s + (b.occupied || 0), 0);
  const totalBedsFromFloors = (floors ?? []).reduce((s, f) => s + (f.beds || 0), 0);
  const occupiedBedsFromFloors = (floors ?? []).reduce((s, f) => s + (f.occupied || 0), 0);

  const totalBeds = totalBedsFromProps > 0 
    ? totalBedsFromProps 
    : (totalBedsFromBuildings > 0 ? totalBedsFromBuildings : totalBedsFromFloors);

  const rawOccupiedBeds = occupiedBedsFromProps > 0 
    ? occupiedBedsFromProps 
    : (occupiedBedsFromBuildings > 0 ? occupiedBedsFromBuildings : (occupiedBedsFromFloors > 0 ? occupiedBedsFromFloors : activeTenantsCount));

  const effectiveOccupiedBeds = totalBeds > 0 
    ? Math.min(totalBeds, Math.max(rawOccupiedBeds, activeTenantsCount)) 
    : activeTenantsCount;

  const overallOccupancy = totalBeds > 0 ? Math.min(100, Math.max(0, Math.round((effectiveOccupiedBeds / totalBeds) * 1000) / 10)) : 0;

  // Revenue & Collections Calculations
  const totalInvoicePaid = invoices?.filter((i) => (i.status || '').toLowerCase() === 'paid' || (i.status || '').toLowerCase() === 'partial').reduce((s, i) => s + (i.paidAmount || (i as any).amountPaid || i.amount || 0), 0) ?? 0;
  const totalDirectPayments = payments?.filter((p) => (p.status || '').toLowerCase() === 'success' || (p.status || '').toLowerCase() === 'completed').reduce((s, p) => s + (p.amount || 0), 0) ?? 0;
  const totalRevenue = Math.max(totalInvoicePaid, totalDirectPayments);

  const avgRent = activeTenantsCount > 0 ? Math.round(activeTenantsList.reduce((s, t) => s + (t.rent || 0), 0) / activeTenantsCount) : 0;

  // Real MoM Revenue Trend
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevMonthYear = curMonth === 0 ? curYear - 1 : curYear;

  const curMonthRev = (payments ?? []).filter((p) => {
    const d = new Date(p.date || (p as any).createdAt || Date.now());
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  }).reduce((s, p) => s + (p.amount || 0), 0);

  const prevMonthRev = (payments ?? []).filter((p) => {
    const d = new Date(p.date || (p as any).createdAt || Date.now());
    return d.getFullYear() === prevMonthYear && d.getMonth() === prevMonth;
  }).reduce((s, p) => s + (p.amount || 0), 0);

  let revGrowthPct = 0;
  if (prevMonthRev > 0) {
    revGrowthPct = Math.round(((curMonthRev - prevMonthRev) / prevMonthRev) * 1000) / 10;
  } else if (curMonthRev > 0) {
    revGrowthPct = 100;
  }
  const revenueMomTrend = (curMonthRev > 0 || prevMonthRev > 0) ? {
    value: `${revGrowthPct >= 0 ? '+' : ''}${revGrowthPct}%`,
    direction: revGrowthPct >= 0 ? ('up' as const) : ('down' as const),
    positive: revGrowthPct >= 0,
  } : undefined;

  // Monthly Revenue & Occupancy Breakdown for last 6 calendar months
  const getMonthlyTrend = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthList: { month: string; year: number; monthIdx: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthList.push({ month: months[d.getMonth()], year: d.getFullYear(), monthIdx: d.getMonth() });
    }

    return monthList.map((m) => {
      const monthInvRev = (invoices || []).filter((inv) => {
        const dStr = inv.dueDate || inv.createdAt;
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getFullYear() === m.year && d.getMonth() === m.monthIdx;
      }).reduce((s, inv) => s + (inv.paidAmount || 0), 0);

      const monthPayRev = (payments || []).filter((pay) => {
        const dStr = pay.date || (pay as any).paymentDate || (pay as any).createdAt;
        if (!dStr) return false;
        const d = new Date(dStr);
        return d.getFullYear() === m.year && d.getMonth() === m.monthIdx;
      }).reduce((s, pay) => s + (pay.amount || 0), 0);

      const mTenants = (tenants || []).filter((t) => {
        if (!t.createdAt) return false;
        const d = new Date(t.createdAt);
        return d.getFullYear() === m.year && d.getMonth() === m.monthIdx;
      }).length;

      return {
        month: m.month,
        revenue: monthInvRev + monthPayRev,
        occupancy: overallOccupancy,
        tenants: mTenants > 0 ? mTenants : activeTenantsCount,
      };
    });
  };

  const monthlyTrend = getMonthlyTrend();

  // Property Performance Breakdown
  const propertyPerf = (properties ?? []).map((p) => {
    const propInvoices = invoices?.filter((i) => i.propertyId === p.id) ?? [];
    const propPayments = payments?.filter((pay) => (pay as any).propertyId === p.id) ?? [];
    const revenue = propInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
      + propPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
    const occPct = p.totalBeds > 0 ? Math.min(100, Math.round((p.occupiedBeds / p.totalBeds) * 100)) : overallOccupancy;
    return {
      name: p.code || p.name.substring(0, 12),
      revenue,
      occupancy: occPct,
    };
  });

  // Real Complaint Distribution
  const complaintDist = [
    { name: 'Open', value: complaints?.filter((c) => (c.status || '').toLowerCase() === 'open').length ?? 0 },
    { name: 'In Progress', value: complaints?.filter((c) => (c.status || '').toLowerCase() === 'in_progress').length ?? 0 },
    { name: 'Resolved', value: complaints?.filter((c) => (c.status || '').toLowerCase() === 'resolved').length ?? 0 },
    { name: 'Closed', value: complaints?.filter((c) => (c.status || '').toLowerCase() === 'closed').length ?? 0 },
  ];
  const pieColors = ['hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--muted-foreground))'];

  // Real Payment Modes Breakdown
  const cashVal = (payments?.filter((p) => (p.method === 'cash' || (p as any).paymentMethod === 'CASH')).reduce((s, p) => s + (p.amount || 0), 0) ?? 0)
    + (invoices?.filter((i) => i.status === 'paid' && i.paymentMethod === 'CASH').reduce((s, i) => s + (i.paidAmount || 0), 0) ?? 0);

  const upiVal = (payments?.filter((p) => (p.method === 'upi' || (p as any).paymentMethod === 'UPI')).reduce((s, p) => s + (p.amount || 0), 0) ?? 0)
    + (invoices?.filter((i) => i.status === 'paid' && i.paymentMethod === 'UPI').reduce((s, i) => s + (i.paidAmount || 0), 0) ?? 0);

  const razorpayVal = (payments?.filter((p) => (p.method === 'razorpay' || p.method === 'card' || (p as any).paymentMethod === 'RAZORPAY')).reduce((s, p) => s + (p.amount || 0), 0) ?? 0)
    + (invoices?.filter((i) => i.status === 'paid' && (i.paymentMethod === 'RAZORPAY' || (i.paymentMethod as any) === 'CARD')).reduce((s, i) => s + (i.paidAmount || 0), 0) ?? 0);

  const bankVal = (payments?.filter((p) => (p.method === 'bank_transfer' || (p as any).paymentMethod === 'BANK_TRANSFER')).reduce((s, p) => s + (p.amount || 0), 0) ?? 0)
    + (invoices?.filter((i) => i.status === 'paid' && i.paymentMethod === 'BANK_TRANSFER').reduce((s, i) => s + (i.paidAmount || 0), 0) ?? 0);

  const rawPaymentMethods = [
    { name: 'Cash', value: cashVal },
    { name: 'UPI / QR', value: upiVal },
    { name: 'Razorpay / Online', value: razorpayVal },
    { name: 'Bank Transfer', value: bankVal },
  ];

  const paymentMethods = rawPaymentMethods.filter((p) => p.value > 0).length > 0
    ? rawPaymentMethods.filter((p) => p.value > 0)
    : [{ name: 'Direct Collections', value: totalRevenue }];

  function exportReport(name: string, data: readonly object[]) {
    exportToCSV(name, data);
  }

  function handlePrintReport() {
    window.print();
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Reports & Financial Analytics"
        description="Comprehensive analysis of revenue collections, bed occupancy, tenant directory, and complaint resolutions."
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrintReport}>
              <Printer className="mr-1.5 h-4 w-4" /> Print PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportReport('full-financial-summary', invoices ?? [])}>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Portfolio Revenue" value={formatCurrency(totalRevenue)} icon={Wallet} accent="success" trend={revenueMomTrend} hint="Rent & Payment Collections" />
        <StatCard label="Overall Occupancy Rate" value={`${overallOccupancy}%`} icon={Building2} accent="primary" hint={`${effectiveOccupiedBeds}/${totalBeds} beds occupied`} />
        <StatCard label="Active Tenants" value={activeTenantsCount} icon={Users} accent="info" hint="Currently checked in" />
        <StatCard label="Average Rent / Bed" value={formatCurrency(avgRent)} icon={TrendingUp} accent="warning" hint="Monthly average" />
      </div>

      <Tabs defaultValue="financial" className="space-y-6">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="financial">Financial Collections</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy & Capacity</TabsTrigger>
          <TabsTrigger value="operations">Operational Audits</TabsTrigger>
        </TabsList>

        {/* Financial Collections Tab */}
        <TabsContent value="financial" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base font-bold">Revenue & Collections Trend</CardTitle>
                  <CardDescription className="text-xs">Monthly rent collections from invoices & direct payment receipts</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => exportReport('revenue-trend', monthlyTrend)}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={monthlyTrend} margin={{ left: -10, right: 10 }}>
                    <defs>
                      <linearGradient id="rep-rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2.5} fill="url(#rep-rev)" name="Total Revenue (₹)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold">Payment Modes Breakdown</CardTitle>
                <CardDescription className="text-xs">Collections split by Cash, UPI, Razorpay & Bank</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={paymentMethods} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={4}>
                      {paymentMethods.map((_, i) => (
                        <Cell key={i} fill={['#10b981', '#6366f1', '#3b82f6', '#f59e0b', '#ec4899'][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Occupancy & Capacity Tab */}
        <TabsContent value="occupancy" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold">Occupancy & Tenant Growth Rate</CardTitle>
                <CardDescription className="text-xs">Active check-ins vs bed capacity utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={monthlyTrend} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={12} unit="%" />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="occupancy" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Occupancy %" />
                    <Line yAxisId="right" type="monotone" dataKey="tenants" stroke="hsl(var(--info))" strokeWidth={2.5} name="Active Tenants" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold">Property Performance</CardTitle>
                <CardDescription className="text-xs">Revenue generation by property</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={propertyPerf} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Operational Audits Tab */}
        <TabsContent value="operations" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold">Complaint Resolution Efficiency</CardTitle>
                <CardDescription className="text-xs">Distribution of open vs resolved tenant issues</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={complaintDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {complaintDist.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold">Download Data Reports</CardTitle>
                <CardDescription className="text-xs">Export raw data tables to CSV for auditing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Property & Building Master', icon: Building2, data: properties ?? [], name: 'properties_report' },
                  { label: 'Active Tenant Directory', icon: Users, data: tenants ?? [], name: 'tenants_report' },
                  { label: 'Invoice Ledger & Tax Register', icon: FileText, data: invoices ?? [], name: 'invoices_report' },
                  { label: 'Payment Collections Ledger', icon: Wallet, data: payments ?? [], name: 'payments_report' },
                  { label: 'Complaint Resolution Log', icon: AlertTriangle, data: complaints ?? [], name: 'complaints_report' },
                ].map((r) => (
                  <Button key={r.label} variant="outline" className="w-full justify-start text-xs font-medium" onClick={() => exportReport(r.name, r.data as unknown as object[])}>
                    <r.icon className="mr-2 h-4 w-4 text-indigo-500" /> {r.label} <Download className="ml-auto h-4 w-4 text-muted-foreground" />
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
