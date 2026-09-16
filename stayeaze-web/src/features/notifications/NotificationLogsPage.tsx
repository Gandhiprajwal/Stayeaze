import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  BellRing, Send, CheckCircle2, XCircle, RotateCcw, 
  Search, MessageSquare, Mail, Phone, Clock, AlertTriangle, 
  Sparkles, Filter, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { FormDialog } from '@/components/common/FormDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/format';

export interface NotificationLogItem {
  id: string;
  recipient: string;
  type: string; // SMS, EMAIL, WHATSAPP, ANNOUNCEMENT
  messageContent: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  sentAt?: string;
  createdAt?: string;
}

export default function NotificationLogsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    recipient: '',
    type: 'WHATSAPP',
    messageContent: '',
  });

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    priority: 'HIGH',
    targetAudience: 'ALL',
  });

  const { data: logsData, isLoading, refetch } = useQuery<NotificationLogItem[]>({
    queryKey: ['notification-logs'],
    queryFn: () => api.get('/notification-logs').then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : Array.isArray(d?.data) ? d.data : [];
    }),
    refetchInterval: 30000,
  });

  const logsList: NotificationLogItem[] = Array.isArray(logsData) ? logsData : [];

  const broadcastMutation = useMutation({
    mutationFn: (payload: any) => api.post('/notification-logs/broadcast-announcement', payload),
    onSuccess: () => {
      toast.success('In-App Notification Broadcast Sent to All Residents & Staff');
      qc.invalidateQueries({ queryKey: ['notification-logs'] });
      qc.invalidateQueries({ queryKey: ['notif', 'announcements'] });
      setBroadcastOpen(false);
      setBroadcastForm({ title: '', message: '', priority: 'HIGH', targetAudience: 'ALL' });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to dispatch broadcast');
    },
  });

  const sendMutation = useMutation({
    mutationFn: (payload: any) => api.post('/notification-logs', payload),
    onSuccess: () => {
      toast.success('Notification dispatched successfully');
      qc.invalidateQueries({ queryKey: ['notification-logs'] });
      setDialogOpen(false);
      setForm({ recipient: '', type: 'WHATSAPP', messageContent: '' });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to dispatch notification');
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notification-logs/${id}/retry`),
    onSuccess: () => {
      toast.success('Notification retry dispatched');
      qc.invalidateQueries({ queryKey: ['notification-logs'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to retry notification');
    },
  });

  const filteredLogs = useMemo(() => {
    return logsList.filter((log) => {
      const matchesChannel = channelFilter === 'ALL' || (log.type || '').toUpperCase() === channelFilter;
      const matchesStatus = statusFilter === 'ALL' || (log.status || '').toUpperCase() === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q || 
        (log.recipient || '').toLowerCase().includes(q) || 
        (log.messageContent || '').toLowerCase().includes(q) ||
        (log.type || '').toLowerCase().includes(q);

      return matchesChannel && matchesStatus && matchesSearch;
    });
  }, [logsList, channelFilter, statusFilter, search]);

  const totalLogs = logsList.length;
  const sentCount = logsList.filter((l) => (l.status || '').toUpperCase() === 'SENT').length;
  const failedCount = logsList.filter((l) => (l.status || '').toUpperCase() === 'FAILED').length;

  function handleSendSubmit() {
    if (!form.recipient.trim()) {
      toast.error('Recipient phone or email is required');
      return;
    }
    if (!form.messageContent.trim()) {
      toast.error('Message content is required');
      return;
    }
    sendMutation.mutate(form);
  }

  function renderChannelBadge(type: string) {
    const t = (type || '').toUpperCase();
    if (t === 'WHATSAPP') {
      return (
        <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> WhatsApp
        </Badge>
      );
    }
    if (t === 'EMAIL') {
      return (
        <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600 font-semibold flex items-center gap-1">
          <Mail className="h-3 w-3" /> Email
        </Badge>
      );
    }
    if (t === 'SMS') {
      return (
        <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 font-semibold flex items-center gap-1">
          <Phone className="h-3 w-3" /> SMS
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-bold">
        {type}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SMS, WhatsApp & Email Gateway Logs"
        description="Delivery tracking, failure alerts, and 1-click gateway retry for automated rent invoices, OTPs, and alerts."
        icon={BellRing}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 rounded-xl">
              <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
            <Button 
              variant="outline"
              size="sm" 
              onClick={() => setBroadcastOpen(true)} 
              className="h-9 rounded-xl border-indigo-200 text-indigo-700 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 font-semibold"
            >
              <Sparkles className="mr-1.5 h-4 w-4 text-indigo-600" /> Broadcast Notice
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl h-9">
              <Send className="mr-1.5 h-4 w-4" /> Send Manual Alert
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Dispatched Logs" value={totalLogs} icon={BellRing} accent="primary" />
        <StatCard label="Successful Deliveries" value={sentCount} icon={CheckCircle2} accent="success" />
        <StatCard label="Failed Gateway Dispatches" value={failedCount} icon={XCircle} accent="destructive" />
      </div>

      <Card className="rounded-2xl border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by recipient phone, email, or message snippet..."
                className="pl-9 text-xs rounded-xl h-9"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Channels</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs">Channel</TableHead>
                  <TableHead className="text-xs">Recipient</TableHead>
                  <TableHead className="text-xs">Message Preview</TableHead>
                  <TableHead className="text-xs">Dispatch Time</TableHead>
                  <TableHead className="text-xs">Delivery Status</TableHead>
                  <TableHead className="text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      Loading notification gateway logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      No notification logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => {
                    const isFailed = (log.status || '').toUpperCase() === 'FAILED';

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30 transition">
                        <TableCell>
                          {renderChannelBadge(log.type)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {log.recipient}
                        </TableCell>
                        <TableCell>
                          <p className="text-xs line-clamp-1 max-w-xs sm:max-w-md text-foreground">
                            {log.messageContent}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(log.sentAt || log.createdAt || '')}
                        </TableCell>
                        <TableCell>
                          {isFailed ? (
                            <Badge variant="destructive" className="text-[10px] font-semibold">
                              <XCircle className="mr-1 h-3 w-3" /> Delivery Failed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Dispatched
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isFailed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryMutation.mutate(log.id)}
                              disabled={retryMutation.isPending}
                              className="h-7 text-[11px] font-semibold border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Retry
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Manual Notification Dialog */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Dispatch Manual Resident Alert"
        onSubmit={handleSendSubmit}
        loading={sendMutation.isPending}
        submitLabel="Send Notification"
        size="md"
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="Recipient Phone / Email"
              required
              id="recipient"
              value={form.recipient}
              onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              placeholder="e.g. +91 98765 43210 / resident@gmail.com"
            />
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Gateway Channel</label>
              <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WHATSAPP">WhatsApp API</SelectItem>
                  <SelectItem value="SMS">SMS Gateway</SelectItem>
                  <SelectItem value="EMAIL">Email (SMTP/Sendgrid)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <FormTextarea
            label="Message Content"
            required
            id="messageContent"
            value={form.messageContent}
            onChange={(e) => setForm({ ...form, messageContent: e.target.value })}
            rows={3}
            placeholder="Type your notification message..."
          />
        </div>
      </FormDialog>

      {/* Broadcast Property Notice Modal */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden border">
          <DialogHeader className="p-5 pb-3 border-b bg-gradient-to-r from-indigo-50/60 to-purple-50/60 dark:from-indigo-950/20 dark:to-purple-950/20">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Broadcast Property Announcement</DialogTitle>
                <DialogDescription className="text-xs">
                  Send an instant in-app notification directly into the bell drawer of all residents and staff in your property.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notice Headline / Title</Label>
              <Input
                value={broadcastForm.title}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                placeholder="e.g. Water Tank Maintenance Tomorrow 10 AM - 1 PM"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Alert Priority</Label>
                <Select
                  value={broadcastForm.priority}
                  onValueChange={(val) => setBroadcastForm({ ...broadcastForm, priority: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">🚨 High Priority</SelectItem>
                    <SelectItem value="URGENT">⚡ Urgent Maintenance</SelectItem>
                    <SelectItem value="INFO">ℹ️ General Notice / Info</SelectItem>
                    <SelectItem value="EVENT">🎉 Event / Community Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Audience</Label>
                <Select
                  value={broadcastForm.targetAudience}
                  onValueChange={(val) => setBroadcastForm({ ...broadcastForm, targetAudience: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">👥 All Residents &amp; Staff</SelectItem>
                    <SelectItem value="RESIDENTS">🏠 Residents Only</SelectItem>
                    <SelectItem value="STAFF">🏢 Staff &amp; Housekeeping Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Announcement Content</Label>
              <Textarea
                rows={3}
                value={broadcastForm.message}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                placeholder="Write the full announcement message that will appear in their notification drawer..."
                className="text-xs rounded-xl resize-none"
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border text-[11px] text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Broadcasts immediately into the Notification Bell (🔔) of all targeted users and logs in gateway audit history.</span>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBroadcastOpen(false)}
              className="text-xs rounded-xl h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={broadcastMutation.isPending || !broadcastForm.title.trim() || !broadcastForm.message.trim()}
              onClick={() => broadcastMutation.mutate(broadcastForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs"
            >
              {broadcastMutation.isPending ? 'Broadcasting...' : (
                <span className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Dispatch Notice
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
