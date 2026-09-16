import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Hotel, Building2, Users, BedDouble, Wallet, MapPin,
  Phone, Mail, Pencil, Trash2, Calendar, TrendingUp, Layers, DoorOpen,
  ChevronDown, ChevronRight, BedSingle, CreditCard, ShieldCheck, RotateCcw,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import type { Property, Building, Tenant, Floor, Room, Bed } from '@/lib/types';
import { FormDialog } from '@/components/common/FormDialog';
import { PropertyDeleteModal } from './PropertyDeleteModal';
import { FormInput } from '@/components/common/FormField';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate, initials, occupancyRate } from '@/lib/format';
import { useUpdate, useDelete, useForm } from '@/lib/hooks/use-crud';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';

const propertyTypes = [
  { value: 'PG', label: 'Paying Guest' },
  { value: 'HOSTEL', label: 'Hostel' },
  { value: 'CO_LIVING', label: 'Co-living' },
];
const propertyStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function PropertyDetailPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = (user?.role as string) === 'SUPER_ADMIN' || (user?.role as string) === 'ROLE_SUPER_ADMIN';
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const updateMut = useUpdate<Property>('/properties', 'Property');
  const deleteMut = useDelete('/properties', 'Property');
  const canManage = isSuperAdmin || (user?.role as string) === 'OWNER' || (user?.role as string) === 'ADMIN';
  const form = useForm({
    name: '', code: '', type: 'PG' as Property['type'], address: '', city: '', state: '', pincode: '',
    manager: '', phone: '', email: '', status: 'active' as Property['status'],
    minimumLockInMonths: 3,
    noticePeriodDays: 30,
    defaultExitCleaningFee: 500,
    defaultElectricityRatePerUnit: 10.0,
    razorpayKeyId: '', razorpayKeySecret: ''
  });

  const { data: property, isLoading, refetch: refetchProperty } = useQuery({
    queryKey: ['/properties', id],
    queryFn: () => api.get<Property>(`/properties/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: orgProfile } = useQuery({
    queryKey: ['org-billing-profile'],
    queryFn: () => api.get('/organization-billing-profile').then((r) => r.data).catch(() => null),
  });

  async function handleRestore() {
    if (!property) return;
    try {
      setRestoring(true);
      await api.put(`/properties/${property.id}/restore`);
      toast.success(`Property "${property.name}" and all spaces have been restored to Active!`);
      refetchProperty();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to restore property');
    } finally {
      setRestoring(false);
    }
  }
  const { data: buildings } = useQuery({
    queryKey: ['/buildings', id],
    queryFn: () => api.get<any>('/buildings', { params: { pageSize: 100 } }).then((r) => {
      const d = r.data;
      const list = Array.isArray(d) ? d : d?.data || [];
      return list.filter((b: Building) => b.propertyId === id);
    }),
    enabled: !!id,
  });
  const { data: floors } = useQuery({
    queryKey: ['/floors'],
    queryFn: () => api.get<any>('/floors', { params: { pageSize: 200 } }).then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || [];
    }),
    enabled: !!id,
  });
  const { data: rooms } = useQuery({
    queryKey: ['/rooms'],
    queryFn: () => api.get<any>('/rooms', { params: { pageSize: 300 } }).then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || [];
    }),
    enabled: !!id,
  });
  const { data: beds } = useQuery({
    queryKey: ['/beds'],
    queryFn: () => api.get<any>('/beds', { params: { pageSize: 500 } }).then((r) => {
      const d = r.data;
      return Array.isArray(d) ? d : d?.data || [];
    }),
    enabled: !!id,
  });
  const { data: allTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['property-tenants', id],
    queryFn: () => api.get<any>('/tenants', { params: { pageSize: 200 } }).then((r) => {
      const d = r.data;
      const list = Array.isArray(d) ? d : d?.data || d?.content || [];
      return list.filter((t: any) => t.propertyId === id);
    }),
    enabled: !!id,
  });

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (!property) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/properties')}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button>
        <p className="text-muted-foreground">Property not found.</p>
      </div>
    );
  }

  const occRate = occupancyRate(property.occupiedBeds, property.totalBeds);
  const activeTenants = allTenants?.filter((t: any) => t.status && !['CHECKED_OUT', 'ARCHIVED', 'INACTIVE'].includes(t.status.toUpperCase())) || [];
  const tenantRentSum = activeTenants.reduce((s: number, t: any) => s + Number(t.rent || 0), 0);
  
  // Calculate potential or occupied rent from rooms if no active tenant records
  const propertyRooms = (rooms ?? []).filter((r: any) => r.propertyId === id || buildings?.some((b: any) => b.id === r.buildingId));
  const occupiedRoomsRent = propertyRooms.filter((r: any) => Number(r.occupied || 0) > 0).reduce((s: number, r: any) => s + Number(r.rent || r.baseRent || 0), 0);
  const totalPotentialRent = propertyRooms.reduce((s: number, r: any) => s + Number(r.rent || r.baseRent || 0), 0);
  const effectiveMonthlyRent = tenantRentSum > 0 ? tenantRentSum : (occupiedRoomsRent > 0 ? occupiedRoomsRent : totalPotentialRent);

  const buildingFloors = (buildingId: string) => {
    // 1. Explicit floors in DB
    const explicit = (floors ?? []).filter((f: any) => f.buildingId === buildingId);
    if (explicit.length > 0) return explicit;

    // 2. Derive floors automatically from rooms belonging to this building
    const bRooms = (rooms ?? []).filter((r: any) =>
      r.buildingId === buildingId ||
      (r.buildingName && buildings?.find((b: any) => b.id === buildingId)?.name &&
        r.buildingName.toLowerCase() === buildings?.find((b: any) => b.id === buildingId)?.name.toLowerCase())
    );

    if (bRooms.length === 0) return [];

    const floorMap = new Map<string, any>();
    bRooms.forEach((r: any) => {
      const fNum = r.floorNumber ?? (r.roomNumber ? parseInt(String(r.roomNumber)[0]) || 1 : 1);
      const fKey = `f-${buildingId}-${fNum}`;
      if (!floorMap.has(fKey)) {
        floorMap.set(fKey, {
          id: fKey,
          buildingId,
          name: `Floor ${fNum}`,
          floorNumber: fNum,
          occupied: 0,
          beds: 0,
          isDerived: true,
        });
      }
      const flr = floorMap.get(fKey);
      flr.occupied += Number(r.occupied || 0);
      flr.beds += Number(r.beds || 0);
    });

    return Array.from(floorMap.values()).sort((a, b) => (a.floorNumber ?? 0) - (b.floorNumber ?? 0));
  };

  const floorRooms = (floorId: string, buildingId?: string) => {
    if (String(floorId).startsWith(`f-${buildingId}-`)) {
      const fNum = parseInt(floorId.split('-').pop() || '1');
      return (rooms ?? []).filter((r: any) => {
        const matchesBuilding = r.buildingId === buildingId ||
          (r.buildingName && buildings?.find((b: any) => b.id === buildingId)?.name &&
            r.buildingName.toLowerCase() === buildings?.find((b: any) => b.id === buildingId)?.name.toLowerCase());
        const rFloor = r.floorNumber ?? (r.roomNumber ? parseInt(String(r.roomNumber)[0]) || 1 : 1);
        return matchesBuilding && rFloor === fNum;
      });
    }
    return (rooms ?? []).filter((r: any) => r.floorId === floorId);
  };

  const roomBeds = (roomId: string) => (beds ?? []).filter((b: any) => b.roomId === roomId);

  function toggleBuilding(bid: string) {
    setExpandedBuilding((prev) => (prev === bid ? null : bid));
    setExpandedFloor(null);
  }
  function toggleFloor(fid: string) {
    setExpandedFloor((prev) => (prev === fid ? null : fid));
  }

  function openEdit() {
    if (!property) return;
    form.reset({
      name: property.name, code: property.code, type: property.type, address: property.address,
      city: property.city, state: property.state, pincode: property.pincode, manager: property.manager,
      phone: property.phone, email: property.email, status: property.status,
      minimumLockInMonths: (property as any).minimumLockInMonths ?? orgProfile?.minimumLockInMonths ?? 3,
      noticePeriodDays: (property as any).noticePeriodDays ?? orgProfile?.noticePeriodDays ?? 30,
      defaultExitCleaningFee: (property as any).defaultExitCleaningFee ?? orgProfile?.defaultExitCleaningFee ?? 500,
      defaultElectricityRatePerUnit: (property as any).defaultElectricityRatePerUnit ?? orgProfile?.defaultElectricityRatePerUnit ?? 10.0,
      razorpayKeyId: property.razorpayKeyId ?? '',
      razorpayKeySecret: property.razorpayKeySecret ?? ''
    });
    setEditOpen(true);
  }

  function submitEdit() {
    if (!property) return;
    const rules = {
      name: (v: any) => !v ? 'Name is required' : undefined,
      code: (v: any) => !v ? 'Code is required' : undefined,
      city: (v: any) => !v ? 'City is required' : undefined,
    };
    if (!form.validate(rules)) return;
    updateMut.mutate({ id: property.id, payload: form.values }, { onSuccess: () => setEditOpen(false) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/properties"><ArrowLeft className="mr-1.5 h-4 w-4" /> Properties</Link>
        </Button>
      </div>

      <PageHeader
        title={property.name}
        description={`${property.code || 'PROP'} · ${(property.type || 'CO_LIVING').replace('_', '-')} · ${property.city || ''}, ${property.state || ''}`}
        icon={Hotel}
        actions={
          canManage ? (
            <div className="flex items-center gap-2">
              {property.status?.toLowerCase() === 'archived' ? (
                <>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 px-3 py-1 font-semibold uppercase text-xs">
                    Archived Property
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={handleRestore}
                    disabled={restoring}
                    className="gap-1.5 font-semibold text-xs border-success/30 text-success hover:bg-success/5"
                  >
                    <RotateCcw className="h-4 w-4" /> {restoring ? 'Restoring...' : 'Restore Property'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    className="gap-1.5 font-bold text-xs"
                  >
                    <Trash2 className="h-4 w-4" /> Purge Permanently
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={openEdit}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Edit Property
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20 font-medium"
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete / Archive
                  </Button>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Buildings" value={property.totalBuildings} icon={Building2} accent="primary" />
        <StatCard label="Total Beds" value={property.totalBeds} icon={BedDouble} accent="info" hint={`${property.totalRooms} rooms`} />
        <StatCard label="Occupancy" value={`${occRate}%`} icon={TrendingUp} accent="success" hint={`${property.occupiedBeds}/${property.totalBeds} beds`} />
        <StatCard
          label="Est. Monthly Rent"
          value={formatCurrency(effectiveMonthlyRent)}
          icon={Wallet}
          accent="warning"
          hint={tenantRentSum > 0 ? "From active residents" : (effectiveMonthlyRent > 0 ? "Projected room rent" : "No rent configured")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Overview */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Property Overview</CardTitle>
            <CardDescription>General information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4">
              <InfoRow icon={MapPin} label="Address" value={[property.address, property.city, property.state, property.pincode].filter(Boolean).join(', ')} allowWrap />
              <InfoRow icon={Users} label="Manager" value={property.manager} />
              <InfoRow icon={Phone} label="Phone" value={property.phone} />
              <InfoRow icon={Mail} label="Email" value={property.email} />
              <InfoRow icon={Calendar} label="Created" value={formatDate(property.createdAt)} />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><Hotel className="h-5 w-5 text-muted-foreground" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={property.status} tone={statusTone(property.status)} />
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Bed Occupancy</span>
                <span className="text-muted-foreground">{property.occupiedBeds} of {property.totalBeds} ({occRate}%)</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${occRate}%` }} />
              </div>
            </div>
            <Separator />
            {/* Lease & Settlement Policies Card */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lease &amp; Settlement Policies</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Lock-In Period</p>
                  <p className="font-semibold">{Number(((property as any).minimumLockInMonths ?? orgProfile?.minimumLockInMonths ?? 3)) > 0 ? `${(property as any).minimumLockInMonths ?? orgProfile?.minimumLockInMonths ?? 3} Months` : 'Monthly Rolling'}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Notice Period</p>
                  <p className="font-semibold">{(property as any).noticePeriodDays ?? orgProfile?.noticePeriodDays ?? 30} Days</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Exit Cleaning Fee</p>
                  <p className="font-semibold">₹{(property as any).defaultExitCleaningFee ?? orgProfile?.defaultExitCleaningFee ?? 500}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Electricity Tariff</p>
                  <p className="font-semibold">₹{(property as any).defaultElectricityRatePerUnit ?? orgProfile?.defaultElectricityRatePerUnit ?? 10.0}/unit</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drill-down hierarchy: Buildings -> Floors -> Rooms -> Beds */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Building Hierarchy</CardTitle>
            <CardDescription>Click a building to expand its floors, rooms, and beds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {!buildings || buildings.length === 0 ? (
              <Skeleton className="h-32" />
            ) : (
              buildings.map((building: any) => {
                const bRate = occupancyRate(building.occupied, building.beds);
                const bFloors = buildingFloors(building.id);
                const isOpen = expandedBuilding === building.id;

                return (
                  <div key={building.id} className="rounded-lg border">
                    {/* Building header */}
                    <button
                      onClick={() => toggleBuilding(building.id)}
                      className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{building.name}</p>
                          <p className="text-xs text-muted-foreground">{bFloors.length} floor{bFloors.length === 1 ? '' : 's'} · {building.rooms} rooms · {building.beds} beds</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden w-24 sm:block">
                          <div className="flex justify-between text-xs"><span className="font-medium">{bRate}%</span><span className="text-muted-foreground">{building.occupied}/{building.beds}</span></div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${bRate}%` }} /></div>
                        </div>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Floors */}
                    {isOpen && (
                      <div className="border-t bg-muted/20 p-2.5 space-y-2 animate-fade-in">
                        {bFloors.length === 0 ? (
                          <p className="py-3 text-center text-xs text-muted-foreground">No floors configured</p>
                        ) : (
                          bFloors.map((floor: any) => {
                            const fRooms = floorRooms(floor.id, building.id);
                            const fIsOpen = expandedFloor === floor.id;
                            return (
                              <div key={floor.id} className="rounded-md border bg-card">
                                <button
                                  onClick={() => toggleFloor(floor.id)}
                                  className="flex w-full items-center justify-between p-2.5 text-left transition-colors hover:bg-muted/40"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-info/10 text-info"><Layers className="h-4 w-4" /></div>
                                    <div>
                                      <p className="text-sm font-medium">{floor.name}</p>
                                      <p className="text-xs text-muted-foreground">{fRooms.length} room{fRooms.length === 1 ? '' : 's'} · {floor.occupied}/{floor.beds} beds</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{occupancyRate(floor.occupied, floor.beds)}%</span>
                                    {fIsOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                  </div>
                                </button>

                                {/* Rooms */}
                                {fIsOpen && (
                                  <div className="border-t bg-muted/20 p-2.5 animate-fade-in">
                                    {fRooms.length === 0 ? (
                                      <p className="py-2 text-center text-xs text-muted-foreground">No rooms configured</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {fRooms.map((room: any) => {
                                          const rBeds = roomBeds(room.id);
                                          return (
                                            <div key={room.id} className="rounded-md border bg-card p-2.5">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-warning/10 text-warning"><DoorOpen className="h-4 w-4" /></div>
                                                  <div>
                                                    <p className="text-sm font-medium">Room {room.number}</p>
                                                    <p className="text-xs text-muted-foreground capitalize">{room.type} · {formatCurrency(room.rent || room.baseRent || 0)}/mo</p>
                                                  </div>
                                                </div>
                                                <StatusBadge status={room.status} tone={statusTone(room.status)} />
                                              </div>
                                              {/* Beds */}
                                              {rBeds.length > 0 && (
                                                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t pt-2.5">
                                                  {rBeds.map((bed: any) => (
                                                    <div
                                                      key={bed.id}
                                                      className={cn(
                                                        'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
                                                        bed.status === 'available' && 'border-success/30 bg-success/10 text-success',
                                                        bed.status === 'occupied' && 'border-primary/30 bg-primary/10 text-primary',
                                                        bed.status === 'reserved' && 'border-warning/30 bg-warning/10 text-warning',
                                                        bed.status === 'maintenance' && 'border-destructive/30 bg-destructive/10 text-destructive',
                                                      )}
                                                      title={`Bed ${bed.number} — ${bed.status}`}
                                                    >
                                                      <BedSingle className="h-3 w-3" />
                                                      {bed.number}
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent tenants */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Residents</CardTitle>
            <CardDescription>Active &amp; recent tenants allocated to {property.name}</CardDescription>
          </div>
          {allTenants && allTenants.length > 0 && (
            <Badge variant="secondary" className="font-semibold">
              {allTenants.length} Total Resident{allTenants.length === 1 ? '' : 's'}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {tenantsLoading ? (
            <Skeleton className="h-20" />
          ) : !allTenants || allTenants.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground space-y-2">
              <Users className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm font-medium">No tenants currently allocated to this property</p>
              <p className="text-xs">Allocate a room/bed to a resident via the Tenants or Check-in page to see them here.</p>
            </div>
          ) : (
            allTenants.slice(0, 8).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(t.name || `${t.firstName || ''} ${t.lastName || ''}`)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Resident'}</p>
                    <p className="text-xs text-muted-foreground">
                      Room {t.roomNumber || '—'} {t.bedNumber ? `· Bed ${t.bedNumber}` : ''} {t.occupation ? `· ${t.occupation}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(t.rent || 0)}/mo</span>
                  <StatusBadge status={t.status || 'ACTIVE'} tone={statusTone(t.status || 'ACTIVE')} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Property"
        description="Update property details."
        onSubmit={submitEdit}
        loading={updateMut.isPending}
        submitLabel="Save Changes"
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Property Name" required id="name" value={form.values.name} onChange={(e) => form.setValue('name', e.target.value)} error={form.errors.name} />
          <FormInput label="Property Code" required id="code" value={form.values.code} onChange={(e) => form.setValue('code', e.target.value.toUpperCase())} error={form.errors.code} />
          <div className="space-y-1.5">
            <Label>Property Type</Label>
            <Select value={form.values.type} onValueChange={(v) => form.setValue('type', v as Property['type'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{propertyTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.values.status} onValueChange={(v) => form.setValue('status', v as Property['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{propertyStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <FormInput label="Address" id="address" className="sm:col-span-2" value={form.values.address} onChange={(e) => form.setValue('address', e.target.value)} />
          <FormInput label="City" required id="city" value={form.values.city} onChange={(e) => form.setValue('city', e.target.value)} error={form.errors.city} />
          <FormInput label="State" id="state" value={form.values.state} onChange={(e) => form.setValue('state', e.target.value)} />
          <FormInput label="Pincode" id="pincode" value={form.values.pincode} onChange={(e) => form.setValue('pincode', e.target.value)} />
          <FormInput label="Manager" id="manager" value={form.values.manager} onChange={(e) => form.setValue('manager', e.target.value)} />
          <FormInput label="Phone" id="phone" value={form.values.phone} onChange={(e) => form.setValue('phone', e.target.value)} />
          <FormInput label="Email" type="email" id="email" value={form.values.email} onChange={(e) => form.setValue('email', e.target.value)} />

          {/* Lease Terms & Operational Settlement Policy (P3.3) */}
          <div className="sm:col-span-2 mt-2 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <h4 className="text-sm font-bold">Lease Terms &amp; Settlement Policies</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure contractual lock-in duration, notice period, exit cleaning fees, and electricity tariff for this property.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormInput
                label="Minimum Lock-In Period (Months)"
                id="minimumLockInMonths"
                type="number"
                value={form.values.minimumLockInMonths}
                onChange={(e) => form.setValue('minimumLockInMonths', Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="e.g. 3 (0 for monthly rolling)"
              />
              <FormInput
                label="Required Notice Period (Days)"
                id="noticePeriodDays"
                type="number"
                value={form.values.noticePeriodDays}
                onChange={(e) => form.setValue('noticePeriodDays', Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="e.g. 30"
              />
              <FormInput
                label="Default Exit Cleaning Fee (₹)"
                id="defaultExitCleaningFee"
                type="number"
                value={form.values.defaultExitCleaningFee}
                onChange={(e) => form.setValue('defaultExitCleaningFee', Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="e.g. 500"
              />
              <FormInput
                label="Default Electricity Tariff (₹/Unit)"
                id="defaultElectricityRatePerUnit"
                type="number"
                value={form.values.defaultElectricityRatePerUnit}
                onChange={(e) => form.setValue('defaultElectricityRatePerUnit', Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="e.g. 10.0"
              />
            </div>
          </div>
          {!isSuperAdmin ? (
            <>
              <div className="sm:col-span-2 border-t pt-3 mt-1">
                <h4 className="font-semibold text-xs text-primary flex items-center gap-1.5 uppercase tracking-wider">
                  <CreditCard className="h-3.5 w-3.5 text-primary" /> Property Razorpay Gateway Credentials
                </h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Enter unique Razorpay API credentials for this property. Tenant rent payments for this property will be processed using this account.
                </p>
              </div>
              <FormInput
                label="Razorpay Key ID"
                id="razorpayKeyId"
                value={form.values.razorpayKeyId}
                onChange={(e) => form.setValue('razorpayKeyId', e.target.value)}
                placeholder="rzp_live_... / rzp_test_..."
              />
              <FormInput
                label="Razorpay Key Secret"
                type="password"
                id="razorpayKeySecret"
                value={form.values.razorpayKeySecret}
                onChange={(e) => form.setValue('razorpayKeySecret', e.target.value)}
                placeholder={property?.hasRazorpaySecret ? "•••••••• (Saved in DB - leave blank to keep)" : "Enter Razorpay Key Secret"}
              />
            </>
          ) : (
            <div className="sm:col-span-2 border-t pt-3 mt-1">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-amber-700 dark:text-amber-300">Security & Gateway Management Policy</span>
                  Razorpay API Key & Secret credentials cannot be updated by Super Admin. For security & compliance, credentials must be uploaded directly by the Property Owner or Property Manager from their dashboard settings.
                </div>
              </div>
            </div>
          )}
        </div>
      </FormDialog>

      <PropertyDeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        property={property}
        fallbackActiveTenants={activeTenants.length > 0 ? activeTenants.length : (property.occupiedBeds ?? 0)}
        fallbackBuildings={buildings?.length ?? property.totalBuildings ?? 0}
        fallbackRooms={rooms?.length ?? property.totalRooms ?? 0}
        fallbackBeds={beds?.length ?? property.totalBeds ?? 0}
        onSuccess={() => navigate('/properties')}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, allowWrap }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string; allowWrap?: boolean }) {
  const isEmailOrId = label.toLowerCase().includes('email') || label.toLowerCase().includes('id') || label.toLowerCase().includes('phone');
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-medium", allowWrap ? "break-words whitespace-normal" : "truncate", isEmailOrId ? "normal-case" : "capitalize")}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}
