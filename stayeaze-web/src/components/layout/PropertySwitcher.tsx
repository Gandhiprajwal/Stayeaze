import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Building2,
  Check,
  ChevronsUpDown,
  Globe,
  Plus,
  Search,
  MapPin,
  BedDouble,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/stores/auth-store';
import { usePropertyStore } from '@/lib/stores/property-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import type { Property } from '@/lib/types';

export function PropertySwitcher() {
  const { user } = useAuthStore();
  const { selectedPropertyId, setSelectedPropertyId } = usePropertyStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);

  // Hidden for system-wide platform roles & tenants
  if (
    !user ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'SUPPORT' ||
    user.role === 'TENANT'
  ) {
    return null;
  }

  // Fetch properties available to current user / organization
  const { data: rawProperties, isLoading } = useQuery<any[]>({
    queryKey: ['properties-minimal'],
    queryFn: () =>
      api.get('/properties/minimal').then((r) => {
        const payload = r.data as unknown;
        if (Array.isArray(payload)) return payload;
        return (payload as { data: any[] })?.data ?? [];
      }),
    staleTime: 60000,
  });

  const properties: Property[] = useMemo(() => {
    const list = Array.isArray(rawProperties) ? rawProperties : [];
    // If user has restricted assigned propertyIds, filter to only those
    if (user.propertyIds && user.propertyIds.length > 0) {
      return list.filter((p) => user.propertyIds?.includes(p.id));
    }
    return list;
  }, [rawProperties, user.propertyIds]);

  // Auto-heal selectedPropertyId if stored ID no longer exists
  useEffect(() => {
    if (properties.length > 0 && selectedPropertyId !== 'ALL') {
      const exists = properties.some((p) => p.id === selectedPropertyId);
      if (!exists) {
        setSelectedPropertyId('ALL');
      }
    }
  }, [properties, selectedPropertyId, setSelectedPropertyId]);

  const activeProperty = useMemo(() => {
    if (selectedPropertyId === 'ALL') return null;
    return properties.find((p) => p.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);

  const filteredProperties = useMemo(() => {
    if (!searchTerm.trim()) return properties;
    const q = searchTerm.toLowerCase().trim();
    return properties.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
    );
  }, [properties, searchTerm]);

  const handleSelectProperty = (id: string, prop?: Property | null) => {
    setSelectedPropertyId(id, prop ?? null);
    setOpen(false);
    setSearchTerm('');

    const targetName = id === 'ALL' ? 'All Properties (Aggregate)' : prop?.name || 'Property';
    toast.success(`Switched to ${targetName}`, {
      description: id === 'ALL'
        ? `Viewing consolidated metrics across ${properties.length} properties.`
        : `All views & metrics now filtered for ${prop?.name}.`,
    });
  };

  const canAddProperty = user.role === 'OWNER' || user.role === 'ADMIN';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'group relative h-9 sm:h-10 gap-1.5 sm:gap-2.5 px-2 sm:px-3.5 mx-0.5 sm:mx-2 rounded-xl border border-border/80 bg-background/90 text-sm font-medium transition-all hover:bg-accent/80 hover:border-primary/50 shadow-xs hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 shrink min-w-0 max-w-[160px] sm:max-w-[240px] md:max-w-[280px]',
            selectedPropertyId !== 'ALL' && 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
          )}
          title={
            selectedPropertyId === 'ALL'
              ? 'Viewing All Properties'
              : `Current Scope: ${activeProperty?.name || 'Property'}`
          }
        >
          {selectedPropertyId === 'ALL' ? (
            <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-lg bg-muted border border-border/60 text-muted-foreground group-hover:text-foreground transition-colors">
              <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          ) : (
            <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary transition-colors">
              <Building2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
          )}

          <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            <span className="truncate text-xs sm:text-sm font-semibold tracking-tight">
              {selectedPropertyId === 'ALL'
                ? 'All Properties'
                : activeProperty?.name || 'Select Property'}
            </span>
            {selectedPropertyId === 'ALL' ? (
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold h-4 bg-muted text-muted-foreground shrink-0 rounded-full"
              >
                {properties.length}
              </Badge>
            ) : (
              activeProperty?.city && (
                <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/80 text-[10px] font-medium text-muted-foreground shrink-0 border border-border/40">
                  <MapPin className="h-2.5 w-2.5 opacity-70" />
                  {activeProperty.city}
                </span>
              )
            )}
          </div>

          <ChevronsUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground/70 shrink-0 opacity-70 group-hover:text-foreground transition-colors" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        sideOffset={8}
        collisionPadding={16}
        className="w-[calc(100vw-32px)] max-w-[320px] sm:w-80 p-2.5 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mx-auto"
      >
        <div className="px-2 py-1.5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Property Scope</p>
            <p className="text-[11px] text-muted-foreground">
              Switch active context across operations
            </p>
          </div>
          {properties.length > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
              {properties.length} Active
            </span>
          )}
        </div>

        {properties.length > 4 && (
          <div className="p-1.5">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
                autoFocus
              />
            </div>
          </div>
        )}

        <DropdownMenuSeparator className="my-1" />

        {/* Option 1: All Properties */}
        <DropdownMenuItem
          onClick={() => handleSelectProperty('ALL')}
          className={cn(
            'flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer transition-colors',
            selectedPropertyId === 'ALL'
              ? 'bg-primary/10 text-primary font-semibold'
              : 'hover:bg-accent text-foreground'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground',
                selectedPropertyId === 'ALL'
                  ? 'border-primary/30 bg-primary/15 text-primary'
                  : 'border-border bg-muted/40'
              )}
            >
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-none truncate">
                All Properties (Aggregate)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                Combined data from all operational buildings
              </p>
            </div>
          </div>
          {selectedPropertyId === 'ALL' && (
            <Check className="h-4 w-4 text-primary shrink-0 ml-1" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Individual Properties
        </DropdownMenuLabel>

        {/* List of individual properties */}
        <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin">
          {filteredProperties.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              {searchTerm ? 'No matching properties found.' : 'No properties configured yet.'}
            </div>
          ) : (
            filteredProperties.map((prop) => {
              const isSelected = selectedPropertyId === prop.id;
              const totalBeds = prop.totalBeds ?? (prop as any).beds ?? 0;
              const occupiedBeds = prop.occupiedBeds ?? (prop as any).occupied ?? 0;

              return (
                <DropdownMenuItem
                  key={prop.id}
                  onClick={() => handleSelectProperty(prop.id, prop)}
                  className={cn(
                    'flex items-center justify-between gap-2.5 p-2 rounded-xl cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-accent text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                        isSelected
                          ? 'border-primary/30 bg-primary/15 text-primary'
                          : 'border-border bg-muted/40 text-muted-foreground'
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-xs font-semibold leading-none truncate max-w-[150px] sm:max-w-[190px]">
                          {prop.name}
                        </p>
                        {prop.code && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono shrink-0 whitespace-nowrap">
                            {prop.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        {prop.city && (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="h-3 w-3" />
                            {prop.city}
                          </span>
                        )}
                        {totalBeds > 0 && (
                          <span className="flex items-center gap-0.5 shrink-0 tabular-nums">
                            <BedDouble className="h-3 w-3" />
                            {occupiedBeds}/{totalBeds} beds
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0 ml-1" />
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </div>

        {canAddProperty && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={() => {
                setOpen(false);
                navigate('/properties');
              }}
              className="flex items-center gap-2 p-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer hover:bg-accent"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border bg-muted/30">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <span>Manage & Add New Property</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
