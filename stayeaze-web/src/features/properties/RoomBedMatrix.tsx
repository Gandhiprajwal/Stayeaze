import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  User,
  Phone,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  MoreVertical,
  Wind,
  Wifi,
  ShowerHead,
  Tv,
  Flame,
  Sun,
  Utensils,
  Zap,
  BedDouble,
  ArrowLeftRight,
  LogOut,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatCurrency, formatRoomName } from '@/lib/format';
import type { Room, Bed, Floor, Building } from '@/lib/types';

interface RoomBedMatrixProps {
  rooms: Room[];
  beds: Bed[];
  floors: Floor[];
  buildings: Building[];
  properties: any[];
  searchQuery?: string;
  vacancyFilter?: 'all' | 'vacant' | 'occupied' | 'maintenance';
  typeFilter?: string;
  buildingFilter?: string;
  floorFilter?: string;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onAddRoomOnFloor: (floor: Floor) => void;
  onAllotBed: (bedInfo: { bedNumber: string; bedId?: string; roomId: string; roomNumber: string; propertyId?: string; rent?: number }) => void;
}

export function RoomBedMatrix({
  rooms,
  beds,
  floors,
  buildings,
  properties,
  searchQuery = '',
  vacancyFilter = 'all',
  typeFilter = 'all',
  buildingFilter = 'all',
  floorFilter = 'all',
  onEditRoom,
  onDeleteRoom,
  onAddRoomOnFloor,
  onAllotBed,
}: RoomBedMatrixProps) {
  const navigate = useNavigate();
  const [collapsedFloors, setCollapsedFloors] = useState<Record<string, boolean>>({});

  const toggleFloor = (floorKey: string) => {
    setCollapsedFloors((prev) => ({ ...prev, [floorKey]: !prev[floorKey] }));
  };

  // Map floorId -> Floor object
  const floorMap = useMemo(() => new Map(floors.map((f) => [f.id, f])), [floors]);
  // Map buildingId -> Building object
  const buildingMap = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  // Group beds by roomId
  const bedsByRoomId = useMemo(() => {
    const map = new Map<string, Bed[]>();
    for (const b of beds) {
      if (!b.roomId) continue;
      const list = map.get(b.roomId) || [];
      list.push(b);
      map.set(b.roomId, list);
    }
    return map;
  }, [beds]);

  // Group rooms by Floor (or Building + Floor)
  const floorGroups = useMemo(() => {
    // 1. Filter rooms according to search & filter options
    const filteredRooms = rooms.filter((r) => {
      // Building filter
      if (buildingFilter && buildingFilter !== 'all') {
        const bldId = r.buildingId || (r.floorId ? floorMap.get(r.floorId)?.buildingId : '');
        if (bldId !== buildingFilter) return false;
      }

      // Floor filter
      if (floorFilter && floorFilter !== 'all' && r.floorId !== floorFilter) {
        return false;
      }

      // Room Type filter
      if (typeFilter && typeFilter !== 'all') {
        const rawType = (r.type || r.sharingType || '').toLowerCase();
        if (!rawType.includes(typeFilter.toLowerCase())) return false;
      }

      const roomBeds = bedsByRoomId.get(r.id) || [];
      const totalCapacity = r.sharing || r.beds || Math.max(roomBeds.length, 1);
      const occupiedBedsCount = roomBeds.filter((b) => b.status === 'occupied').length;
      const hasVacancy = occupiedBedsCount < totalCapacity;

      // Vacancy / Status Filter
      if (vacancyFilter === 'vacant' && !hasVacancy) return false;
      if (vacancyFilter === 'occupied' && occupiedBedsCount === 0) return false;
      if (vacancyFilter === 'maintenance' && r.status !== 'maintenance') return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (r.roomNumber || r.number || '').toLowerCase();
        const bld = (r.buildingName || '').toLowerCase();
        const flrObj = r.floorId ? floorMap.get(r.floorId) : undefined;
        const flr = (flrObj?.name || (r as any).floorName || '').toLowerCase();
        const matchRoom = num.includes(q) || bld.includes(q) || flr.includes(q);
        const matchBed = roomBeds.some((b) =>
          (b.number || b.bedNumber || '').toLowerCase().includes(q) ||
          (b.tenantName || '').toLowerCase().includes(q)
        );
        if (!matchRoom && !matchBed) return false;
      }

      return true;
    });

    // 2. Group into floor buckets
    const groupsMap = new Map<string, {
      floorId: string;
      floorName: string;
      floorNumber?: number;
      buildingId?: string;
      buildingName: string;
      propertyName?: string;
      floorObj?: Floor;
      rooms: Room[];
    }>();

    for (const r of filteredRooms) {
      const flr = r.floorId ? floorMap.get(r.floorId) : undefined;
      const bld = (flr?.buildingId ? buildingMap.get(flr.buildingId) : undefined) || (r.buildingId ? buildingMap.get(r.buildingId) : undefined);

      const floorKey = r.floorId || 'unknown-floor';
      if (!groupsMap.has(floorKey)) {
        const bldName = r.buildingName || bld?.name || 'Main Building';
        const flrName = flr?.name || (r as any).floorName || (r.floorNumber != null ? `Floor ${r.floorNumber}` : 'Unassigned Floor');
        groupsMap.set(floorKey, {
          floorId: floorKey,
          floorName: flrName,
          floorNumber: r.floorNumber ?? flr?.floorNumber,
          buildingId: bld?.id || r.buildingId,
          buildingName: bldName,
          propertyName: r.propertyName || bld?.propertyName,
          floorObj: flr,
          rooms: [],
        });
      }
      groupsMap.get(floorKey)!.rooms.push(r);
    }

    // Sort rooms within each floor by room number
    const list = Array.from(groupsMap.values()).map((g) => {
      g.rooms.sort((a, b) => {
        const numA = a.roomNumber || a.number || '';
        const numB = b.roomNumber || b.number || '';
        return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' });
      });
      return g;
    });

    // Sort floor groups by building name then floor number
    list.sort((a, b) => {
      if (a.buildingName !== b.buildingName) {
        return a.buildingName.localeCompare(b.buildingName);
      }
      return (a.floorNumber ?? 0) - (b.floorNumber ?? 0);
    });

    return list;
  }, [rooms, bedsByRoomId, floorMap, buildingMap, searchQuery, vacancyFilter, typeFilter, buildingFilter, floorFilter]);

  if (floorGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-card">
        <DoorOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <h3 className="text-base font-semibold text-foreground">No Rooms Match Your Criteria</h3>
        <p className="text-sm text-muted-foreground max-w-md mt-1">
          Try adjusting your search terms, clearing the vacancy filter, or switching building/floor selections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {floorGroups.map((group) => {
        const isCollapsed = !!collapsedFloors[group.floorId];

        // Aggregate Floor Metrics
        let floorTotalBeds = 0;
        let floorOccupiedBeds = 0;
        let floorVacantBeds = 0;
        let floorReservedBeds = 0;
        let floorMaintenanceBeds = 0;

        group.rooms.forEach((r) => {
          const roomBeds = bedsByRoomId.get(r.id) || [];
          const capacity = r.sharing || r.beds || Math.max(roomBeds.length, 1);
          floorTotalBeds += capacity;

          let roomOcc = 0;
          let roomRes = 0;
          let roomMaint = 0;

          roomBeds.forEach((b) => {
            const st = (b.status || 'available').toLowerCase();
            if (st === 'occupied') roomOcc++;
            else if (st === 'reserved') roomRes++;
            else if (st === 'maintenance') roomMaint++;
          });

          floorOccupiedBeds += roomOcc;
          floorReservedBeds += roomRes;
          floorMaintenanceBeds += roomMaint;
          floorVacantBeds += Math.max(0, capacity - roomOcc - roomRes - roomMaint);
        });

        const floorOccupancyPct = floorTotalBeds > 0
          ? ((floorOccupiedBeds / floorTotalBeds) * 100).toFixed(1)
          : '0.0';

        return (
          <div
            key={group.floorId}
            className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/60 dark:bg-slate-900/40 p-4 sm:p-5 shadow-sm transition-all"
          >
            {/* Floor Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-start sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleFloor(group.floorId)}
                  className="mt-0.5 sm:mt-0 flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                  title={isCollapsed ? 'Expand Floor' : 'Collapse Floor'}
                >
                  {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                      {group.buildingName} — {group.floorName}
                    </span>
                    {group.propertyName && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({group.propertyName})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    {group.rooms.length} {group.rooms.length === 1 ? 'Room' : 'Rooms'} • {floorTotalBeds} Total Beds • {floorOccupiedBeds} Occupied ({floorOccupancyPct}%)
                  </p>
                </div>
              </div>

              {/* Status Pills Legend & Actions */}
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Occupied ({floorOccupiedBeds})
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Vacant ({floorVacantBeds})
                  </span>
                  {floorReservedBeds > 0 && (
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Reserved ({floorReservedBeds})
                    </span>
                  )}
                  {floorMaintenanceBeds > 0 && (
                    <span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      Maint ({floorMaintenanceBeds})
                    </span>
                  )}
                </div>

                {group.floorObj && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2.5 gap-1 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => onAddRoomOnFloor(group.floorObj!)}
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">Add Room</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Room Cards Grid */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3.5 pt-4">
                {group.rooms.map((room) => {
                  const roomBeds = bedsByRoomId.get(room.id) || [];
                  const capacity = room.sharing || room.beds || Math.max(roomBeds.length, 1);

                  // 1. Take all existing beds from roomBeds
                  const bedSlots: {
                    bedNumber: string;
                    bed?: Bed;
                    status: string;
                    tenantName?: string;
                    tenantId?: string;
                    tenantMobile?: string;
                  }[] = [];

                  roomBeds.forEach((b, idx) => {
                    const rawStatus = (b.status || 'available').toLowerCase();
                    const hasTenant = Boolean(b.tenantId || b.tenantName);
                    const isOccupied = hasTenant || rawStatus === 'occupied';
                    const isReserved = !isOccupied && rawStatus === 'reserved';
                    const isMaint = !isOccupied && rawStatus === 'maintenance';

                    bedSlots.push({
                      bedNumber: b.number || b.bedNumber || `B${idx + 1}`,
                      bed: b,
                      status: isOccupied ? 'occupied' : isReserved ? 'reserved' : isMaint ? 'maintenance' : 'available',
                      tenantName: b.tenantName,
                      tenantId: b.tenantId,
                      tenantMobile: b.tenantMobile,
                    });
                  });

                  // 2. Fill remainder with virtual vacant slots if capacity > roomBeds.length
                  if (bedSlots.length < capacity) {
                    for (let i = bedSlots.length + 1; i <= capacity; i++) {
                      bedSlots.push({
                        bedNumber: `B${i}`,
                        status: 'available',
                      });
                    }
                  }

                  const hasVacantBed = bedSlots.some((s) => s.status === 'available' || s.status === 'vacant');
                  const isMaintenance = (room.status || '').toLowerCase() === 'maintenance';

                  // Parse amenities safely from array or comma-separated string
                  const rawAmenities: string[] = (() => {
                    if (Array.isArray(room.amenities)) return room.amenities;
                    if (typeof room.amenities === 'string' && (room.amenities as string).trim()) {
                      try {
                        const parsed = JSON.parse(room.amenities);
                        if (Array.isArray(parsed)) return parsed;
                      } catch {}
                      return (room.amenities as string).split(',').map((s) => s.trim()).filter(Boolean);
                    }
                    return [];
                  })();

                  const hasAc = rawAmenities.some((a) => /ac|air/i.test(a));
                  const hasWifi = rawAmenities.some((a) => /wifi|internet/i.test(a));
                  const hasBath = rawAmenities.some((a) => /bath|attached/i.test(a));
                  const hasGeyser = rawAmenities.some((a) => /geyser|water/i.test(a));
                  const hasTv = rawAmenities.some((a) => /tv|television/i.test(a));
                  const hasBalcony = rawAmenities.some((a) => /balcony/i.test(a));
                  const hasFood = rawAmenities.some((a) => /food|mess|meal/i.test(a));
                  const hasPower = rawAmenities.some((a) => /power|backup/i.test(a));

                  // Normalized Room Type Label (e.g., 'Triple AC', 'Double Non-AC')
                  const rawType = (room.type || room.sharingType || 'double').toString();
                  const cleanType = rawType.replace(/_/g, ' ').replace(/sharing/gi, '').trim();
                  const roomTypeLabel = `${cleanType.charAt(0).toUpperCase() + cleanType.slice(1)}${hasAc ? ' AC' : ''}`;

                  const roomNumberDisplay = formatRoomName(room.roomNumber || room.number);
                  const roomRent = room.rent || room.baseRent;

                  return (
                    <div
                      key={room.id}
                      className={`group relative rounded-xl border p-3.5 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between ${
                        isMaintenance
                          ? 'border-orange-300 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20'
                          : hasVacantBed
                          ? 'border-blue-300/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-400'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90'
                      }`}
                    >
                      <div>
                        {/* Room Card Top Bar */}
                        <div className="flex items-center justify-between gap-1 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                              {roomNumberDisplay}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-semibold px-2 py-0 h-5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize"
                            >
                              {roomTypeLabel}
                            </Badge>

                            {/* Dropdown Menu for Room Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-70 group-hover:opacity-100"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-36 text-xs">
                                <DropdownMenuItem onClick={() => onEditRoom(room)} className="gap-2 cursor-pointer">
                                  <Pencil className="h-3.5 w-3.5" /> Edit Room
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDeleteRoom(room)}
                                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete Room
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Room Rent & Quick Amenities */}
                        <div className="flex items-center justify-between pt-1.5 pb-2 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {roomRent ? formatCurrency(roomRent) : '—'}<span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                          </span>

                          <div className="flex items-center gap-1.5 text-slate-400">
                            {hasAc && (
                              <span title="Air Conditioned">
                                <Wind className="h-3 w-3 text-cyan-500" />
                              </span>
                            )}
                            {hasWifi && (
                              <span title="High-Speed Wi-Fi">
                                <Wifi className="h-3 w-3 text-indigo-500" />
                              </span>
                            )}
                            {hasBath && (
                              <span title="Attached Bathroom">
                                <ShowerHead className="h-3 w-3 text-emerald-500" />
                              </span>
                            )}
                            {hasGeyser && (
                              <span title="Water Geyser">
                                <Flame className="h-3 w-3 text-amber-500" />
                              </span>
                            )}
                            {hasTv && (
                              <span title="Television (TV)">
                                <Tv className="h-3 w-3 text-purple-500" />
                              </span>
                            )}
                            {hasBalcony && (
                              <span title="Balcony">
                                <Sun className="h-3 w-3 text-yellow-500" />
                              </span>
                            )}
                            {hasFood && (
                              <span title="Food & Mess Included">
                                <Utensils className="h-3 w-3 text-orange-500" />
                              </span>
                            )}
                            {hasPower && (
                              <span title="Power Backup">
                                <Zap className="h-3 w-3 text-blue-500" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bed Slots List */}
                        <div className="space-y-1.5 pt-0.5">
                          {bedSlots.map((slot, sIdx) => {
                            const isVacant = slot.status === 'available' || slot.status === 'vacant';
                            const isOccupied = slot.status === 'occupied';
                            const isReserved = slot.status === 'reserved';
                            const isMaint = slot.status === 'maintenance';

                            if (isOccupied) {
                              return (
                                <Popover key={sIdx}>
                                  <PopoverTrigger asChild>
                                    <div
                                      className="group/bed text-[11px] px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between bg-slate-100/90 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="font-bold text-slate-900 dark:text-white font-mono text-[10px] bg-slate-200/80 dark:bg-slate-700/80 px-1 py-0.5 rounded">
                                          {slot.bedNumber}
                                        </span>
                                        <span className="truncate font-medium">
                                          {slot.tenantName || 'Occupied'}
                                        </span>
                                      </div>
                                      <User className="h-3 w-3 text-slate-400 group-hover/bed:text-primary transition-colors flex-shrink-0" />
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent side="top" className="w-64 p-3.5 space-y-3">
                                    <div className="flex items-center gap-2 pb-2 border-b">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <User className="h-4 w-4" />
                                      </div>
                                      <div className="truncate">
                                        <h4 className="text-xs font-bold text-foreground truncate">{slot.tenantName || 'Tenant'}</h4>
                                        <p className="text-[10px] text-muted-foreground">Room {roomNumberDisplay} • Bed {slot.bedNumber}</p>
                                      </div>
                                    </div>
                                    {slot.tenantMobile && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Phone className="h-3.5 w-3.5 text-primary" />
                                        <span>{slot.tenantMobile}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="h-7 text-xs flex-1 gap-1"
                                        onClick={() => navigate('/tenants')}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        View Tenants
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            }

                            if (isVacant) {
                              return (
                                <div
                                  key={sIdx}
                                  className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 shadow-xs"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold font-mono text-[10px] bg-blue-500/20 px-1 py-0.5 rounded text-blue-800 dark:text-blue-200">
                                      {slot.bedNumber}
                                    </span>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                      VACANT
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onAllotBed({
                                        bedNumber: slot.bedNumber,
                                        bedId: slot.bed?.id,
                                        roomId: room.id,
                                        roomNumber: roomNumberDisplay,
                                        propertyId: room.propertyId,
                                        rent: roomRent ? Number(roomRent) : undefined,
                                      })
                                    }
                                    className="text-[9px] font-extrabold uppercase bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                  >
                                    ALLOT
                                  </button>
                                </div>
                              );
                            }

                            if (isReserved) {
                              return (
                                <div
                                  key={sIdx}
                                  className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-bold font-mono text-[10px] bg-amber-500/20 px-1 py-0.5 rounded">
                                      {slot.bedNumber}
                                    </span>
                                    <span className="font-semibold text-amber-700 dark:text-amber-300">
                                      RESERVED
                                    </span>
                                  </div>
                                  <Sparkles className="h-3 w-3 text-amber-500" />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={sIdx}
                                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium flex items-center justify-between bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold font-mono text-[10px] bg-orange-500/20 px-1 py-0.5 rounded">
                                    {slot.bedNumber}
                                  </span>
                                  <span className="font-semibold">MAINTENANCE</span>
                                </div>
                                <Wrench className="h-3 w-3 text-orange-500" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
