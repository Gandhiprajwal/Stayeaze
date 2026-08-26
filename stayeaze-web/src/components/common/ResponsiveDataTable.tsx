import React, { useState } from 'react';
import { LayoutGrid, Table as TableIcon, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  cell: (item: T, index: number) => React.ReactNode;
  mobileHidden?: boolean;
  mobilePrimary?: boolean;
  mobileSubtitle?: boolean;
}

interface ResponsiveDataTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  actions?: React.ReactNode;
  pageSize?: number;
}

export function ResponsiveDataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No records found.',
  searchPlaceholder = 'Search records...',
  searchFilter,
  renderMobileCard,
  actions,
  pageSize = 10,
}: ResponsiveDataTableProps<T>) {
  const [viewMode, setViewMode] = useState<'auto' | 'table' | 'cards'>('auto');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim() || !searchFilter) return data;
    return data.filter((item) => searchFilter(item, searchQuery.toLowerCase().trim()));
  }, [data, searchQuery, searchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const primaryCol = columns.find((c) => c.mobilePrimary) || columns[0];
  const subtitleCol = columns.find((c) => c.mobileSubtitle) || columns[1];
  const otherCols = columns.filter((c) => c !== primaryCol && c !== subtitleCol && !c.mobileHidden);

  return (
    <div className="space-y-4">
      {/* Search & Toolbar Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {searchFilter && (
            <div className="relative w-full sm:w-80 md:w-96 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10 pr-8 h-10.5 bg-card/90 border-border/80 rounded-xl text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded-full hover:bg-muted"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {actions}

          {/* View Mode Switcher on Medium+ Screens */}
          <div className="hidden sm:flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('table')}
              className={cn(
                'h-7 px-2.5 rounded-lg text-xs font-medium transition-all',
                viewMode === 'table' || viewMode === 'auto' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <TableIcon className="h-3.5 w-3.5 mr-1" />
              Table
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('cards')}
              className={cn(
                'h-7 px-2.5 rounded-lg text-xs font-medium transition-all',
                viewMode === 'cards' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Cards
            </Button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse border border-border/40" />
          ))}
        </div>
      ) : pagedData.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-border/80 bg-card/50 backdrop-blur-sm p-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <>
          {/* 1. Desktop High-Density Table View */}
          <div
            className={cn(
              'rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md overflow-hidden shadow-sm transition-all',
              viewMode === 'cards' ? 'hidden' : 'hidden md:block'
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="py-3.5 px-4 font-semibold">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pagedData.map((item, idx) => (
                    <tr
                      key={keyExtractor(item)}
                      className="hover:bg-muted/30 transition-colors duration-150 group"
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="py-3 px-4 align-middle">
                          {col.cell(item, idx)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Mobile Responsive Stacked Card View */}
          <div
            className={cn(
              'space-y-3',
              viewMode === 'table' ? 'hidden' : 'block md:hidden'
            )}
          >
            {pagedData.map((item, idx) => {
              if (renderMobileCard) {
                return <React.Fragment key={keyExtractor(item)}>{renderMobileCard(item, idx)}</React.Fragment>;
              }

              return (
                <div
                  key={keyExtractor(item)}
                  className="p-4 rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md shadow-sm space-y-3 hover:border-primary/40 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                    <div>
                      <div className="font-semibold text-foreground text-sm">
                        {primaryCol?.cell(item, idx)}
                      </div>
                      {subtitleCol && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {subtitleCol.cell(item, idx)}
                        </div>
                      )}
                    </div>
                  </div>

                  {otherCols.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      {otherCols.map((col) => (
                        <div key={col.key} className="space-y-0.5">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                            {col.header}
                          </span>
                          <div className="text-foreground font-medium">
                            {col.cell(item, idx)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Responsive Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2 px-1 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong className="text-foreground">
              {Math.min(currentPage * pageSize, filteredData.length)}
            </strong>{' '}
            of <strong className="text-foreground">{filteredData.length}</strong>
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 rounded-xl border-border"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 font-medium text-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 rounded-xl border-border"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
