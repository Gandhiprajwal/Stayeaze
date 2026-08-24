import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Headset, Sparkles, UserCheck, Search,
  CheckCircle2, Clock, AlertTriangle, ShieldCheck, Mail, Phone, ExternalLink,
  RefreshCw, Filter, MessageCircle, LifeBuoy,
  FileText, ArrowUpRight, Send, User, ChevronRight, X, ArrowUpCircle, XCircle
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
import { formatCurrency, formatDate } from '@/lib/format';

export default function SupportDashboardPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [appTicketStatus, setAppTicketStatus] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [statusUpdateVal, setStatusUpdateVal] = useState('RESOLVED');

  // Validity Extension Escalation Dialog State
  const [selectedSubForExtension, setSelectedSubForExtension] = useState<any | null>(null);
  const [extensionDaysVal, setExtensionDaysVal] = useState<number>(15);
  const [extensionReasonVal, setExtensionReasonVal] = useState<string>('');

  // 1. Fetch Application Support Tickets (B2B from Property Owners & Admins)
  const { data: appTicketsData, isLoading: loadingAppTickets } = useQuery({
    queryKey: ['platform-support-tickets', appTicketStatus],
    queryFn: () =>
      api
        .get('/support/tickets', {
          params: {
            pageSize: 10,
            status: appTicketStatus === 'ALL' ? '' : appTicketStatus,
          },
        })
        .then((r) => r.data?.data || r.data || []),
  });

  // 2. Fetch Platform Subscribers
  const { data: subscribersData, isLoading: loadingSubs } = useQuery({
    queryKey: ['support-subscribers-list'],
    queryFn: () => api.get('/super-admin/subscribers', { params: { pageSize: 10 } }).then((r) => r.data?.data || r.data || []),
  });

  // 3. Fetch Extension Requests Escalation History
  const { data: extensionRequestsData, isLoading: loadingExtensionReqs } = useQuery({
    queryKey: ['support-extension-requests'],
    queryFn: () => api.get('/super-admin/subscribers/extension-requests', { params: { pageSize: 10 } }).then((r) => r.data?.data || r.data || []),
  });

  // 4. Fetch Onboarding Leads
  const { data: leadsData, isLoading: loadingLeads } = useQuery({
    queryKey: ['support-leads-list'],
    queryFn: () => api.get('/super-admin/leads', { params: { pageSize: 10 } }).then((r) => r.data?.data || r.data || []),
  });

  // Dedicated Page Stats Queries
  const { data: ticketStats } = useQuery({
    queryKey: ['support-ticket-stats'],
    queryFn: () => api.get('/support/tickets/stats').then((r) => r.data || {}),
  });

  const { data: subscriberStats } = useQuery({
    queryKey: ['subscribers-stats'],
    queryFn: () => api.get('/super-admin/subscribers/stats').then((r) => r.data || {}),
  });

  const { data: leadStats } = useQuery({
    queryKey: ['leads-stats'],
    queryFn: () => api.get('/super-admin/leads/stats').then((r) => r.data || {}),
  });

  const appTickets = Array.isArray(appTicketsData) ? appTicketsData : [];
  const subscribers = Array.isArray(subscribersData) ? subscribersData : [];
  const extensionRequests = Array.isArray(extensionRequestsData) ? extensionRequestsData : [];
  const leads = Array.isArray(leadsData) ? leadsData : [];

  useEffect(() => {
    if (selectedTicket) {
      const currentStatus = selectedTicket.status ? String(selectedTicket.status).toUpperCase() : 'OPEN';
      setStatusUpdateVal(currentStatus);
      setResolutionText(selectedTicket.resolutionNotes || '');
    }
  }, [selectedTicket?.id, selectedTicket?.status]);

  const openAppTicketsCount = (ticketStats?.openTickets || 0) + (ticketStats?.inProgressTickets || 0);
  const resolvedTicketsCount = (ticketStats?.resolvedTickets || 0) + (ticketStats?.closedTickets || 0);
  const activeSubscribersCount = subscriberStats?.activeSubscribers ?? 0;
  const pendingExtensionsCount = subscriberStats?.pendingExtensionRequests ?? 0;
  const highPriorityLeadsCount = (leadStats?.demoRequestedLeads || 0) + (leadStats?.pendingPaymentLeads || 0);

  // Escalate Subscription Validity Extension Mutation
  const escalateExtensionMutation = useMutation({
    mutationFn: ({ orgId, days, reason }: { orgId: string; days: number; reason: string }) =>
      api.post(`/super-admin/subscribers/${orgId}/extend`, { additionalDays: days, reason }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['support-subscribers-list'] });
      queryClient.invalidateQueries({ queryKey: ['support-extension-requests'] });
      toast({
        title: 'Request Escalated to Super Admin',
        description: data.data?.message || 'Validity extension request submitted for Super Admin review and approval.',
      });
      setSelectedSubForExtension(null);
      setExtensionReasonVal('');
      setExtensionDaysVal(15);
    },
    onError: (err: any) => {
      toast({
        title: 'Escalation Failed',
        description: err.response?.data?.message || 'Could not submit extension request.',
        variant: 'destructive',
      });
    },
  });

  // Log Sales Notes Mutation
  const logNoteMutation = useMutation({
    mutationFn: ({ leadId, note }: { leadId: string; note: string }) =>
      api.post(`/super-admin/leads/${leadId}/notes`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-leads-list'] });
      toast({ title: 'Note Logged', description: 'Lead contact notes updated.' });
    },
  });

  // Resolve / Update Application Support Ticket
  const updateAppTicketMutation = useMutation({
    mutationFn: ({ id, status, resolutionNotes }: { id: string; status: string; resolutionNotes: string }) =>
      api.put(`/support/tickets/${id}`, { status, resolutionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-support-tickets'] });
      toast({ title: 'Ticket Updated', description: 'Application ticket status & resolution notes updated.' });
      setSelectedTicket(null);
      setResolutionText('');
    },
    onError: (err: any) => {
      toast({ title: 'Update Failed', description: err.response?.data?.message || 'Could not update ticket.', variant: 'destructive' });
    },
  });

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
      case 'APPROVED':
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px] font-bold uppercase">Resolved</Badge>;
      case 'PENDING':
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] font-bold uppercase">Pending Review</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive" className="text-[10px] font-bold uppercase">Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] font-bold uppercase">Open</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Support & Helpdesk Hub"
        description="Central command console for B2B application support tickets, subscriber assistance, onboarding pipeline, and platform telemetry."
        icon={Headset}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-indigo-500 shadow-xs bg-gradient-to-br from-indigo-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              App Support Tickets
            </CardTitle>
            <LifeBuoy className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openAppTicketsCount} Open</div>
            <p className="text-xs text-muted-foreground mt-1">Property Owner & Admin Inquiries</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-xs bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Subscribers
            </CardTitle>
            <Sparkles className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscribersCount} Active</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingExtensionsCount > 0 ? `${pendingExtensionsCount} Extensions Pending Approval` : 'SaaS PG Organizations'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-xs bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Onboarding Pipeline
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highPriorityLeadsCount} Leads</div>
            <p className="text-xs text-muted-foreground mt-1">Demo & Trial Activations</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-xs bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Resolved Inquiries
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedTicketsCount} Resolved</div>
            <p className="text-xs text-muted-foreground mt-1">Closed & Solution Delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="appTickets" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="appTickets" className="text-xs">
            <LifeBuoy className="mr-1.5 h-3.5 w-3.5 text-indigo-500" />
            App Tickets ({openAppTicketsCount})
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="text-xs">
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-blue-500" />
            Subscribers ({subscribers.length})
          </TabsTrigger>
          <TabsTrigger value="leads" className="text-xs">
            <UserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
            Leads ({leads.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: B2B APPLICATION SUPPORT TICKETS */}
        <TabsContent value="appTickets" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-indigo-600" /> Application Support Tickets (Owner & Admin)
                </CardTitle>
                <CardDescription>Direct platform support tickets raised by PG Owners regarding technical bugs, payment gateway webhooks, or billing.</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={appTicketStatus} onValueChange={setAppTicketStatus}>
                  <SelectTrigger className="w-36 text-xs h-9">
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">All Statuses</SelectItem>
                    <SelectItem value="OPEN" className="text-xs">Open Only</SelectItem>
                    <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                    <SelectItem value="RESOLVED" className="text-xs">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-48 sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tickets..."
                    className="pl-8 text-xs h-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button size="sm" variant="outline" className="text-xs h-9" asChild>
                  <Link to="/support/tickets">
                    Full Page <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAppTickets ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading application tickets...</div>
              ) : appTickets.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
                  No tickets found in this view. All subscriber inquiries resolved!
                </div>
              ) : (
                <div className="space-y-3">
                  {appTickets
                    .filter((t: any) => {
                      if (!searchTerm) return true;
                      const q = searchTerm.toLowerCase();
                      return (
                        t.ticketNumber?.toLowerCase().includes(q) ||
                        t.title?.toLowerCase().includes(q) ||
                        t.description?.toLowerCase().includes(q) ||
                        t.organization?.name?.toLowerCase().includes(q) ||
                        t.createdBy?.email?.toLowerCase().includes(q)
                      );
                    })
                    .map((ticket: any) => (
                      <div
                        key={ticket.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition shadow-2xs"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 px-2 py-0.5 rounded">
                              {ticket.ticketNumber}
                            </span>
                            <span className="font-semibold text-sm truncate">{ticket.title}</span>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                            <Badge variant="outline" className="text-[10px]">
                              {ticket.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
                          <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 flex-wrap">
                            <span>Org: <strong>{ticket.organization?.name || 'SaaS PG'}</strong></span>
                            <span>Raised by: <strong>{ticket.createdBy?.email || 'Owner'}</strong></span>
                            {ticket.contactPhone && <span>Phone: <strong>{ticket.contactPhone}</strong></span>}
                            <span>Created: {formatDate(ticket.createdAt)}</span>
                            {ticket.assignedAgent && <span>Agent: <strong className="text-indigo-600">{ticket.assignedAgent}</strong></span>}
                          </div>

                          {ticket.resolutionNotes && (
                            <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Resolution: </span>
                              <span className="text-muted-foreground">{ticket.resolutionNotes}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setResolutionText(ticket.resolutionNotes || '');
                              setStatusUpdateVal(ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status);
                            }}
                          >
                            <LifeBuoy className="mr-1.5 h-3.5 w-3.5" />
                            Triage / Resolve
                          </Button>
                          {ticket.contactEmail && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs"
                              onClick={() => window.open(`mailto:${ticket.contactEmail}?subject=Regarding Support Ticket ${ticket.ticketNumber}: ${ticket.title}`)}
                            >
                              <Mail className="mr-1.5 h-3.5 w-3.5" /> Email
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ONBOARDING LEADS */}
        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500" /> Property Onboarding Inquiries
                </CardTitle>
                <CardDescription>Property owners and hostel managers requesting platform demos and onboarding.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-9 self-start sm:self-auto" asChild>
                <Link to="/support/leads">
                  Full Leads Page <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingLeads ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading leads...</div>
              ) : leads.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No onboarding leads recorded yet.</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {leads.map((lead: any) => (
                    <div key={lead.id} className="p-4 rounded-xl border bg-card space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm">{lead.propertyName || lead.ownerName || 'Prospective Property'}</h4>
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {lead.status?.toUpperCase() || 'NEW'}
                        </Badge>
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p>Contact: <strong>{lead.ownerName || 'Proprietor'}</strong></p>
                        <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {lead.ownerEmail || '—'}</p>
                        <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {lead.ownerPhone || '—'}</p>
                      </div>
                      {lead.salesNotes && (
                        <div className="p-2 rounded bg-muted text-[11px] text-muted-foreground italic">
                          "{lead.salesNotes}"
                        </div>
                      )}
                      <div className="flex gap-2 pt-1 border-t border-muted">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs flex-1"
                          onClick={() => {
                            const note = prompt('Add support/sales follow-up note:', lead.salesNotes || '');
                            if (note !== null) {
                              logNoteMutation.mutate({ leadId: lead.id, note });
                            }
                          }}
                        >
                          Log Note
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => window.open(`tel:${lead.ownerPhone}`)}
                        >
                          <Phone className="h-3 w-3" /> Call
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SUBSCRIBERS & EXTENSION ESCALATIONS */}
        <TabsContent value="subscribers" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" /> SaaS Subscribers Directory
                </CardTitle>
                <CardDescription>Registered PG organizations, active subscription plans, and validity management.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-9 self-start sm:self-auto" asChild>
                <Link to="/support/subscribers">
                  Full Subscribers Page <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loadingSubs ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading subscribers...</div>
              ) : subscribers.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">No subscriber organizations active.</div>
              ) : (
                <div className="space-y-3">
                  {subscribers.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">{sub.name || 'Tenant Organization'}</h4>
                          <Badge variant={sub.status === 'ACTIVE' ? 'outline' : 'secondary'} className="text-[10px]">
                            {sub.status || 'ACTIVE'}
                          </Badge>
                          {sub.planName && (
                            <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]">
                              {sub.planName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Subdomain: <strong>{sub.subdomain || '—'}</strong></span>
                          <span>Cycle: <strong>{sub.billingCycle || 'Monthly'}</strong></span>
                          <span>Expires: {sub.endDate ? formatDate(sub.endDate) : '—'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          onClick={() => {
                            setSelectedSubForExtension(sub);
                            setExtensionDaysVal(15);
                            setExtensionReasonVal('');
                          }}
                        >
                          <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                          Escalate Validity Extension
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extension Requests Escalation History Table */}
          {extensionRequests.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" /> Escalated Extension Requests History
                </CardTitle>
                <CardDescription>Track Super Admin approvals and status of validity extension proposals.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {extensionRequests.map((req: any) => (
                    <div key={req.id} className="p-3 rounded-lg border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{req.organization?.name || 'Subscriber PG'}</span>
                          <Badge variant="outline" className="text-[10px]">+{req.additionalDays} Days</Badge>
                          {req.status === 'APPROVED' && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                              Approved by Super Admin
                            </Badge>
                          )}
                          {req.status === 'PENDING' && (
                            <Badge variant="secondary" className="text-amber-600 bg-amber-50 dark:bg-amber-950/50 text-[10px]">
                              Pending Super Admin Review
                            </Badge>
                          )}
                          {req.status === 'REJECTED' && (
                            <Badge variant="destructive" className="text-[10px]">
                              Rejected
                            </Badge>
                          )}
                        </div>
                        {req.reason && <p className="text-muted-foreground italic">"{req.reason}"</p>}
                        {req.reviewNotes && (
                          <p className="text-muted-foreground">
                            Super Admin Remarks: <strong>{req.reviewNotes}</strong>
                          </p>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground shrink-0 text-right">
                        <div>Submitted: {formatDate(req.createdAt)}</div>
                        {req.reviewedAt && <div>Reviewed: {formatDate(req.reviewedAt)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* EXTENSION ESCALATION DIALOG */}
      <Dialog open={!!selectedSubForExtension} onOpenChange={(open) => !open && setSelectedSubForExtension(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <ArrowUpCircle className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold">
                  Escalate Validity Extension
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedSubForExtension?.name} ({selectedSubForExtension?.subdomain})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Super Admin Approval Required
              </p>
              <p className="text-[11px] text-muted-foreground">
                Platform Support cannot directly extend subscriptions. This request will be submitted to the Super Admin approval queue.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Additional Days</Label>
              <Select value={String(extensionDaysVal)} onValueChange={(v) => setExtensionDaysVal(parseInt(v))}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Select days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7" className="text-xs">+7 Days (1 Week Grace)</SelectItem>
                  <SelectItem value="15" className="text-xs">+15 Days (Half Month)</SelectItem>
                  <SelectItem value="30" className="text-xs">+30 Days (1 Full Month)</SelectItem>
                  <SelectItem value="60" className="text-xs">+60 Days (2 Months)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason / Justification <span className="text-rose-500">*</span></Label>
              <Textarea
                className="text-xs min-h-[90px]"
                placeholder="E.g., Customer facing bank payout delay; proprietor requested 15 days grace period during room renovation..."
                value={extensionReasonVal}
                onChange={(e) => setExtensionReasonVal(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedSubForExtension(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
              disabled={escalateExtensionMutation.isPending || !extensionReasonVal.trim()}
              onClick={() => {
                if (selectedSubForExtension && extensionReasonVal.trim()) {
                  escalateExtensionMutation.mutate({
                    orgId: selectedSubForExtension.id,
                    days: extensionDaysVal,
                    reason: extensionReasonVal.trim(),
                  });
                }
              }}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {escalateExtensionMutation.isPending ? 'Submitting...' : 'Escalate to Super Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TRIAGE / RESOLUTION MODAL */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-indigo-600" />
              <div>
                <DialogTitle className="text-base font-bold">
                  Support Triage: {selectedTicket?.ticketNumber}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedTicket?.organization?.name || 'SaaS Subscriber'} • {selectedTicket?.createdBy?.email}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{selectedTicket.title}</span>
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-muted">
                  <span>Category: <strong>{selectedTicket.category}</strong></span>
                  <span>Contact: <strong>{selectedTicket.contactEmail || selectedTicket.contactPhone || 'N/A'}</strong></span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Update Ticket Status</Label>
                <Select
                  value={statusUpdateVal || (selectedTicket?.status ? String(selectedTicket.status).toUpperCase() : 'OPEN')}
                  onValueChange={setStatusUpdateVal}
                >
                  <SelectTrigger className="text-xs h-9 font-semibold">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN" className="text-xs">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS" className="text-xs">In Progress</SelectItem>
                    <SelectItem value="RESOLVED" className="text-xs">Resolved</SelectItem>
                    <SelectItem value="CLOSED" className="text-xs">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Resolution Notes & Guidance</Label>
                <Textarea
                  className="text-xs min-h-[90px]"
                  placeholder="Explain the resolution, steps taken, or reply for the subscriber..."
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedTicket(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={updateAppTicketMutation.isPending}
              onClick={() => {
                if (selectedTicket) {
                  updateAppTicketMutation.mutate({
                    id: selectedTicket.id,
                    status: statusUpdateVal,
                    resolutionNotes: resolutionText,
                  });
                }
              }}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {updateAppTicketMutation.isPending ? 'Saving...' : 'Save & Update Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
