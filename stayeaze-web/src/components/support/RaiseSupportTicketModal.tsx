import { useState, useEffect, useRef, forwardRef, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LifeBuoy, Send, CheckCircle2, Clock, AlertTriangle,
  Plus, MessageSquare, Shield, ChevronRight,
  Lock, Info, User, AlertCircle, ArrowLeft,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  function RaiseSupportTicketModal({ trigger, open: controlledOpen, onOpenChange }, _ref) {
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

    const [touched, setTouched] = useState<Record<string, boolean>>({});

    const markTouched = (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
    };

    const errors = useMemo(() => {
      const errs: Record<string, string | null> = {};

      if (!title.trim()) {
        errs.title = 'Subject / Ticket title is required.';
      } else if (title.trim().length < 4) {
        errs.title = 'Subject must be at least 4 characters.';
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
        errs.contactEmail = 'Callback email is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
        errs.contactEmail = 'Please enter a valid email address.';
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

    const { data: ticketsData, isLoading: loadingTickets } = useQuery({
      queryKey: ['my-support-tickets'],
      queryFn: () => api.get('/support/tickets', { params: { pageSize: 50, mineOnly: true } }).then((r) => r.data?.data || r.data || []),
      enabled: isOpen,
    });

    const tickets = Array.isArray(ticketsData) ? ticketsData : [];

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

    useEffect(() => {
      if (!isOpen) return;
      const unsub = subscribe('/topic/support-tickets', () => {
        queryClient.invalidateQueries({ queryKey: ['my-support-tickets'] });
      });
      return unsub;
    }, [isOpen, subscribe, queryClient]);

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
    }, [setIsOpen]);

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
        toast({ title: 'Message Sent', description: 'Your message has been posted to the support thread.' });
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
          description: `Ticket ${res.data?.ticketNumber || ''} submitted to Support.`,
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
        toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
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
          return <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] uppercase font-bold">Urgent</Badge>;
        case 'HIGH':
          return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] uppercase font-bold">High</Badge>;
        case 'LOW':
          return <Badge className="bg-slate-500/10 text-slate-600 border border-slate-500/20 text-[10px] uppercase font-semibold">Low</Badge>;
        default:
          return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] uppercase font-bold">Medium</Badge>;
      }
    };

    const getStatusBadge = (s: string) => {
      switch (s?.toUpperCase()) {
        case 'RESOLVED':
        case 'CLOSED':
          return <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] uppercase font-bold">Resolved</Badge>;
        case 'IN_PROGRESS':
          return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] uppercase font-bold">In Progress</Badge>;
        default:
          return <Badge className="bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 text-[10px] uppercase font-bold">Open</Badge>;
      }
    };

    const isResolvedOrClosed = selectedTicketForChat?.status === 'RESOLVED' || selectedTicketForChat?.status === 'CLOSED';
    const resolvedTimestamp = selectedTicketForChat?.resolvedAt ? new Date(selectedTicketForChat.resolvedAt).getTime() : null;
    const isExpired = resolvedTimestamp ? Date.now() - resolvedTimestamp > 24 * 60 * 60 * 1000 : false;
    const hoursLeft = resolvedTimestamp ? Math.max(0, Math.ceil((resolvedTimestamp + 24 * 60 * 60 * 1000 - Date.now()) / (1000 * 60 * 60))) : 0;

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl h-[680px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          {/* Top Header */}
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 border border-primary/20">
                <LifeBuoy className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">StayEaze Platform Helpdesk</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Direct channel to platform engineers & billing specialists for application issues.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* CHAT VIEW */}
          {selectedTicketForChat ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
              {/* Chat Sub-header */}
              <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTicketForChat(null)}
                    className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </Button>
                  <span className="font-mono font-bold text-xs text-primary">
                    {selectedTicketForChat.ticketNumber}
                  </span>
                  {getStatusBadge(selectedTicketForChat.status)}
                  {getPriorityBadge(selectedTicketForChat.priority)}
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px] hidden sm:inline-block">
                  {selectedTicketForChat.title}
                </span>
              </div>

              {/* Resolution banner */}
              {isResolvedOrClosed && (
                <div className={`mx-5 mt-3 p-3 rounded-xl border text-xs flex items-center gap-2.5 shrink-0 ${
                  isExpired
                    ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
                }`}>
                  {isExpired ? <Lock className="h-4 w-4 shrink-0 text-rose-600" /> : <Info className="h-4 w-4 shrink-0 text-amber-600" />}
                  <span>
                    {isExpired
                      ? 'Ticket permanently closed (24h grace window expired).'
                      : `Ticket resolved. You have ${hoursLeft}h left in the grace window to reply and reopen.`}
                  </span>
                </div>
              )}

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin">
                {loadingMessages ? (
                  <div className="py-16 text-center text-xs text-muted-foreground">Loading chat thread...</div>
                ) : chatError ? (
                  <div className="py-16 text-center text-xs text-rose-500 space-y-2">
                    <AlertTriangle className="mx-auto h-6 w-6 text-rose-500" />
                    <p>Could not load ticket messages.</p>
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => refetchMessages()}>
                      Retry Connection
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground">
                    <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    No messages yet. Send a message below to reach Support.
                  </div>
                ) : (
                  messages.map((m: any) => {
                    const isMe = m.sender?.id === user?.id || m.sender?.email === user?.email;
                    const isStaffMsg = m.senderRole === 'SUPPORT' || m.senderRole === 'SUPER_ADMIN';
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground ${isMe ? 'flex-row-reverse' : ''}`}>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            {isMe ? 'You' : isStaffMsg ? (
                              <>
                                <Shield className="h-3.5 w-3.5 text-primary" />
                                <span>StayEaze Support</span>
                              </>
                            ) : (
                              <>
                                <User className="h-3.5 w-3.5 text-slate-500" />
                                <span>{m.senderName || 'Property Admin'}</span>
                              </>
                            )}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-[10px] opacity-70">
                            <Clock className="h-2.5 w-2.5" />
                            {formatChatTimestamp(m.createdAt)}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-primary text-primary-foreground rounded-tr-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200 dark:border-slate-700'
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

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChatMessage} className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex gap-2.5 shrink-0">
                <Input
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder={isExpired ? 'Ticket closed permanently.' : 'Type your reply to Support...'}
                  disabled={isExpired || sendMessageMutation.isPending}
                  className="text-xs sm:text-sm h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
                <Button
                  type="submit"
                  disabled={!chatMessage.trim() || isExpired || sendMessageMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-semibold rounded-xl h-10 px-5 gap-1.5 shrink-0 shadow-xs"
                >
                  <Send className="h-4 w-4" />
                  {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
              {/* Segmented Tab Switcher */}
              <div className="px-5 sm:px-6 pt-4 pb-2 shrink-0 bg-white dark:bg-slate-900">
                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setTab('raise')}
                    className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                      tab === 'raise'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" /> Raise New Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('history')}
                    className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                      tab === 'history'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5 text-primary" /> My Tickets ({tickets.length})
                  </button>
                </div>
              </div>

              {/* TAB 1: RAISE TICKET FORM */}
              {tab === 'raise' && (
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3 space-y-4 scrollbar-thin">
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Issue Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger className="text-xs sm:text-sm h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80">
                            <SelectValue placeholder="Select Category" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value} className="text-xs sm:text-sm py-2">
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Priority / Urgency</Label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger className="text-xs sm:text-sm h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80">
                            <SelectValue placeholder="Select Priority" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p.value} value={p.value} className="text-xs sm:text-sm py-2">
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Subject / Ticket Title <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground font-mono">{title.length}/150</span>
                      </div>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={() => markTouched('title')}
                        placeholder="e.g. Need assistance setting up custom rent invoices"
                        className={`text-xs sm:text-sm h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 ${
                          touched.title && errors.title ? 'border-red-500 focus-visible:ring-red-500/30' : ''
                        }`}
                        maxLength={150}
                      />
                      {touched.title && errors.title && (
                        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {errors.title}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Detailed Description <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <span className="text-[10px] text-muted-foreground font-mono">{description.length} chars</span>
                      </div>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={() => markTouched('description')}
                        placeholder="Provide details about the issue, steps to reproduce, or questions..."
                        rows={3}
                        className={`text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 ${
                          touched.description && errors.description ? 'border-red-500 focus-visible:ring-red-500/30' : ''
                        }`}
                      />
                      {touched.description && errors.description && (
                        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {errors.description}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Callback Email <span className="text-red-500 font-bold">*</span>
                        </Label>
                        <Input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          onBlur={() => markTouched('contactEmail')}
                          placeholder="owner@myproperty.com"
                          className={`text-xs sm:text-sm h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 ${
                            touched.contactEmail && errors.contactEmail ? 'border-red-500 focus-visible:ring-red-500/30' : ''
                          }`}
                        />
                        {touched.contactEmail && errors.contactEmail && (
                          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {errors.contactEmail}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Callback Phone <span className="text-muted-foreground font-normal text-[10px]">(Optional)</span>
                        </Label>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          onBlur={() => markTouched('contactPhone')}
                          placeholder="e.g. 9876543210"
                          className={`text-xs sm:text-sm h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 ${
                            touched.contactPhone && errors.contactPhone ? 'border-red-500 focus-visible:ring-red-500/30' : ''
                          }`}
                        />
                        {touched.contactPhone && errors.contactPhone && (
                          <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {errors.contactPhone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clean Fixed Footer (Never Overlaps Inputs) */}
                  <div className="px-5 sm:px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between gap-3 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                      className="rounded-xl h-10 px-4 text-xs sm:text-sm font-semibold border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!isFormValid || createTicketMutation.isPending}
                      className="text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-10 px-5 shadow-xs gap-2"
                    >
                      <Send className="h-4 w-4" />
                      {createTicketMutation.isPending ? 'Submitting...' : 'Submit Ticket'}
                    </Button>
                  </div>
                </form>
              )}

              {/* TAB 2: TICKET HISTORY */}
              {tab === 'history' && (
                <div className="flex-1 overflow-y-auto p-5 sm:px-6 space-y-3 scrollbar-thin">
                  {loadingTickets ? (
                    <div className="py-20 text-center text-xs text-muted-foreground">Loading your support tickets...</div>
                  ) : tickets.length === 0 ? (
                    <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
                      <CheckCircle2 className="mx-auto h-9 w-9 text-muted-foreground/40" />
                      <p className="font-semibold text-slate-800 dark:text-slate-200">No support tickets found</p>
                      <p className="text-[11px]">Click "Raise New Ticket" if you need technical or billing assistance.</p>
                    </div>
                  ) : (
                    tickets.map((t: any) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          markChatAsRead(t.id);
                          setSelectedTicketForChat(t);
                        }}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/40 hover:bg-slate-50/70 dark:hover:bg-slate-850 transition-all shadow-2xs space-y-2.5 cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {hasUnreadChat(t.id) && (
                              <span className="relative flex h-2.5 w-2.5 shrink-0" title="New unread chat message">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                              </span>
                            )}
                            <span className="font-mono font-bold text-xs text-primary group-hover:underline">
                              {t.ticketNumber}
                            </span>
                            {getStatusBadge(t.status)}
                            {getPriorityBadge(t.priority)}
                          </div>
                          <span className="text-[11px] text-muted-foreground font-medium">{formatDate(t.createdAt)}</span>
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-primary transition">
                          {t.title}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{t.description}</p>

                        <div className="pt-1 flex items-center justify-between text-xs text-primary font-bold">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" /> Open Live Chat & Reply
                          </span>
                          <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);
