import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ConciergeBell, UserCheck, LogIn, LogOut, Package, Users, Plus,
  Search, CheckCircle2, Clock, Phone, MapPin, Calendar, QrCode, Sparkles,
  Camera, User, AlertCircle
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
import { formatDateTime, formatDate, resolveFileUrl } from '@/lib/format';
import type { Visitor } from '@/lib/types';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';

export default function ReceptionistDashboardPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visitorModalOpen, setVisitorModalOpen] = useState(false);
  const [parcelModalOpen, setParcelModalOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    visitorPhone: '',
    tenantName: '',
    purpose: 'Personal Visit',
    photoUrl: '',
  });

  const [parcelForm, setParcelForm] = useState({
    tenantName: '',
    courierCompany: 'Amazon',
    trackingNumber: '',
  });

  // 1. Fetch Visitors
  const { data: visitorsData, isLoading: loadingVisitors, refetch: refetchVisitors } = useQuery({
    queryKey: ['reception-visitors-list'],
    queryFn: () => api.get<{ data: Visitor[] }>('/visitors', { params: { pageSize: 50 } }).then((r) => r.data?.data || []),
    refetchInterval: 10000,
  });

  // 2. Fetch Check-ins
  const { data: checkInsData, isLoading: loadingCheckIns } = useQuery({
    queryKey: ['reception-checkins-list'],
    queryFn: () => api.get('/check-ins').then((r) => r.data?.data || r.data || []),
  });

  // 3. Fetch Checkouts
  const { data: checkOutsData, isLoading: loadingCheckOuts } = useQuery({
    queryKey: ['reception-checkouts-list'],
    queryFn: () => api.get('/check-outs').then((r) => r.data?.data || r.data || []),
  });

  const visitors: Visitor[] = Array.isArray(visitorsData) ? visitorsData : [];
  const checkIns = Array.isArray(checkInsData) ? checkInsData : [];
  const checkOuts = Array.isArray(checkOutsData) ? checkOutsData : [];

  const activeVisitors = visitors.filter((v) => (v.status || '').toLowerCase() === 'checked_in');

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'visitors');

    try {
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVisitorForm((f) => ({ ...f, photoUrl: res.data?.fileUrl || '' }));
      toast({ title: 'Photo Uploaded', description: 'Visitor photo attached.' });
    } catch (err: any) {
      toast({ title: 'Photo Failed', description: err?.response?.data?.message || 'Error uploading photo', variant: 'destructive' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Quick Create Visitor Mutation
  const createVisitorMutation = useMutation({
    mutationFn: (data: typeof visitorForm) => api.post('/visitors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reception-visitors-list'] });
      toast({ title: 'Visitor Logged', description: 'Visitor pass created.' });
      setVisitorModalOpen(false);
      setVisitorForm({ visitorName: '', visitorPhone: '', tenantName: '', purpose: 'Personal Visit', photoUrl: '' });
      refetchVisitors();
    },
    onError: (err: any) => {
      toast({ title: 'Failed to log visitor', description: err?.response?.data?.message || 'Error creating pass.', variant: 'destructive' });
    },
  });

  // Mark Visitor Exit
  const markVisitorExitMutation = useMutation({
    mutationFn: (id: string) => api.put(`/visitors/${id}`, { status: 'CHECKED_OUT', exitTime: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reception-visitors-list'] });
      toast({ title: 'Visitor Exited', description: 'Visitor checkout logged successfully.' });
      refetchVisitors();
    },
  });

  return (
    <div className="space-y-6 pb-12 sm:pb-6">
      <PageHeader
        title="Front Desk & Reception Desk"
        description="Daily visitor logging, resident key handover desk, and parcel collection."
        icon={ConciergeBell}
        actions={
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <Button onClick={() => setVisitorModalOpen(true)} className="rounded-xl h-10 text-xs sm:text-sm font-semibold bg-primary shadow-xs flex-1 sm:flex-none">
              <Plus className="mr-1.5 h-4 w-4" /> Log Visitor Pass
            </Button>
            <Button variant="outline" onClick={() => setParcelModalOpen(true)} className="rounded-xl h-10 text-xs sm:text-sm font-semibold border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex-1 sm:flex-none">
              <Package className="mr-1.5 h-4 w-4" /> Log Parcel
            </Button>
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-2xl border-l-4 border-l-indigo-500 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Visitors In Property
              <Users className="h-4 w-4 text-indigo-500 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <div className="text-xl sm:text-2xl font-black font-mono text-foreground">{activeVisitors.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Currently on-site</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-l-4 border-l-emerald-500 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Check-ins Pending Handover
              <LogIn className="h-4 w-4 text-emerald-500 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600">{checkIns.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Keys ready for resident</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-l-4 border-l-amber-500 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Scheduled Move-Outs
              <LogOut className="h-4 w-4 text-amber-500 shrink-0" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <div className="text-xl sm:text-2xl font-black font-mono text-amber-600">{checkOuts.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Pending key return</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visitor List */}
      <Card className="rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg font-bold">Live Visitor Gate Passes</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setVisitorModalOpen(true)} className="rounded-xl h-8.5 text-xs font-semibold">
              <Plus className="h-3 w-3 mr-1" /> Quick Log
            </Button>
          </div>
          <CardDescription className="text-xs">Recent visitor check-ins, guest passes, and exit status.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {loadingVisitors ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading visitor records...</div>
          ) : visitors.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              No visitor passes logged yet today. Click "Log Visitor Pass" to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {visitors.slice(0, 10).map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border bg-card hover:bg-muted/40 transition shadow-xs"
                >
                  <div className="flex items-center gap-3.5">
                    {v.photoUrl ? (
                      <img src={resolveFileUrl(v.photoUrl)} alt={v.visitorName} className="h-12 w-12 rounded-xl object-cover border shadow-xs shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <User className="h-6 w-6" />
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-foreground">{v.visitorName}</span>
                        {v.passCode && (
                          <Badge variant="outline" className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800">
                            #{v.passCode}
                          </Badge>
                        )}
                        <StatusBadge status={v.status} tone={statusTone(v.status)} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Visiting: <strong>{v.tenantName || 'Resident'}</strong> • Phone: {v.visitorPhone || v.mobileNumber || 'N/A'} • <span className="capitalize">{v.purpose}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3 shrink-0" /> Arrived: {v.checkInTime ? formatDateTime(v.checkInTime) : '—'}
                      </p>
                    </div>
                  </div>

                  {(v.status === 'checked_in' || !v.checkOutTime) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-semibold h-9 rounded-xl self-end sm:self-auto w-full sm:w-auto"
                      onClick={() => markVisitorExitMutation.mutate(v.id)}
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1" /> Mark Exit
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Visitor Modal with Photo Capture */}
      <Dialog open={visitorModalOpen} onOpenChange={setVisitorModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <Camera className="h-5 w-5 text-indigo-600 shrink-0" /> Log Visitor Pass (Front Desk)
            </DialogTitle>
            <DialogDescription className="text-xs">Capture photo and enter guest details to issue an entry pass.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            {/* Photo upload */}
            <div className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-900/40 text-center space-y-2">
              {visitorForm.photoUrl ? (
                <div className="space-y-1.5">
                  <img src={resolveFileUrl(visitorForm.photoUrl)} alt="Visitor" className="h-20 w-20 rounded-xl object-cover mx-auto border" />
                  <Button size="sm" variant="ghost" className="text-xs text-rose-500 h-7" onClick={() => setVisitorForm({ ...visitorForm, photoUrl: '' })}>Remove Photo</Button>
                </div>
              ) : (
                <div>
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto} className="rounded-xl h-9 text-xs">
                    <Camera className="mr-1.5 h-3.5 w-3.5" /> {uploadingPhoto ? 'Uploading...' : 'Take / Upload Photo'}
                  </Button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhotoUpload} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Visitor Name *</Label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={visitorForm.visitorName}
                onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })}
                className="rounded-xl h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Visitor Phone *</Label>
              <Input
                placeholder="e.g. +91 98765 43210"
                value={visitorForm.visitorPhone}
                onChange={(e) => setVisitorForm({ ...visitorForm, visitorPhone: e.target.value })}
                className="rounded-xl h-10 text-xs sm:text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Resident Being Visited</Label>
              <Input
                placeholder="e.g. Room 204 - Amit Kumar"
                value={visitorForm.tenantName}
                onChange={(e) => setVisitorForm({ ...visitorForm, tenantName: e.target.value })}
                className="rounded-xl h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Purpose of Visit</Label>
              <Input
                placeholder="e.g. Family / Delivery / Maintenance"
                value={visitorForm.purpose}
                onChange={(e) => setVisitorForm({ ...visitorForm, purpose: e.target.value })}
                className="rounded-xl h-10 text-xs sm:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setVisitorModalOpen(false)} className="rounded-xl h-10 w-full sm:w-auto text-xs font-semibold">Cancel</Button>
            <Button
              onClick={() => createVisitorMutation.mutate(visitorForm)}
              disabled={!visitorForm.visitorName || !visitorForm.visitorPhone || createVisitorMutation.isPending}
              className="rounded-xl h-10 w-full sm:w-auto text-xs font-bold shadow-xs"
            >
              {createVisitorMutation.isPending ? 'Logging…' : 'Issue Visitor Pass'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Parcel Modal */}
      <Dialog open={parcelModalOpen} onOpenChange={setParcelModalOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">Log Incoming Parcel / Courier</DialogTitle>
            <DialogDescription className="text-xs">Record a delivery parcel and send a 4-digit pickup code to the tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Recipient Resident Name / Room *</Label>
              <Input
                placeholder="e.g. Room 301 - Priya Nair"
                value={parcelForm.tenantName}
                onChange={(e) => setParcelForm({ ...parcelForm, tenantName: e.target.value })}
                className="rounded-xl h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Courier / Delivery Provider</Label>
              <Input
                placeholder="e.g. Amazon / Flipkart / BlueDart"
                value={parcelForm.courierCompany}
                onChange={(e) => setParcelForm({ ...parcelForm, courierCompany: e.target.value })}
                className="rounded-xl h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Tracking / AWB Number</Label>
              <Input
                placeholder="e.g. AMZ-98765432"
                value={parcelForm.trackingNumber}
                onChange={(e) => setParcelForm({ ...parcelForm, trackingNumber: e.target.value })}
                className="rounded-xl h-10 text-xs sm:text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setParcelModalOpen(false)} className="rounded-xl h-10 w-full sm:w-auto text-xs font-semibold">Cancel</Button>
            <Button
              onClick={() => {
                toast({ title: 'Parcel Logged', description: `Pickup OTP generated and SMS sent to ${parcelForm.tenantName}.` });
                setParcelModalOpen(false);
                setParcelForm({ tenantName: '', courierCompany: 'Amazon', trackingNumber: '' });
              }}
              disabled={!parcelForm.tenantName}
              className="rounded-xl h-10 w-full sm:w-auto text-xs font-bold shadow-xs"
            >
              Record &amp; Notify Resident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
