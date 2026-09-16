import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Building2,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  Search,
  CheckCircle2,
  Sparkles,
  Filter,
  RefreshCw,
  BedDouble,
  User,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { RowActions } from '@/components/common/RowActions';
import { FormDialog } from '@/components/common/FormDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormField';
import { SearchableSelect } from '@/components/common/SearchableSelect';
import { QuickAddTenantModal } from '@/features/tenants/QuickAddTenantModal';
import { RoomBedMatrix } from './RoomBedMatrix';
import { BatchSpaceGeneratorDialog } from './BatchSpaceGeneratorDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { usePropertyStore } from '@/lib/stores/property-store';
import type { Room, Floor, Building, Bed } from '@/lib/types';
import { formatCurrency, formatRoomName } from '@/lib/format';
import { useCreate, useDelete, useUpdate, useForm } from '@/lib/hooks/use-crud';

const ENDPOINT_ROOMS = '/rooms';
const ENDPOINT_BEDS = '/beds';
const ENDPOINT_BUILDINGS = '/buildings';
const ENDPOINT_FLOORS = '/floors';

const roomTypes = [
  { value: 'single', label: 'Single (1 sharing)' },
  { value: 'double', label: 'Double (2 sharing)' },
  { value: 'triple', label: 'Triple (3 sharing)' },
  { value: 'dorm', label: 'Dorm (4+ sharing)' },
];
const roomStatuses = [
  { value: 'available', label: 'Available' },
  { value: 'partially_occupied', label: 'Partially Occupied' },
  { value: 'occupied', label: 'Fully Occupied' },
  { value: 'partially_reserved', label: 'Partially Reserved' },
  { value: 'reserved', label: 'Fully Reserved' },
  { value: 'maintenance', label: 'Maintenance' },
];
const bedStatuses = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'maintenance', label: 'Maintenance' },
];
const allAmenities = ['AC', 'WiFi', 'Geyser', 'Wardrobe', 'Study Table', 'Balcony', 'Attached Bath', 'TV', 'Lift', 'Parking', 'Food', 'Laundry', 'Power Backup', 'Security'];

const emptyRoomForm = {
  number: '', type: 'double' as Room['type'], sharing: 2, beds: 2, occupied: 0,
  rent: 0, status: 'available' as Room['status'], floorId: '', amenities: [] as string[],
};

const emptyBedForm = {
  number: 'B1', roomId: '', status: 'available' as Bed['status'], tenantId: '',
};

