import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Hotel, Users, Wallet, TrendingUp, Building2, CalendarCheck,
  MessageSquareWarning, ArrowUpRight, AlertTriangle,
  Server, Cpu, Database, Activity, Mail, MessageSquare, CreditCard, Radio, Key, Zap, HardDrive, Sparkles
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
import { usePropertyStore } from '@/lib/stores/property-store';
import { useSystemMetricsStream } from '@/lib/hooks/useSystemMetricsStream';
import { useRoleDashboardStream } from '@/lib/hooks/useRoleDashboardStream';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { selectedPropertyId, selectedProperty } = usePropertyStore();
  const { isLiveStreaming } = useSystemMetricsStream();
  const { isLiveStreaming: isRoleStreaming, streamData: roleMetrics } = useRoleDashboardStream();

  const activePropParam = selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId } : {};

  const { data: properties, isLoading: loadingProps } = useQuery({
    queryKey: ['dashboard', 'properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
    staleTime: 60000,
  });
  const { data: buildings } = useQuery({
    queryKey: ['dashboard', 'buildings', selectedPropertyId],
    queryFn: () => api.get<{ data: any[] }>('/buildings', { params: activePropParam }).then((r) => r.data.data),
    enabled: user?.role !== 'SUPER_ADMIN',
    staleTime: 60000,
  });
  const { data: floors } = useQuery({
    queryKey: ['dashboard', 'floors', selectedPropertyId],
    queryFn: () => api.get<{ data: any[] }>('/floors', { params: activePropParam }).then((r) => r.data.data),
    enabled: user?.role !== 'SUPER_ADMIN',
    staleTime: 60000,
  });
  const { data: tenants } = useQuery({
    queryKey: ['dashboard', 'tenants', selectedPropertyId],
    queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { ...activePropParam, pageSize: 50 } }).then((r) => r.data.data),
    staleTime: 60000,
  });
  const { data: invoices } = useQuery({
    queryKey: ['dashboard', 'invoices', selectedPropertyId],
    queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { params: { ...activePropParam, pageSize: 50 } }).then((r) => r.data.data),
    staleTime: 60000,
  });
  const { data: payments } = useQuery({
    queryKey: ['dashboard', 'payments', selectedPropertyId],
    queryFn: () => api.get<{ data: Payment[] }>('/payments', { params: { ...activePropParam, pageSize: 50 } }).then((r) => r.data?.data || []),
    staleTime: 60000,
  });
  const { data: complaints } = useQuery({
    queryKey: ['dashboard', 'complaints', selectedPropertyId],
    queryFn: () => api.get<{ data: Complaint[] }>('/complaints', { params: { ...activePropParam, pageSize: 5, sortBy: 'createdAt', sortOrder: 'desc' } }).then((r) => r.data.data),
    staleTime: 60000,
  });

  // Dedicated Page-Based Server Stats
  const { data: propertyStats } = useQuery({
    queryKey: ['properties-stats', selectedPropertyId],
    queryFn: () => api.get('/properties/stats', { params: activePropParam }).then((r) => r.data || {}),
    staleTime: 60000,
  });

  const { data: tenantStats } = useQuery({
    queryKey: ['tenants-stats', selectedPropertyId],
    queryFn: () => api.get('/tenants/stats', { params: activePropParam }).then((r) => r.data || {}),
    staleTime: 60000,
  });

  const { data: invoiceStats } = useQuery({
    queryKey: ['invoices-stats', selectedPropertyId],
    queryFn: () => api.get('/invoices/stats', { params: activePropParam }).then((r) => r.data || {}),
    staleTime: 60000,
  });

  const { data: complaintStats } = useQuery({
    queryKey: ['complaints-stats', selectedPropertyId],
    queryFn: () => api.get('/complaints/stats', { params: activePropParam }).then((r) => r.data || {}),
    staleTime: 60000,
  });

  // Live SSE metrics with fallback to REST API stats
  const liveActiveTenants = roleMetrics?.activeTenantsCount ?? tenantStats?.activeTenants ?? 0;
  const liveTotalBeds = roleMetrics?.totalBeds ?? propertyStats?.totalBeds ?? 0;
  const liveOccupiedBeds = roleMetrics?.occupiedBeds ?? propertyStats?.occupiedBeds ?? 0;
  const liveOccupancyRate = roleMetrics?.occupancyRate ?? propertyStats?.occupancyRate ?? (liveTotalBeds > 0 ? Math.round((liveOccupiedBeds / liveTotalBeds) * 100) : 0);
  const liveMonthlyRevenue = roleMetrics?.monthlyRevenue != null ? Number(roleMetrics.monthlyRevenue) : (invoiceStats?.monthlyRevenue ? Number(invoiceStats.monthlyRevenue) : 0);
  const overdue = invoiceStats?.overdueInvoicesCount ?? 0;
  const openComplaints = roleMetrics?.openComplaintsCount ?? ((complaintStats?.openComplaints || 0) + (complaintStats?.inProgressComplaints || 0));

  // Month-over-Month Growth Trends from server stats
  const revGrowthPct = invoiceStats?.revenueMomGrowthPct ?? 0;
  const revenueMomTrend = invoiceStats?.monthlyRevenue > 0 || invoiceStats?.prevMonthRevenue > 0 ? {
    value: `${revGrowthPct >= 0 ? '+' : ''}${revGrowthPct}%`,
    direction: revGrowthPct >= 0 ? ('up' as const) : ('down' as const),
    positive: revGrowthPct >= 0,
  } : undefined;

  const activeTenantTrend = undefined;

  const { data: usersData } = useQuery({
    queryKey: ['dashboard', 'all-users'],
    queryFn: () => api.get<{ data: any[]; total?: number }>('/users', { params: { pageSize: 1 } }).then((r) => r.data),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: sysMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['dashboard', 'system-metrics'],
    queryFn: () => api.get<{
      cpu?: number;
      jvm?: { max: number; total: number; used: number; percent?: number };
      db?: { active: number; max: number; percent?: number };
      dbPool?: { active: number; max: number; total: number; idle: number };
      services: {
        redis?: { status: string; rtt: number; engine?: string };
        postgres?: { status: string; rtt: number; engine?: string };
        storage?: { status: string; rtt: number; engine?: string; mode?: string };
        twilio: { status: string; rtt: number };
        smtp: { status: string; rtt: number };
        razorpay: { status: string; rtt: number };
      }
    }>('/system/metrics').then((r) => r.data),
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  const activeSysMetrics = sysMetrics;

  const { data: orgProfile } = useQuery({
    queryKey: ['dashboard', 'org-billing-profile'],
    queryFn: () => api.get<any>('/organization-billing-profile').then((r) => r.data),
    enabled: user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER' || user?.role === 'RECEPTIONIST' || user?.role === 'ACCOUNTANT',
  });

  const renderStatusBadge = (status?: string) => {
    const s = (status || 'disabled').toLowerCase();
    if (s === 'connected' || s === 'up') {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Connected
        </span>
      );
    }
    if (s.includes('in-memory') || s.includes('memory') || s.includes('fallback')) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          In-Memory L2 (Active)
        </span>
      );
    }
    if (s.includes('local') || s.includes('disk')) {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          Local Disk (Active)
        </span>
      );
    }
    if (s === 'disabled' || s === 'inactive') {
      return (
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
          Disabled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold bg-destructive/15 text-destructive border border-destructive/20">
        Down
      </span>
    );
  };

  const redisStatus = activeSysMetrics?.services?.redis?.status;
  const postgresStatus = activeSysMetrics?.services?.postgres?.status;
  const storageStatus = activeSysMetrics?.services?.storage?.status;
  const twilioStatus = activeSysMetrics?.services?.twilio?.status;
  const smtpStatus = activeSysMetrics?.services?.smtp?.status;
  const razorpayStatus = user?.role === 'SUPER_ADMIN'
    ? activeSysMetrics?.services?.razorpay?.status
    : ((orgProfile as any)?.hasRazorpayConfigured ? 'Connected' : 'Disabled');

  const redisConnected = redisStatus?.toLowerCase() === 'connected';
  const postgresConnected = postgresStatus?.toLowerCase() === 'connected';
  const storageConnected = storageStatus?.toLowerCase() === 'connected';
  const twilioConnected = twilioStatus?.toLowerCase() === 'connected';
  const smtpConnected = smtpStatus?.toLowerCase() === 'connected';
  const razorpayConnected = razorpayStatus?.toLowerCase() === 'connected';





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
  const { data: subscribersData } = useQuery({
    queryKey: ['dashboard', 'super-admin-subscribers'],
    queryFn: () => api.get<any>('/super-admin/subscribers').then((r) => {
      const d = r.data;
      if (Array.isArray(d?.data)) return d.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.content)) return d.content;
      return [];
    }),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const pieColors = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))', 'hsl(var(--destructive))'];

  if (user?.role === 'SUPER_ADMIN') {
    const subscribersList: any[] = Array.isArray(subscribersData) ? subscribersData : [];
    const totalSaaSUsers = usersData?.total ?? usersData?.data?.length ?? 0;
    const totalSaaSProps = properties?.length ?? subscribersList.length ?? 0;

    const saasMonthlyRevenue = subscribersList.reduce((acc, s) => acc + (Number(s.planPrice ?? s.subscriptionPlanPrice) || 0), 0);
    const saasProfit = Math.round(saasMonthlyRevenue * 0.85);

    const starterProps = subscribersList.filter((s) => (s.planName || s.subscriptionPlanName || '').toLowerCase().includes('starter')).length;
    const professionalProps = subscribersList.filter((s) => (s.planName || s.subscriptionPlanName || '').toLowerCase().includes('pro')).length;
    const enterpriseProps = subscribersList.filter((s) => (s.planName || s.subscriptionPlanName || '').toLowerCase().includes('enterprise')).length;

    const subscriptionPlans = [
      { name: 'Starter Plan', value: starterProps || 0, color: '#6366f1' },
      { name: 'Professional Plan', value: professionalProps || 0, color: '#2563eb' },
      { name: 'Enterprise Plan', value: enterpriseProps || 0, color: '#16a34a' },
    ].filter((p) => p.value > 0);

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
        const activeSubs = subscribersList.filter((s) => {
          if (!s.startDate && !s.subscriptionStartDate && !s.createdAt) return true;
          const sDate = new Date(s.startDate || s.subscriptionStartDate || s.createdAt);
          const sYear = sDate.getFullYear();
          const sMonth = sDate.getMonth();
          return sYear < m.year || (sYear === m.year && sMonth <= m.monthIndex);
        });

        const revenue = activeSubs.reduce((acc, s) => acc + (Number(s.planPrice ?? s.subscriptionPlanPrice) || 0), 0);
        const profit = Math.round(revenue * 0.85);

        return {
          month: m.name,
          revenue: revenue || saasMonthlyRevenue,
          profit: profit || saasProfit,
        };
      });
    };

    const saasGrowthData = getSaaSGrowthData();

    const jvmUsed = activeSysMetrics?.jvm?.used ? (activeSysMetrics.jvm.used / (1024 * 1024 * 1024)).toFixed(1) : '0.0';
    const jvmMax = activeSysMetrics?.jvm?.max ? (activeSysMetrics.jvm.max / (1024 * 1024 * 1024)).toFixed(1) : '0.0';
    const jvmPercent = (activeSysMetrics?.jvm?.max && activeSysMetrics.jvm.max > 0)
      ? Math.round((activeSysMetrics.jvm.used / activeSysMetrics.jvm.max) * 100)
      : (activeSysMetrics?.jvm?.percent ?? 0);
    const dbActive = activeSysMetrics?.dbPool?.active ?? activeSysMetrics?.db?.active ?? 0;
    const dbMax = activeSysMetrics?.dbPool?.max ?? activeSysMetrics?.db?.max ?? 10;
    const dbPercent = dbMax > 0 ? Math.round((dbActive / dbMax) * 100) : (activeSysMetrics?.db?.percent ?? 0);

    return (
      <div className="space-y-6">
        <PageHeader
          title="SaaS Platform Admin Dashboard"
          description="Real-time multi-tenant system overview, subscription metrics, and infrastructure health."
          actions={
            <div className="flex items-center flex-wrap sm:flex-nowrap gap-2.5 shrink-0 w-full sm:w-auto">
              <Button asChild variant="outline" className="rounded-xl h-10 text-xs sm:text-sm font-semibold gap-1.5 shrink-0 flex-1 sm:flex-none">
                <Link to="/super-admin/integrations">
                  <Key className="h-4 w-4 text-primary shrink-0" />
                  <span className="hidden sm:inline">Configure API Gateways</span>
                  <span className="sm:hidden">API Gateways</span>
                </Link>
              </Button>

              <Button asChild className="rounded-xl h-10 text-xs sm:text-sm font-bold gap-1.5 shrink-0 flex-1 sm:flex-none shadow-xs">
                <Link to="/users">
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">User Accounts</span>
                  <span className="sm:hidden">Users</span>
                </Link>
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
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" /> Server Utilization
                </div>
                {isLiveStreaming && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    LIVE SSE (2s)
                  </span>
                )}
              </CardTitle>
              <CardDescription>StayEaze hosting infrastructure and database node health</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium"><Cpu className="h-4 w-4 text-muted-foreground" /> CPU Utilization</span>
                  <span className="font-semibold text-primary">{activeSysMetrics?.cpu ?? 0}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${activeSysMetrics?.cpu ?? 0}%` }} />
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
                  <span className="font-semibold text-info">{dbActive} Active Pools / {dbMax} Max</span>
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
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-primary" /> Service Connections
                </div>
                {isLiveStreaming && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    LIVE SSE
                  </span>
                )}
              </CardTitle>
              <CardDescription>Real-time channels &amp; response latency</CardDescription>
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
                  {renderStatusBadge(redisStatus)}
                  <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {activeSysMetrics?.services?.redis?.rtt ?? 0}ms</p>
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
                  {renderStatusBadge(postgresStatus)}
                  <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {activeSysMetrics?.services?.postgres?.rtt ?? 2}ms</p>
                </div>
              </div>

              {/* AWS S3 / Local File Storage */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">
                      {activeSysMetrics?.services?.storage?.mode === 'Cloud S3' ? 'AWS S3 Cloud Storage' : 'Local File Storage'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activeSysMetrics?.services?.storage?.engine || 'KYC & Media Storage'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {renderStatusBadge(storageStatus)}
                  <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {activeSysMetrics?.services?.storage?.rtt ?? 1}ms</p>
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
                  {renderStatusBadge(razorpayStatus)}
                  {razorpayConnected && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {activeSysMetrics?.services?.razorpay?.rtt}ms</p>
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
                  {renderStatusBadge(twilioStatus)}
                  {twilioConnected && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {activeSysMetrics?.services?.twilio?.rtt}ms</p>
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
                  {renderStatusBadge(smtpStatus)}
                  {smtpConnected && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {activeSysMetrics?.services?.smtp?.rtt}ms</p>
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
              {subscriptionPlans.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">No Active Subscriptions</p>
                  <p className="text-xs text-muted-foreground">Workspace plan distribution will appear here once organizations subscribe.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={subscriptionPlans} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {subscriptionPlans.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
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
        description={
          selectedPropertyId !== 'ALL' && selectedProperty
            ? `Viewing active operations & metrics for ${selectedProperty.name}.`
            : "Here's what's happening across your entire portfolio today."
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" asChild className="gap-1.5 rounded-xl h-10 text-xs font-semibold">
              <Link to="/tenants"><Users className="h-4 w-4 text-primary" /> + Add Resident</Link>
            </Button>
            <Button variant="outline" asChild className="gap-1.5 rounded-xl h-10 text-xs font-semibold">
              <Link to="/utilities"><Zap className="h-4 w-4 text-amber-500" /> + Sub-Meter</Link>
            </Button>
            <Button asChild className="gap-1.5 rounded-xl h-10 text-xs font-semibold shadow-xs">
              <Link to="/reports"><TrendingUp className="h-4 w-4" /> View Reports</Link>
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingProps ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Total Buildings" value={buildings?.length ?? roleMetrics?.totalBuildings ?? 0} icon={Building2} accent="primary" hint={`${buildings?.length ?? 0} buildings registered`} />
            <StatCard label="Occupancy Rate" value={`${liveOccupancyRate}%`} icon={Building2} accent="success" hint={`${liveOccupiedBeds}/${liveTotalBeds} beds occupied`} />
            <StatCard label="Active Tenants" value={liveActiveTenants} icon={Users} accent="info" trend={activeTenantTrend} hint="Currently checked in" />
            <StatCard label="Monthly Revenue" value={formatCurrency(liveMonthlyRevenue)} icon={Wallet} accent="warning" trend={revenueMomTrend} hint="Collected this month" />
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
