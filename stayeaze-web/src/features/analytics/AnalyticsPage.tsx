import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Users, BedDouble, Wallet, Receipt,
  AlertCircle, Building2, ShieldCheck, Download, RefreshCw,
  BarChart3, PieChart as PieChartIcon, Calendar, ArrowUpRight,
  CheckCircle2, Clock, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { usePropertyStore } from '@/lib/stores/property-store';
import { formatCurrency, formatDate } from '@/lib/format';
import api from '@/lib/api';

const AGING_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { selectedPropertyId, setSelectedPropertyId } = usePropertyStore();
  const [timeseriesMonths, setTimeseriesMonths] = useState<number>(12);

  const { data: properties } = useQuery({
    queryKey: ['analytics-properties'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });

  const propertyParam = selectedPropertyId && selectedPropertyId !== 'ALL' ? { propertyId: selectedPropertyId } : {};

  // Overview metrics
  const { data: overview, isLoading: loadingOverview, refetch: refetchOverview } = useQuery({
    queryKey: ['analytics-overview', selectedPropertyId],
    queryFn: () => api.get('/analytics/overview', { params: propertyParam }).then((r) => r.data || {}),
  });

  // 12-Month revenue timeseries
  const { data: timeseriesRaw, isLoading: loadingTimeseries } = useQuery({
    queryKey: ['analytics-timeseries', selectedPropertyId, timeseriesMonths],
    queryFn: () => api.get<any>('/analytics/revenue-timeseries', {
      params: { ...propertyParam, months: timeseriesMonths }
    }).then((r) => r.data),
  });

  // Occupancy breakdown by property
  const { data: occupancyRaw, isLoading: loadingOccupancy } = useQuery({
    queryKey: ['analytics-occupancy', selectedPropertyId],
    queryFn: () => api.get<any>('/analytics/occupancy-breakdown', { params: propertyParam }).then((r) => r.data),
  });

  // Arrears aging & top debtors
  const { data: arrearsData, isLoading: loadingArrears } = useQuery({
    queryKey: ['analytics-arrears', selectedPropertyId],
    queryFn: () => api.get<any>('/analytics/arrears-aging', { params: propertyParam }).then((r) => r.data || {}),
  });

  const occupancyList: any[] = Array.isArray(occupancyRaw)
    ? occupancyRaw
    : Array.isArray((occupancyRaw as any)?.content)
    ? (occupancyRaw as any).content
    : Array.isArray((occupancyRaw as any)?.data)
    ? (occupancyRaw as any).data
    : [];

  const timeseries: any[] = Array.isArray(timeseriesRaw)
    ? timeseriesRaw
    : Array.isArray((timeseriesRaw as any)?.content)
    ? (timeseriesRaw as any).content
    : Array.isArray((timeseriesRaw as any)?.data)
    ? (timeseriesRaw as any).data
    : [];

  const agingBuckets = arrearsData?.agingBuckets || {};
  const topDebtors: any[] = Array.isArray(arrearsData?.topDebtors)
    ? arrearsData.topDebtors
    : Array.isArray((arrearsData as any)?.content)
    ? (arrearsData as any).content
    : [];

  const agingPieData = [
    { name: 'Current (Not Overdue)', value: Number(agingBuckets.current || 0) },
    { name: '1–30 Days Overdue', value: Number(agingBuckets.days1to30 || 0) },
    { name: '31–60 Days Overdue', value: Number(agingBuckets.days31to60 || 0) },
    { name: '60+ Days Overdue', value: Number(agingBuckets.days61Plus || 0) },
  ].filter(item => item.value > 0);

  function exportExecutiveSummary() {
    if (!overview) return;
    const csvContent = [
      ['Metric', 'Value'],
      ['Total Properties', overview.totalProperties || 0],
      ['Total Bed Capacity', overview.totalBeds || 0],
      ['Occupied Beds', overview.occupiedBeds || 0],
      ['Vacant Beds', overview.vacantBeds || 0],
      ['Occupancy Rate', `${overview.occupancyRate || 0}%`],
      ['Active Residents', overview.activeTenantsCount || 0],
      ['Current Month Billed', overview.curMonthBilled || 0],
      ['Current Month Collected', overview.curMonthCollected || 0],
      ['MoM Revenue Growth', `${overview.momRevenueGrowth || 0}%`],
      ['YTD Billed', overview.totalBilledYtd || 0],
      ['YTD Collected', overview.totalCollectedYtd || 0],
      ['Collection Efficiency', `${overview.collectionEfficiency || 0}%`],
      ['Total Outstanding Arrears', overview.totalOverdueAmount || 0],
      ['Total Bad Debt Written Off', overview.totalWrittenOffYtd || 0],
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `StayEaze_Executive_Analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Executive Analytics"
        description="Comprehensive financial performance, occupancy trends, arrears aging, and portfolio health metrics."
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Select
              value={selectedPropertyId || 'ALL'}
              onValueChange={(val) => setSelectedPropertyId(val)}
            >
              <SelectTrigger className="h-9.5 w-[180px] rounded-xl text-xs font-semibold">
                <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Properties</SelectItem>
                {(properties ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={exportExecutiveSummary}
              className="rounded-xl h-9.5 text-xs font-semibold gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export Report
            </Button>
          </div>
        }
      />

      {/* KPI Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Occupancy Rate"
          value={`${overview?.occupancyRate || 0}%`}
          hint={`${overview?.occupiedBeds || 0} of ${overview?.totalBeds || 0} Beds Occupied`}
          icon={BedDouble}
          accent="primary"
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(overview?.curMonthCollected || 0)}
          hint={`Billed: ${formatCurrency(overview?.curMonthBilled || 0)}`}
          icon={Wallet}
          accent="success"
          trend={{
            value: `${Math.abs(overview?.momRevenueGrowth || 0)}% MoM`,
            direction: (overview?.momRevenueGrowth || 0) >= 0 ? 'up' : 'down',
            positive: (overview?.momRevenueGrowth || 0) >= 0,
          }}
        />
        <StatCard
          label="Outstanding Arrears"
          value={formatCurrency(overview?.totalOverdueAmount || 0)}
          hint={`${overview?.overdueInvoicesCount || 0} Overdue Invoices`}
          icon={AlertCircle}
          accent="destructive"
        />
        <StatCard
          label="Collection Efficiency"
          value={`${overview?.collectionEfficiency || 0}%`}
          hint={`YTD Collected: ${formatCurrency(overview?.totalCollectedYtd || 0)}`}
          icon={Receipt}
          accent="info"
        />
      </div>

      {/* Main Charts & Analytics Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="rounded-xl p-1 bg-muted/60">
          <TabsTrigger value="revenue" className="rounded-lg text-xs font-semibold gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Revenue & Collections
          </TabsTrigger>
          <TabsTrigger value="occupancy" className="rounded-lg text-xs font-semibold gap-1.5">
            <BedDouble className="h-3.5 w-3.5" /> Capacity & Occupancy
          </TabsTrigger>
          <TabsTrigger value="arrears" className="rounded-lg text-xs font-semibold gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Arrears Aging & Debtors
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Revenue & Collections Timeseries */}
        <TabsContent value="revenue" className="space-y-4">
          <Card className="rounded-2xl border shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-bold">12-Month Financial Performance Trajectory</CardTitle>
                <CardDescription className="text-xs">
                  Monthly Comparison of Total Invoiced vs Actual Collections vs Accrued Arrears
                </CardDescription>
              </div>
              <Select
                value={String(timeseriesMonths)}
                onValueChange={(val) => setTimeseriesMonths(Number(val))}
              >
                <SelectTrigger className="h-8 w-[120px] rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">Last 6 Months</SelectItem>
                  <SelectItem value="12">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeseries ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="monthShort" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [formatCurrency(Number(val)), name === 'collected' ? 'Collected' : name === 'billed' ? 'Billed' : 'Overdue']}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Legend
                      formatter={(val) => val === 'collected' ? 'Collected Revenue' : val === 'billed' ? 'Invoiced Amount' : 'Overdue Arrears'}
                    />
                    <Area type="monotone" dataKey="billed" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorBilled)" />
                    <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollected)" />
                    <Bar dataKey="overdue" fill="#f43f5e" radius={[4, 4, 0, 0]} opacity={0.8} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Occupancy & Capacity Matrix */}
        <TabsContent value="occupancy" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 rounded-2xl border shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Property Capacity & Bed Allocation Matrix</CardTitle>
                <CardDescription className="text-xs">Live occupancy rate and bed breakdown per building</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {occupancyList.map((prop: any) => (
                    <div key={prop.propertyId} className="py-3.5 space-y-2 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{prop.propertyName}</p>
                          <p className="text-[11px] text-muted-foreground">{prop.address || 'Standard Property'}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold">{prop.occupancyRate}%</span>
                          <p className="text-[11px] text-muted-foreground">
                            {prop.occupiedBeds}/{prop.totalBeds} Beds Occupied
                          </p>
                        </div>
                      </div>
                      <Progress value={prop.occupancyRate} className="h-2 rounded-full" />
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {prop.occupiedBeds} Occupied
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-700" /> {prop.vacantBeds} Vacant
                        </span>
                        {prop.reservedBeds > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-indigo-400" /> {prop.reservedBeds} Reserved
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Portfolio Occupancy Health</CardTitle>
                <CardDescription className="text-xs">Overall allocation breakdown</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center pt-2">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Occupied', value: overview?.occupiedBeds || 0 },
                          { name: 'Vacant', value: overview?.vacantBeds || 0 },
                        ]}
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#cbd5e1" />
                      </Pie>
                      <Tooltip formatter={(val) => [`${val} Beds`, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full pt-2 text-center">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Occupied</p>
                    <p className="text-lg font-bold text-emerald-600">{overview?.occupiedBeds || 0}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Vacant</p>
                    <p className="text-lg font-bold">{overview?.vacantBeds || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Arrears Aging & Top Debtors */}
        <TabsContent value="arrears" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="rounded-2xl border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">Arrears Aging Distribution</CardTitle>
                <CardDescription className="text-xs">Outstanding balances grouped by overdue duration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={agingPieData.length > 0 ? agingPieData : [{ name: 'No Arrears', value: 1 }]}
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {agingPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={AGING_COLORS[index % AGING_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), 'Amount']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 pt-2 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Current / Grace:
                    </span>
                    <span className="font-semibold text-foreground">{formatCurrency(agingBuckets.current || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> 1–30 Days Overdue:
                    </span>
                    <span className="font-semibold text-foreground">{formatCurrency(agingBuckets.days1to30 || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500" /> 31–60 Days Overdue:
                    </span>
                    <span className="font-semibold text-foreground">{formatCurrency(agingBuckets.days31to60 || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-violet-500" /> 60+ Days Overdue:
                    </span>
                    <span className="font-semibold text-foreground">{formatCurrency(agingBuckets.days61Plus || 0)}</span>
                  </div>
                  {Number(agingBuckets.totalWrittenOff || 0) > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t text-muted-foreground">
                      <span>Total Written-off / Waived:</span>
                      <span className="font-bold text-slate-500">{formatCurrency(agingBuckets.totalWrittenOff)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 rounded-2xl border shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Top 10 Resident Debtors</CardTitle>
                <CardDescription className="text-xs">Highest outstanding overdue balances requiring follow-up</CardDescription>
              </CardHeader>
              <CardContent>
                {topDebtors.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    🎉 Excellent! No resident debtors with overdue balances found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-muted-foreground text-[10px] uppercase font-bold">
                          <th className="text-left py-2">Resident</th>
                          <th className="text-left py-2">Room / Bed</th>
                          <th className="text-right py-2">Invoices</th>
                          <th className="text-right py-2">Max Overdue</th>
                          <th className="text-right py-2">Outstanding Due</th>
                          <th className="text-right py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {topDebtors.map((debtor: any) => (
                          <tr key={debtor.tenantId} className="hover:bg-muted/30 transition">
                            <td className="py-2.5 font-medium">
                              <div>{debtor.tenantName}</div>
                              <div className="text-[10px] text-muted-foreground">{debtor.phone || '—'}</div>
                            </td>
                            <td className="py-2.5 text-muted-foreground">
                              {debtor.roomNumber || '—'}{debtor.bedNumber ? ` / ${debtor.bedNumber}` : ''}
                            </td>
                            <td className="py-2.5 text-right font-medium">{debtor.invoiceCount}</td>
                            <td className="py-2.5 text-right">
                              <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-600 dark:border-rose-800">
                                {debtor.maxDaysOverdue} days
                              </Badge>
                            </td>
                            <td className="py-2.5 text-right font-bold text-destructive">
                              {formatCurrency(debtor.totalOutstanding)}
                            </td>
                            <td className="py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => navigate(`/tenants/${debtor.tenantId}`)}
                              >
                                View <ChevronRight className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
