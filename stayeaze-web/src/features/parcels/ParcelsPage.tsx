import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Package, Plus, CheckCircle2, Clock, Truck, Search, 
  Send, User, Home, ArrowUpRight, ShieldCheck, Check, 
  RotateCcw, Sparkles, MessageSquare, AlertCircle, Phone,
  Flame, KeyRound, PenLine, Users, Share2, HelpCircle,
  Copy, ExternalLink, Calendar, MapPin, Snowflake
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { formatDate } from '@/lib/format';
import { openWhatsApp } from '@/lib/whatsapp';

export interface ParcelRecord {
  id: string;
  tenant?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    roomNumber?: string;
    bedNumber?: string;
    phone?: string;
    email?: string;
  };
  tenantId?: string;
  courierCompany: string;
  trackingNumber?: string;
  parcelType?: string;
  lockerLocation?: string;
  pickupOtp?: string;
  qrCodeToken?: string;
  status: string;
  handoverMethod?: string;
  handedOverBy?: string;
  recipientSignature?: string;
  delegateName?: string;
  delegatePhone?: string;
  photoUrl?: string;
  notes?: string;
  reminderCount?: number;
  lastRemindedAt?: string;
  receivedDate: string;
  handedOverDate?: string;
  ageInHours?: number;
  isOverdue?: boolean;
  isPerishable?: boolean;
}

const COURIER_PRESETS = [
  'Amazon', 'Flipkart', 'Blue Dart', 'Delhivery', 
  'DTDC', 'Swiggy Instamart', 'Blinkit', 'Zomato', 
  'Zepto', 'India Post', 'FedEx', 'DHL', 'Other'
];

