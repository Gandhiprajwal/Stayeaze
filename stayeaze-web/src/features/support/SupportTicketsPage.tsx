import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy, Search, Filter, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Mail, Phone,
  ChevronRight, RefreshCw, Send, MessageCircle, ChevronLeft, Lock, AlertCircle, Sparkles, User,
  ShieldAlert, ArrowUpRight, Activity, Database, Building2, BedDouble, TrendingUp, FileCode, Check
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

const ESCALATION_CATEGORIES = [
  { value: 'SUBSCRIPTION_VALIDITY_PROPOSAL', label: 'Subscription Validity Override / Extension' },
  { value: 'GATEWAY_RECONCILIATION', label: 'Payment Gateway Webhook / Capture Reconcile' },
  { value: 'CRITICAL_SYSTEM_BUG', label: 'Critical System Bug / Database Constraint Exception' },
  { value: 'QUOTA_OVERRIDE', label: 'Enterprise Quota Limit Waiver / Bed Increase' },
  { value: 'SECURITY_OWNERSHIP_TRANSFER', label: 'Account Security & Primary Ownership Transfer' },
  { value: 'DATA_CORRECTION', label: 'Cross-Tenant Collision / Database Repair' },
];

export default function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const { subscribe, hasUnreadChat, markChatAsRead } = useWebSocket();
  const isStaff = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'SUPPORT';
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [appTicketStatus, setAppTicketStatus] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
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
        description: 'Support queue and ticket stats updated with latest records.',
      });
    } catch {
      toast({
        title: 'Refresh Error',
        description: 'Failed to refresh ticket queue.',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Chat & Diagnostic Modal State
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'chat' | 'health' | 'telemetry'>('chat');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [statusUpdateVal, setStatusUpdateVal] = useState('RESOLVED');
  const [resolutionText, setResolutionText] = useState('');
  const chatEndRef = React.useRef<HTMLDivElement | null>(null);

  // Escalation Modal State
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [escalationCategory, setEscalationCategory] = useState('CRITICAL_SYSTEM_BUG');
  const [escalationNotes, setEscalationNotes] = useState('');
  const [requestedAction, setRequestedAction] = useState('');

  // Super Admin Action Modal State
  const [isSuperAdminActionModalOpen, setIsSuperAdminActionModalOpen] = useState(false);
  const [adminActionStatus, setAdminActionStatus] = useState('RESOLVED');
  const [adminActionNotes, setAdminActionNotes] = useState('');
  const [adminResolutionNotes, setAdminResolutionNotes] = useState('');

  // Helper to strictly deduplicate by id and sort chronologically (oldest at top, newest at bottom)
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

  // 1. Fetch Server-Side Aggregate Ticket Stats
  const { data: ticketStats } = useQuery<any>({
    queryKey: ['support-tickets-stats'],
    queryFn: () => api.get('/support/tickets/stats').then((r) => r.data || {}),
    staleTime: 30000,
  });

  // 2. Fetch Paginated Application Support Tickets
  const { data: ticketsResponse, isLoading: loadingTickets, refetch } = useQuery({
    queryKey: ['platform-support-tickets', appTicketStatus, priorityFilter, page, pageSize, searchTerm],
    queryFn: () =>
      api
        .get('/support/tickets', {
          params: {
            page,
            pageSize,
            status: appTicketStatus === 'ALL' ? '' : appTicketStatus,
            search: searchTerm,
          },
        })
        .then((r) => r.data),
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

  // 4. Fetch Deep Diagnostic Data (Org Health + Telemetry Trace) for Active Ticket
  const { data: diagnosticData, isLoading: loadingDiagnostics } = useQuery<any>({
    queryKey: ['support-ticket-diagnostics', activeTicket?.id],
    queryFn: () => api.get(`/support/tickets/${activeTicket?.id}/diagnostics`).then((r) => r.data || {}),
    enabled: !!activeTicket?.id && isStaff,
    staleTime: 10000,
  });

  // Single unified real-time WebSocket listener for active ticket chat
  useEffect(() => {
    if (!activeTicket?.id) return;
    const unsub = subscribe(`/topic/support-tickets/${activeTicket.id}/messages`, (incomingMsg: any) => {
      if (!incomingMsg) return;
      queryClient.setQueryData<any[]>(['support-ticket-messages', activeTicket.id], (current = []) => {
        return normalizeMessages([...(Array.isArray(current) ? current : []), incomingMsg]);
      });
    });
    return unsub;
  }, [activeTicket?.id, subscribe, queryClient]);

  // Send Chat Message Mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      api.post(`/support/tickets/${ticketId}/messages`, { message }),
    onSuccess: (res) => {
      if (activeTicket?.id && res.data) {
        queryClient.setQueryData<any[]>(['support-ticket-messages', activeTicket.id], (current = []) => {
          return normalizeMessages([...(Array.isArray(current) ? current : []), res.data]);
        });
      }
      queryClient.invalidateQueries({ queryKey: ['platform-support-tickets'] });
      setNewChatMessage('');
      if (activeTicket && (activeTicket.status === 'RESOLVED' || activeTicket.status === 'CLOSED') && !isStaff) {
        setActiveTicket({ ...activeTicket, status: 'IN_PROGRESS' });
        toast({ title: 'Ticket Reopened', description: 'Your message was sent and the ticket has been reopened for follow-up.' });
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Could Not Send Message',
        description: err.response?.data?.message || 'Failed to post message.',
        variant: 'destructive',
      });
    },
  });

  // Triage & Update Ticket Status Mutation (Staff only)
  const updateTicketMutation = useMutation({
    mutationFn: ({ id, status, resolutionNotes }: { id: string; status: string; resolutionNotes: string }) =>
      api.put(`/support/tickets/${id}`, { status, resolutionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket-messages', activeTicket?.id] });
      toast({ title: 'Ticket Updated', description: 'Ticket status & resolution updated successfully.' });
      if (activeTicket) {
        setActiveTicket({ ...activeTicket, status: statusUpdateVal, resolutionNotes: resolutionText });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.response?.data?.message || 'Could not update ticket.', variant: 'destructive' });
    },
  });

  // Escalate to Super Admin Mutation
  const escalateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.post(`/support/tickets/${id}/escalate`, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['platform-support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket-messages', activeTicket?.id] });
      toast({ title: 'Ticket Escalated to Super Admin', description: 'Super Admin has been alerted via priority WebSocket dispatch.' });
      setIsEscalateModalOpen(false);
      setEscalationNotes('');
      setRequestedAction('');
      if (activeTicket && res.data) {
        setActiveTicket({ ...activeTicket, ...res.data, status: 'ESCALATED', escalated: true });
        setStatusUpdateVal('ESCALATED');
      }
    },
    onError: (err: any) => {
      toast({ title: 'Escalation Failed', description: err.response?.data?.message || 'Could not escalate ticket.', variant: 'destructive' });
    },
  });

  // Super Admin Action Mutation
  const superAdminActionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.put(`/support/tickets/${id}/super-admin-action`, payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['platform-support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket-messages', activeTicket?.id] });
      toast({ title: 'Super Admin Action Recorded', description: 'Resolution executed and attached to support thread.' });
      setIsSuperAdminActionModalOpen(false);
      setAdminActionNotes('');
      setAdminResolutionNotes('');
      if (activeTicket && res.data) {
        setActiveTicket({ ...activeTicket, ...res.data });
        setStatusUpdateVal(res.data.status || 'RESOLVED');
      }
    },
    onError: (err: any) => {
      toast({ title: 'Action Failed', description: err.response?.data?.message || 'Failed to record action.', variant: 'destructive' });
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
      const currentStatus = activeTicket.status ? String(activeTicket.status).toUpperCase() : 'OPEN';
      setStatusUpdateVal(currentStatus);
      setResolutionText(activeTicket.resolutionNotes || '');
    }
  }, [activeTicket?.id, activeTicket?.status]);

  useEffect(() => {
    if (activeTicket && chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages.length, activeTicket?.id]);

  const checkIsGraceExpired = (ticket: any) => {
    if (!ticket) return false;
    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    if (!isResolved) return false;
    const baseline = ticket.resolvedAt ? new Date(ticket.resolvedAt) : new Date(ticket.updatedAt || ticket.createdAt);
    const diffHours = (Date.now() - baseline.getTime()) / (1000 * 60 * 60);
    return diffHours > 24;
  };

  const isGraceExpired = activeTicket ? checkIsGraceExpired(activeTicket) : false;
  const isTicketResolved = activeTicket?.status === 'RESOLVED' || activeTicket?.status === 'CLOSED';

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
    <div className="space-y-6">
      <PageHeader
        title="Application Support Tickets"
        description={
          isStaff
            ? "Centralized helpdesk queue to triage, manage, diagnose with live telemetry, and escalate subscriber inquiries."
            : "Direct support helpdesk to chat with StayEaze Platform Engineers regarding technical bugs, billing, or system questions."
        }
        icon={LifeBuoy}
      />

      {/* Server-Backed Filter Pills */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'ALL', label: 'All Tickets', count: ticketStats?.totalTickets ?? totalElements },
          { id: 'OPEN', label: 'Open Queue', count: ticketStats?.openTickets ?? 0 },
          { id: 'IN_PROGRESS', label: 'In Progress', count: ticketStats?.inProgressTickets ?? 0 },
          { id: 'ESCALATED', label: 'Escalated', count: ticketStats?.escalatedTickets ?? 0 },
          { id: 'RESOLVED', label: 'Resolved', count: ticketStats?.resolvedTickets ?? 0 },
          { id: 'CLOSED', label: 'Closed', count: ticketStats?.closedTickets ?? 0 },
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => {
              setAppTicketStatus(pill.id);
              setPage(1);
            }}
            className={`h-9 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-2xs ${
              appTicketStatus === pill.id
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-600/20 shadow-xs'
                : 'bg-muted/60 hover:bg-muted text-slate-600 dark:text-slate-300 hover:text-foreground border border-border/40'
            }`}
          >
            {pill.label}
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                appTicketStatus === pill.id ? 'bg-white/20 text-white' : 'bg-background/80 text-muted-foreground border border-border/30'
              }`}
            >
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b">
          <div>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-indigo-600 shrink-0" />
              {isStaff ? 'Platform Support Queue' : 'My Support Tickets'}
            </CardTitle>
            <CardDescription className="text-xs">
              Showing {tickets.length} of {totalElements} tickets
            </CardDescription>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56 md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ticket #, title..."
                className="pl-8 text-xs h-9 rounded-xl w-full"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Select
              value={appTicketStatus}
              onValueChange={(val) => {
                setAppTicketStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-36 text-xs h-9 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="OPEN" className="text-xs">Open Only</SelectItem>
                <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                <SelectItem value="ESCALATED" className="text-xs">Escalated</SelectItem>
                <SelectItem value="RESOLVED" className="text-xs">Resolved</SelectItem>
                <SelectItem value="CLOSED" className="text-xs">Closed</SelectItem>
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
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-muted-foreground'}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadingTickets ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
              <p>Loading support tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-1" />
              <p className="font-semibold text-slate-800 dark:text-white">No Support Tickets Found</p>
              <p className="text-[11px] max-w-sm mx-auto">
                {isStaff
                  ? 'All subscriber inquiries have been answered or no tickets match the filter criteria.'
                  : 'You have not raised any support tickets yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t: any) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs cursor-pointer ${
                    t.status === 'ESCALATED'
                      ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60'
                      : 'bg-card/70 hover:bg-card border-border/60'
                  }`}
                  onClick={() => {
                    markChatAsRead(t.id);
                    setActiveTicket(t);
                    setActiveDrawerTab('chat');
                    setStatusUpdateVal(t.status);
                    setResolutionText(t.resolutionNotes || '');
                  }}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {hasUnreadChat(t.id) && (
                        <span className="relative flex h-2.5 w-2.5 shrink-0" title="New unread chat message">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
                        {t.ticketNumber}
                      </span>
                      <h4 className="font-semibold text-sm">{t.title}</h4>
                      {getPriorityBadge(t.priority)}
                      {getStatusBadge(t.status)}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap pt-1">
                      <span>Org: <strong>{t.organization?.name || 'SaaS Subscriber'}</strong></span>
                      <span>Creator: <strong>{t.createdBy?.email || 'Owner'}</strong></span>
                      <span>Category: <strong className="uppercase">{t.category?.replace(/_/g, ' ')}</strong></span>
                      <span>Created: {formatDate(t.createdAt)}</span>
                      {t.resolvedAt && <span>Resolved: {formatDate(t.resolvedAt)}</span>}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="shrink-0 text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTicket(t);
                      setActiveDrawerTab('chat');
                      setStatusUpdateVal(t.status);
                      setResolutionText(t.resolutionNotes || '');
                    }}
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                    Open Diagnostics & Chat <ChevronRight className="ml-1 h-3.5 w-3.5" />
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
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
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

      {/* UNIFIED SUPPORT DIAGNOSTIC & TRIAGE WORKSPACE DIALOG */}
      <Dialog open={!!activeTicket} onOpenChange={(open) => !open && setActiveTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 border-b bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200">
                    {activeTicket?.ticketNumber}
                  </span>
                  <DialogTitle className="text-base font-bold">{activeTicket?.title}</DialogTitle>
                  {activeTicket && getStatusBadge(activeTicket.status)}
                </div>
                <DialogDescription className="text-xs">
                  {activeTicket?.organization?.name || 'SaaS Subscriber'} • Created by {activeTicket?.createdBy?.email} ({formatDate(activeTicket?.createdAt)})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Navigation Tabs for Staff: Chat, Subscriber Health, Telemetry Logs */}
          {isStaff ? (
            <Tabs value={activeDrawerTab} onValueChange={(val: any) => setActiveDrawerTab(val)} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid grid-cols-3 mx-4 mt-2 mb-1 bg-muted/70">
                <TabsTrigger value="chat" className="text-xs font-semibold gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" /> Live Conversation
                </TabsTrigger>
                <TabsTrigger value="health" className="text-xs font-semibold gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Org Health & Quotas
                </TabsTrigger>
                <TabsTrigger value="telemetry" className="text-xs font-semibold gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Event & Telemetry Trace
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Live Chat & Resolution */}
              <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                {isTicketResolved && (
                  <div
                    className={`p-2.5 text-xs border-b flex items-center gap-2 ${
                      isGraceExpired
                        ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                    }`}
                  >
                    {isGraceExpired ? (
                      <>
                        <Lock className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                        <span><strong>Ticket Permanently Closed:</strong> Resolved over 24 hours ago. Thread locked.</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span><strong>24-Hour Resolution Window Active:</strong> Sending a message will reopen this ticket.</span>
                      </>
                    )}
                  </div>
                )}

                {/* Chat Messages Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[340px] bg-slate-50/50 dark:bg-slate-950/30">
                  {loadingMessages ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
                      Loading conversation thread...
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-card border text-xs text-muted-foreground shadow-2xs">
                      <strong>Description:</strong> {activeTicket?.description}
                    </div>
                  ) : (
                    chatMessages.map((msg: any) => {
                      const isMe = msg.sender?.id === currentUser?.id || msg.sender?.email === currentUser?.email;
                      const isMsgFromSupport = msg.senderRole === 'SUPPORT' || msg.senderRole === 'SUPER_ADMIN';

                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground ${isMe ? 'flex-row-reverse' : ''}`}>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {isMe ? 'You' : (msg.senderName || (isMsgFromSupport ? 'Platform Support' : 'Customer'))}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                isMsgFromSupport
                                  ? 'text-[9px] border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                                  : 'text-[9px] border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                              }
                            >
                              {isMsgFromSupport ? 'Platform Support' : 'Customer'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium">
                              <Clock className="h-2.5 w-2.5 opacity-60" />
                              {formatChatTimestamp(msg.createdAt)}
                            </span>
                          </div>

                          <div
                            className={`p-3 rounded-2xl max-w-[85%] text-xs shadow-2xs whitespace-pre-wrap leading-relaxed ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-tr-xs'
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

                {/* Support Staff Triage Controls & Escalation Bar */}
                <div className="p-3 border-t bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    <span className="font-semibold text-muted-foreground shrink-0">Status:</span>
                    <Select value={statusUpdateVal} onValueChange={setStatusUpdateVal}>
                      <SelectTrigger className="text-xs h-8 w-32 font-semibold">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN" className="text-xs">Open</SelectItem>
                        <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                        <SelectItem value="RESOLVED" className="text-xs">Resolved</SelectItem>
                        <SelectItem value="CLOSED" className="text-xs">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Resolution notes..."
                      className="text-xs h-8 flex-1 min-w-[140px]"
                      value={resolutionText}
                      onChange={(e) => setResolutionText(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold"
                      disabled={updateTicketMutation.isPending}
                      onClick={() => {
                        if (activeTicket) {
                          updateTicketMutation.mutate({
                            id: activeTicket.id,
                            status: statusUpdateVal,
                            resolutionNotes: resolutionText,
                          });
                        }
                      }}
                    >
                      Update
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Escalate to Super Admin Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold text-amber-600 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/40 gap-1.5"
                      onClick={() => {
                        setEscalationNotes(activeTicket?.description || '');
                        setIsEscalateModalOpen(true);
                      }}
                    >
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                      Escalate to Super Admin
                    </Button>

                    {/* Super Admin Resolve Action Button (If Super Admin logged in) */}
                    {isSuperAdmin && activeTicket?.status === 'ESCALATED' && (
                      <Button
                        size="sm"
                        className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                        onClick={() => {
                          setAdminActionNotes(activeTicket?.escalationNotes || '');
                          setIsSuperAdminActionModalOpen(true);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Execute Admin Action
                      </Button>
                    )}
                  </div>
                </div>

                {/* Chat Composer Bar */}
                <div className="p-3 border-t bg-card flex items-center gap-2">
                  {isGraceExpired ? (
                    <div className="flex-1 p-2 rounded-lg bg-muted text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-rose-500" /> Chat input locked. Resolution window expired.
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder={
                          isTicketResolved
                            ? 'Type a reply to reopen ticket...'
                            : 'Type a message in this ticket thread...'
                        }
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
                        className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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
                    </>
                  )}
                </div>
              </TabsContent>

              {/* TAB 2: Subscriber Health & Quotas */}
              <TabsContent value="health" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
                {loadingDiagnostics ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading subscriber diagnostic profile...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Organization Vitals Card */}
                    <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-indigo-600" /> Subscriber Vital Profile
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

                    {/* Subscription & Plan Status Card */}
                    <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-indigo-600" /> Subscription & Plan Tier
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

                    {/* Resource Quotas & Utilization */}
                    <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <BedDouble className="h-4 w-4 text-indigo-600" /> Resource Quotas & Utilization
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

              {/* TAB 3: Telemetry & Event Trace */}
              <TabsContent value="telemetry" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
                <div className="flex items-center justify-between pb-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-indigo-600" /> Recent Subscriber Journey Logs (Last 15 Events)
                  </h4>
                </div>

                {loadingDiagnostics ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
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
          ) : (
            /* Customer View (Chat Only) */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px] max-h-[380px] bg-slate-50/50 dark:bg-slate-950/30">
                {loadingMessages ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading conversation...
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-card border text-xs text-muted-foreground shadow-2xs">
                    <strong>Description:</strong> {activeTicket?.description}
                  </div>
                ) : (
                  chatMessages.map((msg: any) => {
                    const isMe = msg.sender?.id === currentUser?.id || msg.sender?.email === currentUser?.email;

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {isMe ? 'You' : (msg.senderName || 'Platform Support')}
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1 font-medium">
                            <Clock className="h-2.5 w-2.5 opacity-60" />
                            {formatChatTimestamp(msg.createdAt)}
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl max-w-[85%] text-xs shadow-2xs whitespace-pre-wrap leading-relaxed ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-xs'
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

              {/* Chat Composer for Customer */}
              <div className="p-3 border-t bg-card flex items-center gap-2">
                <Input
                  placeholder="Type a reply to Platform Support..."
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
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ESCALATE TO SUPER ADMIN DIALOG */}
      <Dialog open={isEscalateModalOpen} onOpenChange={setIsEscalateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" /> Escalate Ticket to Super Admin
            </DialogTitle>
            <DialogDescription className="text-xs">
              Hand over this ticket to Super Administrator for system-level actions, billing overrides, or database fixes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Escalation Category</Label>
              <Select value={escalationCategory} onValueChange={setEscalationCategory}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESCALATION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value} className="text-xs">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Diagnostic Findings & Root Cause</Label>
              <Textarea
                rows={4}
                className="text-xs font-mono"
                placeholder="Explain the technical findings, error logs, or why Super Admin intervention is needed..."
                value={escalationNotes}
                onChange={(e) => setEscalationNotes(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Requested Super Admin Action</Label>
              <Input
                className="text-xs"
                placeholder="e.g. Approve +15 days courtesy extension, reconcile Razorpay order pay_xyz..."
                value={requestedAction}
                onChange={(e) => setRequestedAction(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsEscalateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              disabled={escalateMutation.isPending || !escalationNotes.trim()}
              onClick={() => {
                if (activeTicket) {
                  escalateMutation.mutate({
                    id: activeTicket.id,
                    payload: {
                      escalationCategory,
                      escalationNotes: escalationNotes.trim(),
                      requestedAction: requestedAction.trim(),
                    },
                  });
                }
              }}
            >
              {escalateMutation.isPending ? 'Escalating...' : 'Submit Escalation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUPER ADMIN ACTION RESOLUTION DIALOG */}
      <Dialog open={isSuperAdminActionModalOpen} onOpenChange={setIsSuperAdminActionModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-indigo-600">
              <Sparkles className="h-5 w-5" /> Super Admin Action & Resolution
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record system override action and transition ticket status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resulting Ticket Status</Label>
              <Select value={adminActionStatus} onValueChange={setAdminActionStatus}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESOLVED" className="text-xs">Resolved</SelectItem>
                  <SelectItem value="IN_PROGRESS" className="text-xs">In Progress (Returned to Support)</SelectItem>
                  <SelectItem value="CLOSED" className="text-xs">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Super Admin Action Taken</Label>
              <Textarea
                rows={3}
                className="text-xs"
                placeholder="Describe the action executed (e.g. Plan quota updated in database, validity extended)..."
                value={adminActionNotes}
                onChange={(e) => setAdminActionNotes(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resolution Notes for Customer</Label>
              <Input
                className="text-xs"
                placeholder="Optional explanation visible in ticket summary..."
                value={adminResolutionNotes}
                onChange={(e) => setAdminResolutionNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsSuperAdminActionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              disabled={superAdminActionMutation.isPending}
              onClick={() => {
                if (activeTicket) {
                  superAdminActionMutation.mutate({
                    id: activeTicket.id,
                    payload: {
                      status: adminActionStatus,
                      actionNotes: adminActionNotes.trim(),
                      resolutionNotes: adminResolutionNotes.trim(),
                    },
                  });
                }
              }}
            >
              {superAdminActionMutation.isPending ? 'Saving...' : 'Apply Super Admin Action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
