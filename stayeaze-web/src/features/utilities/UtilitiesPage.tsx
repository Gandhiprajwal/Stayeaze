import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap, Plus, Pencil, Trash2, Wallet, TrendingUp, AlertCircle, CheckCircle2,
  RefreshCw, CreditCard, Building2, ShieldCheck, Sparkles, Check, X,
  Share2, Save, FileCheck, Search, HelpCircle, Layers, ArrowRight, Eye,
  Camera, Receipt, Upload, Image, Gift, RotateCcw, Building, UserX,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';
import { useDebounce } from '@/lib/hooks/use-debounce';
import api from '@/lib/api';
import type { Building as BuildingType } from '@/lib/types';

interface Occupant {
  id: string;
  name: string;
  checkInDate: string;
  mobile: string;
}

interface RoomSheetItem {
  roomId: string;
  roomNumber: string;
  buildingId?: string;
  buildingName?: string;
  floorId?: string;
  floorNumber?: number;
  floorName: string;
  capacity: number;
  occupiedCount: number;
  lastReadingValue: number;
  lastReadingDate: string;
  defaultUnitRate: number;
  defaultSplitMode: string;
  occupants: Occupant[];
  // Editable form state
  currentReading?: number;
  unitRate?: number;
  freeAllowanceUnits?: number;
  splitMode?: string;
  isRollover?: boolean;
  photoUrl?: string;
  calculatedUnits?: number;
  calculatedAmount?: number;
  tenantSplits?: any[];
}

