import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert, Phone, Clock, DollarSign, Building2, Save,
  CheckCircle2, AlertCircle, RefreshCw, Sparkles, Key
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { usePropertyStore } from '@/lib/stores/property-store';

export default function FrontDeskSettingsSection() {
  const queryClient = useQueryClient();
  const { selectedPropertyId, setSelectedPropertyId } = usePropertyStore();

  const { data: properties = [], isLoading: isLoadingProps } = useQuery({
    queryKey: ['properties-list-settings'],
    queryFn: () => api.get('/properties').then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  });

  const activePropId = selectedPropertyId && selectedPropertyId !== 'ALL'
    ? selectedPropertyId
    : (properties[0]?.id || '');

  const [form, setForm] = useState({
    phone: '',
    emergencyHospitalPhone: '108',
    emergencyPolicePhone: '112',
    emergencyElectricianPhone: '+91 98450 99881',
    emergencyPlumberPhone: '+91 98450 99882',
    curfewTime: '10:30 PM',
    lostKeyPenaltyFee: '200',
  });

  // Fetch active property details
  const { data: propertyDetail, refetch, isFetching } = useQuery({
    queryKey: ['property-front-desk-config', activePropId],
    queryFn: () => api.get(`/properties/${activePropId}`).then((r) => r.data),
    enabled: !!activePropId,
  });

  useEffect(() => {
    if (propertyDetail) {
      setForm({
        phone: propertyDetail.phone || '',
        emergencyHospitalPhone: propertyDetail.emergencyHospitalPhone || '108',
        emergencyPolicePhone: propertyDetail.emergencyPolicePhone || '112',
        emergencyElectricianPhone: propertyDetail.emergencyElectricianPhone || '+91 98450 99881',
        emergencyPlumberPhone: propertyDetail.emergencyPlumberPhone || '+91 98450 99882',
        curfewTime: propertyDetail.curfewTime || '10:30 PM',
        lostKeyPenaltyFee: propertyDetail.lostKeyPenaltyFee ? String(propertyDetail.lostKeyPenaltyFee) : '200',
      });
    }
  }, [propertyDetail]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put(`/properties/${activePropId}/front-desk-config`, data),
    onSuccess: () => {
      toast({
        title: 'Front Desk Settings Saved',
        description: 'Emergency directory, curfew hours, and desk policies updated in real-time.',
      });
      queryClient.invalidateQueries({ queryKey: ['reception-properties-list'] });
      queryClient.invalidateQueries({ queryKey: ['property-front-desk-config', activePropId] });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to Save Settings',
        description: err.response?.data?.message || err.message,
        variant: 'destructive',
      });
    },
  });

  const selectedPropertyObj = properties.find((p: any) => p?.id === activePropId);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-rose-100 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Front Desk & Emergency SOS Management</CardTitle>
                <CardDescription className="text-xs">
                  Configure branch emergency quick-dial contacts, night curfew policies, and lost key penalties.
                </CardDescription>
              </div>
            </div>

            {/* Property Selector */}
            {properties.length > 1 && (
              <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-lg border">
                <Building2 className="h-4 w-4 text-muted-foreground ml-1" />
                <Select value={activePropId} onValueChange={(val) => setSelectedPropertyId(val)}>
                  <SelectTrigger className="h-8 text-xs font-semibold w-48 bg-background">
                    <SelectValue placeholder="Select Property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Emergency SOS Directory */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-900">
              <Phone className="h-4 w-4 text-rose-600" />
              Emergency SOS Directory Numbers
            </CardTitle>
            <CardDescription className="text-xs">
              Direct hotlines rendered in the Receptionist Emergency SOS dialer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">Branch Property Manager (On-Call Phone)</Label>
              <Input
                placeholder="e.g. +91 98451 12234"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">This is the primary on-call number dialed by front desk officers during emergencies.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Partner Hospital / Ambulance</Label>
                <Input
                  placeholder="e.g. 108 / +91 80 4455 6677"
                  value={form.emergencyHospitalPhone}
                  onChange={(e) => setForm({ ...form, emergencyHospitalPhone: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Local Police Station</Label>
                <Input
                  placeholder="e.g. 112 / +91 80 2294 2222"
                  value={form.emergencyPolicePhone}
                  onChange={(e) => setForm({ ...form, emergencyPolicePhone: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">24/7 Electrician Tech</Label>
                <Input
                  placeholder="e.g. +91 98450 99881"
                  value={form.emergencyElectricianPhone}
                  onChange={(e) => setForm({ ...form, emergencyElectricianPhone: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">24/7 Emergency Plumber</Label>
                <Input
                  placeholder="e.g. +91 98450 99882"
                  value={form.emergencyPlumberPhone}
                  onChange={(e) => setForm({ ...form, emergencyPlumberPhone: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Front-Desk Operating Policies */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-900">
              <Clock className="h-4 w-4 text-indigo-600" />
              Desk Operating & Curfew Policies
            </CardTitle>
            <CardDescription className="text-xs">
              Property curfew hours and automated penalty fee configurations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <Label className="text-xs font-semibold">Property Night-Out Curfew Hour</Label>
              <Input
                placeholder="e.g. 10:30 PM or 11:00 PM"
                value={form.curfewTime}
                onChange={(e) => setForm({ ...form, curfewTime: e.target.value })}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Displayed in the Front-Desk Protocol and resident curfew enforcement banners.</p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Lost Master / Duplicate Key Penalty Fee (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 200"
                value={form.lostKeyPenaltyFee}
                onChange={(e) => setForm({ ...form, lostKeyPenaltyFee: e.target.value })}
                className="mt-1 text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Auto-applied when a resident reports a lost key during front-desk key loan settlement.</p>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1.5">
              <p className="font-semibold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Active Branch: {selectedPropertyObj?.name || 'Selected Property'}
              </p>
              <p className="text-[11px] text-indigo-800">
                All changes saved here immediately update the Receptionist Command Center and Tenant Portal without requiring a server restart.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Action Footer */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending || !activePropId}
          className="bg-indigo-600 hover:bg-indigo-500 gap-2 font-semibold shadow-lg shadow-indigo-600/20"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving Settings...' : 'Save Front Desk Configuration'}
        </Button>
      </div>
    </div>
  );
}
