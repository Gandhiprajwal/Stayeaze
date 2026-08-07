import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Hotel, Users, Wallet, TrendingUp, Building2, CalendarCheck,
  MessageSquareWarning, ArrowUpRight, AlertTriangle,
  Server, Cpu, Database, Activity, Mail, MessageSquare, CreditCard, Radio, Key,
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
import type { Property, Tenant, Invoice, Complaint } from '@/lib/types';
import { useAuthStore } from '@/lib/stores/auth-store';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: properties, isLoading: loadingProps } = useQuery({
    queryKey: ['dashboard', 'properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 100 } }).then((r) => r.data.data),
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
  const { data: complaints } = useQuery({
    queryKey: ['dashboard', 'complaints'],
    queryFn: () => api.get<{ data: Complaint[] }>('/complaints', { params: { pageSize: 5, sortBy: 'createdAt', sortOrder: 'desc' } }).then((r) => r.data.data),
  });

  const totalBeds = properties?.reduce((s, p) => s + p.totalBeds, 0) ?? 0;
  const occupiedBeds = properties?.reduce((s, p) => s + p.occupiedBeds, 0) ?? 0;
  const occupancy = occupancyRate(occupiedBeds, totalBeds);
  const activeTenants = tenants?.filter((t) => t.status === 'active').length ?? 0;
  const monthlyRevenue = invoices?.filter((i) => i.status === 'paid').reduce((s, i) => s + i.paidAmount, 0) ?? 0;
  const overdue = invoices?.filter((i) => i.status === 'overdue').length ?? 0;
  const openComplaints = complaints?.filter((c) => c.status === 'open' || c.status === 'in_progress').length ?? 0;

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
        twilio: { status: string; rtt: number };
        smtp: { status: string; rtt: number };
        razorpay: { status: string; rtt: number };
      }
    }>('/system/metrics').then((r) => r.data),
    refetchInterval: 5000,
    enabled: user?.role === 'SUPER_ADMIN',
  });

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
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [formData, setFormData] = useState({
      smsProvider: 'Twilio',
      emailProvider: 'SMTP',
      allowSelfRegistration: true,
      maintenanceMode: false,
      twilioSid: '',
      twilioAuthToken: '',
      smtpHost: '',
      smtpPort: '587',
      smtpUsername: '',
      smtpPassword: '',
      razorpayKeyId: '',
      razorpayKeySecret: '',
    });

    const { data: systemConfig, refetch: refetchConfig } = useQuery({
      queryKey: ['dashboard', 'system-config'],
      queryFn: () => api.get<any>('/system-configs').then((r) => r.data),
      enabled: user?.role === 'SUPER_ADMIN',
    });

    useEffect(() => {
      if (systemConfig) {
        setFormData({
          smsProvider: systemConfig.smsProvider || 'Twilio',
          emailProvider: systemConfig.emailProvider || 'SMTP',
          allowSelfRegistration: systemConfig.allowSelfRegistration ?? true,
          maintenanceMode: systemConfig.maintenanceMode ?? false,
          twilioSid: systemConfig.twilioSid || '',
          twilioAuthToken: systemConfig.twilioAuthToken || '',
          smtpHost: systemConfig.smtpHost || '',
          smtpPort: systemConfig.smtpPort || '587',
          smtpUsername: systemConfig.smtpUsername || '',
          smtpPassword: systemConfig.smtpPassword || '',
          razorpayKeyId: systemConfig.razorpayKeyId || '',
          razorpayKeySecret: systemConfig.razorpayKeySecret || '',
        });
      }
    }, [systemConfig, showConfigModal]);

    const handleSaveConfig = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await api.put('/system-configs', formData);
        setShowConfigModal(false);
        refetchConfig();
        refetchMetrics();
        toast.success('System API configurations updated successfully!');
      } catch (err) {
        toast.error('Failed to save configuration settings.');
      }
    };

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

    const twilioConnected = sysMetrics?.services.twilio.status === 'Connected';
    const smtpConnected = sysMetrics?.services.smtp.status === 'Connected';
    const razorpayConnected = sysMetrics?.services.razorpay.status === 'Connected';

    return (
      <div className="space-y-6">
        <PageHeader
          title="SaaS Platform Admin Dashboard"
          description="Real-time multi-tenant system overview, subscription metrics, and infrastructure health."
          actions={
            <div className="flex gap-3">
              <Button onClick={() => setShowConfigModal(true)} variant="outline">
                <Key className="mr-1.5 h-4 w-4 text-primary" /> Configure API Gateways
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
              <CardDescription>Integration channels & response latency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4.5 w-4.5 text-primary" />
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services.twilio.rtt}ms</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-b pb-2.5">
                <div className="flex items-center gap-2">
                  <Mail className="h-4.5 w-4.5 text-primary" />
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services.smtp.rtt}ms</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-4.5 w-4.5 text-primary" />
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
                    <p className="text-[10px] text-muted-foreground mt-0.5">RTT: {sysMetrics?.services.razorpay.rtt}ms</p>
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

        {/* API Configurations Modal Overlay */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card border rounded-xl shadow-2xl max-w-2xl w-full text-card-foreground my-8">
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" /> API Gateways & Credentials Configuration
                </h3>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="text-muted-foreground hover:text-foreground rounded-lg p-1 hover:bg-muted"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* SMS Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-primary flex items-center gap-1.5 border-b pb-1">
                    <Radio className="h-4 w-4" /> Twilio SMS Gateway
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Twilio Account SID</label>
                      <input
                        type="text"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={formData.twilioSid}
                        onChange={(e) => setFormData({ ...formData, twilioSid: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Twilio Auth Token</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••••••••••••••••••"
                        value={formData.twilioAuthToken}
                        onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </div>

                {/* SMTP Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-primary flex items-center gap-1.5 border-b pb-1">
                    <Mail className="h-4 w-4" /> SMTP Email Server
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="smtp.mailgun.org"
                        value={formData.smtpHost}
                        onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">SMTP Port</label>
                      <input
                        type="text"
                        placeholder="587"
                        value={formData.smtpPort}
                        onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">SMTP Username</label>
                      <input
                        type="text"
                        placeholder="postmaster@yourdomain.com"
                        value={formData.smtpUsername}
                        onChange={(e) => setFormData({ ...formData, smtpUsername: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">SMTP Password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••••••••••••••••••"
                        value={formData.smtpPassword}
                        onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </div>

                {/* Razorpay Section */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-primary flex items-center gap-1.5 border-b pb-1">
                    <CreditCard className="h-4 w-4" /> Razorpay Payment Gateway
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Razorpay Key ID</label>
                      <input
                        type="text"
                        placeholder="rzp_live_xxxxxxxxxxxxxx"
                        value={formData.razorpayKeyId}
                        onChange={(e) => setFormData({ ...formData, razorpayKeyId: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Razorpay Key Secret</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••••••••••••••••••"
                        value={formData.razorpayKeySecret}
                        onChange={(e) => setFormData({ ...formData, razorpayKeySecret: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                </div>
              </form>

              <div className="flex items-center justify-end gap-3 p-6 border-t">
                <Button type="button" variant="outline" onClick={() => setShowConfigModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" onClick={handleSaveConfig}>
                  Save Settings
                </Button>
              </div>
            </div>
          </div>
        )}
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
            <StatCard label="Occupancy Rate" value={`${occupancy}%`} icon={Building2} accent="success" trend={{ value: '+4.2%', direction: 'up', positive: true }} hint={`${occupiedBeds}/${totalBeds} beds occupied`} />
            <StatCard label="Active Tenants" value={activeTenants} icon={Users} accent="info" trend={{ value: '+12', direction: 'up', positive: true }} hint="Currently checked in" />
            <StatCard label="Monthly Revenue" value={formatCurrency(monthlyRevenue)} icon={Wallet} accent="warning" trend={{ value: '+7.8%', direction: 'up', positive: true }} hint="Collected this month" />
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

        <Card>
          <CardHeader>
            <CardTitle>Invoice Status</CardTitle>
            <CardDescription>Current billing cycle</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {statusDist.map((_, i) => (
                    <Cell key={i} fill={pieColors[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
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
