import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDebounce } from '@/lib/hooks/use-debounce';
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown,
  Download, Settings2, Inbox, Search, CalendarRange, Trash2, CheckSquare,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/format';
import api from '@/lib/api';
import { usePropertyStore } from '@/lib/stores/property-store';
import type { Paginated, QueryParams } from '@/lib/types';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => React.ReactNode;
  className?: string;
  width?: string;
}

interface FilterOption {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface DateRangeFilter {
  key: string;
  label: string;
  field: string;
}

interface BulkAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  onAction: (ids: string[]) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  endpoint: string;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  dateRangeFilter?: DateRangeFilter;
  exportFilename?: string;
  rowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  initialSortBy?: string;
  initialSortOrder?: 'asc' | 'desc';
  initialPageSize?: number;
  bulkActions?: BulkAction[];
  emptyAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
  emptyDescription?: string;
  syncUrlState?: boolean;
  virtualizeThreshold?: number;
}

function getFilterableValues(item: Record<string, unknown>, key: string): string[] {
  const values: string[] = [];

  if (item[key] !== undefined && item[key] !== null) {
    const val = item[key];
    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      if (obj.id) values.push(String(obj.id));
      if (obj.name) values.push(String(obj.name));
      if (obj.code) values.push(String(obj.code));
      if (obj.number) values.push(String(obj.number));
    } else {
      values.push(String(val));
    }
  }

  if (key === 'buildingId' || key === 'building') {
    if (item.buildingId) values.push(String(item.buildingId));
    const bld = item.building as Record<string, unknown> | undefined;
    if (bld?.id) values.push(String(bld.id));
    if (bld?.name) values.push(String(bld.name));
    if (bld?.code) values.push(String(bld.code));
  }
  if (key === 'propertyId' || key === 'property') {
    if (item.propertyId) values.push(String(item.propertyId));
    const prop = item.property as Record<string, unknown> | undefined;
    if (prop?.id) values.push(String(prop.id));
    if (prop?.name) values.push(String(prop.name));
    const bld = item.building as Record<string, unknown> | undefined;
    const bldProp = bld?.property as Record<string, unknown> | undefined;
    if (bldProp?.id) values.push(String(bldProp.id));
    if (bldProp?.name) values.push(String(bldProp.name));
    const flr = item.floor as Record<string, unknown> | undefined;
    const flrBld = flr?.building as Record<string, unknown> | undefined;
    const flrProp = flrBld?.property as Record<string, unknown> | undefined;
    if (flrProp?.id) values.push(String(flrProp.id));
    if (flrProp?.name) values.push(String(flrProp.name));
  }
  if (key === 'floorId' || key === 'floor') {
    if (item.floorId) values.push(String(item.floorId));
    const flr = item.floor as Record<string, unknown> | undefined;
    if (flr?.id) values.push(String(flr.id));
    if (flr?.name) values.push(String(flr.name));
    if (flr?.number) values.push(String(flr.number));
  }
  if (key === 'roomId' || key === 'room') {
    if (item.roomId) values.push(String(item.roomId));
    if (item.roomNumber) values.push(String(item.roomNumber));
    const rm = item.room as Record<string, unknown> | undefined;
    if (rm?.id) values.push(String(rm.id));
    if (rm?.number) values.push(String(rm.number));
    if (rm?.roomNumber) values.push(String(rm.roomNumber));
  }
  if (key === 'tenantId' || key === 'tenant') {
    if (item.tenantId) values.push(String(item.tenantId));
    if (item.tenantName) values.push(String(item.tenantName));
    const t = item.tenant as Record<string, unknown> | undefined;
    if (t?.id) values.push(String(t.id));
    if (t?.name) values.push(String(t.name));
  }
  if (key === 'type' || key === 'sharing' || key === 'sharingType') {
    if (item.type) values.push(String(item.type));
    if (item.sharingType) values.push(String(item.sharingType));
  }
  if (key === 'status') {
    if (item.status) values.push(String(item.status));
  }

  return values;
}

