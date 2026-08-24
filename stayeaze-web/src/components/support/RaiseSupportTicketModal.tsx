import { useState, useEffect, useRef, forwardRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy, Send, CheckCircle2, Clock, AlertTriangle, HelpCircle,
  Plus, MessageSquare, Shield, Tag, FileText, ChevronRight, X,
  Lock, Info, User, Headphones, AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { formatDate, formatChatTimestamp } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useWebSocket } from '@/lib/websocket/WebSocketProvider';

export const SUPPORT_CATEGORIES = [
  { value: 'TECHNICAL_BUG', label: 'Technical Bug / App Error' },
  { value: 'PAYMENT_GATEWAY', label: 'Payment Gateway / Razorpay' },
  { value: 'BILLING_ISSUE', label: 'Subscription & SaaS Billing' },
  { value: 'PROPERTY_STRUCTURE', label: 'Property, Rooms & Bed Setup' },
  { value: 'TENANT_ONBOARDING', label: 'Tenant Onboarding & KYC' },
  { value: 'FINANCE_TAX_INVOICING', label: 'Rent Invoices & Financial Reports' },
  { value: 'NOTIFICATIONS_MESSAGING', label: 'WhatsApp & SMS Notifications' },
  { value: 'ACCOUNT_SECURITY', label: 'Account & Staff Access' },
  { value: 'DATA_MIGRATION', label: 'Bulk Data Import / Migration' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request / Improvement' },
  { value: 'OTHER', label: 'General Technical Inquiry' },
];

const CATEGORIES = SUPPORT_CATEGORIES;

const PRIORITIES = [
  { value: 'LOW', label: 'Low - General Question' },
  { value: 'MEDIUM', label: 'Medium - Minor Issue' },
  { value: 'HIGH', label: 'High - Affects Operations' },
  { value: 'URGENT', label: 'Urgent - Critical Outage' },
];

export interface RaiseSupportTicketModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const RaiseSupportTicketModal = forwardRef<HTMLDivElement, RaiseSupportTicketModalProps>(
  function RaiseSupportTicketModal({ trigger, open: controlledOpen, onOpenChange }, ref) {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const { subscribe, hasUnreadChat, markChatAsRead } = useWebSocket();
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;

  const [tab, setTab] = useState<'raise' | 'history'>('raise');
  const [selectedTicketForChat, setSelectedTicketForChat] = useState<any | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedTicketForChat?.id) {
      markChatAsRead(selectedTicketForChat.id);
    }
  }, [selectedTicketForChat?.id, markChatAsRead]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('TECHNICAL_BUG');
  const [priority, setPriority] = useState('MEDIUM');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');

  // Touched state for on-blur error display
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Form field errors computed in real-time
  const errors = useMemo(() => {
    const errs: Record<string, string | null> = {};

    if (!title.trim()) {
      errs.title = 'Subject / Ticket title is required.';
    } else if (title.trim().length < 4) {
      errs.title = 'Subject must be at least 4 characters long.';
    } else {
      errs.title = null;
    }

    if (!description.trim()) {
      errs.description = 'Please explain the issue or question.';
    } else if (description.trim().length < 10) {
      errs.description = 'Description must be at least 10 characters.';
    } else {
      errs.description = null;
    }

    if (!contactEmail.trim()) {
      errs.contactEmail = 'Callback email is required for support updates.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      errs.contactEmail = 'Please enter a valid email address (e.g. name@domain.com).';
    } else {
      errs.contactEmail = null;
    }

    if (contactPhone.trim() && contactPhone.trim().replace(/\D/g, '').length < 10) {
      errs.contactPhone = 'Phone number must have at least 10 digits.';
    } else {
      errs.contactPhone = null;
    }

    return errs;
  }, [title, description, contactEmail, contactPhone]);

  const isFormValid = useMemo(() => {
    return !errors.title && !errors.description && !errors.contactEmail && !errors.contactPhone;
  }, [errors]);

  // Fetch my created tickets — backend-enforced isolation (mineOnly: true)
  const { data: ticketsData, isLoading: loadingTickets } = useQuery({
    queryKey: ['my-support-tickets'],
    queryFn: () => api.get('/support/tickets', { params: { pageSize: 50, mineOnly: true } }).then((r) => r.data?.data || r.data || []),
    enabled: isOpen,
  });

  const tickets = Array.isArray(ticketsData) ? ticketsData : [];

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

  // Fetch Chat Messages for selected ticket — instant updates via WebSocket
  const { data: messages = [], isLoading: loadingMessages, isError: chatError, refetch: refetchMessages } = useQuery<any[]>({
    queryKey: ['support-ticket-messages', selectedTicketForChat?.id],
    queryFn: async () => {
      if (!selectedTicketForChat?.id) return [];
      const res = await api.get(`/support/tickets/${selectedTicketForChat.id}/messages`);
      return normalizeMessages(res.data);
    },
    enabled: !!selectedTicketForChat?.id && isOpen,
    staleTime: 0,
  });

  // Real-time: invalidate ticket list when a new ticket is created or status changes
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribe('/topic/support-tickets', () => {
      queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
    });
    return unsub;
  }, [isOpen, subscribe, queryClient]);

  // Real-time: append new chat messages instantly from WebSocket
  useEffect(() => {
    if (!selectedTicketForChat?.id || !isOpen) return;
    const unsub = subscribe(`/topic/support-tickets/${selectedTicketForChat.id}/messages`, (newMsg: any) => {
      if (!newMsg) return;
      queryClient.setQueryData<any[]>(['support-ticket-messages', selectedTicketForChat.id], (current = []) => {
        return normalizeMessages([...(Array.isArray(current) ? current : []), newMsg]);
      });
    });
    return unsub;
  }, [selectedTicketForChat?.id, isOpen, subscribe, queryClient]);

  useEffect(() => {
    const handleOpenModal = (e: any) => {
      setIsOpen(true);
      if (e?.detail) {
        if (e.detail.title) setTitle(e.detail.title);
        if (e.detail.description) setDescription(e.detail.description);
        if (e.detail.category) setCategory(e.detail.category);
        if (e.detail.priority) setPriority(e.detail.priority);
        if (e.detail.contactEmail) setContactEmail(e.detail.contactEmail);
        setTab('raise');
      } else {
        setTab('history');
      }
    };
    window.addEventListener('open-support-modal', handleOpenModal);
    return () => window.removeEventListener('open-support-modal', handleOpenModal);
  }, []);

  useEffect(() => {
    if (selectedTicketForChat && messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectedTicketForChat?.id]);

  const sendMessageMutation = useMutation({
    mutationFn: (payload: { ticketId: string; message: string }) =>
      api.post(`/support/tickets/${payload.ticketId}/messages`, { message: payload.message }),
    onSuccess: (res) => {
      if (selectedTicketForChat?.id && res.data) {
        queryClient.setQueryData<any[]>(['support-ticket-messages', selectedTicketForChat.id], (current = []) => {
          return normalizeMessages([...(Array.isArray(current) ? current : []), res.data]);
        });
      }
      queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
      setChatMessage('');
      toast({ title: 'Message Sent', description: 'Your follow-up has been posted to the support thread.' });
    },
    onError: (err: any) => {
      toast({
        title: 'Could Not Send Message',
        description: err.response?.data?.message || err.message || 'Failed to post message',
        variant: 'destructive',
      });
    },
  });

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !selectedTicketForChat?.id) return;
    sendMessageMutation.mutate({
      ticketId: selectedTicketForChat.id,
      message: chatMessage.trim(),
    });
  };

  const createTicketMutation = useMutation({
    mutationFn: (payload: any) => api.post('/support/tickets', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['platform-support-tickets'] });
      toast({
        title: 'Support Ticket Raised',
        description: `Ticket ${res.data?.ticketNumber || ''} submitted to StayEaze Platform Support team.`,
      });
      setTitle('');
      setDescription('');
      setCategory('TECHNICAL_BUG');
      setPriority('MEDIUM');
      setTab('history');
      if (res.data?.id) {
        setSelectedTicketForChat(res.data);
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Submission Failed',
        description: err.response?.data?.message || 'Could not submit support ticket. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, description: true, contactEmail: true, contactPhone: true });

    if (!isFormValid) {
      toast({ title: 'Validation Error', description: 'Please resolve highlighted errors before submitting.', variant: 'destructive' });
      return;
    }

    createTicketMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
    });
  };

  const getPriorityBadge = (p: string) => {
    switch (p?.toUpperCase()) {
      case 'URGENT':
        return <Badge variant="destructive" className="text-[10px] uppercase font-bold">Urgent</Badge>;
      case 'HIGH':
        return <Badge variant="destructive" className="bg-orange-600/90 text-white text-[10px] uppercase font-bold">High</Badge>;
      case 'LOW':
        return <Badge variant="outline" className="text-[10px] uppercase text-muted-foreground">Low</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] uppercase">Medium</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px] uppercase font-bold">Resolved</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px] uppercase font-bold">In Progress</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] uppercase font-bold">Open</Badge>;
    }
  };

  const isResolvedOrClosed = selectedTicketForChat?.status === 'RESOLVED' || selectedTicketForChat?.status === 'CLOSED';
  const resolvedTimestamp = selectedTicketForChat?.resolvedAt ? new Date(selectedTicketForChat.resolvedAt).getTime() : null;
  const isExpired = resolvedTimestamp ? Date.now() - resolvedTimestamp > 24 * 60 * 60 * 1000 : false;
  const hoursLeft = resolvedTimestamp ? Math.max(0, Math.ceil((resolvedTimestamp + 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60))) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">StayEaze Platform Helpdesk</DialogTitle>
                <DialogDescription className="text-xs">
                  Direct channel to platform engineers & billing specialists for application issues.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* IF A SPECIFIC TICKET IS SELECTED FOR CHAT */}
        {selectedTicketForChat ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/40 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 -ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedTicketForChat(null)}
                  >
                    ← Back to Tickets
                  </Button>
                  <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                    {selectedTicketForChat.ticketNumber}
                  </span>
                  {getStatusBadge(selectedTicketForChat.status)}
                  {getPriorityBadge(selectedTicketForChat.priority)}
                </div>
                <h3 className="font-bold text-sm text-foreground">{selectedTicketForChat.title}</h3>
              </div>
            </div>

            {/* 24h Resolution Grace Window Notice */}
            {isResolvedOrClosed && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                isExpired
                  ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                  : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
              }`}>
                {isExpired ? (
                  <Lock className="h-4 w-4 shrink-0 text-rose-600 stroke-[1.75]" />
                ) : (
                  <Info className="h-4 w-4 shrink-0 text-amber-600 stroke-[1.75]" />
                )}
                <span>
                  {isExpired
                    ? 'Ticket permanently closed (24h resolution window expired). Please raise a new ticket for new inquiries.'
                    : `Ticket resolved. You have ${hoursLeft} hour(s) left in the grace window to reply and automatically reopen if you need further help.`}
                </span>
              </div>
            )}

            {/* Chat Thread Messages */}
            <div className="h-[280px] overflow-y-auto rounded-xl border bg-card/60 p-4 space-y-3">
              {loadingMessages ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading chat thread...</div>
              ) : chatError ? (
                <div className="py-12 text-center text-xs text-rose-500 space-y-2">
                  <AlertTriangle className="mx-auto h-6 w-6 text-rose-500" />
                  <p>Could not load ticket messages.</p>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => refetchMessages()}>
                    Retry Connection
                  </Button>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <MessageSquare className="mx-auto h-7 w-7 text-muted-foreground/40 mb-1.5" />
                  No messages yet. Send a message below to reach out to Support.
                </div>
              ) : (
                messages.map((m: any) => {
                  const isMe = m.sender?.id === user?.id || m.sender?.email === user?.email;
                  const isStaffMsg = m.senderRole === 'SUPPORT' || m.senderRole === 'SUPER_ADMIN';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {isMe ? (
                            'You'
                          ) : isStaffMsg ? (
                            <>
                              <Shield className="h-3.5 w-3.5 text-indigo-600 stroke-[1.75]" />
                              <span>StayEaze Support</span>
                            </>
                          ) : (
                            <>
                              <User className="h-3.5 w-3.5 text-slate-500 stroke-[1.75]" />
                              <span>{m.senderName || 'Property Admin'}</span>
                            </>
                          )}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80 font-medium">
                          <Clock className="h-2.5 w-2.5 opacity-60" />
                          {formatChatTimestamp(m.createdAt)}
                        </span>
                      </div>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs whitespace-pre-wrap leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-tr-xs'
                            : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100 rounded-tl-xs border'
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Composer */}
            <form onSubmit={handleSendChatMessage} className="flex gap-2">
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={isExpired ? 'Ticket closed (window expired)' : 'Type your reply or question...'}
                disabled={isExpired || sendMessageMutation.isPending}
                className="text-xs h-9"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!chatMessage.trim() || isExpired || sendMessageMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 px-4 shrink-0"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
              </Button>
            </form>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="raise" className="text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Raise New Ticket
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                <Clock className="mr-1.5 h-3.5 w-3.5" /> My Tickets ({tickets.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: RAISE TICKET */}
            <TabsContent value="raise" className="space-y-4 pt-3">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Issue Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Priority / Urgency</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue placeholder="Select Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value} className="text-xs">
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>
                      Subject / Ticket Title <span className="text-red-500 font-bold">*</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">{title.length}/150</span>
                  </Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => markTouched('title')}
                    placeholder="e.g. Need assistance setting up custom rent invoices"
                    className={`text-xs h-9 ${touched.title && errors.title ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                    maxLength={150}
                  />
                  {touched.title && errors.title && (
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {errors.title}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>
                      Detailed Description <span className="text-red-500 font-bold">*</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground">{description.length} chars</span>
                  </Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => markTouched('description')}
                    placeholder="Provide details about the issue, steps to reproduce, or questions..."
                    rows={4}
                    className={`text-xs ${touched.description && errors.description ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                  />
                  {touched.description && errors.description && (
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {errors.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Callback Email <span className="text-red-500 font-bold">*</span>
                    </Label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      onBlur={() => markTouched('contactEmail')}
                      placeholder="owner@myproperty.com"
                      className={`text-xs h-9 ${touched.contactEmail && errors.contactEmail ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                    />
                    {touched.contactEmail && errors.contactEmail && (
                      <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {errors.contactEmail}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Callback Phone <span className="text-muted-foreground font-normal text-[10px]">(Optional)</span>
                    </Label>
                    <Input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      onBlur={() => markTouched('contactPhone')}
                      placeholder="+91 98765 43210"
                      className={`text-xs h-9 ${touched.contactPhone && errors.contactPhone ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                    />
                    {touched.contactPhone && errors.contactPhone && (
                      <p className="text-[11px] font-medium text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {errors.contactPhone}
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!isFormValid || createTicketMutation.isPending}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all"
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    {createTicketMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            {/* TAB 2: TICKET HISTORY */}
            <TabsContent value="history" className="space-y-3 pt-3">
              {loadingTickets ? (
                <div className="py-12 text-center text-xs text-muted-foreground">Loading your support tickets...</div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                  No support tickets filed. Click "Raise New Ticket" if you need technical or billing assistance.
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {tickets.map((t: any) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        markChatAsRead(t.id);
                        setSelectedTicketForChat(t);
                      }}
                      className="p-3.5 rounded-xl border bg-card hover:bg-indigo-50/50 dark:hover:bg-slate-900/50 hover:border-indigo-300 transition space-y-2 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {hasUnreadChat(t.id) && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0" title="New unread chat message">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                            </span>
                          )}
                          <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline">
                            {t.ticketNumber}
                          </span>
                          {getStatusBadge(t.status)}
                          {getPriorityBadge(t.priority)}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDate(t.createdAt)}</span>
                      </div>

                      <h4 className="font-bold text-xs text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {t.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" /> Open Chat & Reply
                        </span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
});
