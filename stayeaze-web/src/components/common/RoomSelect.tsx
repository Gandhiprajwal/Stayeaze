import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Home, Bed as BedIcon, Check, X, Building2, Layers, CheckCircle2, User, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Room, Bed } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface RoomSelectProps {
  rooms: Room[];
  beds?: Bed[];
  selectedRoomNumber?: string;
  selectedBedNumber?: string;
  onSelectRoom: (roomNumber: string, roomId?: string, rent?: number) => void;
  onSelectBed: (bedNumber: string) => void;
  existingTenants?: any[];
  currentTenantId?: string;
  disabled?: boolean;
  className?: string;
}

export function RoomSelect({
  rooms = [],
  beds = [],
  selectedRoomNumber,
  selectedBedNumber,
  onSelectRoom,
  onSelectBed,
  existingTenants = [],
  currentTenantId,
  disabled = false,
  className,
}: RoomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected Room Object
  const selectedRoom = useMemo(() => {
    if (!selectedRoomNumber) return undefined;
    const targetStr = String(selectedRoomNumber).trim().toLowerCase();
    return rooms.find(
      (r) =>
        (r.roomNumber && String(r.roomNumber).trim().toLowerCase() === targetStr) ||
        (r.number && String(r.number).trim().toLowerCase() === targetStr) ||
        (r.id && String(r.id) === String(selectedRoomNumber))
    );
  }, [rooms, selectedRoomNumber]);

  // Compute vacancy & occupancy stats for each room
  const roomStatsMap = useMemo(() => {
    const map = new Map<string, { totalBeds: number; occupiedBeds: number; availableBeds: number; isAvailable: boolean }>();

    for (const r of rooms) {
      const rNum = String(r.roomNumber || r.number || r.id || '');
      const capacity = Number(r.capacity || r.beds || (r as any).totalBeds || (r as any).sharing || 1);

      // Count active occupants in this room
      const occupants = (existingTenants || []).filter((t: any) => {
        const isCurrent = currentTenantId && t.id === currentTenantId;
        const status = String(t.status || '').toLowerCase();
        const isCheckedOut = status === 'checked_out' || status === 'archived';
        const inThisRoom = (t.roomNumber && String(t.roomNumber) === rNum) || (t.roomId && t.roomId === r.id);
        return inThisRoom && !isCheckedOut && !isCurrent;
      });

      const occupiedCount = occupants.length;
      const availableCount = Math.max(0, capacity - occupiedCount);

      map.set(r.id, {
        totalBeds: capacity,
        occupiedBeds: occupiedCount,
        availableBeds: availableCount,
        isAvailable: availableCount > 0,
      });
    }
    return map;
  }, [rooms, existingTenants, currentTenantId]);

  // Filtered rooms with building & floor awareness
  const filteredRooms = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rooms.filter((r) => {
      const rNum = String(r.roomNumber || r.number || '').toLowerCase();
      const bldg = String((r as any).buildingName || (r as any).building || '').toLowerCase();
      const floor = String((r as any).floorName || ((r as any).floorNumber != null ? `Floor ${(r as any).floorNumber}` : '')).toLowerCase();
      const type = String(r.type || r.sharingType || '').toLowerCase();

      const matchesSearch = !q || rNum.includes(q) || bldg.includes(q) || floor.includes(q) || type.includes(q);
      const stats = roomStatsMap.get(r.id);
      const matchesAvailable = !onlyAvailable || (stats && stats.isAvailable);

      return matchesSearch && matchesAvailable;
    });
  }, [rooms, search, onlyAvailable, roomStatsMap]);

  // Group rooms hierarchically by [Property Name › Building Name • Floor Name]
  const groupedRooms = useMemo(() => {
    const groups: Record<string, { propertyName?: string; buildingName: string; floorName: string; rooms: Room[] }> = {};
    
    for (const r of filteredRooms) {
      const propName = (r as any).propertyName || '';
      const bldgName = (r as any).buildingName || 'Main Building';
      const floorName = (r as any).floorName || ((r as any).floorNumber != null ? `Floor ${(r as any).floorNumber}` : 'Main Floor');
      const groupKey = `${propName} __ ${bldgName} __ ${floorName}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          propertyName: propName,
          buildingName: bldgName,
          floorName: floorName,
          rooms: []
        };
      }
      groups[groupKey].rooms.push(r);
    }
    return groups;
  }, [filteredRooms]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  // Calculate bed occupancy for the selected room
  const bedList = useMemo(() => {
    if (!selectedRoom) return [];
    if (beds && beds.length > 0) {
      return beds.map((b) => {
        const bNum = b.bedNumber || (b as any).number || 'Bed';
        const occupant = (existingTenants || []).find((t: any) => {
          const isCurrent = currentTenantId && t.id === currentTenantId;
          const status = (t.status || '').toLowerCase();
          const isCheckedOut = status === 'checked_out' || status === 'archived';
          const rMatch =
            (t.roomNumber && t.roomNumber === (selectedRoom.roomNumber || selectedRoom.number)) ||
            (t.roomId && t.roomId === selectedRoom.id);
          const bMatch = t.bedNumber && t.bedNumber === bNum;
          return rMatch && bMatch && !isCheckedOut && !isCurrent;
        });

        return {
          id: b.id,
          bedNumber: bNum,
          status: b.status || (occupant ? 'OCCUPIED' : 'AVAILABLE'),
          occupantName: occupant ? occupant.name || `${occupant.firstName || ''} ${occupant.lastName || ''}`.trim() : null,
          isOccupied: Boolean(occupant) || (b.status && b.status.toUpperCase() === 'OCCUPIED'),
        };
      });
    }

    // Fallback based on capacity if beds array not explicitly populated
    const capacity = Number(selectedRoom.capacity || selectedRoom.beds || (selectedRoom as any).sharing || 1);
    const generated: Array<{ id: string; bedNumber: string; status: string; occupantName: string | null; isOccupied: boolean }> = [];
    for (let i = 1; i <= capacity; i++) {
      const bNum = `B${i}`;
      const occupant = (existingTenants || []).find((t: any) => {
        const isCurrent = currentTenantId && t.id === currentTenantId;
        const status = (t.status || '').toLowerCase();
        const isCheckedOut = status === 'checked_out' || status === 'archived';
        const rMatch = (t.roomNumber && t.roomNumber === (selectedRoom.roomNumber || selectedRoom.number)) || (t.roomId && t.roomId === selectedRoom.id);
        const bMatch = t.bedNumber && (t.bedNumber === bNum || t.bedNumber === `Bed ${bNum}` || t.bedNumber === String(i));
        return rMatch && bMatch && !isCheckedOut && !isCurrent;
      });

      generated.push({
        id: `gen-bed-${i}`,
        bedNumber: bNum,
        status: occupant ? 'OCCUPIED' : 'AVAILABLE',
        occupantName: occupant ? occupant.name || `${occupant.firstName || ''} ${occupant.lastName || ''}`.trim() : null,
        isOccupied: Boolean(occupant),
      });
    }
    return generated;
  }, [selectedRoom, beds, existingTenants, currentTenantId]);

  const selectedBuilding = (selectedRoom as any)?.buildingName;
  const selectedFloor = (selectedRoom as any)?.floorName || ((selectedRoom as any)?.floorNumber != null ? `Floor ${(selectedRoom as any)?.floorNumber}` : null);

  return (
    <div className={cn('space-y-3 w-full', className)}>
      {/* 1. Searchable Hierarchical Room Picker */}
      <div className="relative w-full">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                'w-full justify-between h-10 px-3.5 text-left font-normal border border-input/80 dark:border-slate-800 bg-background/90 dark:bg-slate-900/90 hover:bg-muted/40 transition-all rounded-xl shadow-2xs focus:ring-2 focus:ring-primary/20 focus:border-primary',
                !selectedRoom && 'text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Home className="h-3.5 w-3.5" />
                </div>
                {selectedRoom ? (
                  <div className="truncate flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(selectedBuilding || selectedFloor) && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-muted/60 font-semibold text-muted-foreground">
                          {selectedBuilding ? `${selectedBuilding}` : ''}
                          {selectedBuilding && selectedFloor ? ' • ' : ''}
                          {selectedFloor ? `${selectedFloor}` : ''}
                        </Badge>
                      )}
                      <span className="font-bold text-foreground text-xs">
                        Room {selectedRoom.roomNumber || selectedRoom.number}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({selectedRoom.sharingType || selectedRoom.type || 'Shared'})
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>Rent: <strong className="text-foreground">{formatCurrency(Number(selectedRoom.baseRent || selectedRoom.rent || 0))}</strong>/mo</span>
                      {selectedBedNumber && (
                        <>
                          <span>•</span>
                          <span className="font-semibold text-primary">Bed: {selectedBedNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Select Room (Building › Floor › Room)...</span>
                )}
              </div>

              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[360px] sm:w-[420px] p-0 rounded-xl shadow-xl" align="start">
            <div className="p-3 border-b bg-muted/30 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search Building, Floor, Room 101..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">
                  Showing {filteredRooms.length} room(s)
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span>Only Vacant Rooms</span>
                </label>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto p-2 divide-y divide-border/40">
              {Object.keys(groupedRooms).length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <Home className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No rooms matching your search criteria.
                </div>
              ) : (
                Object.entries(groupedRooms).map(([groupKey, group]) => (
                  <div key={groupKey} className="py-2 first:pt-0 last:pb-0 space-y-1.5">
                    {/* Hierarchical Group Header: Property › Building & Floor */}
                    <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                        {group.propertyName && (
                          <>
                            <span className="text-muted-foreground font-normal">{group.propertyName}</span>
                            <span className="text-muted-foreground font-normal">›</span>
                          </>
                        )}
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{group.buildingName}</span>
                        <span className="text-muted-foreground">•</span>
                        <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{group.floorName}</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">
                        {group.rooms.length} Rooms
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-1">
                      {group.rooms.map((r) => {
                        const stats = roomStatsMap.get(r.id);
                        const isSelected = selectedRoom?.id === r.id;
                        const rNum = r.roomNumber || r.number;
                        const rentVal = Number(r.baseRent || r.rent || 0);

                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              onSelectRoom(rNum, r.id, rentVal);
                              setOpen(false);
                            }}
                            className={cn(
                              'w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-primary font-bold border border-primary/30'
                                : 'hover:bg-muted text-foreground'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs font-mono">Room {rNum}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">
                                ({r.sharingType || r.type || 'Shared'})
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-semibold">{formatCurrency(rentVal)}</span>
                              {stats && (
                                <Badge
                                  variant={stats.isAvailable ? 'default' : 'destructive'}
                                  className={cn(
                                    'text-[9px] py-0 px-1 font-mono',
                                    stats.isAvailable ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600'
                                  )}
                                >
                                  {stats.occupiedBeds}/{stats.totalBeds} Occ
                                </Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* 2. Interactive Bed Strip for Selected Room */}
      {selectedRoom && (
        <div className="p-3 rounded-xl border bg-card/60 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
              <BedIcon className="h-3.5 w-3.5 text-primary" />
              Select Bed in Room {selectedRoom.roomNumber || selectedRoom.number}:
            </span>
            <span className="text-[10px] text-muted-foreground">
              {bedList.filter((b) => !b.isOccupied).length} of {bedList.length} Available
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {bedList.map((bed) => {
              const isSelected = selectedBedNumber === bed.bedNumber;
              const isOccupied = bed.isOccupied;

              return (
                <button
                  key={bed.id}
                  type="button"
                  disabled={isOccupied && !isSelected}
                  onClick={() => onSelectBed(bed.bedNumber)}
                  className={cn(
                    'p-2 rounded-lg border text-left text-xs transition-all flex flex-col justify-between relative',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20 shadow-xs'
                      : isOccupied
                      ? 'border-destructive/30 bg-destructive/5 text-muted-foreground opacity-75 cursor-not-allowed'
                      : 'border-border bg-background hover:border-primary/50 hover:bg-muted/30 text-foreground'
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold font-mono text-xs">{bed.bedNumber}</span>
                    <span
                      className={cn(
                        'h-2 w-2 rounded-full',
                        isSelected ? 'bg-primary' : isOccupied ? 'bg-rose-500' : 'bg-emerald-500'
                      )}
                    />
                  </div>

                  <div className="text-[10px] truncate">
                    {isOccupied ? (
                      <span className="text-rose-600 dark:text-rose-400 font-medium truncate flex items-center gap-1">
                        <User className="h-2.5 w-2.5 shrink-0" />
                        {bed.occupantName || 'Occupied'}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Available</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
