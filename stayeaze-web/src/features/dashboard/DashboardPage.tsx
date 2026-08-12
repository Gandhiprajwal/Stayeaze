import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Hotel, Users, Wallet, TrendingUp, Building2, CalendarCheck,
  MessageSquareWarning, ArrowUpRight, AlertTriangle,
  Server, Cpu, Database, Activity, Mail, MessageSquare, CreditCard, Radio, Key, Zap, HardDrive,

} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, PieChart, Pie, Cell, Legend,
} from 'recharts';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate, initials, occupancyRate } from '@/lib/format';
import api from '@/lib/api';
import type { Property, Tenant, Invoice, Payment, Complaint } from '@/lib/types';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: properties, isLoading: loadingProps } = useQuery({
    queryKey: ['dashboard', 'properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });
  const { data: buildings } = useQuery({
    queryKey: ['dashboard', 'buildings'],
    queryFn: () => api.get<{ data: any[] }>('/buildings').then((r) => r.data.data),
    enabled: user?.role !== 'SUPER_ADMIN',
  });
  const { data: floors } = useQuery({
    queryKey: ['dashboard', 'floors'],
    queryFn: () => api.get<{ data: any[] }>('/floors').then((r) => r.data.data),
    enabled: user?.role !== 'SUPER_ADMIN',
  });
  const { data: tenants } = useQuery({
    queryKey: ['dashboard', 'tenants'],
    queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const { data: invoices } = useQuery({
    queryKey: ['dashboard', 'invoices'],
    queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const { data: payments } = useQuery({
    queryKey: ['dashboard', 'payments'],
    queryFn: () => api.get<{ data: Payment[] }>('/payments', { params: { pageSize: 100 } }).then((r) => r.data?.data || []),
  });
  const { data: complaints } = useQuery({
    queryKey: ['dashboard', 'complaints'],
    queryFn: () => api.get<{ data: Complaint[] }>('/complaints', { params: { pageSize: 5, sortBy: 'createdAt', sortOrder: 'desc' } }).then((r) => r.data.data),
  });

  // Accurate Active Tenants (excluding checked out / archived / inactive)
  const activeTenantsList = (tenants ?? []).filter((t) => {
    const st = (t.status || '').toLowerCase();
    return st === 'active' || st === 'checked_in';
  });
  const activeTenants = activeTenantsList.length;

  // Accurate Total & Occupied Beds calculation
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
    : (occupiedBedsFromBuildings > 0 ? occupiedBedsFromBuildings : (occupiedBedsFromFloors > 0 ? occupiedBedsFromFloors : activeTenants));

  const occupiedBeds = totalBeds > 0 
    ? Math.min(totalBeds, Math.max(rawOccupiedBeds, activeTenants)) 
    : activeTenants;

  const occupancy = totalBeds > 0 ? Math.min(100, Math.max(0, Math.round((occupiedBeds / totalBeds) * 1000) / 10)) : 0;
  const invoicePaidTotal = invoices?.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.paidAmount || 0), 0) ?? 0;
  const paymentCollectionsTotal = payments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0;
  const monthlyRevenue = invoicePaidTotal + paymentCollectionsTotal;
  const overdue = invoices?.filter((i) => i.status === 'overdue').length ?? 0;
  const openComplaints = complaints?.filter((c) => c.status === 'open' || c.status === 'in_progress').length ?? 0;

  // Accurate Real Month-over-Month (MoM) Growth Trends
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevMonthYear = curMonth === 0 ? curYear - 1 : curYear;

  const curMonthRev = (payments ?? []).filter((p) => {
    if (p.status !== 'success') return false;
    const d = new Date(p.date || (p as any).createdAt || Date.now());
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  }).reduce((s, p) => s + (p.amount || 0), 0);

  const prevMonthRev = (payments ?? []).filter((p) => {
    if (p.status !== 'success') return false;
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

  const curMonthTenantsCount = (tenants ?? []).filter((t) => {
    if (!t.createdAt) return false;
    const d = new Date(t.createdAt);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  }).length;

  const prevMonthTenantsCount = (tenants ?? []).filter((t) => {
    if (!t.createdAt) return false;
    const d = new Date(t.createdAt);
    return d.getFullYear() === prevMonthYear && d.getMonth() === prevMonth;
  }).length;

  const tenantGrowthDiff = curMonthTenantsCount - prevMonthTenantsCount;
  const activeTenantTrend = (curMonthTenantsCount > 0 || prevMonthTenantsCount > 0) ? {
    value: `${tenantGrowthDiff >= 0 ? '+' : ''}${tenantGrowthDiff}`,
    direction: tenantGrowthDiff >= 0 ? ('up' as const) : ('down' as const),
    positive: tenantGrowthDiff >= 0,
  } : undefined;

  const { data: allUsers } = useQuery({
    queryKey: ['dashboard', 'all-users'],
    queryFn: () => api.get<{ data: any[] }>('/users', { params: { pageSize: 100 } }).then((r) => r.data?.data || []),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: sysMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['dashboard', 'system-metrics'],
    queryFn: () => api.get<{
      cpu: number;
      jvm: { max: number; total: number; used: number; percent: number };
      db: { active: number; max: number; percent: number };
      services: {
        redis?: { status: string; rtt: number };
        postgres?: { status: string; rtt: number };
        storage?: { status: string; rtt: number };
        twilio: { status: string; rtt: number };
        smtp: { status: string; rtt: number };
        razorpay: { status: string; rtt: number };
      }
    }>('/system/metrics').then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: orgProfile } = useQuery({
    queryKey: ['dashboard', 'org-billing-profile'],
    queryFn: () => api.get<any>('/organization-billing-profile').then((r) => r.data),
    enabled: user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER' || user?.role === 'RECEPTIONIST' || user?.role === 'ACCOUNTANT',
  });

  const redisConnected = sysMetrics?.services?.redis?.status?.toLowerCase() === 'connected';
  const postgresConnected = sysMetrics?.services?.postgres?.status?.toLowerCase() === 'connected';
  const storageConnected = sysMetrics?.services?.storage?.status?.toLowerCase() === 'connected';
  const twilioConnected = sysMetrics?.services?.twilio?.status?.toLowerCase() === 'connected';
  const smtpConnected = sysMetrics?.services?.smtp?.status?.toLowerCase() === 'connected';
  const razorpayConnected = user?.role === 'SUPER_ADMIN'
    ? sysMetrics?.services?.razorpay?.status?.toLowerCase() === 'connected'
    : !!((orgProfile as any)?.hasRazorpayConfigured);





  // Dynamic trend chart data computed from invoices
  const getRevenueTrend = () => {
    if (!invoices || invoices.length === 0) {
      return [
        { month: 'Jan', revenue: 0, collections: 0 },
        { month: 'Feb', revenue: 0, collections: 0 },
        { month: 'Mar', revenue: 0, collections: 0 },
        { month: 'Apr', revenue: 0, collections: 0 },
        { month: 'May', revenue: 0, collections: 0 },
        { month: 'Jun', revenue: 0, collections: 0 },
        { month: 'Jul', revenue: 0, collections: 0 },
      ];
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTotals: Record<string, { billed: number; collected: number; index: number }> = {};

    invoices.forEach((inv) => {
      const dateStr = inv.dueDate || inv.createdAt;
      if (!dateStr) return;
      const date = new Date(dateStr);
      const monthName = months[date.getMonth()];

      if (!monthlyTotals[monthName]) {
        monthlyTotals[monthName] = { billed: 0, collected: 0, index: date.getMonth() };
      }

      monthlyTotals[monthName].billed += inv.amount || 0;
      monthlyTotals[monthName].collected += inv.paidAmount || 0;
    });

    const sortedMonths = Object.keys(monthlyTotals).sort((a, b) => monthlyTotals[a].index - monthlyTotals[b].index);
    return sortedMonths.map((m) => ({
      month: m,
      revenue: monthlyTotals[m].billed,
      collections: monthlyTotals[m].collected,
    }));
  };

  const revenueTrend = getRevenueTrend();

  const occupancyByProperty = user?.role === 'SUPER_ADMIN'
    ? (properties ?? []).slice(0, 4).map((p) => ({
        name: p.code,
        occupied: p.occupiedBeds,
        available: p.totalBeds - p.occupiedBeds,
      }))
    : (buildings ?? []).slice(0, 5).map((b) => {
        const bFloors = (floors ?? []).filter((f) => f.buildingId === b.id);
        const occupied = bFloors.reduce((sum, f) => sum + (f.occupied || 0), 0);
        const total = bFloors.reduce((sum, f) => sum + (f.beds || 0), 0);
        return {
          name: b.code,
          occupied,
          available: Math.max(0, total - occupied),
        };
      });

  const statusDist = [
    { name: 'Paid', value: invoices?.filter((i) => i.status === 'paid').length ?? 0 },
    { name: 'Unpaid', value: invoices?.filter((i) => i.status === 'unpaid').length ?? 0 },
    { name: 'Partial', value: invoices?.filter((i) => i.status === 'partial').length ?? 0 },
    { name: 'Overdue', value: invoices?.filter((i) => i.status === 'overdue').length ?? 0 },
  ];
  const pieColors = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

  if (user?.role === 'SUPER_ADMIN') {
    const totalSaaSUsers = allUsers?.length ?? 0;

    const totalSaaSProps = properties?.length ?? 0;
    const saasMonthlyRevenue = totalSaaSProps * 4999;
    const saasProfit = Math.round(saasMonthlyRevenue * 0.85);

    const starterProps = (properties ?? []).filter((p) => (p.totalBeds ?? 24) < 15).length;
    const professionalProps = (properties ?? []).filter((p) => (p.totalBeds ?? 24) >= 15 && (p.totalBeds ?? 24) <= 50).length;
    const enterpriseProps = (properties ?? []).filter((p) => (p.totalBeds ?? 24) > 50).length;

    const subscriptionPlans = [
      { name: 'Starter Plan', value: starterProps },
      { name: 'Professional Plan', value: professionalProps },
      { name: 'Enterprise Plan', value: enterpriseProps },
    ].filter((p) => p.value > 0);

    const planColors = ['hsl(var(--muted-foreground) / 0.4)', 'hsl(var(--primary))', 'hsl(var(--success))'];

    const getSaaSGrowthData = () => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonthIndex = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const last7Months: { year: number; monthIndex: number; name: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(currentYear, currentMonthIndex - i, 1);
        last7Months.push({
          year: d.getFullYear(),
          monthIndex: d.getMonth(),
          name: months[d.getMonth()],
        });
      }

      return last7Months.map((m) => {
        const activeProps = (properties ?? []).filter((p) => {
          if (!p.createdAt) return true;
          const pDate = new Date(p.createdAt);
          const pYear = pDate.getFullYear();
          const pMonth = pDate.getMonth();
          return pYear < m.year || (pYear === m.year && pMonth <= m.monthIndex);
        });

        const revenue = activeProps.length * 4999;
        const profit = Math.round(revenue * 0.85);

        return {
          month: m.name,
          revenue,
          profit,
        };
      });
    };

    const saasGrowthData = getSaaSGrowthData();

    const jvmUsed = sysMetrics ? (sysMetrics.jvm.used / (1024 * 1024 * 1024)).toFixed(1) : '0.0';
    const jvmMax = sysMetrics ? (sysMetrics.jvm.max / (1024 * 1024 * 1024)).toFixed(1) : '0.0';
    const jvmPercent = Math.round(sysMetrics?.jvm.percent ?? 0);
    const dbPercent = Math.round(sysMetrics?.db.percent ?? 0);



    return (
      <div className="space-y-6">
        <PageHeader
          title="SaaS Platform Admin Dashboard"
          description="Real-time multi-tenant system overview, subscription metrics, and infrastructure health."
          actions={
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to="/super-admin/integrations">
                  <Key className="mr-1.5 h-4 w-4 text-primary" /> Configure API Gateways
                </Link>
              </Button>

              <Button asChild>
                <Link to="/users"><Users className="mr-1.5 h-4 w-4" /> User Accounts</Link>
              </Button>
            </div>
          }
        />

        {/* Key Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total SaaS Tenants" value={totalSaaSProps} icon={Hotel} accent="primary" hint="Active property workspaces" />
          <StatCard label="Total System Users" value={totalSaaSUsers} icon={Users} accent="info" hint="Registered accounts globally" />
          <StatCard label="Monthly SaaS Revenue" value={formatCurrency(saasMonthlyRevenue)} icon={CreditCard} accent="warning" trend={{ value: '+14.2%', direction: 'up', positive: true }} hint="Platform software subscription fees" />
          <StatCard label="Platform Net Profit" value={formatCurrency(saasProfit)} icon={TrendingUp} accent="success" trend={{ value: '+15.8%', direction: 'up', positive: true }} hint="85% profit margin after hosting costs" />
        </div>

        {/* Server & Service Health Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Server Resource Utilization */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" /> Server Utilization
              </CardTitle>
              <CardDescription>StayEaze hosting infrastructure and database node health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium"><Cpu className="h-4 w-4 text-muted-foreground" /> CPU Utilization</span>
                  <span className="font-semibold text-primary">{sysMetrics?.cpu ?? 0}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${sysMetrics?.cpu ?? 0}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium"><Activity className="h-4 w-4 text-muted-foreground" /> JVM Memory Pool</span>
                  <span className="font-semibold text-success">{jvmUsed} GB / {jvmMax} GB ({jvmPercent}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${jvmPercent}%` }} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium"><Database className="h-4 w-4 text-muted-foreground" /> PostgreSQL Active Connection Pool</span>
                  <span className="font-semibold text-info">{sysMetrics?.db.active ?? 0} Active Pools / {sysMetrics?.db.max ?? 10} Max</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-info rounded-full transition-all duration-500" style={{ width: `${dbPercent}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Third-party Connected Services */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" /> Service Connections
              </CardTitle>
              <CardDescription>Real-time channels & response latency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Redis */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Redis Cache Engine</p>
                    <p className="text-xs text-muted-foreground">In-memory L2 Cache</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    redisConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {redisConnected ? 'Connected' : 'Down'}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services?.redis?.rtt ?? 0}ms</p>
                </div>
              </div>

              {/* PostgreSQL */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">PostgreSQL Database</p>
                    <p className="text-xs text-muted-foreground">Primary DB Cluster</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    postgresConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {postgresConnected ? 'Connected' : 'Down'}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services?.postgres?.rtt ?? 2}ms</p>
                </div>
              </div>

              {/* AWS S3 / File Storage */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">AWS S3 / File Storage</p>
                    <p className="text-xs text-muted-foreground">KYC & Media Storage</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    storageConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {storageConnected ? 'Connected' : 'Down'}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services?.storage?.rtt ?? 4}ms</p>
                </div>
              </div>

              {/* Payment Gateway (Razorpay) */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">Payment Gateway (Razorpay)</p>
                    <p className="text-xs text-muted-foreground">Webhook active listener</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    razorpayConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {razorpayConnected ? 'Connected' : 'Down'}
                  </span>
                  {razorpayConnected && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services?.razorpay?.rtt}ms</p>
                  )}
                </div>
              </div>

              {/* OTP Service */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">OTP Service (Twilio/SMS)</p>
                    <p className="text-xs text-muted-foreground">Gateway status</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    twilioConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {twilioConnected ? 'Connected' : 'Down'}
                  </span>
                  {twilioConnected && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services?.twilio?.rtt}ms</p>
                  )}
                </div>
              </div>

              {/* Email Dispatcher (SMTP) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Email Dispatcher (SMTP)</p>
                    <p className="text-xs text-muted-foreground">Notification SMTP relay</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                    smtpConnected ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                  }`}>
                    {smtpConnected ? 'Connected' : 'Down'}
                  </span>
                  {smtpConnected && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services?.smtp?.rtt}ms</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* SaaS Monthly Growth Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>SaaS Subscription Revenues & Profit</CardTitle>
              <CardDescription>Monthly growth trend based on active tenant billing cycles</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={saasGrowthData} margin={{ left: -10, right: 10 }}>
                  <defs>
                    <linearGradient id="saasRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="saasProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#saasRev)" name="SaaS Revenue" />
                  <Area type="monotone" dataKey="profit" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#saasProf)" name="Net Profit" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Active Workspaces plan distributions */}
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans</CardTitle>
              <CardDescription>Workspaces plan distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={subscriptionPlans} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {subscriptionPlans.map((_, i) => (
                      <Cell key={i} fill={planColors[i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>


      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Admin'}`}
        description="Here's what's happening across your portfolio today."
        actions={
          <Button asChild>
            <Link to="/reports"><TrendingUp className="mr-1.5 h-4 w-4" /> View Reports</Link>
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingProps ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Total Buildings" value={buildings?.length ?? 0} icon={Building2} accent="primary" hint={`${buildings?.length ?? 0} buildings registered`} />
            <StatCard label="Occupancy Rate" value={`${occupancy}%`} icon={Building2} accent="success" hint={`${occupiedBeds}/${totalBeds} beds occupied`} />
            <StatCard label="Active Tenants" value={activeTenants} icon={Users} accent="info" trend={activeTenantTrend} hint="Currently checked in" />
            <StatCard label="Monthly Revenue" value={formatCurrency(monthlyRevenue)} icon={Wallet} accent="warning" trend={revenueMomTrend} hint="Collected this month" />
          </>
        )}
      </div>

      {/* Alerts row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-destructive">{overdue} Overdue invoices</p>
              <p className="text-xs text-muted-foreground">Needs immediate follow-up</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <MessageSquareWarning className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-warning">{openComplaints} Open complaints</p>
              <p className="text-xs text-muted-foreground">Awaiting resolution</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{tenants?.filter((t) => t.status === 'notice_period').length ?? 0} Notice periods</p>
              <p className="text-xs text-muted-foreground">Pending check-out</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue & Collections</CardTitle>
            <CardDescription>Last 7 months performance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueTrend} margin={{ left: -10, right: 10 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="col" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" name="Billed" />
                <Area type="monotone" dataKey="collections" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#col)" name="Collected" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Gateway Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Payment Gateway Status
            </CardTitle>
            <CardDescription>Razorpay online payment system status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Razorpay Gateway</p>
                  <p className="text-xs text-muted-foreground">Online rent payments & auto-reconciliation</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  razorpayConnected 
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {razorpayConnected ? 'UP' : 'NOT CONFIGURED'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Occupancy by Building</CardTitle>
            <CardDescription>Beds occupied vs available</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={occupancyByProperty} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="occupied" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} name="Occupied" />
                <Bar dataKey="available" stackId="a" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} name="Available" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent complaints */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent Complaints</CardTitle>
              <CardDescription>Latest raised tickets</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/complaints">View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {complaints?.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-muted text-[10px] font-semibold">{initials(c.tenantName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.description}</p>
                  <p className="text-xs text-muted-foreground">{c.ticketNumber} · {formatDate(c.createdAt)}</p>
                </div>
                <StatusBadge status={c.status} tone={statusTone(c.status)} />
              </div>
            )) ?? <Skeleton className="h-20" />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