export default function RoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = searchParams.get('tab') || 'matrix';
  const [currentTab, setCurrentTab] = useState(activeTabParam);

  useEffect(() => {
    if (searchParams.get('tab')) {
      setCurrentTab(searchParams.get('tab')!);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    setSearchParams({ tab });
  };

  const { selectedPropertyId } = usePropertyStore();
  const queryClient = useQueryClient();

  // Modals state
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<Room | null>(null);

  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [deleteBedTarget, setDeleteBedTarget] = useState<Bed | null>(null);

  const [batchGenBuilding, setBatchGenBuilding] = useState<Building | null>(null);

  // Quick Allot Modal state
  const [allotModalOpen, setAllotModalOpen] = useState(false);
  const [allotTarget, setAllotTarget] = useState<{
    bedNumber: string;
    bedId?: string;
    roomId: string;
    roomNumber: string;
    propertyId?: string;
    rent?: number;
  } | null>(null);

  // Visual View Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [vacancyFilter, setVacancyFilter] = useState<'all' | 'vacant' | 'occupied' | 'maintenance'>('all');
  const [filterBuildingId, setFilterBuildingId] = useState('all');
  const [filterFloorId, setFilterFloorId] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Queries
  const { data: properties } = useQuery({
    queryKey: ['rooms-properties'],
    queryFn: () => api.get<any[]>('/properties', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload;
      return (payload as { data: any[] })?.data ?? [];
    }),
  });
  const propMap = new Map((properties ?? []).map((p: any) => [p.id, p.name]));

  const { data: buildings } = useQuery({
    queryKey: ['rooms-buildings'],
    queryFn: () => api.get<Building[]>('/buildings', { params: { pageSize: 100 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Building[];
      return (payload as { data: Building[] }).data ?? [];
    }),
  });

  const { data: floors } = useQuery({
    queryKey: ['rooms-floors'],
    queryFn: () => api.get<Floor[]>('/floors', { params: { pageSize: 200 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Floor[];
      return (payload as { data: Floor[] }).data ?? [];
    }),
  });
  const floorMap = new Map((floors ?? []).map((f) => [f.id, f.name]));

  // Live Query for Visual Matrix (Rooms & Beds)
  const { data: matrixRooms = [] } = useQuery({
    queryKey: ['matrix-rooms', selectedPropertyId],
    queryFn: () =>
      api.get<any>('/rooms', {
        params: {
          pageSize: 500,
          propertyId: selectedPropertyId !== 'ALL' ? selectedPropertyId : undefined,
        },
      }).then((r) => {
        const payload = r.data as unknown;
        if (Array.isArray(payload)) return payload as Room[];
        return (payload as { data: Room[] })?.data ?? [];
      }),
  });

  const { data: matrixBeds = [] } = useQuery({
    queryKey: ['matrix-beds', selectedPropertyId],
    queryFn: () =>
      api.get<any>('/beds', {
        params: {
          pageSize: 1000,
          propertyId: selectedPropertyId !== 'ALL' ? selectedPropertyId : undefined,
        },
      }).then((r) => {
        const payload = r.data as unknown;
        if (Array.isArray(payload)) return payload as Bed[];
        return (payload as { data: Bed[] })?.data ?? [];
      }),
  });

  // Room CRUD hooks
  const createRoomMut = useCreate<Room>(ENDPOINT_ROOMS, 'Room');
  const updateRoomMut = useUpdate<Room>(ENDPOINT_ROOMS, 'Room');
  const deleteRoomMut = useDelete(ENDPOINT_ROOMS, 'Room');
  const roomForm = useForm(emptyRoomForm);

  // Bed CRUD hooks
  const createBedMut = useCreate<Bed>(ENDPOINT_BEDS, 'Bed');
  const updateBedMut = useUpdate<Bed>(ENDPOINT_BEDS, 'Bed');
  const deleteBedMut = useDelete(ENDPOINT_BEDS, 'Bed');
  const bedForm = useForm(emptyBedForm);

  const [formPropId, setFormPropId] = useState<string>('');
  const [formBldId, setFormBldId] = useState<string>('');
  const [formFloorId, setFormFloorId] = useState<string>('');

  function openCreateRoom() {
    setEditingRoom(null);
    setFormPropId(selectedPropertyId && selectedPropertyId !== 'ALL' ? selectedPropertyId : '');
    setFormBldId('');
    roomForm.reset(emptyRoomForm);
    setRoomDialogOpen(true);
  }

  function handleAddRoomOnFloor(floor: Floor) {
    setEditingRoom(null);
    const bld = (buildings ?? []).find((b) => b.id === floor.buildingId);
    const pId = bld?.propertyId || (selectedPropertyId !== 'ALL' ? selectedPropertyId : '');
    setFormPropId(pId);
    setFormBldId(floor.buildingId || '');
    roomForm.reset({
      ...emptyRoomForm,
      floorId: floor.id,
    });
    setRoomDialogOpen(true);
  }

  function openEditRoom(row: Room) {
    setEditingRoom(row);
    const flr = (floors ?? []).find((f) => f.id === row.floorId);
    const bld = (buildings ?? []).find((b) => b.id === (row.buildingId || flr?.buildingId));
    const pId = row.propertyId || bld?.propertyId || '';
    setFormPropId(pId);
    setFormBldId(bld?.id || '');

    const num = row.roomNumber || row.number || '';
    const rawType = (row.type || row.sharingType || 'double').toString().toLowerCase();
    const normalizedType = rawType.includes('single') ? 'single' : rawType.includes('double') ? 'double' : rawType.includes('triple') ? 'triple' : rawType.includes('dorm') ? 'dorm' : 'double';
    
    // Parse amenities safely from array or comma-separated string
    const parsedAmenities: string[] = (() => {
      if (Array.isArray(row.amenities)) return row.amenities;
      if (typeof row.amenities === 'string' && (row.amenities as string).trim()) {
        try {
          const parsed = JSON.parse(row.amenities);
          if (Array.isArray(parsed)) return parsed;
        } catch {}
        return (row.amenities as string).split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [];
    })();

    roomForm.reset({
      number: num,
      type: normalizedType as Room['type'],
      sharing: row.sharing || (normalizedType === 'single' ? 1 : normalizedType === 'double' ? 2 : normalizedType === 'triple' ? 3 : 4),
      beds: row.beds || 2,
      occupied: row.occupied || 0,
      rent: row.rent || row.baseRent || 10000,
      status: (row.status || 'available').toLowerCase() as Room['status'],
      floorId: row.floorId || '',
      amenities: parsedAmenities,
    });
    setRoomDialogOpen(true);
  }

  function submitRoom() {
    if (!roomForm.validate({ number: (v) => !v ? 'Required' : undefined, floorId: (v) => !v ? 'Select a floor' : undefined })) return;
    const payload = {
      floorId: roomForm.values.floorId,
      roomNumber: roomForm.values.number,
      number: roomForm.values.number,
      sharingType: (roomForm.values.type as string).toUpperCase(),
      baseRent: roomForm.values.rent,
      rent: roomForm.values.rent,
      status: roomForm.values.status,
      amenities: roomForm.values.amenities ?? [],
    };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: ['matrix-rooms'] });
      queryClient.invalidateQueries({ queryKey: ['matrix-beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['beds'] });
      queryClient.invalidateQueries({ queryKey: ['rooms-floors'] });
      queryClient.invalidateQueries({ queryKey: ['rooms-buildings'] });
      setRoomDialogOpen(false);
    };
    if (editingRoom) updateRoomMut.mutate({ id: editingRoom.id, payload }, { onSuccess });
    else createRoomMut.mutate(payload, { onSuccess });
  }

  function confirmDeleteRoom() {
    if (deleteRoomTarget) {
      deleteRoomMut.mutate(deleteRoomTarget.id, {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setDeleteRoomTarget(null);
        },
      });
    }
  }

  function toggleAmenity(a: string) {
    const current = roomForm.values.amenities || [];
    roomForm.setValue('amenities', current.includes(a)
      ? current.filter((x) => x !== a)
      : [...current, a]);
  }

  function openCreateBed() {
    setEditingBed(null);
    setFormPropId(selectedPropertyId && selectedPropertyId !== 'ALL' ? selectedPropertyId : '');
    setFormBldId('');
    setFormFloorId('');
    bedForm.reset(emptyBedForm);
    setBedDialogOpen(true);
  }

  function openEditBed(row: Bed) {
    setEditingBed(row);
    const rm = matrixRooms.find((r: any) => r.id === row.roomId);
    const flr = (floors ?? []).find((f: any) => f.id === (rm?.floorId || (row as any).floorId));
    const bld = (buildings ?? []).find((b: any) => b.id === (rm?.buildingId || flr?.buildingId));
    const pId = rm?.propertyId || bld?.propertyId || '';

    setFormPropId(pId);
    setFormBldId(bld?.id || '');
    setFormFloorId(flr?.id || '');

    bedForm.reset({
      number: row.number || (row as any).bedNumber || 'B1',
      roomId: row.roomId,
      status: row.status,
      tenantId: row.tenantId ?? '',
    });
    setBedDialogOpen(true);
  }

  function submitBed() {
    if (!bedForm.validate({ roomId: (v) => !v ? 'Select a room' : undefined })) return;
    const payload = {
      roomId: bedForm.values.roomId,
      bedNumber: bedForm.values.number,
      number: bedForm.values.number,
      status: bedForm.values.status,
      tenantId: bedForm.values.status === 'occupied' ? bedForm.values.tenantId || undefined : undefined,
    };
    const onSuccess = () => {
      queryClient.invalidateQueries();
      setBedDialogOpen(false);
    };
    if (editingBed) updateBedMut.mutate({ id: editingBed.id, payload }, { onSuccess });
    else createBedMut.mutate(payload, { onSuccess });
  }

  function confirmDeleteBed() {
    if (deleteBedTarget) {
      deleteBedMut.mutate(deleteBedTarget.id, {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setDeleteBedTarget(null);
        },
      });
    }
  }

  function handleAllotBed(info: {
    bedNumber: string;
    bedId?: string;
    roomId: string;
    roomNumber: string;
    propertyId?: string;
    rent?: number;
  }) {
    setAllotTarget(info);
    setAllotModalOpen(true);
  }

  // Room Table Columns
  const roomColumns: Column<Room>[] = [
    { key: 'number', header: 'Room', sortable: true, cell: (r: any) => {
      const num = r.roomNumber || r.number || '';
      const display = formatRoomName(num);
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><DoorOpen className="h-5 w-5" /></div>
          <div><p className="font-medium">{display}</p><p className="text-xs text-muted-foreground capitalize">{r.type || r.sharingType || '—'}</p></div>
        </div>
      );
    }},
    { key: 'buildingName', header: 'Building & Property', sortable: true, cell: (r: any) => (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 font-medium text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span>{r.buildingName || 'Main Building'}</span>
        </div>
        {r.propertyName && (
          <span className="text-xs text-muted-foreground pl-5 font-normal">
            {r.propertyName}
          </span>
        )}
      </div>
    )},
    { key: 'floorId', header: 'Floor', sortable: true, cell: (r: any) => (
      <div className="flex items-center gap-1.5 text-sm">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{r.floorName || (r.floorNumber !== undefined && r.floorNumber !== null ? `Floor ${r.floorNumber}` : (floorMap.get(r.floorId) ?? '—'))}</span>
      </div>
    )},
    { key: 'sharing', header: 'Sharing', sortable: true, cell: (r) => <span className="tabular-nums">{r.sharing ?? 1} share</span> },
    { key: 'beds', header: 'Beds', sortable: true, cell: (r) => {
      const total = r.beds || r.sharing || 1;
      const occ = r.occupied ?? 0;
      const isRes = r.status === 'reserved' || r.status === 'partially_reserved';
      return (
        <div className="flex flex-col text-sm">
          <span>{occ}/{total} <span className="text-muted-foreground">occupied</span></span>
          {isRes && (
            <span className="text-[11px] font-medium text-info">
              {r.status === 'reserved' ? 'All Beds Reserved' : 'Bed Reserved'}
            </span>
          )}
        </div>
      );
    }},
    { key: 'rent', header: 'Rent', sortable: true, cell: (r) => <span className="font-medium tabular-nums">{formatCurrency(r.rent)}</span> },
    { key: 'amenities', header: 'Amenities', cell: (r: any) => (
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {(r.amenities || []).slice(0, 3).map((a: string) => <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>)}
        {(r.amenities || []).length > 3 && <Badge variant="outline" className="text-[10px]">+{r.amenities.length - 3}</Badge>}
      </div>
    )},
    { key: 'status', header: 'Status', sortable: true, cell: (r) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  // Bed Table Columns
  const bedColumns: Column<Bed>[] = [
    { key: 'number', header: 'Bed', sortable: true, cell: (r: any) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><BedDouble className="h-5 w-5" /></div>
        <span className="font-bold font-mono">{r.number || r.bedNumber}</span>
      </div>
    )},
    { key: 'roomId', header: 'Room', sortable: true, cell: (r: any) => (
      <span className="font-semibold text-sm">Room {formatRoomName(r.roomNumber)}</span>
    )},
    { key: 'buildingName', header: 'Location', sortable: true, cell: (r: any) => (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">{r.buildingName || 'Main Building'}</span>
          <span>•</span>
          <Layers className="h-3 w-3" />
          <span>{r.floorName || (r.floorNumber != null ? `Floor ${r.floorNumber}` : 'Floor')}</span>
        </div>
        {r.propertyName && (
          <span className="text-[11px] text-muted-foreground pl-5 font-normal">
            {r.propertyName}
          </span>
        )}
      </div>
    )},
    { key: 'tenantId', header: 'Tenant', sortable: true, cell: (r: any) => (r.tenantName || r.tenantId) ? (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium"><User className="h-3.5 w-3.5 text-muted-foreground" />{r.tenantName || r.tenantId}</span>
    ) : <span className="text-sm text-muted-foreground italic">Vacant</span> },
    { key: 'status', header: 'Status', sortable: true, cell: (r: any) => <StatusBadge status={r.status} tone={statusTone(r.status)} /> },
  ];

  const buildingFilterOptions = (buildings ?? []).map((b) => ({ value: b.id, label: b.name }));
  const floorFilterOptions = (floors ?? []).map((f) => ({ value: f.id, label: `${f.buildingName ? f.buildingName + ' • ' : ''}${f.name || 'Floor ' + f.floorNumber}` }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms & Space Inventory"
        description="Unified hub for visual floor layout, room cards, bed occupancy, and building structures."
        icon={DoorOpen}
        actions={
          <div className="flex items-center gap-2.5">
            {currentTab === 'matrix' || currentTab === 'rooms' ? (
              <Button onClick={openCreateRoom} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Add Room
              </Button>
            ) : currentTab === 'beds' ? (
              <Button onClick={openCreateBed} className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Add Bed
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Top Workspace Tab Switcher */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-5">
        <div className="border-b pb-1">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto max-w-2xl bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="matrix" className="gap-1.5 text-xs font-semibold">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Visual Floor Matrix</span>
            </TabsTrigger>
            <TabsTrigger value="rooms" className="gap-1.5 text-xs font-semibold">
              <DoorOpen className="h-3.5 w-3.5" />
              <span>Rooms List</span>
            </TabsTrigger>
            <TabsTrigger value="beds" className="gap-1.5 text-xs font-semibold">
              <BedDouble className="h-3.5 w-3.5" />
              <span>Beds Inventory</span>
            </TabsTrigger>
            <TabsTrigger value="structure" className="gap-1.5 text-xs font-semibold">
              <Building2 className="h-3.5 w-3.5" />
              <span>Buildings & Floors</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Visual Floor Matrix */}
        <TabsContent value="matrix" className="space-y-5 mt-0">
          {/* Top Visual Control & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card rounded-xl border p-3.5 shadow-xs">
            {/* Search Bar */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Room #, Bed #, or Tenant name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Quick Filter Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setVacancyFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  vacancyFilter === 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 hover:bg-muted text-muted-foreground'
                }`}
              >
                All Rooms
              </button>
              <button
                type="button"
                onClick={() => setVacancyFilter('vacant')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  vacancyFilter === 'vacant'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Vacancies Only
              </button>
              <button
                type="button"
                onClick={() => setVacancyFilter('occupied')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  vacancyFilter === 'occupied'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Occupied
              </button>
              <button
                type="button"
                onClick={() => setVacancyFilter('maintenance')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  vacancyFilter === 'maintenance'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-orange-500/10 text-orange-700 dark:text-orange-400 hover:bg-orange-500/20'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                Maintenance
              </button>
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2">
              {buildings && buildings.length > 1 && (
                <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                  <SelectTrigger className="h-9 text-xs w-[140px]">
                    <SelectValue placeholder="All Buildings" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buildings</SelectItem>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 text-xs w-[120px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="double">Double</SelectItem>
                  <SelectItem value="triple">Triple</SelectItem>
                  <SelectItem value="dorm">Dorm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Matrix Floor Grid */}
          <RoomBedMatrix
            rooms={matrixRooms}
            beds={matrixBeds}
            floors={floors ?? []}
            buildings={buildings ?? []}
            properties={properties ?? []}
            searchQuery={searchQuery}
            vacancyFilter={vacancyFilter}
            typeFilter={filterType}
            buildingFilter={filterBuildingId}
            floorFilter={filterFloorId}
            onEditRoom={openEditRoom}
            onDeleteRoom={(r) => setDeleteRoomTarget(r)}
            onAddRoomOnFloor={handleAddRoomOnFloor}
            onAllotBed={handleAllotBed}
          />
        </TabsContent>

        {/* Tab 2: Rooms List Table */}
        <TabsContent value="rooms" className="mt-0">
          <DataTable
            endpoint={ENDPOINT_ROOMS}
            columns={roomColumns}
            searchPlaceholder="Search rooms, buildings, floors..."
            exportFilename="rooms"
            initialSortBy="number"
            emptyAction={{ label: 'Add First Room', onClick: openCreateRoom, icon: Plus }}
            emptyDescription="No rooms added yet. Create your first room to start allocating beds."
            filters={[
              { key: 'status', label: 'Status', options: roomStatuses },
              { key: 'type', label: 'Type', options: roomTypes },
              ...(buildingFilterOptions.length > 0 ? [{ key: 'buildingId', label: 'Building', options: buildingFilterOptions }] : []),
              ...(floorFilterOptions.length > 0 ? [{ key: 'floorId', label: 'Floor', options: floorFilterOptions }] : []),
            ]}
            rowActions={(row) => (
              <RowActions
                items={[
                  { label: 'Edit Room', icon: Pencil, onSelect: () => openEditRoom(row) },
                  { label: 'Delete Room', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteRoomTarget(row) },
                ]}
              />
            )}
          />
        </TabsContent>

        {/* Tab 3: Beds Inventory Table */}
        <TabsContent value="beds" className="mt-0">
          <DataTable
            endpoint={ENDPOINT_BEDS}
            columns={bedColumns}
            searchPlaceholder="Search beds, rooms, tenants..."
            exportFilename="beds"
            initialSortBy="number"
            emptyAction={{ label: 'Add First Bed', onClick: openCreateBed, icon: Plus }}
            emptyDescription="No beds configured yet."
            filters={[
              { key: 'status', label: 'Status', options: bedStatuses },
            ]}
            rowActions={(row) => (
              <RowActions
                items={[
                  { label: 'Edit Bed', icon: Pencil, onSelect: () => openEditBed(row) },
                  { label: 'Delete Bed', icon: Trash2, variant: 'destructive', onSelect: () => setDeleteBedTarget(row) },
                ]}
              />
            )}
          />
        </TabsContent>

        {/* Tab 4: Buildings & Floors Structure Management */}
        <TabsContent value="structure" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Buildings Section */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Buildings & Towers</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window.location.href = '/buildings')}>
                  Manage Buildings
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {(buildings ?? []).length} buildings registered for this property.
              </p>
              <div className="space-y-2">
                {(buildings ?? []).map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900/50 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{b.name}</p>
                      <p className="text-[10px] text-muted-foreground">{b.code || 'Tower'} • {b.propertyName || 'Property'}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1 text-primary hover:text-primary"
                      onClick={() => setBatchGenBuilding(b)}
                    >
                      <Sparkles className="h-3 w-3" />
                      Batch Space Generator
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Floors Section */}
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Floors & Levels</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => (window.location.href = '/floors')}>
                  Manage Floors
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {(floors ?? []).length} floors configured.
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {(floors ?? []).map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900/50 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{f.name || `Floor ${f.floorNumber}`}</p>
                      <p className="text-[10px] text-muted-foreground">{f.buildingName || 'Building'} • Level {f.floorNumber || 1}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] gap-1"
                      onClick={() => handleAddRoomOnFloor(f)}
                    >
                      <Plus className="h-3 w-3" />
                      Add Room Here
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Room Modal */}
      <FormDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        title={editingRoom ? 'Edit Room' : 'Add Room'}
        onSubmit={submitRoom}
        loading={createRoomMut.isPending || updateRoomMut.isPending}
        submitLabel={editingRoom ? 'Save' : 'Create'}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>1. Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: any) => ({
                value: p.id,
                label: p.name,
                sublabel: p.address || p.city || 'Property',
              }))}
              value={formPropId}
              onChange={(val) => {
                setFormPropId(val);
                setFormBldId('');
                roomForm.setValue('floorId', '');
              }}
              placeholder="Choose Property..."
              searchPlaceholder="Search properties..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>2. Building</Label>
            <SearchableSelect
              options={(buildings ?? [])
                .filter((b) => !formPropId || b.propertyId === formPropId)
                .map((b) => ({
                  value: b.id,
                  label: b.name,
                  sublabel: `${b.propertyName || propMap.get(b.propertyId) || 'Property'} • ${b.code || 'Building'}`,
                }))}
              value={formBldId}
              onChange={(val) => {
                setFormBldId(val);
                roomForm.setValue('floorId', '');
                const matchedBld = (buildings ?? []).find((b) => b.id === val);
                if (matchedBld && matchedBld.propertyId && !formPropId) {
                  setFormPropId(matchedBld.propertyId);
                }
              }}
              placeholder={formPropId ? "Select building in property..." : "Select building..."}
              searchPlaceholder="Search buildings..."
            />
          </div>

          <div className="space-y-1.5">
            <Label required>3. Floor</Label>
            <SearchableSelect
              options={(floors ?? [])
                .filter((f) => !formBldId || f.buildingId === formBldId)
                .map((f) => ({
                  value: f.id,
                  label: f.name || `Floor ${f.floorNumber || 1}`,
                  sublabel: `${f.buildingName || 'Building'} • Level ${f.floorNumber || 1}`,
                }))}
              value={roomForm.values.floorId}
              onChange={(v) => {
                roomForm.setValue('floorId', v);
                const matchedFloor = (floors ?? []).find((f) => f.id === v);
                if (matchedFloor) {
                  if (matchedFloor.buildingId && !formBldId) {
                    setFormBldId(matchedFloor.buildingId);
                  }
                  const bld = (buildings ?? []).find((b) => b.id === matchedFloor.buildingId);
                  if (bld && bld.propertyId && !formPropId) {
                    setFormPropId(bld.propertyId);
                  }
                }
              }}
              placeholder={formBldId ? "Select floor in building..." : "Select floor..."}
              searchPlaceholder="Search floors..."
            />
            {roomForm.errors.floorId && <p className="text-xs text-destructive">{roomForm.errors.floorId}</p>}
          </div>

          <FormInput
            label="4. Room Number"
            required
            id="number"
            value={roomForm.values.number}
            onChange={(e) => roomForm.setValue('number', e.target.value)}
            error={roomForm.errors.number}
            placeholder="e.g. 101, 202, Room A"
          />
          <div className="space-y-1.5">
            <Label>Room Type</Label>
            <Select
              value={roomForm.values.type}
              onValueChange={(v) => {
                roomForm.setValue('type', v as Room['type']);
                const share = v === 'single' ? 1 : v === 'double' ? 2 : v === 'triple' ? 3 : 4;
                roomForm.setValue('sharing', share);
                roomForm.setValue('beds', share);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roomTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FormInput
            label="Monthly Rent (₹)"
            type="number"
            id="rent"
            value={String(roomForm.values.rent)}
            onChange={(e) => roomForm.setValue('rent', Number(e.target.value))}
          />
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={roomForm.values.status}
              onValueChange={(v) => roomForm.setValue('status', v as Room['status'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roomStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FormInput
            label="Occupied Beds"
            type="number"
            id="occupied"
            value={String(roomForm.values.occupied)}
            onChange={(e) => roomForm.setValue('occupied', Number(e.target.value))}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Amenities</Label>
            <div className="flex flex-wrap gap-2 rounded-lg border p-3">
              {allAmenities.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    (roomForm.values.amenities || []).includes(a)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FormDialog>

      {/* Add / Edit Bed Modal */}
      <FormDialog
        open={bedDialogOpen}
        onOpenChange={setBedDialogOpen}
        title={editingBed ? 'Edit Bed' : 'Add Bed'}
        onSubmit={submitBed}
        loading={createBedMut.isPending || updateBedMut.isPending}
        submitLabel={editingBed ? 'Save' : 'Create'}
        size="lg"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>1. Property</Label>
            <SearchableSelect
              options={(properties ?? []).map((p: any) => ({
                value: p.id,
                label: p.name,
                sublabel: p.address || p.city || 'Property',
              }))}
              value={formPropId}
              onChange={(val) => {
                setFormPropId(val);
                setFormBldId('');
                setFormFloorId('');
                bedForm.setValue('roomId', '');
              }}
              placeholder="Choose Property..."
              searchPlaceholder="Search properties..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>2. Building</Label>
            <SearchableSelect
              options={(buildings ?? [])
                .filter((b) => !formPropId || b.propertyId === formPropId)
                .map((b) => ({
                  value: b.id,
                  label: b.name,
                  sublabel: `${b.propertyName || propMap.get(b.propertyId) || 'Property'} • ${b.code || 'Building'}`,
                }))}
              value={formBldId}
              onChange={(val) => {
                setFormBldId(val);
                setFormFloorId('');
                bedForm.setValue('roomId', '');
              }}
              placeholder={formPropId ? "Select building in property..." : "Select building..."}
              searchPlaceholder="Search buildings..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>3. Floor</Label>
            <SearchableSelect
              options={(floors ?? [])
                .filter((f) => !formBldId || f.buildingId === formBldId)
                .map((f) => ({
                  value: f.id,
                  label: f.name || `Floor ${f.floorNumber || 1}`,
                  sublabel: `${f.buildingName || 'Building'} • Level ${f.floorNumber || 1}`,
                }))}
              value={formFloorId}
              onChange={(val) => {
                setFormFloorId(val);
                bedForm.setValue('roomId', '');
              }}
              placeholder={formBldId ? "Select floor in building..." : "Select floor..."}
              searchPlaceholder="Search floors..."
            />
          </div>

          <div className="space-y-1.5">
            <Label required>4. Room</Label>
            <SearchableSelect
              options={matrixRooms
                .filter((r: any) => !formFloorId || r.floorId === formFloorId)
                .map((r: any) => ({
                  value: r.id,
                  label: `Room ${formatRoomName(r.roomNumber || r.number)}`,
                  sublabel: `${r.buildingName || 'Building'} • ${r.sharing || 2} Share`,
                }))}
              value={bedForm.values.roomId}
              onChange={(v) => bedForm.setValue('roomId', v)}
              placeholder="Select room..."
              searchPlaceholder="Search rooms..."
            />
            {bedForm.errors.roomId && <p className="text-xs text-destructive">{bedForm.errors.roomId}</p>}
          </div>

          <FormInput
            label="Bed Number / Label"
            required
            id="number"
            value={bedForm.values.number}
            onChange={(e) => bedForm.setValue('number', e.target.value)}
            placeholder="e.g. B1, B2, Bed A"
          />

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={bedForm.values.status}
              onValueChange={(v) => bedForm.setValue('status', v as Bed['status'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {bedStatuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      {/* Delete Room Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteRoomTarget}
        onOpenChange={(o) => !o && setDeleteRoomTarget(null)}
        title="Delete Room"
        variant="destructive"
        description={`Delete Room ${deleteRoomTarget?.number || deleteRoomTarget?.roomNumber}? This will remove all associated bed allocations.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteRoom}
        loading={deleteRoomMut.isPending}
      />

      {/* Delete Bed Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteBedTarget}
        onOpenChange={(o) => !o && setDeleteBedTarget(null)}
        title="Delete Bed"
        variant="destructive"
        description={`Delete Bed ${deleteBedTarget?.number || (deleteBedTarget as any)?.bedNumber}?`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteBed}
        loading={deleteBedMut.isPending}
      />

      {/* Batch Space Generator Modal */}
      {batchGenBuilding && (
        <BatchSpaceGeneratorDialog
          open={!!batchGenBuilding}
          onOpenChange={(o) => !o && setBatchGenBuilding(null)}
          propertyId={batchGenBuilding.propertyId}
          buildingId={batchGenBuilding.id}
          buildingName={batchGenBuilding.name}
        />
      )}

      {/* Quick Allot Tenant Modal */}
      {allotModalOpen && (
        <QuickAddTenantModal
          open={allotModalOpen}
          onOpenChange={(o) => {
            setAllotModalOpen(o);
            if (!o) setAllotTarget(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries();
            toast({ title: 'Tenant Allotted', description: `Tenant successfully allotted to Bed ${allotTarget?.bedNumber}!` });
          }}
          properties={properties ?? []}
          rooms={matrixRooms}
          beds={matrixBeds}
          initialPropertyId={allotTarget?.propertyId}
          initialRoomId={allotTarget?.roomId}
          initialRoomNumber={allotTarget?.roomNumber}
          initialBedNumber={allotTarget?.bedNumber}
          initialRent={allotTarget?.rent}
        />
      )}
    </div>
  );
}
