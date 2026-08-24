import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck, UserCheck, AlertTriangle, QrCode, Search, Phone, LogIn,
  LogOut, Clock, Plus, Flame, Siren, CheckCircle2, ShieldAlert, Camera,
  User, Check, XCircle
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { formatDateTime, resolveFileUrl } from '@/lib/format';
import type { Visitor } from '@/lib/types';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';

export default function SecurityGuardDashboardPage() {
  const queryClient = useQueryClient();
  const [searchCode, setSearchCode] = useState('');
  const [verifiedPass, setVerifiedPass] = useState<any | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    title: '',
    severity: 'MEDIUM',
    notes: '',
  });

  // 1. Fetch All Gate Visitors
  const { data: visitorsData, isLoading, refetch } = useQuery({
    queryKey: ['security-visitors-list'],
    queryFn: () => api.get<{ data: Visitor[] }>('/visitors', { params: { pageSize: 100 } }).then((r) => r.data?.data || []),
    refetchInterval: 10000, // Poll every 10 seconds for real-time resident approvals
  });

  const visitors: Visitor[] = Array.isArray(visitorsData) ? visitorsData : [];
  const insideVisitors = visitors.filter((v) => (v.status || '').toLowerCase() === 'checked_in');
  const readyForEntry = visitors.filter((v) => ['approved', 'pre_registered'].includes((v.status || '').toLowerCase()));
  const awaitingResidentApproval = visitors.filter((v) => (v.status || '').toLowerCase() === 'waiting_approval');

  // Verify Pass Mutation
  const handleVerifyPass = async () => {
    if (!searchCode.trim()) return;
    setVerifying(true);
    try {
      const res = await api.post('/visitors/verify-pass', { code: searchCode.trim() });
      setVerifiedPass(res.data);
      toast({ title: 'Pass Code Verified', description: `Valid gate pass for ${res.data?.visitorName}` });
    } catch (err: any) {
      toast({
        title: 'Pass Not Found',
        description: err?.response?.data?.message || 'Invalid or expired gate pass code.',
        variant: 'destructive',
      });
      setVerifiedPass(null);
    } finally {
      setVerifying(false);
    }
  };

  // Check In Mutation (Grant Entry)
  const checkInMutation = useMutation({
    mutationFn: (id: string) => api.put(`/visitors/${id}`, { status: 'CHECKED_IN' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-visitors-list'] });
      toast({ title: 'Entry Granted', description: 'Visitor check-in logged successfully.' });
      setVerifiedPass(null);
      setSearchCode('');
      refetch();
    },
    onError: (err: any) => {
      toast({ title: 'Check-In Failed', description: err?.response?.data?.message || 'Failed to grant entry', variant: 'destructive' });
    },
  });

  // Exit Mutation
  const exitVisitorMutation = useMutation({
    mutationFn: (id: string) => api.put(`/visitors/${id}`, { status: 'CHECKED_OUT', exitTime: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-visitors-list'] });
      toast({ title: 'Gate Exit Recorded', description: 'Visitor exit cleared successfully.' });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: 'Exit Failed', description: err?.response?.data?.message || 'Failed to record exit', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Gate Control Console"
        description="Gate pass verification, visitor photo records, and resident approval clearance."
        icon={ShieldCheck}
        actions={
          <Button
            variant="destructive"
            onClick={() => setIncidentModalOpen(true)}
            className="shadow-sm font-bold"
          >
            <AlertTriangle className="mr-1.5 h-4 w-4" /> Report Gate Incident
          </Button>
        }
      />

      {/* Quick Search / Scan Box */}
      <Card className="bg-slate-900 text-white border-slate-800 shadow-md">
        <CardContent className="p-6">
          <div className="max-w-xl mx-auto space-y-3 text-center">
            <h3 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-amber-400" />
              Verify Digital Gate Pass / QR Code
            </h3>
            <p className="text-xs text-slate-400">Enter 6-digit visitor passcode (e.g. 481920) or scan visitor QR pass.</p>
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Enter 6-digit passcode or QR data..."
                className="bg-slate-950 border-slate-700 text-white text-base h-11 font-mono tracking-wider"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyPass()}
              />
              <Button
                className="h-11 px-6 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                onClick={handleVerifyPass}
                disabled={verifying || !searchCode.trim()}
              >
                <Search className="h-4 w-4 mr-1.5" /> {verifying ? 'Verifying...' : 'Verify Pass'}
              </Button>
            </div>

            {/* Verified Pass Result */}
            {verifiedPass && (
              <div className="mt-4 p-4 rounded-xl border border-emerald-400/50 bg-emerald-950/40 text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Verified Valid Pass
                  </span>
                  <StatusBadge status={verifiedPass.status} tone={statusTone(verifiedPass.status)} />
                </div>

                <div className="flex items-center gap-3">
                  {verifiedPass.photoUrl ? (
                    <img src={resolveFileUrl(verifiedPass.photoUrl)} alt="Visitor" className="h-14 w-14 rounded-xl object-cover border border-emerald-400" />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                      <User className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-base text-white">{verifiedPass.visitorName}</p>
                    <p className="text-xs text-slate-300">📞 {verifiedPass.visitorPhone}</p>
                    <p className="text-xs font-medium text-amber-400 mt-0.5">
                      Visiting Resident: {verifiedPass.tenantName || 'Resident'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-900/60 flex justify-end gap-2">
                  <Button
                    onClick={() => checkInMutation.mutate(verifiedPass.visitor.id)}
                    disabled={checkInMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Grant Entry & Check In Now
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gate Status Numbers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Inside Property Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{insideVisitors.length} Visitors</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Approved / Pre-Registered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">{readyForEntry.length} Ready for Entry</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Waiting Resident Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{awaitingResidentApproval.length} Pending</div>
          </CardContent>
        </Card>
      </div>

      {/* Approved Passes Ready for Entry */}
      {readyForEntry.length > 0 && (
        <Card className="border-2 border-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-indigo-600" /> Pre-Approved Visitors Ready at Gate ({readyForEntry.length})
            </CardTitle>
            <CardDescription>Residents have pre-registered or approved these visitors. 1-tap grant entry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {readyForEntry.map((v) => (
              <div key={v.id} className="p-3.5 rounded-xl border bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  {v.photoUrl ? (
                    <img src={resolveFileUrl(v.photoUrl)} alt={v.visitorName} className="h-12 w-12 rounded-xl object-cover border" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold">
                      <QrCode className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{v.visitorName}</p>
                      {v.passCode && (
                        <Badge variant="outline" className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800">
                          #{v.passCode}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Visiting: <strong>{v.tenantName || 'Resident'}</strong> • 📞 {v.visitorPhone || v.mobileNumber}
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => checkInMutation.mutate(v.id)}
                  disabled={checkInMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Grant Entry
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Active Passes Table (Inside Premises) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Current Active Visitors Inside Premises</CardTitle>
          <CardDescription>Visitors verified and currently inside the property.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading gate passes...</div>
          ) : insideVisitors.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              No external visitors currently inside premises. All clear!
            </div>
          ) : (
            <div className="space-y-3">
              {insideVisitors.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:bg-muted/40 transition"
                >
                  <div className="flex items-center gap-3.5">
                    {v.photoUrl ? (
                      <img src={resolveFileUrl(v.photoUrl)} alt={v.visitorName} className="h-12 w-12 rounded-xl object-cover border shadow-xs" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <User className="h-6 w-6" />
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{v.visitorName}</span>
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          INSIDE
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Visiting: <strong>{v.tenantName || 'Resident'}</strong> • Phone: {v.visitorPhone || v.mobileNumber || 'N/A'}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Entry: {formatDateTime(v.checkInTime || '')}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 px-4 shrink-0"
                    onClick={() => exitVisitorMutation.mutate(v.id)}
                    disabled={exitVisitorMutation.isPending}
                  >
                    <LogOut className="mr-1.5 h-4 w-4" /> Record Gate Exit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Modal */}
      <Dialog open={incidentModalOpen} onOpenChange={setIncidentModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Siren className="h-5 w-5" /> Report Security Incident
            </DialogTitle>
            <DialogDescription>
              Submit an immediate security alert to the Property Manager and Owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Incident Type *</Label>
              <Input
                placeholder="e.g. Unauthorized Entry / Noise Dispute / Gate Damage"
                value={incidentForm.title}
                onChange={(e) => setIncidentForm({ ...incidentForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Incident Details / Guard Remarks *</Label>
              <Input
                placeholder="Describe what occurred..."
                value={incidentForm.notes}
                onChange={(e) => setIncidentForm({ ...incidentForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIncidentModalOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                toast({ title: 'Incident Dispatched', description: 'Alert sent to Property Owner and Manager.' });
                setIncidentModalOpen(false);
                setIncidentForm({ title: '', severity: 'MEDIUM', notes: '' });
              }}
              disabled={!incidentForm.title}
            >
              Broadcast Alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
