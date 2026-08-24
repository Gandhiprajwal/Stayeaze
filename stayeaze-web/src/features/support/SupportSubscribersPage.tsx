import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, Search, Clock, CheckCircle2, ShieldCheck, Mail, Phone, ExternalLink,
  RefreshCw, ArrowUpCircle, Send, Building2, ChevronRight, XCircle
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

export default function SupportSubscribersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubForExtension, setSelectedSubForExtension] = useState<any | null>(null);
  const [extensionDaysVal, setExtensionDaysVal] = useState<number>(15);
  const [extensionReasonVal, setExtensionReasonVal] = useState<string>('');

  // 1. Fetch Platform Subscribers
  const { data: subscribersData, isLoading: loadingSubs, refetch: refetchSubs } = useQuery({
    queryKey: ['support-subscribers-list'],
    queryFn: () => api.get('/super-admin/subscribers', { params: { pageSize: 50 } }).then((r) => r.data?.data || r.data || []),
  });

  // 2. Fetch Extension Requests History
  const { data: extensionRequestsData, isLoading: loadingExtensionReqs, refetch: refetchReqs } = useQuery({
    queryKey: ['support-extension-requests'],
    queryFn: () => api.get('/super-admin/subscribers/extension-requests', { params: { pageSize: 20 } }).then((r) => r.data?.data || r.data || []),
  });

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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const subscribers = Array.isArray(subscribersData) ? subscribersData : [];
  const extensionRequests = Array.isArray(extensionRequestsData) ? extensionRequestsData : [];

  const filteredSubscribers = subscribers.filter((s: any) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.subdomain?.toLowerCase().includes(q) ||
      s.ownerEmail?.toLowerCase().includes(q) ||
      s.planName?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredSubscribers.length / pageSize));
  const paginatedSubscribers = filteredSubscribers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriber Directory & Assistance"
        description="Look up subscriber PG organizations, monitor subscription validity dates, and escalate courtesy validity extensions for Super Admin review."
        icon={Sparkles}
      />

      {/* Main Subscribers Table / Cards */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" /> Active SaaS Subscribers
            </CardTitle>
            <CardDescription>
              Showing {filteredSubscribers.length} subscriber organizations
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search PG name, subdomain, email..."
                className="pl-8 text-xs h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button size="sm" variant="outline" className="h-9 w-9 p-0" onClick={() => { refetchSubs(); refetchReqs(); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loadingSubs ? (
            <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-blue-600" />
              <p>Loading subscriber organizations...</p>
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              No subscriber organizations match your search query.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedSubscribers.map((sub: any) => (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl border bg-card/80 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{sub.name}</h4>
                          <span className="text-[11px] font-mono text-muted-foreground">{sub.subdomain}.stayeaze.com</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            sub.status === 'ACTIVE'
                              ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-[10px] font-bold'
                              : 'border-amber-500 text-amber-600 text-[10px] font-bold'
                          }
                        >
                          {sub.status || 'ACTIVE'}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                        <p>Plan: <strong className="text-slate-800 dark:text-slate-200">{sub.planName || 'GROWTH'}</strong></p>
                        <p>Owner: <strong>{sub.ownerEmail || 'admin@pg.com'}</strong></p>
                        <p className="flex items-center gap-1 text-[11px]">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          Valid Until: <strong className="text-slate-800 dark:text-slate-200">{formatDate(sub.subscriptionEndDate)}</strong>
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-8 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 font-semibold"
                      onClick={() => {
                        setSelectedSubForExtension(sub);
                        setExtensionReasonVal('');
                        setExtensionDaysVal(15);
                      }}
                    >
                      <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                      Escalate Extension to Super Admin
                    </Button>
                  </div>
                ))}
              </div>

              {/* PAGINATION */}
              {filteredSubscribers.length > 0 && (
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
                      Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredSubscribers.length)} of {filteredSubscribers.length}
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

      {/* Escalation History Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" /> Escalated Extension Requests & Super Admin Decisions
          </CardTitle>
          <CardDescription>
            Live status of validity extension proposals submitted to the Super Admin queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingExtensionReqs ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading escalation history...</div>
          ) : extensionRequests.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No extension requests have been submitted yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {extensionRequests.map((req: any) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl border bg-card/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="font-semibold text-slate-900 dark:text-white">
                        {req.organization?.name || 'Subscriber Organization'}
                      </strong>
                      <Badge
                        variant="outline"
                        className={
                          req.status === 'APPROVED'
                            ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 text-[10px] font-bold'
                            : req.status === 'REJECTED'
                            ? 'border-rose-500 text-rose-600 bg-rose-50/50 text-[10px] font-bold'
                            : 'border-amber-500 text-amber-600 bg-amber-50/50 text-[10px] font-bold'
                        }
                      >
                        +{req.additionalDays} Days • {req.status}
                      </Badge>
                    </div>
                    {req.reason && <p className="text-muted-foreground italic text-[11px]">"{req.reason}"</p>}
                    {req.reviewNotes && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        Super Admin Remarks: <strong>{req.reviewNotes}</strong>
                      </p>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right shrink-0">
                    <p>Submitted: {formatDate(req.createdAt)}</p>
                    {req.reviewedAt && <p>Reviewed: {formatDate(req.reviewedAt)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                Platform Support cannot directly modify validity. This proposal will be submitted to the Super Admin approval queue with your notes.
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
                placeholder="E.g., Customer facing temporary bank settlement delay; proprietor requested 15 days grace period during property renovation..."
                value={extensionReasonVal}
                onChange={(e) => setExtensionReasonVal(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Must be at least 5 characters.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedSubForExtension(null)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
              disabled={escalateExtensionMutation.isPending || extensionReasonVal.trim().length < 5}
              onClick={() => {
                if (selectedSubForExtension && extensionReasonVal.trim().length >= 5) {
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
    </div>
  );
}
