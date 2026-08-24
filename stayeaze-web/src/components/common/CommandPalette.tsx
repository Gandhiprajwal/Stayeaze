import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, Users, Home, Building2, Receipt, Shield, UserPlus,
  PlusCircle, CreditCard, LogOut, ArrowRight, Settings, Wrench, MessageSquare, PieChart
} from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import api from '@/lib/api';
import type { Tenant, Room } from '@/lib/types';

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const navigate = useNavigate();

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(val);
    } else {
      setInternalOpen(val);
    }
  };

  // Listen for Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen]);

  // Fetch tenants for spotlight search
  const { data: tenants } = useQuery({
    queryKey: ['palette-tenants'],
    queryFn: () => api.get<any[]>('/tenants/minimal').then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Tenant[];
      return (payload as { data: Tenant[] }).data ?? [];
    }),
    enabled: isOpen,
    staleTime: 60000,
  });

  // Fetch rooms for spotlight search
  const { data: rooms } = useQuery({
    queryKey: ['palette-rooms'],
    queryFn: () => api.get<any[]>('/rooms', { params: { pageSize: 200 } }).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Room[];
      return (payload as { data: Room[] }).data ?? [];
    }),
    enabled: isOpen,
    staleTime: 60000,
  });

  const runCommand = (action: () => void) => {
    setOpen(false);
    action();
  };

  const navItems = [
    { label: 'Tenants Directory', icon: Users, path: '/tenants', keywords: ['residents', 'occupants', 'members'] },
    { label: 'Rooms & Beds Grid', icon: Home, path: '/rooms', keywords: ['hostel', 'ac', 'bed', 'capacity'] },
    { label: 'Buildings & Properties', icon: Building2, path: '/properties', keywords: ['branches', 'floors', 'locations'] },
    { label: 'Billing & Invoices', icon: Receipt, path: '/billing', keywords: ['rent', 'payments', 'dues', 'receipts'] },
    { label: 'Accountant Portal', icon: PieChart, path: '/accountant', keywords: ['ledger', 'gst', 'tally', 'finance'] },
    { label: 'Complaints & Requests', icon: MessageSquare, path: '/complaints', keywords: ['tickets', 'issues', 'support'] },
    { label: 'Maintenance & Repairs', icon: Wrench, path: '/maintenance', keywords: ['assets', 'plumbing', 'electrical'] },
    { label: 'Check-outs & Notice', icon: LogOut, path: '/check-outs', keywords: ['clearance', 'refund', 'vacate'] },
    { label: 'System Settings', icon: Settings, path: '/settings', keywords: ['organization', 'profile', 'billing profile'] },
  ];

  const quickActions = [
    { label: 'Onboard New Tenant', icon: UserPlus, action: () => navigate('/tenants?new=true') },
    { label: 'Create New Room', icon: PlusCircle, action: () => navigate('/rooms?new=true') },
    { label: 'Generate Rent Invoices', icon: CreditCard, action: () => navigate('/billing?action=generate') },
    { label: 'Initiate Check-out Clearance', icon: LogOut, action: () => navigate('/check-outs') },
  ];

  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a resident name, room #, building, or action..." />
      <CommandList className="max-h-[380px] p-1.5">
        <CommandEmpty>No matching results found.</CommandEmpty>

        {/* 1. Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <CommandItem
                key={qa.label}
                onSelect={() => runCommand(qa.action)}
                className="flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent"
              >
                <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-xs flex-1">{qa.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-60" />
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* 2. Residents Spotlight */}
        {tenants && tenants.length > 0 && (
          <CommandGroup heading={`Residents (${tenants.length})`}>
            {tenants.slice(0, 15).map((t) => (
              <CommandItem
                key={t.id}
                value={`${t.name} ${t.phone || ''} ${t.roomNumber || ''} ${t.email || ''}`}
                onSelect={() => runCommand(() => navigate(`/tenants/${t.id}`))}
                className="flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent"
              >
                <div className="h-6 w-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-extrabold shrink-0">
                  {t.name?.charAt(0).toUpperCase() || 'T'}
                </div>
                <div className="truncate flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate text-foreground">{t.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {t.phone || t.email} {t.roomNumber ? `· Room ${t.roomNumber}` : ''}
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-muted text-muted-foreground">
                  {t.status || 'Active'}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* 3. Rooms Spotlight */}
        {rooms && rooms.length > 0 && (
          <CommandGroup heading={`Rooms (${rooms.length})`}>
            {rooms.slice(0, 15).map((r) => {
              const rNum = r.roomNumber || r.number || r.id;
              return (
                <CommandItem
                  key={r.id}
                  value={`Room ${rNum} ${(r as any).buildingName || ''} ${(r as any).floorName || ''} ${r.type || ''}`}
                  onSelect={() => runCommand(() => navigate(`/rooms`))}
                  className="flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent"
                >
                  <div className="h-6 w-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <Home className="h-3.5 w-3.5" />
                  </div>
                  <div className="truncate flex-1 min-w-0">
                    <div className="font-semibold text-xs truncate text-foreground">Room {rNum}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {(r as any).buildingName || 'Main Building'} · {r.type || 'Standard'}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {r.capacity || r.beds ? `${r.capacity || r.beds} Beds` : ''}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* 4. Page Navigation */}
        <CommandGroup heading="Platform Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={`${item.label} ${item.keywords.join(' ')}`}
                onSelect={() => runCommand(() => navigate(item.path))}
                className="flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer hover:bg-accent"
              >
                <div className="h-6 w-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-xs flex-1">{item.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{item.path}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
