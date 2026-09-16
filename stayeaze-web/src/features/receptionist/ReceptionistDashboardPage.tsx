import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ConciergeBell, UserCheck, LogIn, LogOut, Package, Users, Plus,
  Search, CheckCircle2, Clock, Phone, MapPin, Calendar, QrCode, Sparkles,
  Key, Gauge, ShieldAlert, Send, ArrowRight, Check, Eye, MessageSquare,
  Wrench, FileText, Wifi, Car, Tag, AlertTriangle, ShieldCheck, DollarSign,
  Building, RefreshCw, Smartphone, ClipboardCheck, Lock, Unlock, HelpCircle,
  ExternalLink, Mail, User, CheckSquare
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { formatDateTime, formatDate, formatCurrency, getTodayIsoDate } from '@/lib/format';
import type { Visitor, Tenant, Property, Room, Bed } from '@/lib/types';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePropertyStore } from '@/lib/stores/property-store';

export default function ReceptionistDashboardPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const selectedPropertyId = usePropertyStore((s) => s.selectedPropertyId);

  // Active Modals
  const [visitorModalOpen, setVisitorModalOpen] = useState(false);
  const [parcelModalOpen, setParcelModalOpen] = useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [keyLoanModalOpen, setKeyLoanModalOpen] = useState(false);
  const [lostFoundModalOpen, setLostFoundModalOpen] = useState(false);
  const [shiftHandoverModalOpen, setShiftHandoverModalOpen] = useState(false);
  const [wifiModalOpen, setWifiModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState('hub');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Target States
  const [selectedCheckIn, setSelectedCheckIn] = useState<any>(null);

  // Forms
  const [visitorForm, setVisitorForm] = useState({
    visitorName: '',
    visitorPhone: '',
    tenantId: '',
    tenantName: '',
    purpose: 'Personal Visit',
    idProofNumber: '',
  });

  const [parcelForm, setParcelForm] = useState({
    tenantId: '',
    tenantName: '',
    courierCompany: 'Amazon',
    trackingNumber: '',
    shelfLocation: 'Rack A-1',
  });

  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    phone: '',
    email: '',
    preferredSharing: 'DOUBLE',
    budget: '10000',
    moveInDate: getTodayIsoDate(),
    notes: 'Front desk walk-in tour',
    tokenAmount: '1000',
  });

  const [keyLoanForm, setKeyLoanForm] = useState({
    roomNumber: '',
    bedNumber: 'A',
    tenantName: '',
    tenantPhone: '',
    loanReason: 'LOCKED_OUT',
    notes: '',
  });

  const [lostFoundForm, setLostFoundForm] = useState({
    itemName: '',
    category: 'ELECTRONICS',
    foundLocation: 'Lobby / Common Area',
    storageRack: 'Front Desk Cabinet',
    foundByName: '',
    notes: '',
  });

  const [shiftHandoverForm, setShiftHandoverForm] = useState({
    shiftType: 'MORNING',
    tokenAdvances: '0',
    keyDeposits: '0',
    guestMealTokens: '0',
    incomingStaffName: '',
    notes: '',
  });

  const [checkInForm, setCheckInForm] = useState({
    keyTagNumber: 'KEY-' + Math.floor(100 + Math.random() * 900),
    initialMeterReading: '100',
    idVerified: true,
    welcomeKitHandedOver: true,
  });

  // --- API QUERIES ---

  // 1. Overview Metrics
  const { data: overview = {}, refetch: refetchOverview } = useQuery({
    queryKey: ['front-desk-overview'],
    queryFn: () => api.get('/front-desk/overview').then((r) => r.data || {}),
    refetchInterval: 8000,
  });

  // 2. Properties
  const { data: propertiesData = [] } = useQuery({
    queryKey: ['reception-properties-list'],
    queryFn: () => api.get('/properties').then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  });

  // 3. Tenants for Selectors
  const { data: tenantsData = [] } = useQuery({
    queryKey: ['reception-tenants-list'],
    queryFn: () => api.get('/tenants/minimal').then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  });

  // 4. Rooms & Vacancy Matrix
  const { data: roomsData = [] } = useQuery({
    queryKey: ['reception-rooms-list'],
    queryFn: () => api.get('/rooms', { params: { pageSize: 200 } }).then((r) => (r.data as any)?.data || (Array.isArray(r.data) ? r.data : [])),
  });

  // 5. Parcels
  const { data: parcelsData = [], refetch: refetchParcels } = useQuery({
    queryKey: ['reception-parcels'],
    queryFn: () => api.get('/parcels').then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
    refetchInterval: 8000,
  });

  // 6. Visitors
  const { data: visitorsData = [], refetch: refetchVisitors } = useQuery({
    queryKey: ['reception-visitors'],
    queryFn: () => api.get('/visitors', { params: { pageSize: 100 } }).then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
    refetchInterval: 8000,
  });

  // 7. Key Loans
  const { data: keyLoansData = [], refetch: refetchKeyLoans } = useQuery({
    queryKey: ['front-desk-key-loans'],
    queryFn: () => api.get('/front-desk/key-loans').then((r) => (Array.isArray(r.data) ? r.data : [])),
    refetchInterval: 8000,
  });

  // 8. Lost & Found
  const { data: lostFoundData = [], refetch: refetchLostFound } = useQuery({
    queryKey: ['front-desk-lost-found'],
    queryFn: () => api.get('/front-desk/lost-and-found').then((r) => (Array.isArray(r.data) ? r.data : [])),
  });

  // 9. Shift Handovers
  const { data: shiftHandoversData = [], refetch: refetchShifts } = useQuery({
    queryKey: ['front-desk-shift-handovers'],
    queryFn: () => api.get('/front-desk/shift-handovers').then((r) => (Array.isArray(r.data) ? r.data : [])),
  });

  // 10. Bookings & Check-ins
  const { data: checkInsData = [], refetch: refetchCheckIns } = useQuery({
    queryKey: ['reception-checkins'],
    queryFn: () => api.get('/check-ins').then((r) => r.data?.data || (Array.isArray(r.data) ? r.data : [])),
  });

  // DYNAMIC CURRENT PROPERTY
  const currentProperty: any = useMemo(() => {
    const list = Array.isArray(propertiesData) ? propertiesData : [];
    if (selectedPropertyId && selectedPropertyId !== 'ALL') {
      const match = list.find((p: any) => p.id === selectedPropertyId);
      if (match) return match;
    }
    return list[0] || {};
  }, [propertiesData, selectedPropertyId]);

  // SAFE ARRAYS
  const tenants: any[] = useMemo(() => Array.isArray(tenantsData) ? tenantsData : [], [tenantsData]);
  const rooms: any[] = useMemo(() => Array.isArray(roomsData) ? roomsData : [], [roomsData]);
  const parcels: any[] = useMemo(() => Array.isArray(parcelsData) ? parcelsData : [], [parcelsData]);
  const visitors: any[] = useMemo(() => Array.isArray(visitorsData) ? visitorsData : [], [visitorsData]);
  const keyLoans: any[] = useMemo(() => Array.isArray(keyLoansData) ? keyLoansData : [], [keyLoansData]);
  const lostFoundItems: any[] = useMemo(() => Array.isArray(lostFoundData) ? lostFoundData : [], [lostFoundData]);
  const shiftHandovers: any[] = useMemo(() => Array.isArray(shiftHandoversData) ? shiftHandoversData : [], [shiftHandoversData]);
  const checkIns: any[] = useMemo(() => Array.isArray(checkInsData) ? checkInsData : [], [checkInsData]);

  // Dynamic Wi-Fi Credentials
  const activeWifiSsid = currentProperty?.wifiSsid || 'StayEaze_HighSpeed_Guest';
  const activeWifiPassword = currentProperty?.wifiPassword || 'StayEaze@2026';
  const wifiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    `WIFI:S:${activeWifiSsid};T:WPA;P:${activeWifiPassword};;`
  )}`;

  // Filtered lists
  const filteredVisitors = useMemo(() => {
    if (!searchQuery) return visitors;
    return visitors.filter((v: any) =>
      (v.visitorName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [visitors, searchQuery]);

  const filteredParcels = useMemo(() => {
    if (!searchQuery) return parcels;
    return parcels.filter((p: any) =>
      (p.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.trackingNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.shelfLocation || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [parcels, searchQuery]);

  // --- MUTATIONS ---

  // 1. Visitor Pass Mutation
  const createVisitorMutation = useMutation({
    mutationFn: (data: any) => api.post('/visitors', {
      ...data,
      propertyId: currentProperty?.id,
    }),
    onSuccess: (res) => {
      const code = res.data?.passCode || res.data?.data?.passCode || 'VP-' + Math.floor(1000 + Math.random() * 9000);
      toast({ title: 'Visitor Pass Issued Successfully', description: `Gate Pass #${code} generated. Host notified.` });
      setVisitorModalOpen(false);
      refetchVisitors();
      refetchOverview();
      setVisitorForm({ visitorName: '', visitorPhone: '', tenantId: '', tenantName: '', purpose: 'Personal Visit', idProofNumber: '' });
    },
    onError: (e: any) => toast({ title: 'Failed to issue pass', description: e.response?.data?.message || e.message, variant: 'destructive' }),
  });

  // 2. Inward Parcel Mutation
  const createParcelMutation = useMutation({
    mutationFn: (data: any) => api.post('/parcels', {
      ...data,
      propertyId: currentProperty?.id,
    }),
    onSuccess: () => {
      toast({ title: 'Inward Parcel Logged', description: 'Package stored in rack. Resident alert dispatched.' });
      setParcelModalOpen(false);
      refetchParcels();
      refetchOverview();
      setParcelForm({ tenantId: '', tenantName: '', courierCompany: 'Amazon', trackingNumber: '', shelfLocation: 'Rack A-1' });
    },
    onError: (e: any) => toast({ title: 'Failed to log parcel', description: e.response?.data?.message || e.message, variant: 'destructive' }),
  });

  const releaseParcelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/parcels/${id}/deliver`, {}),
    onSuccess: () => {
      toast({ title: 'Parcel Handover Complete', description: 'Package marked as delivered to resident.' });
      refetchParcels();
      refetchOverview();
    },
  });

  // 3. Walk-In Inquiry & Token Mutation
  const createInquiryMutation = useMutation({
    mutationFn: (data: any) => api.post('/inquiries', {
      name: data.name,
      mobile: data.phone,
      email: data.email || undefined,
      preferredSharing: data.preferredSharing,
      budget: data.budget ? parseFloat(data.budget) : undefined,
      expectedMoveInDate: data.moveInDate || undefined,
      source: 'WALK_IN_FRONT_DESK',
      notes: `${data.notes} (Token Collected: ₹${data.tokenAmount})`,
      propertyId: currentProperty?.id,
    }),
    onSuccess: () => {
      toast({
        title: 'Walk-In Inquiry & Token Logged',
        description: `Lead registered under ${currentProperty?.name || 'Property'} pipeline. Advance Token added to shift cash drawer.`,
      });
      setInquiryModalOpen(false);
      refetchOverview();
      setInquiryForm({ name: '', phone: '', email: '', preferredSharing: 'DOUBLE', budget: '10000', moveInDate: getTodayIsoDate(), notes: 'Front desk walk-in tour', tokenAmount: '1000' });
    },
    onError: (e: any) => toast({ title: 'Failed to log inquiry', description: e.response?.data?.message || e.message, variant: 'destructive' }),
  });

  // 4. Master Key Loan Mutation
  const createKeyLoanMutation = useMutation({
    mutationFn: (data: any) => api.post('/front-desk/key-loans', {
      ...data,
      issuedByName: currentUser?.name || 'Front Desk Officer',
      propertyId: currentProperty?.id,
    }),
    onSuccess: () => {
      toast({ title: 'Master Key Loan Issued', description: '30-minute countdown timer active.' });
      setKeyLoanModalOpen(false);
      refetchKeyLoans();
      refetchOverview();
      setKeyLoanForm({ roomNumber: '', bedNumber: 'A', tenantName: '', tenantPhone: '', loanReason: 'LOCKED_OUT', notes: '' });
    },
    onError: (e: any) => toast({ title: 'Failed to issue key', description: e.response?.data?.message || e.message, variant: 'destructive' }),
  });

  const returnKeyLoanMutation = useMutation({
    mutationFn: ({ id, isLost }: { id: string; isLost?: boolean }) => api.put(`/front-desk/key-loans/${id}/return`, { isLost }),
    onSuccess: () => {
      toast({ title: 'Key Returned', description: 'Key checked back into front desk repository.' });
      refetchKeyLoans();
      refetchOverview();
    },
  });

  // 5. Lost & Found Mutation
  const createLostFoundMutation = useMutation({
    mutationFn: (data: any) => api.post('/front-desk/lost-and-found', {
      ...data,
      foundByName: data.foundByName || currentUser?.name || 'Front Desk Staff',
      propertyId: currentProperty?.id,
    }),
    onSuccess: () => {
      toast({ title: 'Lost & Found Item Tagged', description: 'Item entered into front-desk custody repository.' });
      setLostFoundModalOpen(false);
      refetchLostFound();
      refetchOverview();
      setLostFoundForm({ itemName: '', category: 'ELECTRONICS', foundLocation: 'Lobby / Common Area', storageRack: 'Front Desk Cabinet', foundByName: '', notes: '' });
    },
    onError: (e: any) => toast({ title: 'Failed to log item', description: e.response?.data?.message || e.message, variant: 'destructive' }),
  });

  // 6. Shift Cash Handover Mutation
  const submitShiftMutation = useMutation({
    mutationFn: (data: any) => api.post('/front-desk/shift-handover', {
      ...data,
      tokenAdvances: parseFloat(data.tokenAdvances || '0'),
      keyDeposits: parseFloat(data.keyDeposits || '0'),
      guestMealTokens: parseFloat(data.guestMealTokens || '0'),
      receptionistName: currentUser?.name || 'Front Desk Officer',
      propertyId: currentProperty?.id,
    }),
    onSuccess: () => {
      toast({
        title: 'Shift Cash Handover Submitted',
        description: 'Physical cash count sent to Property Manager for treasury safe verification.',
      });
      setShiftHandoverModalOpen(false);
      refetchShifts();
      refetchOverview();
      setShiftHandoverForm({ shiftType: 'MORNING', tokenAdvances: '0', keyDeposits: '0', guestMealTokens: '0', incomingStaffName: '', notes: '' });
    },
    onError: (e: any) => toast({ title: 'Failed to submit shift', description: e.response?.data?.message || e.message, variant: 'destructive' }),
  });

  // 7. Express Check-In Mutation
  const completeCheckInMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.post(`/check-ins/${id}/mark-completed`, payload),
    onSuccess: () => {
      toast({
        title: 'Express Move-In Check-In Completed',
        description: 'Resident verified, physical keys issued, welcome kit delivered, bed marked OCCUPIED.',
      });
      setCheckInModalOpen(false);
      setSelectedCheckIn(null);
      refetchCheckIns();
      refetchOverview();
    },
    onError: (e: any) => toast({ title: 'Check-in completion failed', description: e.response?.data?.message || e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6 pb-12">
      {/* 1. DYNAMIC HERO COMMAND HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl border border-indigo-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-400/30 backdrop-blur-md text-indigo-400 shadow-inner">
              <ConciergeBell className="h-7 w-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {currentProperty?.name ? `${currentProperty.name} — Front Desk` : 'Front Desk Command Center'}
                </h1>
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping mr-1.5" />
                  Duty Officer: {currentUser?.name || 'Reception Officer'}
                </Badge>
              </div>
              <p className="text-sm text-slate-300 mt-1 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                {currentProperty?.address ? `${currentProperty.address}, ${currentProperty.city || ''}` : 'Ground Front-Desk Terminal'}
                <span className="text-slate-500">•</span>
                <span>Shift: {new Date().getHours() < 14 ? 'Morning Shift (07:00 - 15:00)' : 'Evening Shift (15:00 - 23:00)'}</span>
              </p>
            </div>
          </div>

          {/* Quick Speed Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setEmergencyModalOpen(true)}
              variant="destructive"
              size="sm"
              className="gap-1.5 shadow-lg shadow-red-500/20 font-semibold"
            >
              <ShieldAlert className="h-4 w-4" />
              Emergency SOS
            </Button>
            <Button
              onClick={() => setWifiModalOpen(true)}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-1.5"
            >
              <Wifi className="h-4 w-4 text-cyan-300" />
              Guest Wi-Fi QR
            </Button>
            <Button
              onClick={() => setShiftHandoverModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-lg shadow-emerald-600/30"
              size="sm"
            >
              <DollarSign className="h-4 w-4" />
              Shift Cash Handover
            </Button>
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME KPI COUNTER CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-indigo-100 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Today Arrivals</p>
              <p className="text-2xl font-bold text-indigo-950 mt-0.5">{overview?.todayArrivals || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <LogIn className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Today Departures</p>
              <p className="text-2xl font-bold text-amber-950 mt-0.5">{overview?.todayDepartures || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <LogOut className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Inward Parcels</p>
              <p className="text-2xl font-bold text-blue-950 mt-0.5">{overview?.pendingParcels || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Active Visitors</p>
              <p className="text-2xl font-bold text-purple-950 mt-0.5">{overview?.activeVisitors || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-100 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Active Key Loans</p>
              <p className="text-2xl font-bold text-rose-950 mt-0.5">{overview?.activeKeyLoans || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Key className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-white/70 backdrop-blur shadow-sm hover:shadow-md transition">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Unclaimed Lost</p>
              <p className="text-2xl font-bold text-emerald-950 mt-0.5">{overview?.unclaimedLostItems || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Tag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. MULTI-TAB FRONT DESK WORKSPACE */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-xl border shadow-sm">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto p-1 bg-slate-100/80 rounded-lg">
            <TabsTrigger value="hub" className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ConciergeBell className="h-3.5 w-3.5" />
              Desk Hub
            </TabsTrigger>
            <TabsTrigger value="arrivals" className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <LogIn className="h-3.5 w-3.5" />
              Arrivals ({checkIns.filter((c: any) => c.status === 'pending' || c.status === 'PENDING').length})
            </TabsTrigger>
            <TabsTrigger value="parcels" className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Package className="h-3.5 w-3.5" />
              Parcels ({parcels.filter((p: any) => p.status === 'IN_CUSTODY' || p.status === 'PENDING').length})
            </TabsTrigger>
            <TabsTrigger value="visitors" className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5" />
              Visitors
            </TabsTrigger>
            <TabsTrigger value="vacancy" className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Building className="h-3.5 w-3.5" />
              Vacancy Matrix
            </TabsTrigger>
            <TabsTrigger value="keys-cash" className="text-xs py-2 gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Key className="h-3.5 w-3.5" />
              Keys & Cash
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search resident, room, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        {/* TAB 1: DESK HUB & ACTION SPEED DIAL */}
        <TabsContent value="hub" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left 2 Cols: Action Speed Dial Grid */}
            <div className="md:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Front Desk Action Speed Dial
                  </CardTitle>
                  <CardDescription>Instant triggers for high-frequency resident and visitor services</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Button
                    onClick={() => setVisitorModalOpen(true)}
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-purple-500 hover:bg-purple-50/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Issue Visitor Pass</span>
                  </Button>

                  <Button
                    onClick={() => setParcelModalOpen(true)}
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-blue-500 hover:bg-blue-50/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Package className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Log Inward Parcel</span>
                  </Button>

                  <Button
                    onClick={() => setInquiryModalOpen(true)}
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-amber-500 hover:bg-amber-50/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                      <Building className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Walk-In Tour / Token</span>
                  </Button>

                  <Button
                    onClick={() => setKeyLoanModalOpen(true)}
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-rose-500 hover:bg-rose-50/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                      <Key className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Master Key Loan</span>
                  </Button>

                  <Button
                    onClick={() => setLostFoundModalOpen(true)}
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-emerald-500 hover:bg-emerald-50/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Tag className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Lost & Found Item</span>
                  </Button>

                  <Button
                    onClick={() => setShiftHandoverModalOpen(true)}
                    variant="outline"
                    className="h-24 flex-col gap-2 border-dashed border-2 hover:border-cyan-500 hover:bg-cyan-50/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <span className="font-semibold text-xs">Shift Cash Ledger</span>
                  </Button>
                </CardContent>
              </Card>

              {/* Active Key Loans Alert Box */}
              {keyLoans.filter((k: any) => k.status === 'ACTIVE_LOAN').length > 0 && (
                <Card className="border-rose-200 bg-rose-50/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold text-rose-900 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-600 animate-bounce" />
                        Active Master Key Loans in Circulation ({keyLoans.filter((k: any) => k.status === 'ACTIVE_LOAN').length})
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => setActiveTab('keys-cash')} className="text-xs h-7 text-rose-700">
                        View All
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pb-3">
                    {keyLoans.filter((k: any) => k.status === 'ACTIVE_LOAN').slice(0, 3).map((loan: any) => (
                      <div key={loan.id} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-rose-100 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono bg-rose-50 text-rose-700 border-rose-200">
                            Room {loan.roomNumber}
                          </Badge>
                          <span className="font-medium text-slate-900">{loan.tenantName}</span>
                          <span className="text-slate-500">({loan.loanReason})</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => returnKeyLoanMutation.mutate({ id: loan.id })}
                          className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Mark Returned
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Col: Duty Information & Emergency Quick Dial */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Desk Protocol & Hierarchy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-600">
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <p className="font-medium text-slate-900">1. Shift Cash Submission</p>
                    <p className="text-slate-500 mt-0.5">All booking tokens & key deposits are verified and accepted into property treasury by the Property Manager.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <p className="font-medium text-slate-900">2. Night-Out Curfew Check</p>
                    <p className="text-slate-500 mt-0.5">
                      Curfew is <span className="font-bold text-slate-800">{currentProperty?.curfewTime || '10:30 PM'}</span>. Verify manager-approved late passes before recording gate entry.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <p className="font-medium text-slate-900">3. Inward Parcel Custody</p>
                    <p className="text-slate-500 mt-0.5">Tag storage rack immediately upon receiving. Parcels exceeding 7 days are flagged to the manager.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ARRIVALS & CHECK-IN DESK */}
        <TabsContent value="arrivals" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Expected Arrivals & Move-In Roster</CardTitle>
                <CardDescription>Fast-track check-in with physical key tags, sub-meter reading & welcome kit handover</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {checkIns.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No pending check-in arrivals scheduled for today.</p>
                ) : (
                  checkIns.map((ci: any) => (
                    <div key={ci.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-sm">
                          {ci.tenantName?.slice(0, 2).toUpperCase() || 'CI'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-slate-900">{ci.tenantName}</p>
                            <Badge variant="outline" className="font-mono text-xs">
                              Room {ci.roomNumber || 'TBD'} • Bed {ci.bedNumber || 'B1'}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Move-in Date: {ci.checkInDate ? formatDate(ci.checkInDate) : 'Today'} • Rent: {formatCurrency(ci.rent || 8000)} • Deposit: {formatCurrency(ci.depositPaid || 16000)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={ci.status} tone={statusTone(ci.status)} />
                        {(ci.status === 'pending' || ci.status === 'PENDING') && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCheckIn(ci);
                              setCheckInModalOpen(true);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-xs h-8 gap-1.5"
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            Express Check-In
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PARCEL LOCKER HUB */}
        <TabsContent value="parcels" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">E-Commerce Inward Deliveries & Resident Custody</CardTitle>
                <CardDescription>Log courier packages, tag storage shelves, and release with resident confirmation</CardDescription>
              </div>
              <Button onClick={() => setParcelModalOpen(true)} size="sm" className="bg-indigo-600 hover:bg-indigo-500 gap-1.5">
                <Plus className="h-4 w-4" /> Log Inward Parcel
              </Button>
            </CardHeader>
            <CardContent>
              {filteredParcels.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No parcels currently logged in custody.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredParcels.map((p: any) => {
                    const isCustody = p.status === 'IN_CUSTODY' || p.status === 'PENDING';
                    return (
                      <div key={p.id} className={`p-4 rounded-xl border ${isCustody ? 'bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                              {p.courierCompany}
                            </Badge>
                            <p className="font-bold text-sm text-slate-900 mt-2">{p.tenantName || 'Resident'}</p>
                            <p className="text-xs text-slate-500 font-mono">Tracking: {p.trackingNumber || 'N/A'}</p>
                          </div>
                          <Badge className={isCustody ? 'bg-amber-500' : 'bg-emerald-600'}>
                            {isCustody ? 'In Storage' : 'Collected'}
                          </Badge>
                        </div>

                        <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {p.shelfLocation || 'Rack A-1'}
                          </span>
                          {isCustody && (
                            <Button
                              size="sm"
                              onClick={() => releaseParcelMutation.mutate(p.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 gap-1"
                            >
                              <Check className="h-3 w-3" /> Release Handover
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: VISITORS & NIGHT PASSES */}
        <TabsContent value="visitors" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Visitor Passes & Night Gate Roster</CardTitle>
                <CardDescription>Digital gate check-in, purpose verification, and resident host tracking</CardDescription>
              </div>
              <Button onClick={() => setVisitorModalOpen(true)} size="sm" className="bg-purple-600 hover:bg-purple-500 gap-1.5">
                <Plus className="h-4 w-4" /> Issue Visitor Pass
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {filteredVisitors.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No visitors recorded today.</p>
                ) : (
                  filteredVisitors.map((v: any) => (
                    <div key={v.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 font-bold text-sm">
                          {v.visitorName?.slice(0, 2).toUpperCase() || 'VP'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-slate-900">{v.visitorName}</p>
                            <Badge variant="outline" className="text-xs bg-slate-50 font-mono">
                              Pass #{v.passCode || 'ACTIVE'}
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-slate-50">
                              {v.purpose || 'Personal Visit'}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Visiting Resident: <span className="font-semibold text-slate-700">{v.tenantName || 'Common Area'}</span> • Phone: {v.mobileNumber || v.visitorPhone || 'N/A'} • In: {v.checkInTime ? formatDateTime(v.checkInTime) : 'Active'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={v.status === 'ACTIVE' || v.status === 'INSIDE' ? 'bg-emerald-600' : 'bg-slate-500'}>
                          {v.status === 'ACTIVE' || v.status === 'INSIDE' ? 'On Premises' : 'Checked Out'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: VACANCY MATRIX & WALK-IN TOURS */}
        <TabsContent value="vacancy" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Live Room & Sharing Vacancy Scanner</CardTitle>
                <CardDescription>Instant vacant bed availability for walk-in inquiries with 1-click token booking</CardDescription>
              </div>
              <Button onClick={() => setInquiryModalOpen(true)} size="sm" className="bg-amber-600 hover:bg-amber-500 gap-1.5">
                <Plus className="h-4 w-4" /> Walk-In Tour & Token
              </Button>
            </CardHeader>
            <CardContent>
              {rooms.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Loading room vacancy status...</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {rooms.map((r: any) => {
                    const availableBedCount = Array.isArray(r.beds)
                      ? r.beds.filter((b: any) => b.status === 'VACANT' || b.status === 'AVAILABLE').length
                      : (typeof r.availableBeds === 'number' ? r.availableBeds : (typeof r.beds === 'number' ? r.beds : 1));
                    return (
                      <div key={r.id} className="p-4 rounded-xl border bg-white shadow-sm hover:border-indigo-300 transition">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900 font-mono">Room {r.roomNumber}</span>
                          <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
                            {r.roomType || 'DOUBLE'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Tariff: {formatCurrency(r.rent || 8500)} / mo</p>
                        
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-700">
                            {availableBedCount > 0 ? `${availableBedCount} Beds Available` : 'Fully Occupied'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setInquiryForm((prev) => ({ ...prev, preferredSharing: r.roomType || 'DOUBLE' }));
                              setInquiryModalOpen(true);
                            }}
                            className="h-6 text-xs text-indigo-600 hover:bg-indigo-50"
                          >
                            Book Token
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: KEY MANAGEMENT & SHIFT CASH LEDGER */}
        <TabsContent value="keys-cash" className="space-y-6">
          {/* Key Loans Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Master Key Temporary Loans & Replacements</CardTitle>
                <CardDescription>Track lockout temporary key checkouts with 30-min countdown and replacement fees</CardDescription>
              </div>
              <Button onClick={() => setKeyLoanModalOpen(true)} size="sm" className="bg-rose-600 hover:bg-rose-500 gap-1.5">
                <Key className="h-4 w-4" /> Issue Master Key
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {keyLoans.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No master keys currently checked out.</p>
                ) : (
                  keyLoans.map((loan: any) => (
                    <div key={loan.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono bg-rose-50 text-rose-700 border-rose-200">
                            Room {loan.roomNumber}
                          </Badge>
                          <span className="font-bold text-slate-900">{loan.tenantName}</span>
                          <span className="text-slate-500">Reason: {loan.loanReason}</span>
                        </div>
                        <p className="text-slate-500 mt-1">
                          Issued At: {formatDateTime(loan.loanTime)} • Issued By: {loan.issuedByName || 'Front Desk'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={loan.status === 'ACTIVE_LOAN' ? 'bg-amber-500' : 'bg-emerald-600'}>
                          {loan.status === 'ACTIVE_LOAN' ? 'Key In Use' : 'Returned'}
                        </Badge>
                        {loan.status === 'ACTIVE_LOAN' && (
                          <Button
                            size="sm"
                            onClick={() => returnKeyLoanMutation.mutate({ id: loan.id })}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white h-7 text-xs"
                          >
                            Mark Returned
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lost & Found Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Lost & Found Property Custody</CardTitle>
                <CardDescription>Tagged unclaimed resident possessions stored at front desk</CardDescription>
              </div>
              <Button onClick={() => setLostFoundModalOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-500 gap-1.5">
                <Tag className="h-4 w-4" /> Log Found Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {lostFoundItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No unclaimed lost items currently in front-desk storage.</p>
                ) : (
                  lostFoundItems.map((item: any) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold">
                            {item.category}
                          </Badge>
                          <span className="font-bold text-slate-900">{item.itemName}</span>
                          <span className="text-slate-500">Location: {item.foundLocation}</span>
                        </div>
                        <p className="text-slate-500 mt-1">
                          Storage: {item.storageRack || 'Desk Safe'} • Found by: {item.foundByName || 'Staff'} • Date: {item.foundDate || 'Today'}
                        </p>
                      </div>

                      <Badge className={item.status === 'UNCLAIMED' ? 'bg-amber-500' : 'bg-emerald-600'}>
                        {item.status === 'UNCLAIMED' ? 'In Storage' : 'Claimed by Resident'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shift Cash Handover History Table */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Front Desk Shift Cash Handovers</CardTitle>
                <CardDescription>Daily cash handover submissions awaiting Property Manager verification and treasury deposit</CardDescription>
              </div>
              <Button onClick={() => setShiftHandoverModalOpen(true)} size="sm" className="bg-cyan-600 hover:bg-cyan-500 gap-1.5">
                <DollarSign className="h-4 w-4" /> Submit Shift Handover
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {shiftHandovers.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No shift cash submissions logged yet.</p>
                ) : (
                  shiftHandovers.map((shift: any) => (
                    <div key={shift.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold">
                            {shift.shiftType} SHIFT
                          </Badge>
                          <span className="font-bold text-slate-900 text-sm">{formatCurrency(shift.cashCollected || 0)}</span>
                          <span className="text-slate-500">
                            (Tokens: {formatCurrency(shift.tokenAdvances || 0)}, Deposits: {formatCurrency(shift.keyDeposits || 0)})
                          </span>
                        </div>
                        <p className="text-slate-500 mt-1">
                          Submitted by: {shift.receptionistName} • Next Duty: {shift.incomingStaffName || 'Next Shift'} • Date: {formatDate(shift.shiftDate)}
                        </p>
                      </div>

                      <Badge className={shift.status === 'VERIFIED_DEPOSITED' ? 'bg-emerald-600' : 'bg-amber-500'}>
                        {shift.status === 'VERIFIED_DEPOSITED' ? 'Verified & Deposited' : 'Pending Manager Review'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- ALL 9 OPERATIONAL MODALS (100% COMPLETE & WIRED) --- */}

      {/* 1. VISITOR PASS MODAL */}
      <Dialog open={visitorModalOpen} onOpenChange={setVisitorModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Issue Visitor Gate Pass
            </DialogTitle>
            <DialogDescription>Record guest details, generate digital pass code and link to host</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Visitor Full Name *</Label>
              <Input
                placeholder="e.g. Ramesh Patel"
                value={visitorForm.visitorName}
                onChange={(e) => setVisitorForm({ ...visitorForm, visitorName: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Visitor Mobile Number *</Label>
              <Input
                placeholder="e.g. 9845112233"
                value={visitorForm.visitorPhone}
                onChange={(e) => setVisitorForm({ ...visitorForm, visitorPhone: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Host Resident / Destination</Label>
              <Select
                value={visitorForm.tenantId}
                onValueChange={(val) => {
                  if (val === 'NONE') {
                    setVisitorForm({ ...visitorForm, tenantId: '', tenantName: 'Common Area / Management' });
                  } else {
                    const t = tenants.find((item: any) => item.id === val);
                    setVisitorForm({ ...visitorForm, tenantId: val, tenantName: t?.name || '' });
                  }
                }}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Select Resident or Common Area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" className="text-xs text-slate-500 font-semibold">General Visitor / Common Area / Maintenance</SelectItem>
                  {tenants.map((t: any) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name} (Room {t.roomNumber || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Purpose of Visit</Label>
              <Select
                value={visitorForm.purpose}
                onValueChange={(val) => setVisitorForm({ ...visitorForm, purpose: val })}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal Visit">Personal Visit / Friends</SelectItem>
                  <SelectItem value="Parents / Family">Parents / Family</SelectItem>
                  <SelectItem value="Food Delivery">Food Delivery (Swiggy/Zomato/Blinkit)</SelectItem>
                  <SelectItem value="Maintenance">Maintenance / Service Technician</SelectItem>
                  <SelectItem value="Room Tour">Prospective Tenant / Room Tour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setVisitorModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createVisitorMutation.mutate(visitorForm)}
              disabled={!visitorForm.visitorName || createVisitorMutation.isPending}
              className="bg-purple-600 hover:bg-purple-500"
            >
              {createVisitorMutation.isPending ? 'Generating Pass...' : 'Issue Digital Gate Pass'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. PARCEL INWARD MODAL */}
      <Dialog open={parcelModalOpen} onOpenChange={setParcelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              Log Inward Delivery Parcel
            </DialogTitle>
            <DialogDescription>Check in courier package, assign locker rack & alert resident</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Courier / Delivery Service</Label>
              <Select
                value={parcelForm.courierCompany}
                onValueChange={(val) => setParcelForm({ ...parcelForm, courierCompany: val })}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                  <SelectItem value="Flipkart">Flipkart</SelectItem>
                  <SelectItem value="Bluedart">Bluedart</SelectItem>
                  <SelectItem value="Swiggy / Zomato">Swiggy / Zomato / Blinkit</SelectItem>
                  <SelectItem value="DTDC / India Post">DTDC / India Post</SelectItem>
                  <SelectItem value="Other Courier">Other Courier / Package</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">Recipient Resident *</Label>
              <Select
                value={parcelForm.tenantId}
                onValueChange={(val) => {
                  const t = tenants.find((item: any) => item.id === val);
                  setParcelForm({ ...parcelForm, tenantId: val, tenantName: t?.name || '' });
                }}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Select Recipient Resident" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t: any) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name} (Room {t.roomNumber || 'N/A'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Tracking AWB #</Label>
                <Input
                  placeholder="e.g. TRK-98212"
                  value={parcelForm.trackingNumber}
                  onChange={(e) => setParcelForm({ ...parcelForm, trackingNumber: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Storage Rack / Locker Tag</Label>
                <Input
                  placeholder="e.g. Rack A-1, Locker 12"
                  value={parcelForm.shelfLocation}
                  onChange={(e) => setParcelForm({ ...parcelForm, shelfLocation: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setParcelModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createParcelMutation.mutate(parcelForm)}
              disabled={!parcelForm.tenantId || createParcelMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {createParcelMutation.isPending ? 'Logging Package...' : 'Log Package & Notify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. WALK-IN TOUR & TOKEN ADVANCE MODAL (ACTIVATED) */}
      <Dialog open={inquiryModalOpen} onOpenChange={setInquiryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <Building className="h-5 w-5 text-amber-600" />
              Walk-In Tour & Bed Token Booking
            </DialogTitle>
            <DialogDescription>Register prospective resident, capture room preference and advance token</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Prospect Full Name *</Label>
                <Input
                  placeholder="e.g. Amit Kumar"
                  value={inquiryForm.name}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Mobile Number *</Label>
                <Input
                  placeholder="e.g. 9845012345"
                  value={inquiryForm.phone}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Email Address (Optional)</Label>
              <Input
                type="email"
                placeholder="e.g. amit.kumar@gmail.com"
                value={inquiryForm.email}
                onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Preferred Sharing</Label>
                <Select
                  value={inquiryForm.preferredSharing}
                  onValueChange={(val) => setInquiryForm({ ...inquiryForm, preferredSharing: val })}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">Single Private Room</SelectItem>
                    <SelectItem value="DOUBLE">Double Sharing</SelectItem>
                    <SelectItem value="TRIPLE">Triple Sharing</SelectItem>
                    <SelectItem value="FOUR">Four Sharing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Target Move-In Date</Label>
                <Input
                  type="date"
                  value={inquiryForm.moveInDate}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, moveInDate: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Monthly Budget (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10000"
                  value={inquiryForm.budget}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, budget: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Token Advance Collected (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 1000"
                  value={inquiryForm.tokenAmount}
                  onChange={(e) => setInquiryForm({ ...inquiryForm, tokenAmount: e.target.value })}
                  className="mt-1 text-xs font-bold text-emerald-700"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Tour Feedback & Notes</Label>
              <Textarea
                placeholder="Prospect liked 2nd floor room. Agreed on 1st of next month move-in."
                value={inquiryForm.notes}
                onChange={(e) => setInquiryForm({ ...inquiryForm, notes: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInquiryModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createInquiryMutation.mutate(inquiryForm)}
              disabled={!inquiryForm.name || !inquiryForm.phone || createInquiryMutation.isPending}
              className="bg-amber-600 hover:bg-amber-500"
            >
              {createInquiryMutation.isPending ? 'Logging Tour...' : 'Register Tour & Lock Token'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. MASTER KEY LOAN MODAL */}
      <Dialog open={keyLoanModalOpen} onOpenChange={setKeyLoanModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-rose-600" />
              Issue Master Key Loan
            </DialogTitle>
            <DialogDescription>Record temporary master key loan with active countdown timer</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Room Number *</Label>
                <Input
                  placeholder="e.g. 101"
                  value={keyLoanForm.roomNumber}
                  onChange={(e) => setKeyLoanForm({ ...keyLoanForm, roomNumber: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Bed Tag</Label>
                <Input
                  placeholder="e.g. A"
                  value={keyLoanForm.bedNumber}
                  onChange={(e) => setKeyLoanForm({ ...keyLoanForm, bedNumber: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Resident / Borrower Name *</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={keyLoanForm.tenantName}
                  onChange={(e) => setKeyLoanForm({ ...keyLoanForm, tenantName: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Contact Phone</Label>
                <Input
                  placeholder="e.g. 9845110022"
                  value={keyLoanForm.tenantPhone}
                  onChange={(e) => setKeyLoanForm({ ...keyLoanForm, tenantPhone: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Loan Reason</Label>
              <Select
                value={keyLoanForm.loanReason}
                onValueChange={(val) => setKeyLoanForm({ ...keyLoanForm, loanReason: val })}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOCKED_OUT">Resident Locked Out</SelectItem>
                  <SelectItem value="ROOM_INSPECTION">Staff Room Inspection</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance Repair Tech</SelectItem>
                  <SelectItem value="SPARE_BORROW">Temporary Spare Borrow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setKeyLoanModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createKeyLoanMutation.mutate(keyLoanForm)}
              disabled={!keyLoanForm.roomNumber || !keyLoanForm.tenantName || createKeyLoanMutation.isPending}
              className="bg-rose-600 hover:bg-rose-500"
            >
              {createKeyLoanMutation.isPending ? 'Issuing Key...' : 'Issue Key & Start Timer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. LOST & FOUND ITEM MODAL (ACTIVATED) */}
      <Dialog open={lostFoundModalOpen} onOpenChange={setLostFoundModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Tag className="h-5 w-5 text-emerald-600" />
              Log Lost & Found Item
            </DialogTitle>
            <DialogDescription>Check found property into front desk custody repository</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Item Description *</Label>
              <Input
                placeholder="e.g. Wireless Earbuds, Blue Wallet, Sony Headphones"
                value={lostFoundForm.itemName}
                onChange={(e) => setLostFoundForm({ ...lostFoundForm, itemName: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Category</Label>
                <Select
                  value={lostFoundForm.category}
                  onValueChange={(val) => setLostFoundForm({ ...lostFoundForm, category: val })}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ELECTRONICS">Electronics / Gadgets</SelectItem>
                    <SelectItem value="CLOTHING">Clothing & Apparels</SelectItem>
                    <SelectItem value="DOCUMENTS">Documents / Wallets / IDs</SelectItem>
                    <SelectItem value="KEYS">Keys & Locks</SelectItem>
                    <SelectItem value="JEWELRY">Jewelry / Watches</SelectItem>
                    <SelectItem value="OTHER">Other Valuable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Storage Shelf / Rack</Label>
                <Input
                  placeholder="e.g. Cabinet Shelf 2"
                  value={lostFoundForm.storageRack}
                  onChange={(e) => setLostFoundForm({ ...lostFoundForm, storageRack: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Found Location</Label>
                <Input
                  placeholder="e.g. 2nd Floor Common Area"
                  value={lostFoundForm.foundLocation}
                  onChange={(e) => setLostFoundForm({ ...lostFoundForm, foundLocation: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Found By (Staff / Resident)</Label>
                <Input
                  placeholder="e.g. Housekeeping Staff"
                  value={lostFoundForm.foundByName}
                  onChange={(e) => setLostFoundForm({ ...lostFoundForm, foundByName: e.target.value })}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Additional Details / Marks</Label>
              <Textarea
                placeholder="Black case with small scratch on left side. Found near gym bench."
                value={lostFoundForm.notes}
                onChange={(e) => setLostFoundForm({ ...lostFoundForm, notes: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLostFoundModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => createLostFoundMutation.mutate(lostFoundForm)}
              disabled={!lostFoundForm.itemName || createLostFoundMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {createLostFoundMutation.isPending ? 'Logging Item...' : 'Check In Custody'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. SHIFT CASH HANDOVER MODAL */}
      <Dialog open={shiftHandoverModalOpen} onOpenChange={setShiftHandoverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-cyan-600" />
              Front Desk Shift Cash Handover
            </DialogTitle>
            <DialogDescription>Submit physical cash count to Property Manager for treasury safe deposit</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Current Shift</Label>
              <Select
                value={shiftHandoverForm.shiftType}
                onValueChange={(val) => setShiftHandoverForm({ ...shiftHandoverForm, shiftType: val })}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MORNING">Morning Shift (07:00 - 15:00)</SelectItem>
                  <SelectItem value="EVENING">Evening Shift (15:00 - 23:00)</SelectItem>
                  <SelectItem value="NIGHT">Night Shift (23:00 - 07:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Advance Tokens (₹)</Label>
                <Input
                  type="number"
                  value={shiftHandoverForm.tokenAdvances}
                  onChange={(e) => setShiftHandoverForm({ ...shiftHandoverForm, tokenAdvances: e.target.value })}
                  className="mt-1 text-xs font-semibold text-emerald-700"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Key Deposits (₹)</Label>
                <Input
                  type="number"
                  value={shiftHandoverForm.keyDeposits}
                  onChange={(e) => setShiftHandoverForm({ ...shiftHandoverForm, keyDeposits: e.target.value })}
                  className="mt-1 text-xs font-semibold text-blue-700"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Meal Tokens (₹)</Label>
                <Input
                  type="number"
                  value={shiftHandoverForm.guestMealTokens}
                  onChange={(e) => setShiftHandoverForm({ ...shiftHandoverForm, guestMealTokens: e.target.value })}
                  className="mt-1 text-xs font-semibold text-purple-700"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Incoming Staff / Reliever Name</Label>
              <Input
                placeholder="e.g. Kavya Menon"
                value={shiftHandoverForm.incomingStaffName}
                onChange={(e) => setShiftHandoverForm({ ...shiftHandoverForm, incomingStaffName: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Handover Notes</Label>
              <Textarea
                placeholder="Physical cash counted in drawer: ₹2,800. Handed over key log."
                value={shiftHandoverForm.notes}
                onChange={(e) => setShiftHandoverForm({ ...shiftHandoverForm, notes: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShiftHandoverModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => submitShiftMutation.mutate(shiftHandoverForm)}
              disabled={submitShiftMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500"
            >
              {submitShiftMutation.isPending ? 'Submitting...' : 'Submit Handover to Manager'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. EXPRESS CHECK-IN MODAL (ACTIVATED) */}
      <Dialog open={checkInModalOpen} onOpenChange={setCheckInModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <LogIn className="h-5 w-5 text-indigo-600" />
              Express Move-In Check-In
            </DialogTitle>
            <DialogDescription>
              Complete move-in onboarding for <span className="font-bold text-slate-900">{selectedCheckIn?.tenantName || 'Resident'}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">{selectedCheckIn?.tenantName}</p>
                <p className="text-slate-600 font-mono">Room {selectedCheckIn?.roomNumber || '101'} • Bed {selectedCheckIn?.bedNumber || 'B1'}</p>
              </div>
              <Badge className="bg-indigo-600">Arrival Pending</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Physical Key Tag #</Label>
                <Input
                  placeholder="e.g. KEY-104"
                  value={checkInForm.keyTagNumber}
                  onChange={(e) => setCheckInForm({ ...checkInForm, keyTagNumber: e.target.value })}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Initial Sub-Meter kWh</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={checkInForm.initialMeterReading}
                  onChange={(e) => setCheckInForm({ ...checkInForm, initialMeterReading: e.target.value })}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="id-check"
                  checked={checkInForm.idVerified}
                  onCheckedChange={(c) => setCheckInForm({ ...checkInForm, idVerified: !!c })}
                />
                <label htmlFor="id-check" className="text-xs font-medium leading-none cursor-pointer">
                  Physical Government ID Proof Verified (Aadhaar / Passport)
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="kit-check"
                  checked={checkInForm.welcomeKitHandedOver}
                  onCheckedChange={(c) => setCheckInForm({ ...checkInForm, welcomeKitHandedOver: !!c })}
                />
                <label htmlFor="kit-check" className="text-xs font-medium leading-none cursor-pointer">
                  Welcome Kit & Room Key Handed Over
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCheckInModalOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => completeCheckInMutation.mutate({
                id: selectedCheckIn?.id,
                payload: {
                  ...checkInForm,
                  tenantName: selectedCheckIn?.tenantName,
                  roomNumber: selectedCheckIn?.roomNumber,
                  bedNumber: selectedCheckIn?.bedNumber,
                },
              })}
              disabled={completeCheckInMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-500"
            >
              {completeCheckInMutation.isPending ? 'Activating...' : 'Complete Check-In & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 8. DYNAMIC GUEST WI-FI QR MODAL */}
      <Dialog open={wifiModalOpen} onOpenChange={setWifiModalOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Wifi className="h-5 w-5 text-cyan-600" />
              Guest High-Speed Wi-Fi
            </DialogTitle>
            <DialogDescription>
              {currentProperty?.name ? `${currentProperty.name} Wireless Network` : 'Scan QR code to auto-connect'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center justify-center space-y-3">
            <div className="p-3 bg-white border-2 border-dashed border-cyan-400 rounded-2xl shadow-inner flex items-center justify-center">
              <img
                src={wifiQrUrl}
                alt="Guest Wi-Fi Connect QR Code"
                className="h-44 w-44 rounded-lg"
              />
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border text-xs w-full text-left space-y-1">
              <p><span className="text-slate-500">SSID:</span> <span className="font-bold text-slate-900">{activeWifiSsid}</span></p>
              <p><span className="text-slate-500">Password:</span> <span className="font-mono font-bold text-cyan-700">{activeWifiPassword}</span></p>
              <p><span className="text-slate-500">Property:</span> <span className="font-medium text-slate-700">{currentProperty?.name || 'StayEaze Campus'}</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-cyan-600 hover:bg-cyan-500" onClick={() => setWifiModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. DYNAMIC EMERGENCY SOS DIRECTORY MODAL */}
      <Dialog open={emergencyModalOpen} onOpenChange={setEmergencyModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
              Front Desk Emergency Quick-Dial
            </DialogTitle>
            <DialogDescription>
              {currentProperty?.name ? `${currentProperty.name} Direct Emergency Contacts` : 'Immediate contact directory for urgent building incidents'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-rose-900">Branch Property Manager (On-Call)</p>
                <p className="text-rose-700 font-mono">{currentProperty?.phone || '+91 98451 12234'}</p>
              </div>
              <a href={`tel:${currentProperty?.phone || '+919845112234'}`}>
                <Button size="sm" variant="destructive" className="h-8 gap-1">
                  <Phone className="h-3.5 w-3.5" /> Call Now
                </Button>
              </a>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Nearest Partner Hospital & Ambulance</p>
                <p className="text-slate-600 font-mono">{currentProperty?.emergencyHospitalPhone || '108'}</p>
              </div>
              <a href={`tel:${currentProperty?.emergencyHospitalPhone || '108'}`}>
                <Button size="sm" variant="outline" className="h-8 border-rose-200 text-rose-700 gap-1">
                  <Phone className="h-3.5 w-3.5" /> Call
                </Button>
              </a>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Local Police Station Control</p>
                <p className="text-slate-600 font-mono">{currentProperty?.emergencyPolicePhone || '112'}</p>
              </div>
              <a href={`tel:${currentProperty?.emergencyPolicePhone || '112'}`}>
                <Button size="sm" variant="outline" className="h-8 gap-1">
                  <Phone className="h-3.5 w-3.5" /> Call
                </Button>
              </a>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">24/7 Electrician & Generator Tech</p>
                <p className="text-slate-600 font-mono">{currentProperty?.emergencyElectricianPhone || '+91 98450 99881'}</p>
              </div>
              <a href={`tel:${currentProperty?.emergencyElectricianPhone || '+919845099881'}`}>
                <Button size="sm" variant="outline" className="h-8 gap-1">
                  <Phone className="h-3.5 w-3.5" /> Call
                </Button>
              </a>
            </div>
            <div className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Emergency Plumber & Water Pump Tech</p>
                <p className="text-slate-600 font-mono">{currentProperty?.emergencyPlumberPhone || '+91 98450 99882'}</p>
              </div>
              <a href={`tel:${currentProperty?.emergencyPlumberPhone || '+919845099882'}`}>
                <Button size="sm" variant="outline" className="h-8 gap-1">
                  <Phone className="h-3.5 w-3.5" /> Call
                </Button>
              </a>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setEmergencyModalOpen(false)}>
              Close Directory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
