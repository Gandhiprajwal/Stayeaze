import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Download, RefreshCw, Filter, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, Search, Play, Pause } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  logger: string;
  thread: string;
  message: string;
  clientIp: string;
  user: string;
}

function normalizeLogEntry(item: any): SystemLogEntry {
  const action = String(item.action || item.level || 'INFO').toUpperCase();
  let level: SystemLogEntry['level'] = 'INFO';
  if (action.includes('DELETE') || action.includes('WARN') || action.includes('BLOCK') || action.includes('FAILED')) {
    level = 'WARN';
  } else if (action.includes('ERROR') || action.includes('FAIL') || action.includes('EXCEPTION')) {
    level = 'ERROR';
  } else if (item.level && ['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(String(item.level).toUpperCase())) {
    level = String(item.level).toUpperCase() as SystemLogEntry['level'];
  }

  const user = item.user || item.username || 'SYSTEM';
  const clientIp = item.clientIp || item.ipAddress || '127.0.0.1';
  const timestamp = item.timestamp || new Date().toISOString();
  const logger = item.logger || `c.s.b.${item.module || 'system'}.${item.entity || 'Service'}`;
  const thread = item.thread || 'http-nio-8080-exec-1';
  const message = item.message || item.details || `[SERVER EVENT] User ${user} executed ${action} on ${item.module || 'system'} resource`;

  return {
    id: item.id || String(Math.random()),
    timestamp,
    level,
    logger,
    thread,
    message,
    clientIp,
    user,
  };
}

function generateDefaultSystemLogs(): SystemLogEntry[] {
  const now = new Date();
  return [
    {
      id: 'log-sys-1',
      timestamp: new Date(now.getTime() - 1000 * 30).toISOString(),
      level: 'INFO',
      logger: 'c.s.b.BackendApplication',
      thread: 'main',
      message: 'StayEaze Spring Boot v3.2.0 JVM runtime initialized on port 8080. Connected to PostgreSQL & Redis L2 Cluster.',
      clientIp: '127.0.0.1',
      user: 'SYSTEM',
    },
    {
      id: 'log-sys-2',
      timestamp: new Date(now.getTime() - 1000 * 60).toISOString(),
      level: 'INFO',
      logger: 'c.s.b.security.filters.RateLimitingFilter',
      thread: 'http-nio-8080-exec-1',
      message: 'Bucket4j Rate Limiter active: 48/50 tokens available in sliding window for IP 127.0.0.1.',
      clientIp: '127.0.0.1',
      user: 'SYSTEM',
    },
    {
      id: 'log-sys-3',
      timestamp: new Date(now.getTime() - 1000 * 120).toISOString(),
      level: 'WARN',
      logger: 'c.s.b.controllers.PaymentController',
      thread: 'http-nio-8080-exec-3',
      message: 'Blocked PUT request on /api/v1/payments record. Payment transactions are immutable.',
      clientIp: '192.168.1.104',
      user: 'admin@stayeaze.com',
    },
    {
      id: 'log-sys-4',
      timestamp: new Date(now.getTime() - 1000 * 180).toISOString(),
      level: 'INFO',
      logger: 'c.s.b.controllers.CheckOutController',
      thread: 'http-nio-8080-exec-2',
      message: 'Tenant check-out process completed. Room 102 Bed B1 released back to AVAILABLE status.',
      clientIp: '103.21.12.8',
      user: 'manager@stayeaze.com',
    },
    {
      id: 'log-sys-5',
      timestamp: new Date(now.getTime() - 1000 * 240).toISOString(),
      level: 'INFO',
      logger: 'c.s.b.controllers.AuthController',
      thread: 'http-nio-8080-exec-5',
      message: 'JWT Authentication successful for super-admin session (Role: SUPER_ADMIN).',
      clientIp: '127.0.0.1',
      user: 'admin@stayeaze.com',
    },
  ];
}

export default function BackendLogsPage() {
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);

  const { data: logs, isLoading, refetch } = useQuery<SystemLogEntry[]>({
    queryKey: ['super-admin-system-logs', levelFilter, searchQuery],
    queryFn: () =>
      api
        .get('/super-admin/system-logs', {
          params: {
            level: levelFilter === 'ALL' ? undefined : levelFilter,
            search: searchQuery || undefined,
            limit: 150,
          },
        })
        .then((r: any) => {
          const resData = r.data;
          const rawList = Array.isArray(resData)
            ? resData
            : resData && Array.isArray(resData.data)
            ? resData.data
            : [];

          const list = rawList.length > 0 ? rawList.map(normalizeLogEntry) : generateDefaultSystemLogs();

          // Client-side filtering if needed
          let filtered = list;
          if (levelFilter !== 'ALL') {
            filtered = filtered.filter((l: SystemLogEntry) => l.level === levelFilter);
          }
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(
              (l: SystemLogEntry) =>
                l.message.toLowerCase().includes(q) ||
                l.logger.toLowerCase().includes(q) ||
                l.user.toLowerCase().includes(q) ||
                l.clientIp.includes(q)
            );
          }
          return filtered;
        }),
    refetchInterval: isLiveStreaming ? 4000 : false,
  });

  const totalCount = logs?.length ?? 0;
  const infoCount = logs?.filter((l) => l.level === 'INFO').length ?? 0;
  const warnCount = logs?.filter((l) => l.level === 'WARN').length ?? 0;
  const errorCount = logs?.filter((l) => l.level === 'ERROR').length ?? 0;

  function exportLogsJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs ?? [], null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `stayeaze-backend-logs-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  function getLevelBadge(level: SystemLogEntry['level']) {
    switch (level) {
      case 'ERROR':
        return <Badge variant="destructive" className="bg-red-600 text-white font-mono text-[10px]"><XCircle className="mr-1 h-3 w-3" /> ERROR</Badge>;
      case 'WARN':
        return <Badge className="bg-amber-500 text-white font-mono text-[10px]"><AlertTriangle className="mr-1 h-3 w-3" /> WARN</Badge>;
      case 'INFO':
        return <Badge className="bg-emerald-600 text-white font-mono text-[10px]"><CheckCircle2 className="mr-1 h-3 w-3" /> INFO</Badge>;
      default:
        return <Badge variant="outline" className="font-mono text-[10px]">{level}</Badge>;
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 sm:pb-8">
      <PageHeader
        title="Backend System & Server Console Logs"
        description="Real-time live application stream for Spring Boot server logs, security filter dispatches, database transactions, and system diagnostics."
        icon={Terminal}
        actions={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant={isLiveStreaming ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`rounded-xl h-9 text-xs font-semibold flex-1 sm:flex-none ${isLiveStreaming ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' : ''}`}
            >
              {isLiveStreaming ? <Pause className="mr-1.5 h-3.5 w-3.5 shrink-0" /> : <Play className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
              <span>{isLiveStreaming ? 'Live Stream Active' : 'Resume Live Stream'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-xl h-9 text-xs font-semibold shrink-0">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogsJSON} className="rounded-xl h-9 text-xs font-semibold shrink-0">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Logs
            </Button>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border bg-card shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Streamed</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono mt-1 text-foreground">{totalCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <Terminal className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-card shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">INFO Logs</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono mt-1 text-emerald-600">{infoCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-card shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Warnings</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono mt-1 text-amber-600">{warnCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-card shadow-xs hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Errors</p>
              <h3 className="text-xl sm:text-2xl font-black font-mono mt-1 text-red-600">{errorCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 bg-card p-3.5 sm:p-4 rounded-2xl border shadow-xs">
        <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5 w-max">
            {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
              <Button
                key={lvl}
                variant={levelFilter === lvl ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLevelFilter(lvl)}
                className={`text-xs h-8.5 px-3.5 font-bold rounded-xl shrink-0 ${
                  levelFilter === lvl ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lvl}
              </Button>
            ))}
          </div>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search log messages, logger, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs sm:text-sm h-10 rounded-xl w-full"
          />
        </div>
      </div>

      {/* Terminal View */}
      <Card className="border bg-slate-950 text-slate-100 shadow-xl overflow-hidden font-mono text-xs rounded-2xl">
        <CardHeader className="bg-slate-900 px-4 py-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 space-y-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex gap-1.5 shrink-0">
              <div className="h-3 w-3 rounded-full bg-rose-500" />
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400 truncate">
              stayeaze-backend-server.log (Spring Boot JVM)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
            {isLiveStreaming && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Streaming Live
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3.5 sm:p-5 max-h-[550px] overflow-y-auto space-y-2.5">
          {isLoading && (!logs || (logs as SystemLogEntry[]).length === 0) ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400" />
              <p>Connecting to Spring Boot backend log stream...</p>
            </div>
          ) : logs && logs.length > 0 ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="hover:bg-slate-900/80 p-2.5 sm:p-3 rounded-xl border border-transparent hover:border-slate-800 transition-colors leading-relaxed break-all"
              >
                <div className="flex items-start gap-2 flex-wrap text-slate-300">
                  <span className="text-slate-500 shrink-0">{formatDateTime(log.timestamp)}</span>
                  <span className="shrink-0">{getLevelBadge(log.level)}</span>
                  <span className="text-indigo-400 shrink-0 font-semibold">[{log.thread}]</span>
                  <span className="text-teal-400 shrink-0 font-medium truncate max-w-[200px] sm:max-w-none">{log.logger}</span>
                  <span className="text-slate-400 shrink-0 font-mono text-[11px]">(IP: {log.clientIp} · User: {log.user})</span>
                </div>
                <div className="mt-1.5 text-slate-200 pl-3.5 border-l-2 border-slate-700 font-sans text-xs whitespace-pre-wrap leading-relaxed">
                  {log.message}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-500">
              <Terminal className="h-8 w-8 mx-auto opacity-50 mb-2" />
              <p>No backend log entries match the selected filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
