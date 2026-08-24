import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck, Search, Mail, Phone, ExternalLink, RefreshCw, MessageSquarePlus,
  Clock, CheckCircle2, AlertCircle, FileText, Send, Calendar, Building2, User,
  PlusCircle, Sparkles, Filter
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { formatDate } from '@/lib/format';

export default function SupportLeadsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Log Note Modal State
  const [selectedLeadForNote, setSelectedLeadForNote] = useState<any | null>(null);
  const [noteContactType, setNoteContactType] = useState('Phone Call Walkthrough');
  const [noteOutcome, setNoteOutcome] = useState('Demo Scheduled');
  const [noteContent, setNoteContent] = useState('');

  // Fetch Onboarding Leads
  const { data: leadsData, isLoading: loadingLeads, refetch } = useQuery({
    queryKey: ['support-leads-list'],
    queryFn: () => api.get('/super-admin/leads', { params: { pageSize: 50 } }).then((r) => r.data?.data || r.data || []),
  });

  // Log Note Mutation
  const logNoteMutation = useMutation({
    mutationFn: ({ leadId, note }: { leadId: string; note: string }) =>
      api.post(`/super-admin/leads/${leadId}/notes`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-leads-list'] });
      toast({
        title: 'Note Logged Successfully',
        description: 'Lead contact interaction has been saved to the timeline.',
      });
      setSelectedLeadForNote(null);
      setNoteContent('');
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Log Note',
        description: err.response?.data?.message || 'Could not save note.',
        variant: 'destructive',
      });
    },
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const leads = Array.isArray(leadsData) ? leadsData : [];

  const filteredLeads = leads.filter((l: any) => {
    const matchesSearch =
      !searchTerm ||
      l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.pgName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const paginatedLeads = filteredLeads.slice((page - 1) * pageSize, page * pageSize);

  const handleSaveNote = () => {
    if (!selectedLeadForNote || !noteContent.trim()) return;

    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const formattedNote = `[${timestamp} • ${noteContactType} - ${noteOutcome}]: ${noteContent.trim()}`;

    logNoteMutation.mutate({
      leadId: selectedLeadForNote.id,
      note: formattedNote,
    });
  };

  const getStatusBadge = (s: string) => {
    switch (s?.toUpperCase()) {
      case 'CONVERTED':
      case 'ACTIVE':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50/50 text-[10px] font-bold">Converted</Badge>;
      case 'DEMO_REQUESTED':
        return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50/50 text-[10px] font-bold">Demo Requested</Badge>;
      case 'PENDING_PAYMENT':
        return <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50/50 text-[10px] font-bold">Payment Pending</Badge>;
      case 'LOST':
        return <Badge variant="outline" className="border-rose-500 text-rose-600 bg-rose-50/50 text-[10px] font-bold">Lost</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] font-bold">{s || 'New Lead'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding Leads & Prospecting"
        description="Track demo requests, reach out to new PG owners, and log call/walkthrough notes directly into the prospect's timeline."
        icon={UserCheck}
      />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600" /> Prospective PG Organizations
            </CardTitle>
            <CardDescription>
              Showing {filteredLeads.length} leads in the onboarding pipeline
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Leads</SelectItem>
                <SelectItem value="DEMO_REQUESTED" className="text-xs">Demo Requested</SelectItem>
                <SelectItem value="PENDING_PAYMENT" className="text-xs">Payment Pending</SelectItem>
                <SelectItem value="CONVERTED" className="text-xs">Converted</SelectItem>
                <SelectItem value="LOST" className="text-xs">Lost</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-48 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search proprietor, PG name..."
                className="pl-8 text-xs h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loadingLeads ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600" />
              <p>Loading onboarding leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              No onboarding leads found matching current filters.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedLeads.map((lead: any) => (
                  <div
                    key={lead.id}
                    className="p-4 rounded-xl border bg-card/80 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{lead.name}</h4>
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {lead.pgName || 'StayEaze PG Prospect'}
                          </span>
                        </div>
                        {getStatusBadge(lead.status)}
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <a href={`mailto:${lead.email}`} className="text-indigo-600 hover:underline">
                            {lead.email}
                          </a>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <a href={`tel:${lead.phone}`} className="text-slate-800 dark:text-slate-200 hover:underline font-mono">
                            {lead.phone}
                          </a>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Registered: {formatDate(lead.createdAt)}
                        </p>
                      </div>

                      {lead.salesNotes && (
                        <div className="p-2.5 rounded-lg bg-muted/50 border text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Recent Activity Notes
                          </span>
                          <p className="whitespace-pre-line line-clamp-3">{lead.salesNotes}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        onClick={() => {
                          setSelectedLeadForNote(lead);
                          setNoteContent('');
                        }}
                      >
                        <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" /> Log Call Note
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 px-2.5"
                        asChild
                      >
                        <a href={`tel:${lead.phone}`}>
                          <Phone className="h-3.5 w-3.5 text-emerald-600" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* PAGINATION */}
              {filteredLeads.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t text-xs text-muted-foreground">
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
                      Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredLeads.length)} of {filteredLeads.length}
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
                      Previous
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
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* INTERACTIVE FORM DIALOG TO LOG CONTACT NOTES */}
      <Dialog open={!!selectedLeadForNote} onOpenChange={(open) => !open && setSelectedLeadForNote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <MessageSquarePlus className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold">
                  Log Lead Interaction Note
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedLeadForNote?.name} • {selectedLeadForNote?.pgName || 'PG Prospect'} ({selectedLeadForNote?.phone})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Existing Timeline Snippet if present */}
            {selectedLeadForNote?.salesNotes && (
              <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1 max-h-32 overflow-y-auto">
                <span className="font-semibold text-[11px] text-muted-foreground uppercase">Previous Logged Notes:</span>
                <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 text-[11px]">
                  {selectedLeadForNote.salesNotes}
                </p>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Interaction Channel</Label>
                <Select value={noteContactType} onValueChange={setNoteContactType}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Phone Call Walkthrough" className="text-xs">Phone Call Walkthrough</SelectItem>
                    <SelectItem value="WhatsApp Discussion" className="text-xs">WhatsApp Discussion</SelectItem>
                    <SelectItem value="Virtual Demo on Meet" className="text-xs">Virtual Demo on Google Meet</SelectItem>
                    <SelectItem value="In-Person PG Visit" className="text-xs">In-Person PG Visit</SelectItem>
                    <SelectItem value="Email Outreach" className="text-xs">Email Outreach</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Call / Meeting Outcome</Label>
                <Select value={noteOutcome} onValueChange={setNoteOutcome}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Demo Scheduled" className="text-xs">Demo Scheduled</SelectItem>
                    <SelectItem value="Walkthrough Completed" className="text-xs">Walkthrough Completed</SelectItem>
                    <SelectItem value="Payment / Invoice Follow-up" className="text-xs">Payment / Invoice Follow-up</SelectItem>
                    <SelectItem value="Proprietor Requested Callback" className="text-xs">Proprietor Requested Callback</SelectItem>
                    <SelectItem value="No Answer / Voicemail" className="text-xs">No Answer / Voicemail</SelectItem>
                    <SelectItem value="Not Interested / Closed" className="text-xs">Not Interested / Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Discussion Details & Next Steps <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                className="text-xs min-h-[100px]"
                placeholder="E.g., Spoke with proprietor Rajesh; discussed 50-bed multi-sharing room setup, sent onboarding invoice link via WhatsApp; scheduled 1-on-1 setup session for Thursday 3 PM..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedLeadForNote(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              disabled={logNoteMutation.isPending || !noteContent.trim()}
              onClick={handleSaveNote}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {logNoteMutation.isPending ? 'Saving...' : 'Save Note to Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