const PARCEL_TYPES = [
  { id: 'BOX', label: 'Standard Box', icon: Package, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'ENVELOPE', label: 'Document / Envelope', icon: PenLine, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'PERISHABLE_FOOD', label: 'Food / Perishable', icon: Snowflake, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'FRAGILE', label: 'Fragile Item', icon: AlertCircle, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'MEDICINE', label: 'Medicines', icon: ShieldCheck, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'ELECTRONICS', label: 'Electronics', icon: Sparkles, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
];

const SHELF_PRESETS = [
  'Reception Shelf A1', 'Reception Shelf A2', 'Reception Shelf A3',
  'Reception Shelf B1', 'Reception Shelf B2', 'Reception Shelf B3',
  'Cold Storage / Fridge', 'Security Locker #1', 'Security Locker #2',
  'Front Counter Desk'
];

export default function ParcelsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PERISHABLE' | 'COLLECTED'>('ALL');
  
  // Intake Modal
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [tenantSearchQuery, setTenantSearchQuery] = useState('');
  const [form, setForm] = useState({
    tenantId: '',
    courierCompany: 'Amazon',
    trackingNumber: '',
    parcelType: 'BOX',
    lockerLocation: 'Reception Shelf A1',
    notes: '',
  });

  // Handover Modal
  const [handoverTarget, setHandoverTarget] = useState<ParcelRecord | null>(null);
  const [handoverTab, setHandoverTab] = useState<'otp' | 'delegate' | 'direct' | 'signature'>('otp');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [delegateName, setDelegateName] = useState('');
  const [delegatePhone, setDelegatePhone] = useState('');

  // Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Focus first OTP box when Handover Modal opens
  useEffect(() => {
    if (handoverTarget && handoverTab === 'otp') {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    }
  }, [handoverTarget, handoverTab]);

  const handleOtpDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const updated = [...otpDigits];
      updated[index] = '';
      setOtpDigits(updated);
      return;
    }

    const digit = cleaned.slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    // Auto-advance to next box
    if (index < 3 && digit) {
      otpInputsRef.current[index + 1]?.focus();
    }

    // Auto-verify if all 4 digits entered
    const fullCode = updated.join('');
    if (fullCode.length === 4 && handoverTarget) {
      verifyOtpMutation.mutate({ id: handoverTarget.id, otp: fullCode });
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const updated = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      updated[i] = pasted[i];
    }
    setOtpDigits(updated);
    if (pasted.length === 4 && handoverTarget) {
      verifyOtpMutation.mutate({ id: handoverTarget.id, otp: pasted });
    } else {
      const nextIdx = Math.min(pasted.length, 3);
      otpInputsRef.current[nextIdx]?.focus();
    }
  };

  // Fetch all parcels
  const { data: parcelsData, isLoading } = useQuery<ParcelRecord[]>({
    queryKey: ['parcels'],
    queryFn: () => api.get('/parcels').then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : Array.isArray(d?.data) ? d.data : [];
    }),
    refetchInterval: 15000,
  });

  // Fetch minimal tenants list for recipient selection
  const { data: tenantsData } = useQuery<any[]>({
    queryKey: ['tenants-minimal'],
    queryFn: () => api.get('/tenants/minimal').then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : Array.isArray(d?.content) ? d.content : Array.isArray(d?.data) ? d.data : [];
    }),
    staleTime: 5 * 60 * 1000,
  });

  const parcelsList: ParcelRecord[] = Array.isArray(parcelsData) ? parcelsData : [];
  const tenantsList: any[] = Array.isArray(tenantsData) ? tenantsData : [];

  // Canvas Drawing helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  // Mutations
  const receiveMutation = useMutation({
    mutationFn: (payload: any) => api.post('/parcels', payload),
    onSuccess: (res: any) => {
      const created = res.data;
      toast.success(
        `📦 Logged ${created?.courierCompany} delivery for ${created?.tenant?.name || 'Resident'}! Pickup OTP: ${created?.pickupOtp}`
      );
      qc.invalidateQueries({ queryKey: ['parcels'] });
      setIntakeOpen(false);
      setForm({
        tenantId: '',
        courierCompany: 'Amazon',
        trackingNumber: '',
        parcelType: 'BOX',
        lockerLocation: 'Reception Shelf A1',
        notes: '',
      });
      setTenantSearchQuery('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to log incoming parcel.');
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) => 
      api.put(`/parcels/${id}/verify-otp`, { otp }),
    onSuccess: (res: any) => {
      const updated = res.data;
      toast.success('✅ Pickup OTP Verified! Parcel marked as Collected.');
      qc.setQueryData(['parcels'], (old: ParcelRecord[] = []) =>
        old.map((p) => (p.id === updated?.id ? { ...p, ...updated, status: 'COLLECTED' } : p))
      );
      qc.invalidateQueries({ queryKey: ['parcels'] });
      setHandoverTarget(null);
      setOtpDigits(['', '', '', '']);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Invalid Pickup OTP PIN.');
    },
  });

  const fullHandoverMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => 
      api.put(`/parcels/${id}/handover`, body),
    onSuccess: (res: any) => {
      const updated = res.data;
      toast.success('✅ Parcel handover completed and logged.');
      qc.setQueryData(['parcels'], (old: ParcelRecord[] = []) =>
        old.map((p) => (p.id === updated?.id ? { ...p, ...updated, status: 'COLLECTED' } : p))
      );
      qc.invalidateQueries({ queryKey: ['parcels'] });
      setHandoverTarget(null);
      clearCanvas();
      setDelegateName('');
      setDelegatePhone('');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to record handover.');
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: (id: string) => api.post(`/parcels/${id}/send-reminder`),
    onSuccess: (res: any) => {
      toast.success(res?.data?.message || 'WhatsApp alert dispatched to resident.');
      qc.invalidateQueries({ queryKey: ['parcels'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to send reminder.');
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => api.put(`/parcels/${id}/status`, { status: 'RECEIVED' }),
    onSuccess: (res: any) => {
      const updated = res.data;
      toast.success('📦 Parcel set to Ready for Pickup! Handover button is now active.');
      qc.setQueryData(['parcels'], (old: ParcelRecord[] = []) =>
        old.map((p) => (p.id === updated?.id ? { ...p, ...updated, status: 'RECEIVED' } : p))
      );
      qc.invalidateQueries({ queryKey: ['parcels'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update parcel status.');
    },
  });

  // Calculate Metrics
  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    let todayCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;
    let perishableCount = 0;
    let collectedCount = 0;

    parcelsList.forEach((p) => {
      if (p.receivedDate && new Date(p.receivedDate).toDateString() === today) {
        todayCount++;
      }
      const s = (p.status || '').toUpperCase();
      const isCollected = s === 'COLLECTED' || s === 'HANDED_OVER';
      const isPending = !isCollected;

      if (isCollected) {
        collectedCount++;
      } else if (isPending) {
        pendingCount++;
        const isOverdue = Boolean(p.isOverdue || (p.ageInHours !== undefined && p.ageInHours >= 48));
        const isPerish = Boolean(p.isPerishable || p.parcelType === 'PERISHABLE_FOOD');
        if (isOverdue) overdueCount++;
        if (isPerish) perishableCount++;
      }
    });

    return { todayCount, pendingCount, overdueCount, perishableCount, collectedCount };
  }, [parcelsList]);

  // Filtered List
  const filteredParcels = useMemo(() => {
    return parcelsList.filter((p) => {
      const s = (p.status || '').toUpperCase();
      const isCollected = s === 'COLLECTED' || s === 'HANDED_OVER';
      const isPending = !isCollected;
      const isOverdue = isPending && Boolean(p.isOverdue || (p.ageInHours !== undefined && p.ageInHours >= 48));
      const isPerish = isPending && Boolean(p.isPerishable || p.parcelType === 'PERISHABLE_FOOD');

      // Status Filter
      if (statusFilter === 'PENDING' && !isPending) return false;
      if (statusFilter === 'COLLECTED' && !isCollected) return false;
      if (statusFilter === 'OVERDUE' && !isOverdue) return false;
      if (statusFilter === 'PERISHABLE' && !isPerish) return false;

      // Text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const tenantName = (p.tenant?.name || `${p.tenant?.firstName || ''} ${p.tenant?.lastName || ''}`).toLowerCase();
        const courier = (p.courierCompany || '').toLowerCase();
        const tracking = (p.trackingNumber || '').toLowerCase();
        const room = (p.tenant?.roomNumber || '').toLowerCase();
        const locker = (p.lockerLocation || '').toLowerCase();
        const otp = (p.pickupOtp || '').toLowerCase();
        return tenantName.includes(q) || courier.includes(q) || tracking.includes(q) || room.includes(q) || locker.includes(q) || otp.includes(q);
      }
      return true;
    });
  }, [parcelsList, statusFilter, search]);

  // Filtered tenants for search dropdown
  const filteredTenants = useMemo(() => {
    if (!tenantSearchQuery.trim()) return tenantsList.slice(0, 8);
    const q = tenantSearchQuery.toLowerCase();
    return tenantsList.filter((t) => {
      const name = (t.name || `${t.firstName || ''} ${t.lastName || ''}`).toLowerCase();
      const room = (t.roomNumber || '').toLowerCase();
      const bed = (t.bedNumber || '').toLowerCase();
      const phone = (t.phone || t.mobile || '').toLowerCase();
      return name.includes(q) || room.includes(q) || bed.includes(q) || phone.includes(q);
    }).slice(0, 10);
  }, [tenantsList, tenantSearchQuery]);

  const selectedTenant = useMemo(() => {
    return tenantsList.find((t) => t.id === form.tenantId);
  }, [tenantsList, form.tenantId]);

  const handleHandoverSubmit = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!handoverTarget) return;

    if (handoverTab === 'otp') {
      const code = otpDigits.join('').trim();
      if (code.length < 4) {
        toast.error('Please enter all 4 digits of the Pickup OTP.');
        return;
      }
      verifyOtpMutation.mutate({ id: handoverTarget.id, otp: code });
    } else if (handoverTab === 'signature') {
      const canvas = canvasRef.current;
      const sigData = canvas && hasDrawn ? canvas.toDataURL('image/png') : 'VERIFIED_SIGNATURE_PAD';
      fullHandoverMutation.mutate({
        id: handoverTarget.id,
        body: {
          handoverMethod: 'SIGNATURE',
          signature: sigData,
        },
      });
    } else if (handoverTab === 'delegate') {
      if (!delegateName.trim()) {
        toast.error('Please enter the roommate / friend collector name.');
        return;
      }
      const code = otpDigits.join('').trim();
      fullHandoverMutation.mutate({
        id: handoverTarget.id,
        body: {
          handoverMethod: 'DELEGATE',
          delegateName: delegateName.trim(),
          delegatePhone: delegatePhone.trim(),
          signature: code ? `OTP_VERIFIED_${code}` : `COLLECTED_BY_DELEGATE_${delegateName.trim().toUpperCase()}`,
        },
      });
    } else if (handoverTab === 'direct') {
      fullHandoverMutation.mutate({
        id: handoverTarget.id,
        body: {
          handoverMethod: 'STAFF_DIRECT',
          signature: 'STAFF_VERIFIED_IN_PERSON',
        },
      });
    }
  };

  const openHandoverForParcel = (parcel: ParcelRecord) => {
    setHandoverTarget(parcel);
    setOtpDigits(['', '', '', '']);
    setHandoverTab('otp');
    setDelegateName(parcel.delegateName || '');
    setDelegatePhone(parcel.delegatePhone || '');
  };

  const fillResidentOtp = () => {
    if (!handoverTarget?.pickupOtp) return;
    const digits = handoverTarget.pickupOtp.split('').slice(0, 4);
    while (digits.length < 4) digits.push('0');
    setOtpDigits(digits);
    if (digits.length === 4) {
      verifyOtpMutation.mutate({ id: handoverTarget.id, otp: digits.join('') });
    }
  };

  const handleDirectWhatsApp = (parcel: ParcelRecord) => {
    const phone = parcel.tenant?.phone;
    if (!phone) {
      toast.error('No phone number attached to resident profile.');
      return;
    }
    const tenantName = parcel.tenant?.name || parcel.tenant?.firstName || 'Resident';
    const msg = `Hello ${tenantName}, your ${parcel.courierCompany} package has arrived at reception.\n\n📍 Shelf: ${parcel.lockerLocation || 'Front Desk'}\n🔑 Pickup OTP: *${parcel.pickupOtp}*\n\nPlease collect it from the desk at your convenience.`;
    openWhatsApp(phone, msg);
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Parcel & Delivery Desk"
        description="Log incoming courier deliveries, verify resident pickup via OTP / signature, and manage uncollected packages."
        icon={Package}
        actions={
          <Button 
            onClick={() => setIntakeOpen(true)} 
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md text-white font-medium"
          >
            <Plus className="h-4 w-4" /> Log Incoming Parcel
          </Button>
        }
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Intake"
          value={metrics.todayCount}
          icon={Package}
          hint="Packages received today"
          accent="primary"
        />
        <StatCard
          label="Pending at Desk"
          value={metrics.pendingCount}
          icon={Clock}
          hint="Awaiting resident pickup"
          accent="warning"
        />
        <StatCard
          label="Overdue (> 48h)"
          value={metrics.overdueCount}
          icon={Flame}
          hint="Uncollected past 48 hours"
          accent="destructive"
        />
        <StatCard
          label="Perishable / Food"
          value={metrics.perishableCount}
          icon={Snowflake}
          hint="Needs urgent collection"
          accent="info"
        />
      </div>

      {/* Control Bar: Filters & Search */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={statusFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('ALL')}
              className="text-xs font-semibold"
            >
              All Packages ({parcelsList.length})
            </Button>
            <Button
              variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('PENDING')}
              className="text-xs font-semibold gap-1.5"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Pending Pickup ({metrics.pendingCount})
            </Button>
            <Button
              variant={statusFilter === 'OVERDUE' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('OVERDUE')}
              className="text-xs font-semibold gap-1"
            >
              <Flame className="h-3.5 w-3.5" />
              Overdue ({metrics.overdueCount})
            </Button>
            <Button
              variant={statusFilter === 'PERISHABLE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('PERISHABLE')}
              className={`text-xs font-semibold gap-1 ${statusFilter === 'PERISHABLE' ? 'bg-amber-600 hover:bg-amber-700' : 'text-amber-700 border-amber-200'}`}
            >
              <Snowflake className="h-3.5 w-3.5" />
              Perishable ({metrics.perishableCount})
            </Button>
            <Button
              variant={statusFilter === 'COLLECTED' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('COLLECTED')}
              className="text-xs font-semibold"
            >
              Handed Over ({metrics.collectedCount})
            </Button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resident, room, courier, OTP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Parcels Table */}
      <Card className="border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="font-semibold">Resident & Room</TableHead>
                <TableHead className="font-semibold">Courier & Category</TableHead>
                <TableHead className="font-semibold">Locker / Shelf</TableHead>
                <TableHead className="font-semibold">Pickup Code</TableHead>
                <TableHead className="font-semibold">Arrived & Age</TableHead>
                <TableHead className="font-semibold">Status & Handover</TableHead>
                <TableHead className="text-right font-semibold">Desk Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                      <span>Loading delivery desk registry...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredParcels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="h-10 w-10 text-slate-300" />
                      <span className="font-medium text-slate-700">No packages found matching criteria</span>
                      <p className="text-xs text-slate-400">Click 'Log Incoming Parcel' to register a new delivery.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredParcels.map((parcel) => {
                  const s = (parcel.status || '').toUpperCase();
                  const isCollected = s === 'COLLECTED' || s === 'HANDED_OVER';
                  const isPending = !isCollected;
                  const tenantName = parcel.tenant?.name || `${parcel.tenant?.firstName || ''} ${parcel.tenant?.lastName || ''}`.trim() || 'Resident';
                  const typeObj = PARCEL_TYPES.find((t) => t.id === parcel.parcelType) || PARCEL_TYPES[0];

                  return (
                    <TableRow key={parcel.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Resident Info */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0">
                            {tenantName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              {tenantName}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span className="inline-flex items-center font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                Room {parcel.tenant?.roomNumber || 'N/A'}-{parcel.tenant?.bedNumber || ''}
                              </span>
                              {parcel.tenant?.phone && (
                                <span>• {parcel.tenant.phone}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Courier & Category */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-blue-600" />
                            {parcel.courierCompany}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${typeObj.color}`}>
                              <typeObj.icon className="h-3 w-3" />
                              {typeObj.label}
                            </span>
                            {parcel.trackingNumber && (
                              <span className="text-[11px] font-mono text-slate-500">
                                #{parcel.trackingNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Shelf Location */}
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                          <MapPin className="h-3 w-3 text-indigo-600" />
                          {parcel.lockerLocation || 'Front Desk'}
                        </div>
                      </TableCell>

                      {/* Pickup Code */}
                      <TableCell>
                        {isPending ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md shadow-xs">
                              <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                              {parcel.pickupOtp || '4892'}
                            </div>
                            {parcel.delegateName && (
                              <div className="text-[10px] text-purple-700 font-medium flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                Proxy: {parcel.delegateName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">
                            {parcel.pickupOtp ? `OTP: ${parcel.pickupOtp}` : 'Completed'}
                          </span>
                        )}
                      </TableCell>

                      {/* Arrived Date & Age */}
                      <TableCell>
                        <div className="text-xs text-slate-800 font-medium">
                          {formatDate(parcel.receivedDate)}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {parcel.ageInHours !== undefined && (
                            <span className={parcel.isOverdue ? 'text-rose-600 font-bold' : ''}>
                              {parcel.ageInHours < 1 ? 'Just now' : `${parcel.ageInHours}h ago`}
                            </span>
                          )}
                          {parcel.isOverdue && isPending && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                              OVERDUE
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {isPending ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-semibold text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ready for Pickup
                          </Badge>
                        ) : (
                          <div className="space-y-0.5">
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-semibold text-xs">
                              <CheckCircle2 className="h-3 w-3 text-blue-600" />
                              Collected
                            </Badge>
                            {parcel.handedOverBy && (
                              <div className="text-[10px] text-muted-foreground">
                                By {parcel.handedOverBy} ({parcel.handoverMethod || 'Desk'})
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => openHandoverForParcel(parcel)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-medium gap-1 shadow-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Handover
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDirectWhatsApp(parcel)}
                                title="Send WhatsApp alert with OTP"
                                className="h-8 w-8 p-0 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => sendReminderMutation.mutate(parcel.id)}
                                title="Send In-App Reminder"
                                disabled={sendReminderMutation.isPending}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center justify-end gap-2 pr-1">
                              <span className="text-xs text-muted-foreground italic">
                                {parcel.handedOverDate ? formatDate(parcel.handedOverDate) : 'Handed over'}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  reopenMutation.mutate(parcel.id);
                                }}
                                disabled={reopenMutation.isPending}
                                title="Reopen parcel as Pending Pickup to test OTP Handover"
                                className="h-7 text-[11px] font-medium text-blue-600 border-blue-200 hover:bg-blue-50 gap-1 px-2 cursor-pointer"
                              >
                                <RotateCcw className={`h-3 w-3 ${reopenMutation.isPending ? 'animate-spin' : ''}`} />
                                Re-test Handover
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* 1. INTAKE PARCEL MODAL */}
      <Dialog open={intakeOpen} onOpenChange={setIntakeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-blue-600" />
              Log Incoming Courier / Parcel
            </DialogTitle>
            <DialogDescription>
              Record the package arrival, assign a locker shelf, and automatically send an instant WhatsApp & OTP pickup code to the resident.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Resident Select */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">1. Select Resident / Room <span className="text-rose-500">*</span></Label>
              <div className="space-y-2">
                <Input
                  placeholder="Filter by resident name, room number (e.g. 101), or phone..."
                  value={tenantSearchQuery}
                  onChange={(e) => setTenantSearchQuery(e.target.value)}
                  className="text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border rounded-md bg-slate-50/50">
                  {filteredTenants.length === 0 ? (
                    <div className="col-span-2 text-center py-4 text-xs text-muted-foreground">
                      No matching residents found.
                    </div>
                  ) : (
                    filteredTenants.map((t) => {
                      const isSelected = form.tenantId === t.id;
                      const name = t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Resident';
                      return (
                        <div
                          key={t.id}
                          onClick={() => setForm((prev) => ({ ...prev, tenantId: t.id }))}
                          className={`p-2 rounded border cursor-pointer text-xs transition-all flex items-center justify-between ${
                            isSelected 
                              ? 'bg-blue-50 border-blue-500 text-blue-900 font-semibold ring-1 ring-blue-500' 
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-medium text-slate-900">{name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              Room {t.roomNumber || 'N/A'}-{t.bedNumber || ''} • {t.phone || t.mobile || 'No phone'}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Courier & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">2. Courier Partner <span className="text-rose-500">*</span></Label>
                <Select
                  value={form.courierCompany}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, courierCompany: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select courier" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURIER_PRESETS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">3. Package Type</Label>
                <Select
                  value={form.parcelType}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, parcelType: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PARCEL_TYPES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Shelf Location & Tracking Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">4. Storage / Shelf Location <span className="text-rose-500">*</span></Label>
                <Select
                  value={form.lockerLocation}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, lockerLocation: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shelf location" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHELF_PRESETS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">5. Tracking / AWB # (Optional)</Label>
                <Input
                  placeholder="e.g. BD102938475IN"
                  value={form.trackingNumber}
                  onChange={(e) => setForm((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">6. Desk Notes / Handling Instructions (Optional)</Label>
              <Input
                placeholder="e.g. Keep chilled in fridge, fragile glass inside..."
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIntakeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!form.tenantId) {
                  toast.error('Please select a resident from the list.');
                  return;
                }
                receiveMutation.mutate(form);
              }}
              disabled={receiveMutation.isPending || !form.tenantId}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2"
            >
              {receiveMutation.isPending ? 'Logging Delivery...' : 'Log & Send Resident OTP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. HANDOVER VERIFICATION MODAL */}
      <Dialog open={Boolean(handoverTarget)} onOpenChange={(o) => !o && setHandoverTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Verify & Handover Parcel
            </DialogTitle>
            <DialogDescription>
              Handing over <strong>{handoverTarget?.courierCompany}</strong> delivery to{' '}
              <strong>
                {handoverTarget?.tenant?.name || handoverTarget?.tenant?.firstName || 'Resident'}
              </strong>{' '}
              (Room {handoverTarget?.tenant?.roomNumber || 'N/A'}).
            </DialogDescription>
          </DialogHeader>

          <Tabs value={handoverTab} onValueChange={(v: any) => setHandoverTab(v)} className="w-full mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="otp" className="gap-1.5 text-xs font-semibold">
                <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                1. Resident OTP
              </TabsTrigger>
              <TabsTrigger value="delegate" className="gap-1.5 text-xs font-semibold">
                <Users className="h-3.5 w-3.5 text-purple-600" />
                2. Roommate
              </TabsTrigger>
              <TabsTrigger value="direct" className="gap-1.5 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                3. Staff Direct
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: RESIDENT OTP VERIFICATION */}
            <TabsContent value="otp" className="space-y-4 pt-4">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200 rounded-xl p-5 text-center space-y-3 shadow-xs">
                <div className="flex items-center justify-center gap-1.5 text-xs text-amber-900 font-semibold">
                  <KeyRound className="h-4 w-4 text-amber-600" />
                  <span>Enter 4-Digit Pickup PIN provided by Resident</span>
                </div>
                
                {/* 4 Separate Digit Input Boxes */}
                <div className="flex justify-center gap-3 py-1">
                  {[0, 1, 2, 3].map((idx) => (
                    <Input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={otpDigits[idx]}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="w-14 h-16 text-center text-3xl font-black font-mono rounded-xl border-2 border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 bg-white shadow-sm transition-all"
                    />
                  ))}
                </div>

                <div className="flex flex-col items-center gap-1.5 pt-1">
                  {handoverTarget?.pickupOtp && (
                    <button
                      type="button"
                      onClick={fillResidentOtp}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 border border-amber-400/60 px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-700" />
                      Auto-Fill Resident PIN: <span className="underline">{handoverTarget.pickupOtp}</span>
                    </button>
                  )}
                  <p className="text-[11px] text-amber-700/80">
                    💡 Resident sees this PIN in their <strong>StayEaze Resident Portal</strong> &amp; <strong>WhatsApp notification</strong>.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: ROOMMATE / PROXY DELEGATE + OTP */}
            <TabsContent value="delegate" className="space-y-3 pt-4">
              <div className="bg-purple-50/60 border border-purple-200 rounded-lg p-3 text-xs text-purple-900">
                Record roommate details and verify the resident's 4-digit Pickup PIN:
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Collector / Roommate Full Name <span className="text-rose-500">*</span></Label>
                  <Input
                    placeholder="e.g. Rohan Sharma (Roommate)"
                    value={delegateName}
                    onChange={(e) => setDelegateName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Collector Mobile Number</Label>
                  <Input
                    placeholder="e.g. 9876543210"
                    value={delegatePhone}
                    onChange={(e) => setDelegatePhone(e.target.value)}
                  />
                </div>

                <div className="pt-2">
                  <Label className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                    Resident 4-Digit Pickup PIN (Optional if verified in person)
                  </Label>
                  <div className="flex justify-center gap-2 pt-1.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <Input
                        key={idx}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={otpDigits[idx]}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-12 h-14 text-center text-2xl font-black font-mono rounded-lg border-2 border-amber-300 focus:border-amber-500 bg-white"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: ADMIN / STAFF DIRECT OVERRIDE */}
            <TabsContent value="direct" className="space-y-3 pt-4">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
                <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Staff / Admin In-Person Handover
                </div>
                <p>
                  Use this override if the resident's phone is unavailable or if you have verified the resident's identity in person.
                </p>
                <div className="p-2.5 bg-white/80 rounded border border-blue-100 font-mono text-[11px] text-slate-700">
                  Logging Handover to: <strong>{handoverTarget?.tenant?.name || 'Resident'}</strong> (Room {handoverTarget?.tenant?.roomNumber || 'N/A'})
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setHandoverTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleHandoverSubmit(e);
              }}
              disabled={verifyOtpMutation.isPending || fullHandoverMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-2 cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              {handoverTab === 'direct' ? 'Confirm Staff Handover' : 'Verify OTP & Release Package'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