function getSortableValue(item: Record<string, unknown>, key: string): string | number {
  if (key === 'netRefund') {
    const dep = Number(item.depositRefund ?? 0);
    const ded = Number(item.deductions ?? 0);
    return dep - ded;
  }
  if (key === 'occupied' || key === 'occupiedBeds') {
    const occ = Number(item.occupiedBeds ?? item.occupied ?? 0);
    const beds = Number(item.totalBeds ?? item.beds ?? 1);
    return beds > 0 ? (occ / beds) * 100 : occ;
  }

  if (key === 'buildingId' || key === 'building') {
    const bld = item.building as Record<string, unknown> | undefined;
    return (bld?.name as string) ?? (bld?.code as string) ?? (item.buildingId as string) ?? '';
  }
  if (key === 'propertyId' || key === 'property') {
    const prop = item.property as Record<string, unknown> | undefined;
    if (prop?.name) return prop.name as string;
    const bld = item.building as Record<string, unknown> | undefined;
    const bldProp = bld?.property as Record<string, unknown> | undefined;
    if (bldProp?.name) return bldProp.name as string;
    const flr = item.floor as Record<string, unknown> | undefined;
    const flrBld = flr?.building as Record<string, unknown> | undefined;
    const flrProp = flrBld?.property as Record<string, unknown> | undefined;
    if (flrProp?.name) return flrProp.name as string;
    return (item.propertyId as string) ?? '';
  }
  if (key === 'floorId' || key === 'floor') {
    const flr = item.floor as Record<string, unknown> | undefined;
    return (flr?.name as string) ?? (flr?.number ? `Level ${flr.number}` : '') ?? (item.floorId as string) ?? '';
  }
  if (key === 'roomId' || key === 'room') {
    const rm = item.room as Record<string, unknown> | undefined;
    return (rm?.roomNumber as string) ?? (rm?.number as string) ?? (item.roomNumber as string) ?? (item.roomId as string) ?? '';
  }
  if (key === 'tenantId' || key === 'tenant') {
    const t = item.tenant as Record<string, unknown> | undefined;
    return (t?.name as string) ?? (item.tenantName as string) ?? (item.tenantId as string) ?? '';
  }

  const direct = item[key];
  if (direct === undefined || direct === null) return '';
  if (typeof direct === 'number') return direct;
  if (typeof direct === 'object') {
    const obj = direct as Record<string, unknown>;
    return (obj.name as string) ?? (obj.number as string) ?? (obj.id as string) ?? JSON.stringify(obj);
  }
  return String(direct);
}

