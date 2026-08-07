import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Download, TrendingUp, Wallet, Building2, Users,
  AlertTriangle, CheckCircle2, FileText,
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
import { exportToCSV, formatCurrency } from '@/lib/format';
import type { Property, Tenant, Invoice, Payment, Complaint } from '@/lib/types';

export default function ReportsPage() {
  const { data: properties } = useQuery({ queryKey: ['rep', 'properties'], queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data) });
  const { data: tenants } = useQuery({ queryKey: ['rep', 'tenants'], queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { pageSize: 100 } }).then((r) => r.data.data) });
  const { data: invoices } = useQuery({ queryKey: ['rep', 'invoices'], queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { params: { pageSize: 100 } }).then((r) => r.data.data) });
  const { data: payments } = useQuery({ queryKey: ['rep', 'payments'], queryFn: () => api.get<{ data: Payment[] }>('/payments', { params: { pageSize: 100 } }).then((r) => r.data.data) });
  const { data: complaints } = useQuery({ queryKey: ['rep', 'complaints'], queryFn: () => api.get<{ data: Complaint[] }>('/complaints', { params: { pageSize: 100 } }).then((r) => r.data.data) });

  const totalRevenue = invoices?.reduce((s, i) => s + i.paidAmount, 0) ?? 0;
  const collectionRate = invoices?.length ? Math.round((invoices.filter((i) => i.status === 'paid').length / invoices.length) * 100) : 0;
  const avgRent = tenants?.length ? Math.round(tenants.reduce((s, t) => s + t.rent, 0) / tenants.length) : 0;

  const getMonthlyTrend = () => {
    if (!invoices || invoices.length === 0) {
      return [
        { month: 'Jan', revenue: 0, occupancy: 0, tenants: 0 },
        { month: 'Feb', revenue: 0, occupancy: 0, tenants: 0 },
        { month: 'Mar', revenue: 0, occupancy: 0, tenants: 0 },
        { month: 'Apr', revenue: 0, occupancy: 0, tenants: 0 },
        { month: 'May', revenue: 0, occupancy: 0, tenants: 0 },
        { month: 'Jun', revenue: 0, occupancy: 0, tenants: 0 },
        { month: 'Jul', revenue: 0, occupancy: 0, tenants: 0 },
      ];
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTotals: Record<string, { revenue: number; index: number }> = {};

    invoices.forEach((inv) => {
      const dateStr = inv.dueDate || inv.createdAt;
      if (!dateStr) return;
      const date = new Date(dateStr);
      const monthName = months[date.getMonth()];

      if (!monthlyTotals[monthName]) {
        monthlyTotals[monthName] = { revenue: 0, index: date.getMonth() };
      }

      monthlyTotals[monthName].revenue += inv.paidAmount || 0;
    });

    const sortedMonths = Object.keys(monthlyTotals).sort((a, b) => monthlyTotals[a].index - monthlyTotals[b].index);
    const totalBeds = properties?.reduce((s, p) => s + p.totalBeds, 0) ?? 0;
    const occupiedBeds = properties?.reduce((s, p) => s + p.occupiedBeds, 0) ?? 0;
    const currentOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const currentTenants = tenants?.length ?? 0;

    return sortedMonths.map((m) => ({
      month: m,
      revenue: monthlyTotals[m].revenue,
      occupancy: currentOccupancy,
      tenants: currentTenants,
    }));
  };

  const monthlyTrend = getMonthlyTrend();

  const propertyPerf = (properties ?? []).map((p) => {
    const propInvoices = invoices?.filter((i) => i.propertyId === p.id) ?? [];
    const revenue = propInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const occupancy = p.totalBeds > 0 ? Math.round((p.occupiedBeds / p.totalBeds) * 100) : 0;
    return {
      name: p.code || p.name.substring(0, 8),
      revenue,
      occupancy,
    };
  });

  const complaintDist = [
    { name: 'Open', value: complaints?.filter((c) => c.status === 'open').length ?? 0 },
    { name: 'In Progress', value: complaints?.filter((c) => c.status === 'in_progress').length ?? 0 },
    { name: 'Resolved', value: complaints?.filter((c) => c.status === 'resolved').length ?? 0 },
    { name: 'Closed', value: complaints?.filter((c) => c.status === 'closed').length ?? 0 },
  ];
  const pieColors = ['hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--muted-foreground))'];

  const paymentMethods = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'].map((m) => ({
    name: m.replace('_', ' '), value: payments?.filter((p) => p.method === m && p.status === 'success').reduce((s, p) => s + p.amount, 0) ?? 0,
  })).filter((p) => p.value > 0);

  function exportReport(name: string, data: readonly object[]) {
    exportToCSV(name, data);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Portfolio performance, financials and operational insights."
        icon={BarChart3}
        actions={
          <Button variant="outline" onClick={() => exportReport('portfolio-summary', properties ?? [])}>
            <Download className="mr-1.5 h-4 w-4" /> Export Summary
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={Wallet} accent="success" trend={{ value: '+7.8%', direction: 'up', positive: true }} />
        <StatCard label="Collection Rate" value={`${collectionRate}%`} icon={CheckCircle2} accent="primary" />
        <StatCard label="Avg. Rent / Bed" value={formatCurrency(avgRent)} icon={TrendingUp} accent="info" />
        <StatCard label="Properties" value={properties?.length ?? 0} icon={Building2} accent="warning" hint={`${tenants?.length ?? 0} tenants`} />
      </div>

      <Tabs defaultValue="financial">
        <TabsList>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div><CardTitle>Revenue Trend</CardTitle><CardDescription>Monthly collections over 7 months</CardDescription></div>
                <Button variant="ghost" size="sm" onClick={() => exportReport('revenue-trend', monthlyTrend)}><Download className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyTrend} margin={{ left: -10, right: 10 }}>
                    <defs>
                      <linearGradient id="rep-rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2.5} fill="url(#rep-rev)" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Payment Methods</CardTitle><CardDescription>By collection volume</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={paymentMethods} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {paymentMethods.map((_, i) => <Cell key={i} fill={['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'][i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, textTransform: 'capitalize' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Occupancy & Tenant Growth</CardTitle><CardDescription>7-month trend</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyTrend} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="occupancy" stroke="hsl(var(--primary))" strokeWidth={2.5} name="Occupancy %" />
                    <Line yAxisId="right" type="monotone" dataKey="tenants" stroke="hsl(var(--info))" strokeWidth={2.5} name="Tenants" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Property Performance</CardTitle><CardDescription>Revenue by property</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={propertyPerf} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Complaint Resolution</CardTitle><CardDescription>Status distribution</CardDescription></CardHeader>
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
            <Card>
              <CardHeader><CardTitle>Quick Reports</CardTitle><CardDescription>Download operational data</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Property Master', icon: Building2, data: properties ?? [], name: 'properties' },
                  { label: 'Tenant Directory', icon: Users, data: tenants ?? [], name: 'tenants' },
                  { label: 'Invoice Register', icon: FileText, data: invoices ?? [], name: 'invoices' },
                  { label: 'Payment Ledger', icon: Wallet, data: payments ?? [], name: 'payments' },
                  { label: 'Complaint Log', icon: AlertTriangle, data: complaints ?? [], name: 'complaints' },
                ].map((r) => (
                  <Button key={r.label} variant="outline" className="w-full justify-start" onClick={() => exportReport(r.name, r.data as unknown as object[])}>
                    <r.icon className="mr-2 h-4 w-4" /> {r.label} <Download className="ml-auto h-4 w-4" />
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
