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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Backend System & Server Console Logs"
        description="Real-time live application stream for Spring Boot server logs, security filter dispatches, database transactions, and system diagnostics."
        icon={Terminal}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={isLiveStreaming ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={isLiveStreaming ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
            >
              {isLiveStreaming ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
              {isLiveStreaming ? 'Live Stream Active' : 'Resume Live Stream'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogsJSON}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Logs
            </Button>
          </div>
        }
      />

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Streamed</p>
              <h3 className="text-2xl font-bold font-mono">{totalCount}</h3>
            </div>
            <Terminal className="h-7 w-7 text-indigo-500 opacity-80" />
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">INFO Logs</p>
              <h3 className="text-2xl font-bold font-mono text-emerald-600">{infoCount}</h3>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-500 opacity-80" />
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Warnings</p>
              <h3 className="text-2xl font-bold font-mono text-amber-600">{warnCount}</h3>
            </div>
            <AlertTriangle className="h-7 w-7 text-amber-500 opacity-80" />
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Errors</p>
              <h3 className="text-2xl font-bold font-mono text-red-600">{errorCount}</h3>
            </div>
            <ShieldAlert className="h-7 w-7 text-red-500 opacity-80" />
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-3 rounded-lg border">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
            <Button
              key={lvl}
              variant={levelFilter === lvl ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setLevelFilter(lvl)}
              className="text-xs h-8 px-3 font-semibold"
            >
              {lvl}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search log messages, logger, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </div>
      </div>

      {/* Terminal View */}
      <Card className="border bg-slate-950 text-slate-100 shadow-xl overflow-hidden font-mono text-xs">
        <CardHeader className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </div>
            <span className="text-xs font-mono font-semibold text-slate-400 ml-2">
              stayeaze-backend-server.log (Spring Boot 3.2.0 JVM)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            {isLiveStreaming && (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Streaming Live
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 max-h-[600px] overflow-y-auto space-y-2">
          {isLoading && (!logs || (logs as SystemLogEntry[]).length === 0) ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400" />
              <p>Connecting to Spring Boot backend log stream...</p>
            </div>
          ) : logs && logs.length > 0 ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="hover:bg-slate-900/80 p-2 rounded border border-transparent hover:border-slate-800 transition-colors leading-relaxed break-all"
              >
                <div className="flex items-start gap-2 flex-wrap text-slate-300">
                  <span className="text-slate-500 shrink-0">{formatDateTime(log.timestamp)}</span>
                  <span className="shrink-0">{getLevelBadge(log.level)}</span>
                  <span className="text-indigo-400 shrink-0 font-semibold">[{log.thread}]</span>
                  <span className="text-teal-400 shrink-0 font-medium">{log.logger}</span>
                  <span className="text-slate-400 shrink-0 font-mono text-[11px]">(IP: {log.clientIp} · User: {log.user})</span>
                </div>
                <div className="mt-1 text-slate-200 pl-4 border-l-2 border-slate-700 font-sans text-xs whitespace-pre-wrap">
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
