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
      const capacity = Number(r.capacity || r.beds || (r as any).totalBeds || 1);

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

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rooms.filter((r) => {
      const rNum = String(r.roomNumber || r.number || '').toLowerCase();
      const bldg = String((r as any).buildingName || (r as any).building || '').toLowerCase();
      const floor = String((r as any).floorName || (r as any).floorNumber != null ? ((r as any).floorName || (r as any).floorNumber) : '').toLowerCase();
      const type = String(r.type || '').toLowerCase();

      const matchesSearch = !q || rNum.includes(q) || bldg.includes(q) || floor.includes(q) || type.includes(q);
      const stats = roomStatsMap.get(r.id);
      const matchesAvailable = !onlyAvailable || (stats && stats.isAvailable);

      return matchesSearch && matchesAvailable;
    });
  }, [rooms, search, onlyAvailable, roomStatsMap]);

  // Group rooms by Floor or Building
  const groupedRooms = useMemo(() => {
    const groups: Record<string, Room[]> = {};
    for (const r of filteredRooms) {
      const groupName =
        (r as any).floorName ||
        ((r as any).floorNumber != null ? `Floor ${(r as any).floorNumber}` : null) ||
        (r as any).buildingName ||
        'Standard Rooms';

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(r);
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
    const capacity = Number(selectedRoom.capacity || selectedRoom.beds || 1);
    const generated: Array<{ id: string; bedNumber: string; status: string; occupantName: string | null; isOccupied: boolean }> = [];
    for (let i = 1; i <= capacity; i++) {
      const bNum = String.fromCharCode(64 + i); // Bed A, Bed B, Bed C...
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
        bedNumber: `Bed ${bNum}`,
        status: occupant ? 'OCCUPIED' : 'AVAILABLE',
        occupantName: occupant ? occupant.name || `${occupant.firstName || ''} ${occupant.lastName || ''}`.trim() : null,
        isOccupied: Boolean(occupant),
      });
    }
    return generated;
  }, [selectedRoom, beds, existingTenants, currentTenantId]);

  return (
    <div className={cn('space-y-3 w-full', className)}>
      {/* 1. Searchable Room Picker */}
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
                'w-full justify-between h-12 px-3 text-left font-normal border-input hover:bg-muted/40 transition-all rounded-xl shadow-xs',
                !selectedRoom && 'text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Home className="h-4 w-4" />
                </div>
                {selectedRoom ? (
                  <div className="truncate flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">
                        Room {selectedRoom.roomNumber || selectedRoom.number}
                      </span>
                      {selectedRoom.type && (
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {selectedRoom.type}
                        </span>
                      )}
                      {(selectedRoom as any).buildingName && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          · {(selectedRoom as any).buildingName}
                        </span>
                      )}
                    </div>
                    {Number(selectedRoom.rent || (selectedRoom as any).baseRent || 0) > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {formatCurrency(Number(selectedRoom.rent || (selectedRoom as any).baseRent || 0))}/mo
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Search & select room (by room #, floor, building)...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {selectedRoom && !disabled && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectRoom('', '', 0);
                      onSelectBed('');
                    }}
                    className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] font-semibold text-primary">
                  {rooms.length} Rooms
                </Badge>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[480px] shadow-2xl border-border bg-popover rounded-xl overflow-hidden"
            align="start"
          >
            {/* Search Header & Filter Toggle */}
            <div className="border-b px-3 py-2.5 bg-muted/40 space-y-2">
              <div className="flex items-center">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search 50+ rooms by number, floor, building..."
                  className="w-full text-xs bg-transparent placeholder:text-muted-foreground focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-muted text-[11px]">
                <span className="text-muted-foreground">
                  Showing {filteredRooms.length} of {rooms.length} rooms
                </span>
                <button
                  type="button"
                  onClick={() => setOnlyAvailable(!onlyAvailable)}
                  className={cn(
                    'px-2 py-0.5 rounded-md font-medium text-[10px] border transition-all',
                    onlyAvailable
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted'
                  )}
                >
                  {onlyAvailable ? '✓ Vacant Only' : 'Show Vacant Only'}
                </button>
              </div>
            </div>

            {/* Grouped Room List */}
            <div className="max-h-72 overflow-y-auto p-1.5 text-xs space-y-2">
              {filteredRooms.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <AlertCircle className="h-6 w-6 mx-auto mb-1 text-muted-foreground/60" />
                  <p className="text-xs font-medium">No matching rooms found.</p>
                  {onlyAvailable && (
                    <button
                      type="button"
                      onClick={() => setOnlyAvailable(false)}
                      className="text-[11px] text-primary hover:underline mt-1 inline-block"
                    >
                      Clear "Vacant Only" filter
                    </button>
                  )}
                </div>
              ) : (
                Object.entries(groupedRooms).map(([groupName, roomItems]) => (
                  <div key={groupName} className="space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/40 rounded-md flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3 w-3 text-primary" />
                        {groupName}
                      </span>
                      <span className="text-[9px] font-mono opacity-80">{roomItems.length} rooms</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                      {roomItems.map((r) => {
                        const rNum = r.roomNumber || r.number || r.id;
                        const isSelected = selectedRoomNumber === rNum || selectedRoomNumber === r.id;
                        const stats = roomStatsMap.get(r.id);
                        const isFull = stats ? stats.availableBeds === 0 : false;
                        const rentVal = Number(r.rent || (r as any).baseRent || 0);

                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              onSelectRoom(rNum, r.id, rentVal);
                              setOpen(false);
                            }}
                            className={cn(
                              'flex flex-col p-2 rounded-lg text-left border transition-all relative overflow-hidden',
                              isSelected
                                ? 'bg-primary/10 border-primary text-foreground font-semibold shadow-xs ring-1 ring-primary/40'
                                : 'bg-card border-border/60 hover:border-primary/50 hover:bg-accent/40 text-foreground',
                              isFull && !isSelected && 'opacity-65 bg-muted/20'
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-bold text-xs flex items-center gap-1">
                                Room {rNum}
                                {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-0.5" />}
                              </span>
                              <span
                                className={cn(
                                  'text-[9px] px-1.5 py-0.2 rounded font-bold',
                                  isFull
                                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                )}
                              >
                                {isFull ? 'Full' : `${stats?.availableBeds ?? 1} Vacant`}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 w-full">
                              <span className="truncate max-w-[90px]">{r.type || 'Standard'}</span>
                              {rentVal > 0 && <span className="font-medium text-foreground">{formatCurrency(rentVal)}</span>}
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

      {/* 2. Visual Interactive Bed Card Grid */}
      {selectedRoom && (
        <div className="p-3 bg-muted/20 rounded-xl border border-border/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <BedIcon className="h-3.5 w-3.5 text-primary" />
              Select Bed in Room {selectedRoom.roomNumber || selectedRoom.number}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {bedList.filter((b) => !b.isOccupied).length} of {bedList.length} Beds Available
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {bedList.map((b) => {
              const isSelected = selectedBedNumber === b.bedNumber;
              const isOccupied = b.isOccupied;

              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={isOccupied}
                  onClick={() => onSelectBed(b.bedNumber)}
                  className={cn(
                    'flex flex-col p-2.5 rounded-lg border text-left transition-all relative',
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/40 shadow-xs'
                      : isOccupied
                      ? 'bg-muted/40 border-border/40 text-muted-foreground/60 cursor-not-allowed opacity-60'
                      : 'bg-card border-border hover:border-emerald-400 hover:bg-emerald-50/20 text-foreground cursor-pointer shadow-2xs'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs flex items-center gap-1">
                      {b.bedNumber}
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-0.5" />}
                    </span>
                    <span
                      className={cn(
                        'text-[9px] px-1.5 py-0.2 rounded font-bold uppercase',
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : isOccupied
                          ? 'bg-rose-500/10 text-rose-600'
                          : 'bg-emerald-500/10 text-emerald-600'
                      )}
                    >
                      {isSelected ? 'Selected' : isOccupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>

                  <div className="text-[10px] mt-1 text-muted-foreground truncate">
                    {isOccupied && b.occupantName ? (
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 truncate">
                        <User className="h-2.5 w-2.5 shrink-0" />
                        {b.occupantName}
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">Ready for allocation</span>
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