export default function UtilitiesPage() {
  const queryClient = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('ALL');
  const [billingMonth, setBillingMonth] = useState<number>(new Date().getMonth() + 1);
  const [billingYear, setBillingYear] = useState<number>(new Date().getFullYear());
  const [defaultRate, setDefaultRate] = useState<number>(10.0);
  const [defaultFreeAllowance, setDefaultFreeAllowance] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Pagination state
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(20);

  const [sheetItems, setSheetItems] = useState<RoomSheetItem[]>([]);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [activePreviewRoom, setActivePreviewRoom] = useState<RoomSheetItem | null>(null);
  const [activePhotoUploadIndex, setActivePhotoUploadIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset page to 0 on filter changes
  useEffect(() => {
    setPage(0);
  }, [selectedPropertyId, selectedBuildingId, billingMonth, billingYear, debouncedSearch]);

  // Fetch properties
  const { data: properties } = useQuery({
    queryKey: ['utilities-properties-minimal'],
    queryFn: () => api.get<any[]>('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
  });

  // Fetch buildings for the property
  const { data: buildings } = useQuery({
    queryKey: ['utilities-buildings', selectedPropertyId],
    queryFn: () => api.get<BuildingType[]>('/buildings', { params: { propertyId: selectedPropertyId, pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as BuildingType[];
      return (payload as { data: BuildingType[] }).data ?? [];
    }),
    enabled: !!selectedPropertyId,
  });

  // Set default selected property once properties load
  useEffect(() => {
    if (properties && properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  // Dedicated Server-Side Utility Statistics Query
  const { data: serverStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['property-utility-stats', selectedPropertyId, selectedBuildingId, billingMonth, billingYear],
    queryFn: async () => {
      if (!selectedPropertyId) return null;
      const res = await api.get(`/utilities/properties/${selectedPropertyId}/stats`, {
        params: {
          buildingId: selectedBuildingId !== 'ALL' ? selectedBuildingId : undefined,
          month: billingMonth,
          year: billingYear
        }
      });
      return res.data;
    },
    enabled: !!selectedPropertyId,
  });

  // Server-Side Paginated Meter Sheet Query
  const { data: paginatedMeterSheet, isLoading: sheetLoading, refetch: refetchSheet } = useQuery({
    queryKey: ['property-meter-sheet', selectedPropertyId, selectedBuildingId, billingMonth, billingYear, page, pageSize, debouncedSearch],
    queryFn: async () => {
      if (!selectedPropertyId) return { content: [], totalElements: 0, totalPages: 0, page: 0, size: pageSize };
      const res = await api.get(`/utilities/properties/${selectedPropertyId}/meter-sheet`, {
        params: {
          buildingId: selectedBuildingId !== 'ALL' ? selectedBuildingId : undefined,
          search: debouncedSearch || undefined,
          month: billingMonth,
          year: billingYear,
          page,
          size: pageSize
        }
      });
      return res.data;
    },
    enabled: !!selectedPropertyId,
  });

  // Hydrate local table state on server response
  useEffect(() => {
    const rawList = Array.isArray(paginatedMeterSheet?.content)
      ? paginatedMeterSheet.content
      : Array.isArray(paginatedMeterSheet)
      ? paginatedMeterSheet
      : [];

    const items: RoomSheetItem[] = rawList.map((item: any) => {
      const hasSavedReading = item.currentReadingValue !== undefined && item.currentReadingValue !== null;
      const currentVal = hasSavedReading ? item.currentReadingValue : item.lastReadingValue;
      const allowanceVal = item.freeAllowanceUnits !== undefined && item.freeAllowanceUnits !== null ? item.freeAllowanceUnits : defaultFreeAllowance;
      const unitsVal = item.unitsConsumed !== undefined && item.unitsConsumed !== null ? item.unitsConsumed : 0;
      const amountVal = item.totalAmount !== undefined && item.totalAmount !== null ? item.totalAmount : 0;

      return {
        ...item,
        occupants: Array.isArray(item.occupants) ? item.occupants : [],
        currentReading: currentVal,
        unitRate: item.defaultUnitRate || defaultRate,
        freeAllowanceUnits: allowanceVal,
        splitMode: item.defaultSplitMode || 'FAIR_PROPORTIONAL',
        isRollover: false,
        photoUrl: item.photoUrl || '',
        calculatedUnits: unitsVal,
        calculatedAmount: amountVal,
        tenantSplits: Array.isArray(item.tenantSplits) ? item.tenantSplits : []
      };
    });

    setSheetItems(items);
  }, [paginatedMeterSheet, defaultRate, defaultFreeAllowance]);

  const handleReadingChange = (index: number, currVal: number) => {
    const updated = [...sheetItems];
    const item = updated[index];
    item.currentReading = currVal;
    
    let gross = 0;
    const prev = item.lastReadingValue || 0;
    if (item.isRollover && currVal < prev) {
      gross = (10000 - prev) + currVal;
    } else {
      gross = Math.max(0, currVal - prev);
    }
    const netUnits = Math.max(0, gross - (item.freeAllowanceUnits || 0));
    const rate = item.unitRate || defaultRate;
    item.calculatedUnits = netUnits;
    item.calculatedAmount = Math.round(netUnits * rate * 100) / 100;

    triggerRoomPreview(index, item);
    setSheetItems(updated);
  };

  const handleAllowanceChange = (index: number, allowance: number) => {
    const updated = [...sheetItems];
    const item = updated[index];
    item.freeAllowanceUnits = allowance;
    
    let gross = 0;
    const prev = item.lastReadingValue || 0;
    const curr = item.currentReading || prev;
    if (item.isRollover && curr < prev) {
      gross = (10000 - prev) + curr;
    } else {
      gross = Math.max(0, curr - prev);
    }
    const netUnits = Math.max(0, gross - allowance);
    const rate = item.unitRate || defaultRate;
    item.calculatedUnits = netUnits;
    item.calculatedAmount = Math.round(netUnits * rate * 100) / 100;

    triggerRoomPreview(index, item);
    setSheetItems(updated);
  };

  const triggerRoomPreview = async (index: number, item: RoomSheetItem) => {
    try {
      const res = await api.post('/utilities/calculate-preview', {
        roomId: item.roomId,
        previousReading: item.lastReadingValue,
        currentReading: item.currentReading,
        unitRate: item.unitRate || defaultRate,
        freeAllowanceUnits: item.freeAllowanceUnits || 0,
        billingMonth,
        billingYear,
        splitMode: item.splitMode,
        isRollover: item.isRollover
      });
      const updated = [...sheetItems];
      updated[index].tenantSplits = res.data.tenantSplits || [];
      updated[index].calculatedAmount = res.data.totalAmount;
      updated[index].calculatedUnits = res.data.unitsConsumed;
      setSheetItems(updated);
    } catch (ignored) {}
  };

  const handleSplitModeChange = (index: number, mode: string) => {
    const updated = [...sheetItems];
    updated[index].splitMode = mode;
    triggerRoomPreview(index, updated[index]);
    setSheetItems(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activePhotoUploadIndex === null) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Meter photo size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = [...sheetItems];
      updated[activePhotoUploadIndex].photoUrl = base64;
      setSheetItems(updated);
      if (activePreviewRoom && activePreviewRoom.roomId === updated[activePhotoUploadIndex].roomId) {
        setActivePreviewRoom({ ...updated[activePhotoUploadIndex] });
      }
      toast.success(`📸 Attached meter dial photo for Room ${updated[activePhotoUploadIndex].roomNumber}`);
      setActivePhotoUploadIndex(null);
    };
    reader.readAsDataURL(file);
  };

  const bulkSubmitMutation = useMutation({
    mutationFn: (appendToRentInvoices: boolean) => {
      const payloadReadings = sheetItems
        .filter(item => (item.currentReading || 0) >= (item.lastReadingValue || 0) || item.isRollover)
        .map(item => ({
          roomId: item.roomId,
          previousReading: item.lastReadingValue,
          currentReading: item.currentReading,
          unitRate: item.unitRate || defaultRate,
          freeAllowanceUnits: item.freeAllowanceUnits || 0,
          billingMonth,
          billingYear,
          splitMode: item.splitMode,
          isRollover: item.isRollover,
          photoUrl: item.photoUrl
        }));

      if (payloadReadings.length === 0) {
        throw new Error('Please enter current meter readings before saving.');
      }

      return api.post(`/utilities/properties/${selectedPropertyId}/bulk-record-readings`, {
        readings: payloadReadings,
        appendToRentInvoices
      }).then(r => r.data);
    },
    onSuccess: (data, appendToRentInvoices) => {
      if (appendToRentInvoices) {
        toast.success(`Logged ${data.recordedRooms} room meter readings and appended ₹${data.totalBilledAmount} to tenant rent invoices!`);
        queryClient.invalidateQueries({ queryKey: ['/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['billing-stats'] });
      } else {
        toast.success(`Saved draft meter readings for ${data.recordedRooms} rooms.`);
      }
      refetchSheet();
      refetchStats();
      setConfirmApplyOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Bulk recording failed');
    }
  });

  const shareViaWhatsApp = (item: RoomSheetItem) => {
    if (!item.tenantSplits || item.tenantSplits.length === 0) {
      toast.info('Please enter current meter reading first to generate split breakdown.');
      return;
    }
    const splitSummary = item.tenantSplits.map(s => `• ${s.tenantName}: ₹${s.amount} (${s.units} units)`).join('\n');
    const msg = `⚡ *StayEaze Sub-Meter Bill - ${item.buildingName ? item.buildingName + ' • ' : ''}Room ${item.roomNumber} (${item.floorName})*\n` +
      `📅 Billing Cycle: ${billingMonth}/${billingYear}\n` +
      `🔢 Meter Reading: ${item.lastReadingValue} ➔ ${item.currentReading} (${item.calculatedUnits} net units @ ₹${item.unitRate || defaultRate}/unit)` +
      `${item.freeAllowanceUnits ? `\n🎁 Free Allowance Deducted: ${item.freeAllowanceUnits} units` : ''}\n` +
      `💰 Room Total: ₹${item.calculatedAmount}\n\n` +
      `*Per Tenant Share:*\n${splitSummary}\n\n` +
      `Please clear the balance on your StayEaze portal.`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Metrics: Uses Server-Side Stats API
  const totalCalculatedUnits = serverStats?.totalUnitsConsumed ?? 0;
  const totalCalculatedAmount = serverStats?.totalUtilityCost ?? 0;
  const totalBilledToTenants = serverStats?.totalTenantRecovery ?? 0;
  const totalOwnerAbsorption = serverStats?.totalOwnerAbsorption ?? 0;
  const totalActiveOccupants = serverStats?.totalActiveResidents ?? 0;
  const totalRoomsCount = serverStats?.totalRoomsCount ?? 0;
  const recordedRoomsCount = serverStats?.recordedRoomsCount ?? 0;

  // Pagination metrics
  const totalElements = paginatedMeterSheet?.totalElements ?? sheetItems.length;
  const totalPages = paginatedMeterSheet?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Hidden file input for meter photo capture */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* StayEaze Standard PageHeader */}
      <PageHeader
        title="Utilities & Sub-Meters"
        description="Log monthly electric sub-meter readings, upload meter dial proof photos, apply free unit allowances, and merge directly into tenant invoices."
        icon={Zap}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={bulkSubmitMutation.isPending || sheetLoading}
              onClick={() => bulkSubmitMutation.mutate(false)}
            >
              <Save className="mr-1.5 h-4 w-4 text-muted-foreground" />
              Save Draft
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-sm"
              disabled={bulkSubmitMutation.isPending || sheetLoading}
              onClick={() => setConfirmApplyOpen(true)}
            >
              <FileCheck className="h-4 w-4" />
              1-Click Apply to Rent Invoices
            </Button>
          </div>
        }
      />

      {/* 4 Financial & Recovery Metric Cards (from dedicated Stats API) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Utility Cost"
          value={formatCurrency(totalCalculatedAmount)}
          icon={Zap}
          accent="primary"
          hint={`${totalCalculatedUnits.toFixed(1)} kWh total (${recordedRoomsCount}/${totalRoomsCount} rooms logged)`}
        />
        <StatCard
          label="Tenant Billable Recovery"
          value={formatCurrency(totalBilledToTenants)}
          icon={Wallet}
          accent="success"
          trend={{ value: `${totalActiveOccupants} active residents`, direction: 'up', positive: true }}
        />
        <StatCard
          label="Owner Absorption (Overhead)"
          value={formatCurrency(totalOwnerAbsorption)}
          icon={UserX}
          accent="warning"
          hint="Vacant beds & pre-checkin loss"
        />
        <StatCard
          label="Current Tariff Rate"
          value={`₹${defaultRate}/unit`}
          icon={Receipt}
          accent="info"
          hint="Standard PG Tariff"
        />
      </div>

      {/* Standard Filter & Allowance Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-7 items-end">
            {/* Property Selector */}
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">Property</Label>
              <SearchableSelect
                options={(properties ?? []).map((p: any) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.city || p.code || 'Property',
                  badge: p.type || 'PG',
                }))}
                value={selectedPropertyId}
                onChange={(v) => {
                  setSelectedPropertyId(v);
                  setSelectedBuildingId('ALL');
                }}
                placeholder="Select property..."
              />
            </div>

            {/* Building Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Building / Block</Label>
              <Select value={selectedBuildingId} onValueChange={(v) => setSelectedBuildingId(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="All Buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Buildings</SelectItem>
                  {(buildings ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Billing Month */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Month</Label>
              <Select value={String(billingMonth)} onValueChange={(v) => setBillingMonth(Number(v))}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit Rate */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rate (₹/kWh)</Label>
              <Input
                type="number"
                step="0.5"
                className="h-9 text-xs font-semibold"
                value={defaultRate}
                onChange={(e) => setDefaultRate(Number(e.target.value))}
              />
            </div>

            {/* Free Allowance Setting */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <Gift className="h-3 w-3" /> Free Allowance (U)
              </Label>
              <Input
                type="number"
                step="1"
                placeholder="e.g. 10"
                className="h-9 text-xs font-semibold border-emerald-300 dark:border-emerald-800"
                value={defaultFreeAllowance}
                onChange={(e) => setDefaultFreeAllowance(Number(e.target.value))}
              />
            </div>

            {/* Search filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="101, Rahul..."
                  className="h-9 pl-8 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-Meter Entry Sheet Table Card */}
      <Card className="overflow-hidden">
        <CardHeader className="p-4 border-b bg-muted/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-600" /> Sub-Meter Reading Registry
            </CardTitle>
            <CardDescription className="text-xs">
              Direct table input with server-side pagination, fast filtering, and instant proportion calculations.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-semibold text-xs">
            {totalElements} Total Rooms Listed
          </Badge>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Room & Hierarchy</th>
                <th className="py-3 px-3">Active Roommates</th>
                <th className="py-3 px-3">Prev Reading</th>
                <th className="py-3 px-3">Current Reading</th>
                <th className="py-3 px-3 text-center">Meter Photo</th>
                <th className="py-3 px-3">Free U</th>
                <th className="py-3 px-3">Net Units</th>
                <th className="py-3 px-3">Split Policy</th>
                <th className="py-3 px-3">Room Total</th>
                <th className="py-3 px-3">Per-Tenant Share & Absorption</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sheetLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading room meter sheet...
                  </td>
                </tr>
              ) : sheetItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-muted-foreground">
                    No rooms found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                sheetItems.map((item, idx) => {
                  const roomTotal = Number(item.calculatedAmount || 0);
                  const tenantSum = item.tenantSplits?.reduce((acc: number, s: any) => acc + (Number(s.amount) || 0), 0) || 0;
                  const roomOwnerOverhead = Math.max(0, Math.round((roomTotal - tenantSum) * 100) / 100);

                  return (
                    <tr key={item.roomId} className="hover:bg-muted/40 transition-colors">
                      {/* Room & Building/Floor Hierarchy */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                            {item.roomNumber}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>Room {item.roomNumber}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <span>{item.buildingName || 'Main Building'}</span>
                              <span>•</span>
                              <span>{item.floorName}</span>
                              <span>({item.capacity} Share)</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Active Roommates */}
                      <td className="py-3.5 px-3">
                        {item.occupants.length === 0 ? (
                          <span className="text-muted-foreground italic">Vacant</span>
                        ) : (
                          <div className="space-y-1 max-w-[170px]">
                            {item.occupants.map((o) => (
                              <div key={o.id} className="flex items-center gap-1.5 text-[11px] truncate">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-medium text-foreground truncate">{o.name}</span>
                                <span className="text-[10px] text-muted-foreground">({o.checkInDate ? o.checkInDate.slice(5) : 'Start'})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Prev Reading */}
                      <td className="py-3.5 px-3 font-mono font-semibold text-muted-foreground">
                        {item.lastReadingValue}
                      </td>

                      {/* Current Reading Input */}
                      <td className="py-3.5 px-3">
                        <Input
                          type="number"
                          step="1"
                          className="h-8 w-24 text-xs font-mono font-bold"
                          value={item.currentReading || ''}
                          onChange={(e) => handleReadingChange(idx, Number(e.target.value))}
                        />
                      </td>

                      {/* Meter Photo Upload Button / Thumbnail */}
                      <td className="py-3.5 px-3 text-center">
                        {item.photoUrl ? (
                          <div className="relative inline-block group">
                            <img
                              src={item.photoUrl}
                              alt="Meter Proof"
                              className="h-8 w-8 rounded-lg object-cover border border-emerald-500 shadow-xs cursor-pointer"
                              onClick={() => setActivePreviewRoom(item)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setActivePhotoUploadIndex(idx);
                                fileInputRef.current?.click();
                              }}
                              className="absolute -bottom-1 -right-1 h-4 w-4 bg-primary text-white rounded-full flex items-center justify-center shadow-xs"
                              title="Replace Photo"
                            >
                              <Camera className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setActivePhotoUploadIndex(idx);
                              fileInputRef.current?.click();
                            }}
                          >
                            <Camera className="h-3 w-3 text-primary" />
                            Upload
                          </Button>
                        )}
                      </td>

                      {/* Free Allowance Input */}
                      <td className="py-3.5 px-3">
                        <Input
                          type="number"
                          step="1"
                          className="h-8 w-16 text-xs font-mono text-center"
                          value={item.freeAllowanceUnits ?? 0}
                          onChange={(e) => handleAllowanceChange(idx, Number(e.target.value))}
                        />
                      </td>

                      {/* Net Units */}
                      <td className="py-3.5 px-3">
                        <Badge
                          variant={(item.calculatedUnits || 0) > 0 ? 'default' : 'secondary'}
                          className="font-mono text-xs"
                        >
                          {item.calculatedUnits || 0} U
                        </Badge>
                      </td>

                      {/* Split Policy Dropdown */}
                      <td className="py-3.5 px-3">
                        <Select
                          value={item.splitMode || 'FAIR_PROPORTIONAL'}
                          onValueChange={(val) => handleSplitModeChange(idx, val)}
                        >
                          <SelectTrigger className="h-8 text-[11px] w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FAIR_PROPORTIONAL">Fair Capacity</SelectItem>
                            <SelectItem value="EQUAL_OCCUPANTS">Equal Active</SelectItem>
                            <SelectItem value="SINGLE_OCCUPANT">Single (100%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Room Total */}
                      <td className="py-3.5 px-3 font-bold text-foreground font-mono">
                        {formatCurrency(roomTotal)}
                      </td>

                      {/* Per-Tenant Share & Owner Absorption Badges */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col gap-1 max-w-[220px]">
                          {item.tenantSplits && item.tenantSplits.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.tenantSplits.map((s, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] gap-1 font-mono border-primary/40 bg-primary/5 text-primary">
                                  <span className="font-semibold">{s.tenantName.split(' ')[0]}:</span>
                                  <span className="font-bold">₹{s.amount}</span>
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}

                          {roomOwnerOverhead > 0 && (
                            <Badge variant="outline" className="text-[9px] gap-1 font-mono border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 self-start">
                              <span>Owner Overhead:</span>
                              <span className="font-bold">₹{roomOwnerOverhead}</span>
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                            title="Share breakdown via WhatsApp"
                            onClick={() => shareViaWhatsApp(item)}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Inspect Room Breakdown"
                            onClick={() => setActivePreviewRoom(item)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-8 w-16 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-2 font-medium">
              Showing {totalElements === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalElements)} of {totalElements} rooms
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(0)}
              disabled={page === 0 || sheetLoading}
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || sheetLoading}
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-3 py-1 font-semibold text-foreground">
              Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || sheetLoading}
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1 || sheetLoading}
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Confirmation Dialog for 1-Click Invoice Merge */}
      <ConfirmDialog
        open={confirmApplyOpen}
        onOpenChange={setConfirmApplyOpen}
        title="Apply Utility Readings to Monthly Rent Invoices"
        description={`This will record meter readings for ${sheetItems.length} rooms and append ₹${totalBilledToTenants.toLocaleString()} directly as line items into corresponding tenant rent invoices for ${billingMonth}/${billingYear}. (The remaining ₹${totalOwnerAbsorption.toLocaleString()} unallocated vacancy loss will be logged as property overhead).`}
        confirmLabel="Confirm & Merge into Invoices"
        onConfirm={() => bulkSubmitMutation.mutate(true)}
        loading={bulkSubmitMutation.isPending}
      />

      {/* Detailed Room Breakdown & Photo Proof Dialog */}
      <Dialog open={!!activePreviewRoom} onOpenChange={() => setActivePreviewRoom(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Room {activePreviewRoom?.roomNumber} Utility Breakdown &amp; Proof
            </DialogTitle>
            <DialogDescription>
              {activePreviewRoom?.buildingName || 'Main Building'} · {activePreviewRoom?.floorName} · {activePreviewRoom?.capacity} Sharing Room
            </DialogDescription>
          </DialogHeader>

          {activePreviewRoom && (() => {
            const rTotal = Number(activePreviewRoom.calculatedAmount || 0);
            const tSum = activePreviewRoom.tenantSplits?.reduce((acc: number, s: any) => acc + (Number(s.amount) || 0), 0) || 0;
            const oAbsorption = Math.max(0, Math.round((rTotal - tSum) * 100) / 100);

            return (
              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border">
                  <div>
                    <span className="text-muted-foreground">Previous Reading:</span>
                    <p className="font-mono font-bold">{activePreviewRoom.lastReadingValue}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current Reading:</span>
                    <p className="font-mono font-bold">{activePreviewRoom.currentReading || activePreviewRoom.lastReadingValue}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Free Allowance:</span>
                    <p className="font-mono font-bold text-emerald-600">-{activePreviewRoom.freeAllowanceUnits || 0} units</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Net Consumed:</span>
                    <p className="font-mono font-bold text-primary">{activePreviewRoom.calculatedUnits || 0} kWh</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Room Total:</span>
                      <p className="font-mono font-bold text-sm text-foreground">{formatCurrency(rTotal)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-primary font-semibold">Tenant Recovered:</span>
                      <p className="font-mono font-bold text-sm text-primary">{formatCurrency(tSum)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Owner Absorption:</span>
                      <p className="font-mono font-bold text-sm text-amber-700 dark:text-amber-400">{formatCurrency(oAbsorption)}</p>
                    </div>
                  </div>
                </div>

                {/* Owner Overhead Explanation Note */}
                {oAbsorption > 0 && (
                  <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
                    <UserX className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Vacancy Overhead ({formatCurrency(oAbsorption)})</p>
                      <p className="text-[10px] text-amber-800 dark:text-amber-300">
                        Under Fair Capacity policy, unoccupied bed days (Bed 2 &amp; pre-checkin period) are not charged to the active resident and are absorbed as operating overhead against property revenue.
                      </p>
                    </div>
                  </div>
                )}

                {/* Meter Dial Photo Proof Box */}
                <div className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-primary" /> Physical Meter Dial Proof
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        const idx = sheetItems.findIndex(s => s.roomId === activePreviewRoom.roomId);
                        if (idx !== -1) {
                          setActivePhotoUploadIndex(idx);
                          fileInputRef.current?.click();
                        }
                      }}
                    >
                      <Upload className="h-3 w-3" />
                      {activePreviewRoom.photoUrl ? 'Replace Photo' : 'Upload Photo'}
                    </Button>
                  </div>

                  {activePreviewRoom.photoUrl ? (
                    <div className="relative rounded-lg overflow-hidden border max-h-48 bg-slate-950 flex items-center justify-center">
                      <img
                        src={activePreviewRoom.photoUrl}
                        alt="Meter Dial Reading Proof"
                        className="max-h-48 w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-[11px]">
                      <Image className="h-6 w-6 mx-auto mb-1 opacity-40" />
                      No meter photo uploaded yet. Take a snapshot of the sub-meter dial for transparency.
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-2 block">Roommate Proportions</Label>
                  {activePreviewRoom.tenantSplits && activePreviewRoom.tenantSplits.length > 0 ? (
                    <div className="space-y-2">
                      {activePreviewRoom.tenantSplits.map((split, i) => (
                        <div key={i} className="flex justify-between items-center p-2 rounded-lg border bg-card">
                          <div>
                            <p className="font-semibold text-foreground">{split.tenantName}</p>
                            <p className="text-[10px] text-muted-foreground">{split.formulaDescription}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary font-mono">{formatCurrency(split.amount)}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{split.units} U</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No roommate splits calculated yet.</p>
                  )}
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setActivePreviewRoom(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
