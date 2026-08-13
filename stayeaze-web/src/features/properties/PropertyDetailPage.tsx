import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Hotel, Building2, Users, BedDouble, Wallet, MapPin,
  Phone, Mail, Pencil, Calendar, TrendingUp, Layers, DoorOpen,
  ChevronDown, ChevronRight, BedSingle, CreditCard,
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
import { FormInput } from '@/components/common/FormField';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatDate, initials, occupancyRate } from '@/lib/format';
import { useUpdate, useForm } from '@/lib/hooks/use-crud';

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
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const updateMut = useUpdate<Property>('/properties', 'Property');
  const form = useForm({
    name: '', code: '', type: 'PG' as Property['type'], address: '', city: '', state: '', pincode: '',
    manager: '', phone: '', email: '', status: 'active' as Property['status'],
    razorpayKeyId: '', razorpayKeySecret: ''
  });

  const { data: property, isLoading } = useQuery({
    queryKey: ['/properties', id],
    queryFn: () => api.get<Property>(`/properties/${id}`).then((r) => r.data),
    enabled: !!id,
  });
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
  const { data: tenants } = useQuery({
    queryKey: ['property-tenants', id],
    queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { pageSize: 6, sortBy: 'createdAt', sortOrder: 'desc' } }).then((r) => r.data.data),
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
  const monthlyRent = tenants?.reduce((s, t) => s + t.rent, 0) ?? 0;

  const buildingFloors = (buildingId: string) => (floors ?? []).filter((f: any) => f.buildingId === buildingId);
  const floorRooms = (floorId: string) => (rooms ?? []).filter((r: any) => r.floorId === floorId);
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
        actions={<Button variant="outline" onClick={openEdit}><Pencil className="mr-1.5 h-4 w-4" /> Edit Property</Button>}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Buildings" value={property.totalBuildings} icon={Building2} accent="primary" />
        <StatCard label="Total Beds" value={property.totalBeds} icon={BedDouble} accent="info" hint={`${property.totalRooms} rooms`} />
        <StatCard label="Occupancy" value={`${occRate}%`} icon={TrendingUp} accent="success" hint={`${property.occupiedBeds}/${property.totalBeds} beds`} />
        <StatCard label="Est. Monthly Rent" value={formatCurrency(monthlyRent * 4)} icon={Wallet} accent="warning" hint="From active tenants" />
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
                          <p className="text-xs text-muted-foreground">{bFloors.length} floors · {building.rooms} rooms · {building.beds} beds</p>
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
                            const fRooms = floorRooms(floor.id);
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
                                      <p className="text-xs text-muted-foreground">{fRooms.length} rooms · {floor.occupied}/{floor.beds} beds</p>
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
                                                    <p className="text-xs text-muted-foreground capitalize">{room.type} · {formatCurrency(room.rent)}/mo</p>
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
        <CardHeader>
          <CardTitle>Recent Tenants</CardTitle>
          <CardDescription>Latest checked-in residents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tenants?.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(t.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">Room {t.roomNumber} · {t.occupation}</p>
              </div>
              <span className="text-sm font-medium">{formatCurrency(t.rent)}/mo</span>
              <StatusBadge status={t.status} tone={statusTone(t.status)} />
            </div>
          )) ?? <Skeleton className="h-20" />}
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
        </div>
      </FormDialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, allowWrap }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string; allowWrap?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-medium", allowWrap ? "break-words whitespace-normal" : "truncate capitalize")}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}
