import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, Search, Filter, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Mail, Phone,
  ChevronRight, RefreshCw, Send, MessageCircle, ChevronLeft, Lock, AlertCircle, Sparkles, User,
  Building2, BedDouble, TrendingUp, Activity, Check, CheckCircle, ArrowUpRight
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { formatDate, formatChatTimestamp } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useWebSocket } from '@/lib/websocket/WebSocketProvider';
import React from 'react';

const ESCALATION_CATEGORY_LABELS: Record<string, string> = {
  GATEWAY_RECONCILIATION: 'Payment Gateway Reconcile',
  CRITICAL_SYSTEM_BUG: 'Critical System Bug',
  SUBSCRIPTION_VALIDITY_PROPOSAL: 'Subscription Validity Override',
  QUOTA_OVERRIDE: 'Enterprise Quota Limit Waiver',
  SECURITY_OWNERSHIP_TRANSFER: 'Security & Primary Ownership Transfer',
  DATA_CORRECTION: 'Database / Cross-Tenant Correction',
};

export default function SuperAdminEscalationsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { subscribe } = useWebSocket();

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ESCALATED'); // Default to active escalations
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] }),
      ]);
      toast({
        title: '✨ Refreshed Successfully',
        description: 'Latest escalation cases and platform statistics synchronized.',
      });
    } catch {
      toast({
        title: 'Refresh Error',
        description: 'Failed to synchronize latest data.',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Active Ticket Drawer State
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'action' | 'chat' | 'health' | 'telemetry'>('action');

  // Super Admin Action Form State
  const [actionStatus, setActionStatus] = useState('RESOLVED');
  const [adminActionNotes, setAdminActionNotes] = useState('');
  const [adminResolutionNotes, setAdminResolutionNotes] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Helper to deduplicate chat messages
  const normalizeMessages = (raw: any): any[] => {
    const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
    const map = new Map<string, any>();
    for (const msg of list) {
      if (!msg) continue;
      const key = msg.id ? String(msg.id) : `${msg.sender?.id || msg.senderRole}-${msg.message}-${msg.createdAt}`;
      map.set(key, msg);
    }
    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  };

  // 1. Fetch Escalated Tickets
  const { data: ticketsResponse, isLoading: loadingTickets, refetch } = useQuery({
    queryKey: ['super-admin-escalations', statusFilter, categoryFilter, page, pageSize, searchTerm],
    queryFn: () =>
      api
        .get('/support/tickets', {
          params: {
            page,
            pageSize,
            status: statusFilter === 'ALL' ? '' : statusFilter,
            category: categoryFilter === 'ALL' ? '' : categoryFilter,
            search: searchTerm,
          },
        })
        .then((r) => r.data),
  });

  // 2. Fetch Support Aggregate Stats
  const { data: stats } = useQuery<any>({
    queryKey: ['support-tickets-stats'],
    queryFn: () => api.get('/support/tickets/stats').then((r) => r.data || {}),
    staleTime: 20000,
  });

  // 3. Fetch Chat Messages Thread for Active Ticket
  const { data: chatMessages = [], isLoading: loadingMessages } = useQuery<any[]>({
    queryKey: ['support-ticket-messages', activeTicket?.id],
    queryFn: async () => {
      if (!activeTicket?.id) return [];
      const res = await api.get(`/support/tickets/${activeTicket.id}/messages`);
      return normalizeMessages(res.data);
    },
    enabled: !!activeTicket?.id,
    staleTime: 0,
  });

  // 4. Fetch Deep Diagnostic Org Health & Telemetry for Active Ticket
  const { data: diagnosticData, isLoading: loadingDiagnostics } = useQuery<any>({
    queryKey: ['support-ticket-diagnostics', activeTicket?.id],
    queryFn: () => api.get(`/support/tickets/${activeTicket?.id}/diagnostics`).then((r) => r.data || {}),
    enabled: !!activeTicket?.id,
    staleTime: 10000,
  });

  // Real-time WebSocket Listeners for Escalations and Active Chat
  useEffect(() => {
    const unsubEscalation = subscribe('/topic/super-admin/escalations', (event: any) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-escalations'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
      toast({
        title: '🚨 High Priority Escalation Received',
        description: `Ticket ${event?.ticketNumber || ''} (${event?.organizationName || 'Subscriber'}) has been escalated for Super Admin review.`,
      });
    });

    return unsubEscalation;
  }, [subscribe, queryClient]);

  useEffect(() => {
    if (!activeTicket?.id) return;
    const unsubChat = subscribe(`/topic/support-tickets/${activeTicket.id}/messages`, (incomingMsg: any) => {
      if (!incomingMsg) return;
      queryClient.setQueryData<any[]>(['support-ticket-messages', activeTicket.id], (current = []) => {
        return normalizeMessages([...(Array.isArray(current) ? current : []), incomingMsg]);
      });
    });
    return unsubChat;
  }, [activeTicket?.id, subscribe, queryClient]);

  // Execute Super Admin Action Mutation
  const superAdminActionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.put(`/support/tickets/${id}/super-admin-action`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-escalations'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
      toast({ title: 'Super Admin Action Executed', description: 'Resolution recorded and attached to support thread.' });
      setActiveTicket(null); // Cleanly close the dialog modal
      setAdminActionNotes('');
      setAdminResolutionNotes('');
    },
    onError: (err: any) => {
      toast({ title: 'Action Execution Failed', description: err.response?.data?.message || 'Failed to apply action.', variant: 'destructive' });
    },
  });

  // Send Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      api.post(`/support/tickets/${ticketId}/messages`, { message }),
    onSuccess: (res) => {
      if (activeTicket?.id && res.data) {
        queryClient.setQueryData<any[]>(['support-ticket-messages', activeTicket.id], (current = []) => {
          return normalizeMessages([...(Array.isArray(current) ? current : []), res.data]);
        });
      }
      setNewChatMessage('');
    },
  });

  const tickets = Array.isArray(ticketsResponse?.data)
    ? ticketsResponse.data
    : Array.isArray(ticketsResponse)
    ? ticketsResponse
    : [];

  const totalElements = ticketsResponse?.totalElements ?? tickets.length;
  const totalPages = ticketsResponse?.totalPages ?? Math.ceil(totalElements / pageSize) ?? 1;

  useEffect(() => {
    if (activeTicket) {
      setActionStatus(activeTicket.status === 'ESCALATED' ? 'RESOLVED' : activeTicket.status || 'RESOLVED');
      setAdminActionNotes(activeTicket.superAdminActionNotes || '');
      setAdminResolutionNotes(activeTicket.resolutionNotes || '');
    }
  }, [activeTicket?.id, activeTicket?.status]);

  useEffect(() => {
    if (activeTicket && chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, activeTicket?.id]);

  const getPriorityBadge = (p: string) => {
    switch (p?.toUpperCase()) {
      case 'URGENT':
        return <Badge variant="destructive" className="text-[10px] font-bold uppercase">Urgent</Badge>;
      case 'HIGH':
        return <Badge variant="destructive" className="bg-orange-600/90 text-white text-[10px] font-bold uppercase">High</Badge>;
      case 'LOW':
        return <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">Low</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] uppercase font-bold">Medium</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'ESCALATED':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 animate-pulse" /> Escalated
          </Badge>
        );
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px] font-bold uppercase bg-emerald-50/50">Resolved</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="border-indigo-500 text-indigo-600 text-[10px] font-bold uppercase bg-indigo-50/50">In Progress</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] font-bold uppercase">Open</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="Super Admin Support Escalations Desk"
        description="High-priority triage console to review technical findings, execute database reconciliations, and override quotas on subscriber tickets escalated by Platform Engineers."
        icon={ShieldAlert}
      />

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5 rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Active Escalations</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-600 mt-2 font-mono">{stats?.escalatedTickets ?? 0}</p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground">Pending Decision</span>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Open Queue</span>
            <Activity className="h-4 w-4 text-indigo-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-2 font-mono">{stats?.openTickets ?? 0}</p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground">Open Inquiries</span>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Resolved</span>
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-2 font-mono">{stats?.resolvedTickets ?? 0}</p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground">Closed Issues</span>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">Platform Total</span>
            <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-2 font-mono">{stats?.totalTickets ?? 0}</p>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground">Lifetime Threads</span>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Escalated Support Tickets Queue
            </CardTitle>
            <CardDescription className="text-xs">
              Showing {tickets.length} of {totalElements} escalated cases
            </CardDescription>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56 md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ticket #, title, org..."
                className="pl-8 text-xs h-9 rounded-xl w-full"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-36 text-xs h-9 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ESCALATED" className="text-xs font-bold text-amber-600">Escalated Only</SelectItem>
                <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="RESOLVED" className="text-xs">Resolved</SelectItem>
                <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                <SelectItem value="OPEN" className="text-xs">Open</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              className="h-9 px-2.5 text-xs font-semibold gap-1.5 border-border hover:bg-muted rounded-xl shrink-0"
              disabled={isRefreshing || loadingTickets}
              onClick={handleManualRefresh}
              title="Refresh queue"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : 'text-muted-foreground'}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadingTickets ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-amber-600" />
              <p>Loading escalated tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-1" />
              <p className="font-semibold text-slate-800 dark:text-white">No Escalated Tickets Found</p>
              <p className="text-[11px] max-w-sm mx-auto">
                {statusFilter === 'ESCALATED'
                  ? 'All escalated subscriber tickets have been resolved or handed back to Support.'
                  : 'No tickets match the selected filter criteria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t: any) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-2xs cursor-pointer ${
                    t.status === 'ESCALATED'
                      ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                      : 'bg-card/70 hover:bg-card border-border/60'
                  }`}
                  onClick={() => {
                    setActiveTicket(t);
                    setActiveTab('action');
                  }}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                        {t.ticketNumber}
                      </span>
                      <h4 className="font-semibold text-sm">{t.title}</h4>
                      {getPriorityBadge(t.priority)}
                      {getStatusBadge(t.status)}
                      {t.escalationCategory && (
                        <Badge variant="outline" className="text-[10px] font-bold text-amber-700 bg-amber-50/50 dark:bg-amber-950/30 border-amber-300">
                          {ESCALATION_CATEGORY_LABELS[t.escalationCategory] || t.escalationCategory}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>

                    {/* Highlighted Escalation Brief Banner */}
                    {t.escalationNotes && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                        <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                          Support Diagnostic Findings:
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 font-mono text-[11px] whitespace-pre-wrap">{t.escalationNotes}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap pt-1">
                      <span>Org: <strong>{t.organization?.name || 'SaaS Subscriber'}</strong> ({t.organization?.subdomain || 'system'}.stayeaze.com)</span>
                      <span>Creator: <strong>{t.createdBy?.email || 'Owner'}</strong></span>
                      <span>Category: <strong className="uppercase">{t.category?.replace(/_/g, ' ')}</strong></span>
                      <span>Escalated: {formatDate(t.escalatedAt || t.updatedAt || t.createdAt)}</span>
                      {t.resolvedAt && <span>Resolved: {formatDate(t.resolvedAt)}</span>}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="shrink-0 text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTicket(t);
                      setActiveTab('action');
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Review & Execute Action <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>
                  Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalElements)} of {totalElements}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <span className="px-2 font-medium">
                  Page {page} of {Math.max(1, totalPages)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAILED SUPER ADMIN RESOLUTION & DIAGNOSTICS MODAL */}
      <Dialog open={!!activeTicket} onOpenChange={(open) => !open && setActiveTicket(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200">
                    {activeTicket?.ticketNumber}
                  </span>
                  <DialogTitle className="text-base sm:text-lg font-bold">{activeTicket?.title}</DialogTitle>
                  {activeTicket && getStatusBadge(activeTicket.status)}
                </div>
                <DialogDescription className="text-xs">
                  {activeTicket?.organization?.name || 'SaaS Subscriber'} • Created by {activeTicket?.createdBy?.email} ({formatDate(activeTicket?.createdAt)})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-2 pb-1 overflow-x-auto scrollbar-none">
              <TabsList className="flex items-center gap-1 w-max min-w-full sm:w-auto h-10 bg-muted/70 p-1 rounded-xl">
                <TabsTrigger value="action" className="text-xs font-semibold gap-1.5 px-3 rounded-lg shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" /> Admin Action
                </TabsTrigger>
                <TabsTrigger value="chat" className="text-xs font-semibold gap-1.5 px-3 rounded-lg shrink-0">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" /> Ticket Thread
                </TabsTrigger>
                <TabsTrigger value="health" className="text-xs font-semibold gap-1.5 px-3 rounded-lg shrink-0">
                  <Building2 className="h-3.5 w-3.5 shrink-0" /> Org Health &amp; Quotas
                </TabsTrigger>
                <TabsTrigger value="telemetry" className="text-xs font-semibold gap-1.5 px-3 rounded-lg shrink-0">
                  <Activity className="h-3.5 w-3.5 shrink-0" /> Telemetry Trace
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: Super Admin Action & Resolution Execution */}
            <TabsContent value="action" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> Support Team Escalation Findings
                </h4>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-muted-foreground font-semibold">Category: </span>
                    <Badge variant="outline" className="font-mono font-bold text-[11px] text-amber-700 bg-amber-50 border-amber-300">
                      {activeTicket?.escalationCategory}
                    </Badge>
                  </div>
                  <div className="p-2.5 bg-card rounded border font-mono text-[11px] whitespace-pre-wrap">
                    {activeTicket?.escalationNotes || 'No notes provided.'}
                  </div>
                </div>
              </div>

              {/* Action Execution Form */}
              <div className="p-4 rounded-xl border bg-card space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-indigo-600" /> Execute Administrative Override & Resolution
                </h4>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Resulting Ticket Status</Label>
                    <Select value={actionStatus || 'RESOLVED'} onValueChange={(v) => setActionStatus(v)}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RESOLVED" className="text-xs font-semibold text-emerald-600">Resolved (Close & Notify Customer)</SelectItem>
                        <SelectItem value="IN_PROGRESS" className="text-xs font-semibold text-indigo-600">In Progress (Hand Back to Support)</SelectItem>
                        <SelectItem value="ESCALATED" className="text-xs font-semibold text-amber-600">Keep Escalated (Under Investigation)</SelectItem>
                        <SelectItem value="CLOSED" className="text-xs font-semibold text-slate-600">Closed (Archive Thread)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Action Executed (Internal / Audit Record)</Label>
                    <Textarea
                      rows={3}
                      className="text-xs font-mono"
                      placeholder="e.g. Plan quota updated in database, +15 days validity granted, Razorpay payment verified..."
                      value={adminActionNotes}
                      onChange={(e) => setAdminActionNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Resolution Notes for Customer & Support</Label>
                    <Input
                      className="text-xs"
                      placeholder="Visible to subscriber in ticket header..."
                      value={adminResolutionNotes}
                      onChange={(e) => setAdminResolutionNotes(e.target.value)}
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 gap-1.5"
                    disabled={superAdminActionMutation.isPending}
                    onClick={() => {
                      if (!activeTicket?.id) {
                        toast({ title: 'Error', description: 'No active ticket selected.', variant: 'destructive' });
                        return;
                      }
                      superAdminActionMutation.mutate({
                        id: String(activeTicket.id),
                        payload: {
                          status: actionStatus || 'RESOLVED',
                          actionNotes: (adminActionNotes || '').trim(),
                          resolutionNotes: (adminResolutionNotes || '').trim(),
                        },
                      });
                    }}
                  >
                    <Check className="h-4 w-4" />
                    {superAdminActionMutation.isPending ? 'Applying Action...' : 'Save & Execute Super Admin Resolution'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Live Thread */}
            <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[340px] bg-slate-50/50 dark:bg-slate-950/30">
                {loadingMessages ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-amber-600 mb-2" />
                    Loading conversation...
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-card border text-xs text-muted-foreground shadow-2xs">
                    <strong>Description:</strong> {activeTicket?.description}
                  </div>
                ) : (
                  chatMessages.map((msg: any) => {
                    const isMe = msg.sender?.id === currentUser?.id || msg.sender?.email === currentUser?.email;
                    const isStaffMsg = msg.senderRole === 'SUPER_ADMIN' || msg.senderRole === 'SUPPORT';

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {isMe ? 'You' : (msg.senderName || 'Staff')}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              msg.senderRole === 'SUPER_ADMIN'
                                ? 'text-[9px] border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                                : isStaffMsg
                                ? 'text-[9px] border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                                : 'text-[9px] border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                            }
                          >
                            {msg.senderRole === 'SUPER_ADMIN' ? 'Super Admin' : (isStaffMsg ? 'Platform Support' : 'Customer')}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium">
                            <Clock className="h-2.5 w-2.5 opacity-60" />
                            {formatChatTimestamp(msg.createdAt)}
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl max-w-[85%] text-xs shadow-2xs whitespace-pre-wrap leading-relaxed ${
                            isMe
                              ? 'bg-amber-600 text-white rounded-tr-xs'
                              : 'bg-card border text-slate-800 dark:text-slate-100 rounded-tl-xs'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Composer */}
              <div className="p-3 border-t bg-card flex items-center gap-2">
                <Input
                  placeholder="Type a message as Super Administrator..."
                  className="text-xs h-9"
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newChatMessage.trim() && activeTicket) {
                        sendMessageMutation.mutate({
                          ticketId: activeTicket.id,
                          message: newChatMessage.trim(),
                        });
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                  disabled={sendMessageMutation.isPending || !newChatMessage.trim()}
                  onClick={() => {
                    if (newChatMessage.trim() && activeTicket) {
                      sendMessageMutation.mutate({
                        ticketId: activeTicket.id,
                        message: newChatMessage.trim(),
                      });
                    }
                  }}
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> Send
                </Button>
              </div>
            </TabsContent>

            {/* TAB 3: Org Health & Quotas */}
            <TabsContent value="health" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
              {loadingDiagnostics ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-amber-600 mb-2" />
                  Loading subscriber vital profile...
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-amber-600" /> Subscriber Vital Profile
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Organization:</span>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{diagnosticData?.organization?.name || 'SaaS Subscriber'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Subdomain:</span>
                        <p className="font-mono font-bold text-indigo-600">{diagnosticData?.organization?.subdomain || 'system'}.stayeaze.com</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Account Status:</span>
                        <Badge variant="outline" className="font-bold uppercase text-[10px] mt-0.5 border-emerald-500 text-emerald-600">
                          {diagnosticData?.organization?.status || 'ACTIVE'}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Owner Email:</span>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{diagnosticData?.organization?.ownerEmail || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contact Phone:</span>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{diagnosticData?.organization?.contactPhone || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-amber-600" /> Subscription & Plan Tier
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Active Plan:</span>
                        <p className="font-bold text-indigo-600">{diagnosticData?.subscription?.planName || 'Standard PG Plan'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Billing Cycle:</span>
                        <p className="font-semibold uppercase">{diagnosticData?.subscription?.billingCycle || 'MONTHLY'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Validity Days Left:</span>
                        <p className="font-black text-emerald-600">
                          {diagnosticData?.subscription?.daysLeft !== undefined ? `${diagnosticData.subscription.daysLeft} Days` : 'Active'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Plan Status:</span>
                        <Badge variant="outline" className="font-bold uppercase text-[10px] border-emerald-500 text-emerald-600">
                          {diagnosticData?.subscription?.status || 'ACTIVE'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <BedDouble className="h-4 w-4 text-amber-600" /> Resource Quotas & Utilization
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-card rounded-lg border text-center">
                        <span className="text-muted-foreground text-[11px]">Total Properties</span>
                        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{diagnosticData?.quotas?.totalProperties || 0}</p>
                      </div>
                      <div className="p-3 bg-card rounded-lg border text-center">
                        <span className="text-muted-foreground text-[11px]">Beds (Occupied / Total)</span>
                        <p className="text-lg font-black text-indigo-600">
                          {diagnosticData?.quotas?.occupiedBeds || 0} / {diagnosticData?.quotas?.totalBeds || 0}
                        </p>
                      </div>
                      <div className="p-3 bg-card rounded-lg border text-center">
                        <span className="text-muted-foreground text-[11px]">Occupancy Rate</span>
                        <p className="text-lg font-black text-emerald-600">{diagnosticData?.quotas?.occupancyRate || 0}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 4: Telemetry Trace */}
            <TabsContent value="telemetry" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
              <div className="flex items-center justify-between pb-1">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-amber-600" /> Recent Subscriber Journey Logs (Last 15 Events)
                </h4>
              </div>

              {loadingDiagnostics ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-amber-600 mb-2" />
                  Fetching telemetry logs...
                </div>
              ) : !diagnosticData?.telemetryLogs || diagnosticData.telemetryLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border">
                  No recent telemetry events recorded for this organization.
                </div>
              ) : (
                <div className="space-y-2">
                  {diagnosticData.telemetryLogs.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-lg border bg-card text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{log.action}</span>
                          <Badge variant="outline" className="text-[9px] font-bold uppercase">{log.category}</Badge>
                          <Badge
                            className={`text-[9px] font-bold uppercase ${
                              log.status === 'SUCCESS' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </div>
                        {log.details && <p className="text-[11px] text-muted-foreground font-mono truncate max-w-lg">{log.details}</p>}
                      </div>
                      <div className="text-[10px] text-muted-foreground shrink-0 text-right">
                        <p>{formatDate(log.createdAt)}</p>
                        <p className="font-mono">{log.clientIp || '127.0.0.1'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