export function DataTable<T extends { id: string }>({
  columns,
  endpoint,
  searchPlaceholder = 'Search...',
  filters = [],
  dateRangeFilter,
  exportFilename = 'export',
  rowActions,
  onRowClick,
  initialSortBy,
  initialSortOrder = 'asc',
  initialPageSize = 10,
  bulkActions,
  emptyAction,
  emptyDescription,
  syncUrlState = true,
  virtualizeThreshold = 50,
}: DataTableProps<T>) {
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialParams = (): QueryParams => {
    if (!syncUrlState) {
      return {
        page: 1,
        pageSize: initialPageSize,
        sortBy: initialSortBy,
        sortOrder: initialSortOrder,
        search: '',
        filters: {},
      };
    }

    const searchFromUrl = searchParams.get('search') || '';
    const pageFromUrl = Number(searchParams.get('page')) || 1;
    const pageSizeFromUrl = Number(searchParams.get('pageSize')) || initialPageSize;
    const sortByFromUrl = searchParams.get('sortBy') || initialSortBy;
    const sortOrderFromUrl = (searchParams.get('sortOrder') as 'asc' | 'desc') || initialSortOrder;

    const filtersFromUrl: Record<string, string> = {};
    if (filters) {
      filters.forEach((f) => {
        const val = searchParams.get(f.key);
        if (val) filtersFromUrl[f.key] = val;
      });
    }

    return {
      page: pageFromUrl,
      pageSize: pageSizeFromUrl,
      sortBy: sortByFromUrl,
      sortOrder: sortOrderFromUrl,
      search: searchFromUrl,
      filters: filtersFromUrl,
    };
  };

  const { selectedPropertyId, setSelectedPropertyId } = usePropertyStore();
  const [params, setParams] = useState<QueryParams>(getInitialParams);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(columns.map((c) => c.key))
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState(syncUrlState ? (searchParams.get('from') || '') : '');
  const [dateTo, setDateTo] = useState(syncUrlState ? (searchParams.get('to') || '') : '');
  const debouncedSearch = useDebounce(params.search ?? '', 300);

  // Sync state changes back to URL query parameters
  useEffect(() => {
    if (!syncUrlState) return;

    const newParams = new URLSearchParams();
    if (params.search && params.search.trim()) newParams.set('search', params.search.trim());
    if (params.page && params.page > 1) newParams.set('page', String(params.page));
    if (params.pageSize && params.pageSize !== initialPageSize) newParams.set('pageSize', String(params.pageSize));
    if (params.sortBy && params.sortBy !== initialSortBy) newParams.set('sortBy', params.sortBy);
    if (params.sortOrder && params.sortOrder !== initialSortOrder) newParams.set('sortOrder', params.sortOrder);

    if (params.filters) {
      Object.entries(params.filters).forEach(([k, v]) => {
        if (v && v !== 'all') newParams.set(k, String(v));
      });
    }
    if (dateFrom) newParams.set('from', dateFrom);
    if (dateTo) newParams.set('to', dateTo);

    const currentQuery = searchParams.toString();
    const newQuery = newParams.toString();
    if (currentQuery !== newQuery) {
      setSearchParams(newParams, { replace: true });
    }
  }, [params, dateFrom, dateTo, syncUrlState]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawPayload, isLoading, isError, error } = useQuery<any, Error>({
    queryKey: [endpoint, params, selectedPropertyId],
    queryFn: async () => {
      const activeFilterParams = { ...params.filters };
      if (selectedPropertyId && selectedPropertyId !== 'ALL' && !activeFilterParams.propertyId) {
        activeFilterParams.propertyId = selectedPropertyId;
      }

      const res = await api.get(endpoint, {
        params: {
          page: params.page,
          pageSize: params.pageSize,
          search: params.search || undefined,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          ...activeFilterParams,
        },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Extract items array safely regardless of response wrapper
  let rawItems: T[] = [];
  let isServerPaginated = false;
  let serverTotal = 0;

  if (Array.isArray(rawPayload)) {
    rawItems = rawPayload;
  } else if (rawPayload && typeof rawPayload === 'object') {
    if (Array.isArray(rawPayload.data)) {
      rawItems = rawPayload.data;
      const t = rawPayload.total ?? rawPayload.totalCount ?? rawPayload.totalElements;
      if (typeof t === 'number') {
        serverTotal = t;
        isServerPaginated = true;
      }
    } else if (Array.isArray(rawPayload.content)) {
      rawItems = rawPayload.content;
      const t = rawPayload.totalElements ?? rawPayload.total ?? rawPayload.totalCount;
      if (typeof t === 'number') {
        serverTotal = t;
        isServerPaginated = true;
      }
    }
  }

  // Memoize client-side filtering and sorting for fallback non-server-paginated endpoints
  const filteredItems = useMemo(() => {
    let result = [...rawItems];

    // 0. Active Property Scoping (Client-side fallback)
    if (selectedPropertyId && selectedPropertyId !== 'ALL') {
      result = result.filter((item) => {
        const rec = item as Record<string, unknown>;
        const pId = rec.propertyId ?? (typeof rec.property === 'object' && rec.property !== null ? (rec.property as any).id : null);
        if (pId !== undefined && pId !== null) {
          return String(pId) === selectedPropertyId;
        }
        return true;
      });
    }

    // 1. Dropdown Filters
    if (params.filters && Object.keys(params.filters).length > 0) {
      Object.entries(params.filters).forEach(([filterKey, filterValue]) => {
        if (filterValue && filterValue !== 'all' && !filterKey.endsWith('_from') && !filterKey.endsWith('_to')) {
          const valStr = String(filterValue).trim().toLowerCase();
          result = result.filter((item) => {
            const rec = item as Record<string, unknown>;
            const candidates = getFilterableValues(rec, filterKey);
            if (candidates.length > 0) {
              return candidates.some((c) => {
                const cLower = c.trim().toLowerCase();
                return cLower === valStr || cLower.includes(valStr) || valStr.includes(cLower);
              });
            }
            return JSON.stringify(rec).toLowerCase().includes(valStr);
          });
        }
      });
    }

    // 2. Search Bar (Debounced)
    if (debouncedSearch && debouncedSearch.trim() !== '') {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((item) => {
        const rec = item as Record<string, unknown>;
        return JSON.stringify(rec).toLowerCase().includes(q);
      });
    }

    // 3. Date Range Filter
    if (dateRangeFilter && (dateFrom || dateTo)) {
      const field = dateRangeFilter.field;
      result = result.filter((item) => {
        const rec = item as Record<string, unknown>;
        const rawDate = rec[field];
        if (!rawDate) return false;
        const dStr = String(rawDate).slice(0, 10);
        if (dateFrom && dStr < dateFrom) return false;
        if (dateTo && dStr > dateTo) return false;
        return true;
      });
    }

    // 4. Sorting
    if (params.sortBy) {
      const sortKey = params.sortBy;
      const isAsc = params.sortOrder === 'asc';
      result.sort((a, b) => {
        const aVal = getSortableValue(a as Record<string, unknown>, sortKey);
        const bVal = getSortableValue(b as Record<string, unknown>, sortKey);

        if (aVal === bVal) return 0;
        if (aVal === undefined || aVal === null || aVal === '') return 1;
        if (bVal === undefined || bVal === null || bVal === '') return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return isAsc ? aVal - bVal : bVal - aVal;
        }
        return isAsc
          ? String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' })
          : String(bVal).localeCompare(String(aVal), undefined, { numeric: true, sensitivity: 'base' });
      });
    }

    return result;
  }, [rawItems, params.filters, debouncedSearch, dateRangeFilter, dateFrom, dateTo, params.sortBy, params.sortOrder]);

  const activeCols = columns.filter((c) => visibleCols.has(c.key));

  const pageSize = params.pageSize ?? initialPageSize;
  const total = isServerPaginated ? serverTotal : filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(params.page ?? 1, totalPages);

  const hasActiveFiltersOrSort = !!(params.sortBy || (params.filters && Object.keys(params.filters).length > 0) || debouncedSearch);

  const displayRows = isServerPaginated
    ? (hasActiveFiltersOrSort ? filteredItems : rawItems)
    : filteredItems.slice((page - 1) * pageSize, page * pageSize);


  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pageRowIds = displayRows.map((r) => r.id);
  const allOnPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = pageRowIds.some((id) => selectedIds.has(id));
  const hasBulk = !!bulkActions && bulkActions.length > 0;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = displayRows.length > virtualizeThreshold;

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    overscan: 6,
    enabled: shouldVirtualize,
  });

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : null;
  const totalVirtualHeight = shouldVirtualize ? rowVirtualizer.getTotalSize() : 0;

  function toggleSort(key: string) {
    setParams((p) => {
      if (p.sortBy !== key) return { ...p, sortBy: key, sortOrder: 'asc', page: 1 };
      if (p.sortOrder === 'asc') return { ...p, sortOrder: 'desc' };
      return { ...p, sortBy: undefined, sortOrder: 'asc', page: 1 };
    });
  }

  function setSearch(value: string) {
    setParams((p) => ({ ...p, search: value, page: 1 }));
  }

  function setFilter(key: string, value: string) {
    if (key === 'propertyId') {
      setSelectedPropertyId(value === 'all' ? 'ALL' : value);
    }
    setParams((p) => ({ ...p, filters: { ...p.filters, [key]: value }, page: 1 }));
  }

  function applyDateRange() {
    if (!dateRangeFilter) return;
    setParams((p) => ({
      ...p,
      filters: {
        ...p.filters,
        [`${dateRangeFilter.field}_from`]: dateFrom || undefined,
        [`${dateRangeFilter.field}_to`]: dateTo || undefined,
      },
      page: 1,
    }));
  }

  function clearDateRange() {
    setDateFrom('');
    setDateTo('');
    if (!dateRangeFilter) return;
    setParams((p) => {
      const nextFilters = { ...p.filters };
      delete nextFilters[`${dateRangeFilter.field}_from`];
      delete nextFilters[`${dateRangeFilter.field}_to`];
      return { ...p, filters: nextFilters, page: 1 };
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageRowIds.forEach((id) => next.delete(id));
      } else {
        pageRowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function exportData() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exportToCSV(exportFilename, (filteredItems ?? []) as Record<string, any>[], activeCols.map((c) => ({ key: c.key, header: c.header })));
  }

  function runBulkAction(action: BulkAction) {
    action.onAction(Array.from(selectedIds));
    clearSelection();
  }

  const sortIcon = (key: string) => {
    if (params.sortBy !== key) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
    return params.sortOrder === 'asc'
      ? <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  };

  const dateRangeActive = !!(dateFrom || dateTo);

  return (
    <div className="space-y-4">
      {/* Enterprise Ergonomic Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Prominent, Sizeable Search Bar */}
          <div className="relative w-full sm:w-64 md:w-72 lg:w-80 shrink-0">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={params.search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-8 h-9 rounded-lg bg-card/90 border-border/80 text-xs sm:text-sm shadow-2xs focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            {params.search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded-full hover:bg-muted"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Dropdowns - Generous Width & Spacing */}
          {(filters.length > 0 || dateRangeFilter) && (
            <div className="flex items-center gap-2 flex-wrap flex-1 sm:flex-none">
              {filters.map((f) => {
                const activeVal = f.key === 'propertyId'
                  ? (selectedPropertyId !== 'ALL' ? selectedPropertyId : (params.filters?.[f.key] ?? 'all'))
                  : (params.filters?.[f.key] ?? 'all');
                return (
                  <Select key={f.key} value={activeVal} onValueChange={(v) => setFilter(f.key, v)}>
                    <SelectTrigger className="h-9 rounded-lg border-border/80 bg-card/90 text-xs sm:text-sm font-medium w-full sm:w-auto min-w-[130px] sm:min-w-[145px] shadow-2xs px-3">
                      <SelectValue placeholder={f.label} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/80 bg-popover/95 backdrop-blur-xl shadow-xl text-xs sm:text-sm p-1">
                      <SelectItem value="all" className="rounded-lg">{f.label}: All</SelectItem>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="rounded-lg">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })}

              {dateRangeFilter && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('h-9 rounded-lg gap-2 text-xs sm:text-sm font-medium px-3 shadow-2xs w-full sm:w-auto shrink-0', dateRangeActive && 'border-primary text-primary font-semibold bg-primary/5')}>
                      <CalendarRange className="h-4 w-4" /> {dateRangeActive ? 'Date: Filtered' : dateRangeFilter.label}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-76 rounded-2xl border-border/80 bg-popover/95 backdrop-blur-xl p-4 shadow-2xl" align="start">
                    <div className="space-y-3.5">
                      <p className="text-sm font-semibold text-foreground">{dateRangeFilter.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">From</label>
                          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</label>
                          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-lg text-xs" />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1 h-8 rounded-lg text-xs font-semibold" onClick={applyDateRange}>Apply Range</Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={clearDateRange}>Clear</Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>

        {/* Action Tools (Export & Columns) */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          <Button variant="outline" onClick={exportData} disabled={!filteredItems.length} className="h-9 rounded-lg text-xs sm:text-sm font-medium gap-2 px-3 shadow-2xs">
            <Download className="h-4 w-4" /> Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 rounded-lg text-xs sm:text-sm font-medium gap-2 px-3 shadow-2xs">
                <Settings2 className="h-4 w-4" /> Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl text-sm p-2">
              <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              {columns.map((c) => (
                <DropdownMenuCheckboxRow
                  key={c.key}
                  label={c.header}
                  checked={visibleCols.has(c.key)}
                  onToggle={() =>
                    setVisibleCols((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.key)) next.delete(c.key);
                      else next.add(c.key);
                      return next;
                    })
                  }
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk action bar */}
      {hasBulk && selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground">
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions!.map((action) => (
              <Button
                key={action.label}
                variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => runBulkAction(action)}
              >
                {action.icon && <action.icon className="mr-1.5 h-4 w-4" />}
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Table (Hidden on Mobile) */}
      <div className="hidden md:block rounded-xl border bg-card/80 backdrop-blur-sm overflow-hidden shadow-xs">
        <div ref={tableContainerRef} className={cn("overflow-x-auto", shouldVirtualize && "max-h-[680px] overflow-y-auto")}>
          <Table>
            <TableHeader className={cn(shouldVirtualize && "sticky top-0 z-10 bg-card/95 backdrop-blur-sm")}>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {hasBulk && (
                  <TableHead className="w-[44px]">
                    <Checkbox
                      checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all on page"
                    />
                  </TableHead>
                )}
                {activeCols.map((col) => (
                  <TableHead key={col.key} style={col.width ? { width: col.width } : undefined} className={cn(col.className)}>
                    {col.sortable ? (
                      <button
                        className="inline-flex items-center font-semibold hover:text-foreground"
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.header}
                        {sortIcon(col.key)}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
                {rowActions && <TableHead className="w-[60px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {hasBulk && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                    {activeCols.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-full max-w-[160px]" />
                      </TableCell>
                    ))}
                    {rowActions && <TableCell><Skeleton className="h-4 w-8" /></TableCell>}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={activeCols.length + (rowActions ? 1 : 0) + (hasBulk ? 1 : 0)} className="py-10 text-center text-sm text-destructive">
                    {error?.message ?? 'Failed to load data'}
                  </TableCell>
                </TableRow>
              ) : !displayRows.length ? (
                <TableRow>
                  <TableCell colSpan={activeCols.length + (rowActions ? 1 : 0) + (hasBulk ? 1 : 0)} className="py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto">
                      <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/60">
                        <Inbox className="h-6 w-6 opacity-60" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {params.search ? `No results for "${params.search}"` : 'No records found'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {emptyDescription ?? (params.search ? 'Try adjusting your search terms or filters.' : 'Get started by creating your first entry.')}
                        </p>
                      </div>
                      {params.search ? (
                        <Button variant="outline" size="sm" onClick={() => setSearch('')} className="rounded-lg h-8 text-xs font-semibold">
                          Clear Search
                        </Button>
                      ) : emptyAction ? (
                        <Button size="sm" onClick={emptyAction.onClick} className="rounded-lg h-8 text-xs font-semibold gap-1.5 shadow-2xs">
                          {emptyAction.icon && <emptyAction.icon className="h-3.5 w-3.5" />}
                          {emptyAction.label}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : shouldVirtualize && virtualItems ? (
                <>
                  {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                    <tr>
                      <td colSpan={activeCols.length + (rowActions ? 1 : 0) + (hasBulk ? 1 : 0)} style={{ height: `${virtualItems[0].start}px` }} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const row = displayRows[virtualRow.index];
                    const isSelected = selectedIds.has(row.id);
                    return (
                      <TableRow
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className={cn(onRowClick && 'cursor-pointer', isSelected && 'bg-primary/5')}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                      >
                        {hasBulk && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectRow(row.id)}
                              aria-label="Select row"
                            />
                          </TableCell>
                        )}
                        {activeCols.map((col) => (
                          <TableCell key={col.key} className={cn(col.className)}>
                            {col.cell ? col.cell(row) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                          </TableCell>
                        ))}
                        {rowActions && (
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {rowActions(row)}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {virtualItems.length > 0 && (
                    <tr>
                      <td
                        colSpan={activeCols.length + (rowActions ? 1 : 0) + (hasBulk ? 1 : 0)}
                        style={{
                          height: `${Math.max(0, totalVirtualHeight - (virtualItems[virtualItems.length - 1]?.end || 0))}px`,
                        }}
                      />
                    </tr>
                  )}
                </>
              ) : (
                displayRows.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(onRowClick && 'cursor-pointer', isSelected && 'bg-primary/5')}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {hasBulk && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectRow(row.id)}
                            aria-label="Select row"
                          />
                        </TableCell>
                      )}
                      {activeCols.map((col) => (
                        <TableCell key={col.key} className={cn(col.className)}>
                          {col.cell ? col.cell(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                        </TableCell>
                      ))}
                      {rowActions && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {rowActions(row)}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Stacked Cards (Visible on Mobile < 768px) */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse border border-border/60" />
          ))
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive rounded-2xl border border-destructive/20 bg-destructive/5">
            {error?.message ?? 'Failed to load data'}
          </div>
        ) : !displayRows.length ? (
          <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md p-8 text-center text-muted-foreground space-y-3 shadow-xs">
            <div className="h-11 w-11 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/60 mx-auto">
              <Inbox className="h-5.5 w-5.5 opacity-60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {params.search ? `No results for "${params.search}"` : 'No records found'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs mx-auto">
                {emptyDescription ?? (params.search ? 'Try adjusting your search terms or filters.' : 'Get started by creating your first entry.')}
              </p>
            </div>
            {params.search ? (
              <Button variant="outline" size="sm" onClick={() => setSearch('')} className="rounded-xl h-8.5 text-xs font-semibold">
                Clear Search
              </Button>
            ) : emptyAction ? (
              <Button size="sm" onClick={emptyAction.onClick} className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 shadow-xs">
                {emptyAction.icon && <emptyAction.icon className="h-3.5 w-3.5" />}
                {emptyAction.label}
              </Button>
            ) : null}
          </div>
        ) : (
          displayRows.map((row) => {
            const isSelected = selectedIds.has(row.id);
            const firstCol = activeCols[0];
            const secondCol = activeCols[1];
            const remainingCols = activeCols.slice(2);

            return (
              <div
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'p-4 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md shadow-xs space-y-3 transition-all duration-200',
                  onRowClick && 'active:scale-[0.99] cursor-pointer',
                  isSelected && 'ring-2 ring-primary border-primary/50'
                )}
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {hasBulk && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectRow(row.id)}
                          aria-label="Select row"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground text-sm truncate">
                        {firstCol ? (firstCol.cell ? firstCol.cell(row) : (row as any)[firstCol.key]) : null}
                      </div>
                      {secondCol && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {secondCol.cell ? secondCol.cell(row) : (row as any)[secondCol.key]}
                        </div>
                      )}
                    </div>
                  </div>
                  {rowActions && (
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      {rowActions(row)}
                    </div>
                  )}
                </div>

                {remainingCols.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                    {remainingCols.map((col) => (
                      <div key={col.key} className="space-y-0.5">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                          {col.header}
                        </span>
                        <div className="text-foreground font-medium truncate">
                          {col.cell ? col.cell(row) : (row as any)[col.key]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

        {/* Footer / Pagination Controls */}
        <div className="flex flex-col items-center justify-between gap-3 border border-border/80 bg-card rounded-xl px-4 py-3 sm:flex-row shadow-2xs">
          <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground">
            <span>
              Showing <span className="font-semibold text-foreground">{start}</span>–<span className="font-semibold text-foreground">{end}</span> of{' '}
              <span className="font-semibold text-foreground">{total}</span>
            </span>
            <Select
              value={String(params.pageSize ?? initialPageSize)}
              onValueChange={(v) => setParams((p) => ({ ...p, pageSize: Number(v), page: 1 }))}
            >
              <SelectTrigger className="h-8.5 w-[115px] text-xs rounded-lg border-border/80 bg-card">
                <SelectValue placeholder={`${initialPageSize} / page`} />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs sm:text-sm">
                {[10, 20, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-border/80 shadow-2xs"
              disabled={page <= 1}
              onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2.5 text-xs sm:text-sm font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border-border/80 shadow-2xs"
              disabled={page >= totalPages}
              onClick={() => setParams((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
  );
}

function DropdownMenuCheckboxRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={onToggle} className="gap-2">
      <Checkbox checked={checked} />
      <span className="flex-1">{label}</span>
    </DropdownMenuItem>
  );
}
