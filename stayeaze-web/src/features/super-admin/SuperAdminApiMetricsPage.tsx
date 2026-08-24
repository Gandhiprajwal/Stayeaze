import { useState } from 'react';
import { 
  Activity, Zap, Server, AlertTriangle, RefreshCw, CheckCircle2, 
  Clock, ShieldAlert, BarChart3, ArrowUpRight, RotateCcw, Building2, TrendingUp
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import api from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  '2xx Success': '#10b981',
  '4xx Warning': '#f59e0b',
  '5xx Error': '#ef4444',
  'Other': '#6366f1',
};

import { useApiMetricsStream } from '@/lib/hooks/useApiMetricsStream';

export default function SuperAdminApiMetricsPage() {
  const queryClient = useQueryClient();
  const { isLiveStreaming } = useApiMetricsStream();

  const { data: metrics, isLoading, isRefetching } = useQuery<any>({
    queryKey: ['super-admin-api-metrics'],
    queryFn: () => api.get('/super-admin/api-metrics').then((r) => r.data),
    refetchInterval: isLiveStreaming ? false : 30000,
    refetchOnWindowFocus: false,
  });

  const resetMetricsMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/super-admin/api-metrics/reset');
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'API hit metrics reset.');
      queryClient.invalidateQueries({ queryKey: ['super-admin-api-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reset metrics');
    },
  });

  const totalHits = metrics?.totalRequests || 0;
  const activeRequests = metrics?.activeRequests || 0;
  const avgLatency = metrics?.avgLatencyMs || 0;
  const rpm = metrics?.requestsPerMinute || 0;
  const errorRate = metrics?.errorRatePercent || 0;
  const topEndpoints = metrics?.topEndpoints || [];
  const orgLeaderboard = metrics?.orgLeaderboard || [];
  const statusCounts = metrics?.statusCounts || {};
  const timeSeriesRaw = metrics?.timeSeries || [];

  const slowEndpoints = topEndpoints.filter((e: any) => e.avgMs > 500 || e.errorRatePercent > 5);

  // Transform time series data for Recharts AreaChart
  const chartData = timeSeriesRaw.map((ts: any) => ({
    time: new Date(ts.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    hits: ts.hits || 0,
    latency: Math.round(ts.avgMs || 0),
  }));

  // If timeSeries is empty, generate baseline chart points
  const displayChartData = chartData.length > 0 ? chartData : [
    { time: '00:00', hits: Math.max(1, totalHits), latency: avgLatency },
  ];

  // Group HTTP status codes for Pie Chart
  let success2xx = 0;
  let warn4xx = 0;
  let err5xx = 0;
  Object.entries(statusCounts).forEach(([code, count]: [string, any]) => {
    const c = parseInt(code);
    if (c >= 200 && c < 300) success2xx += count;
    else if (c >= 400 && c < 500) warn4xx += count;
    else if (c >= 500) err5xx += count;
  });

  const pieData = [
    { name: '2xx Success', value: Math.max(success2xx, totalHits > 0 && warn4xx === 0 && err5xx === 0 ? totalHits : 0) },
    { name: '4xx Warning', value: warn4xx },
    { name: '5xx Error', value: err5xx },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Backend API Hit Metrics"
        description="Real-time HTTP traffic monitoring, latency performance, status codes, and endpoint leaderboards."
        icon={Activity}
        actions={
          <div className="flex items-center gap-3">
            {isLiveStreaming ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                LIVE SSE (2s Push)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Clock className="h-3.5 w-3.5" /> Polling Mode (30s)
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['super-admin-api-metrics'] })}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-primary" /> Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950"
              disabled={resetMetricsMut.isPending}
              onClick={() => {
                if (confirm('Reset all API hit counters and statistics?')) {
                  resetMetricsMut.mutate();
                }
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset Metrics
            </Button>
          </div>
        }
      />

      {/* Primary Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total API Hits</p>
              <p className="text-2xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">{totalHits.toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Req / Min (RPM)</p>
              <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{rpm}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-900/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Latency</p>
              <p className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400">{avgLatency} ms</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Concurrency</p>
              <p className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">{activeRequests}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className={errorRate > 5 ? 'border-rose-400 dark:border-rose-800 bg-rose-50/20 shadow-sm' : 'border-slate-200 dark:border-slate-800 shadow-sm'}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Error Rate</p>
              <p className={`text-2xl font-extrabold font-mono ${errorRate > 5 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>{errorRate}%</p>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${errorRate > 5 ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LIVE RECHARTS: Real-time Throughput & Latency Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between border-b">
            <div>
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-500" /> Live API Throughput & Latency
              </CardTitle>
              <CardDescription className="text-xs">Real-time requests per minute & latency timeline</CardDescription>
            </div>
            {isRefetching && (
              <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Live Syncing...
              </span>
            )}
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayChartData}>
                  <defs>
                    <linearGradient id="colorHits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="hits" name="API Hits" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHits)" />
                  <Area yAxisId="right" type="monotone" dataKey="latency" name="Latency (ms)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorLatency)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* HTTP Status Code Distribution Chart */}
        <Card>
          <CardHeader className="p-5 pb-2 border-b">
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-500" /> Status Code Distribution
            </CardTitle>
            <CardDescription className="text-xs">HTTP 2xx vs 4xx vs 5xx breakdown</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex flex-col items-center justify-center">
            {pieData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
                No HTTP status responses recorded yet.
              </div>
            ) : (
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#6366f1'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Slow Endpoints Warning Banner */}
      {slowEndpoints.length > 0 && (
        <Card className="border-rose-300 dark:border-rose-900/80 bg-rose-50/50 dark:bg-rose-950/20">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-extrabold text-rose-900 dark:text-rose-200 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span>Slow APIs & High Error Alerts ({slowEndpoints.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {slowEndpoints.map((se: any) => (
              <div key={se.method + se.uri} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40">
                <div className="flex items-center gap-2 font-mono">
                  <Badge variant="outline" className={se.method === 'POST' ? 'border-blue-500 text-blue-600' : 'border-emerald-500 text-emerald-600'}>
                    {se.method}
                  </Badge>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{se.uri}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className={se.avgMs > 500 ? 'text-amber-600 font-bold' : ''}>Avg: {se.avgMs} ms</span>
                  <span className={se.errorRatePercent > 5 ? 'text-rose-600 font-bold' : ''}>Errors: {se.errorRatePercent}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Endpoint Hit Leaderboard */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-5 pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-extrabold">Top Endpoint Leaderboard</CardTitle>
              <CardDescription className="text-xs">Most frequently requested backend API endpoints</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[380px] overflow-y-auto">
              {topEndpoints.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No API hits recorded yet. Trigger backend operations to see metrics.</div>
              ) : (
                topEndpoints.map((ep: any) => (
                  <div key={ep.method + ep.uri} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Badge className={
                        ep.method === 'GET' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                        ep.method === 'POST' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                        ep.method === 'PUT' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                        'bg-rose-500/10 text-rose-600 border-rose-500/30'
                      }>
                        {ep.method}
                      </Badge>
                      <span className="font-mono font-medium truncate text-slate-800 dark:text-slate-200">{ep.uri}</span>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right font-mono">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{ep.count}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">hits</span>
                      </div>
                      <div className="w-16">
                        <span className="text-blue-600 dark:text-blue-400">{ep.avgMs} ms</span>
                      </div>
                      <div className="w-12 text-[11px]">
                        <span className={ep.errorRatePercent > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'}>
                          {ep.errorRatePercent}% err
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Organization API Usage Leaderboard */}
        <Card>
          <CardHeader className="p-5 pb-3 border-b">
            <CardTitle className="text-base font-extrabold flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-indigo-500" />
              <span>Workspace Traffic Breakdown</span>
            </CardTitle>
            <CardDescription className="text-xs">API consumption by property workspace</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {orgLeaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No organization traffic captured yet.</p>
            ) : (
              orgLeaderboard.map((org: any) => {
                const percent = Math.min(100, Math.round((org.hits / Math.max(1, totalHits)) * 100));
                return (
                  <div key={org.orgId} className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-muted-foreground">Org ID: {org.orgId.substring(0, 8)}...</span>
                      <span className="font-bold font-mono">{org.hits} hits ({percent}%)</span>
                    </div>
                    <Progress value={percent} className="h-1.5" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
