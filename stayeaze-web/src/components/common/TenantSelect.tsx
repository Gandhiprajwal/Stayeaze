import { useState, useMemo, useRef } from 'react';
import { Check, Search, Home, Phone, Mail, IndianRupee, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Tenant } from '@/lib/types';
import { formatCurrency } from '@/lib/format';

interface TenantSelectProps {
  tenants: Tenant[];
  selectedTenantId?: string;
  onSelectTenant: (tenant: Tenant | null) => void;
  placeholder?: string;
  className?: string;
}

export function TenantSelect({
  tenants = [],
  selectedTenantId,
  onSelectTenant,
  placeholder = 'Search tenant by Name, Phone (+91), Room #, or Email...',
  className,
}: TenantSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId),
    [tenants, selectedTenantId]
  );

  const filteredTenants = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    return tenants
      .filter((t) => {
        const name = (t.name || '').toLowerCase();
        const room = (t.roomNumber || '').toLowerCase();
        const phone = (t.phone || '').toLowerCase();
        const email = (t.email || '').toLowerCase();
        const bldg = (t.buildingName || '').toLowerCase();
        return name.includes(q) || room.includes(q) || phone.includes(q) || email.includes(q) || bldg.includes(q);
      })
      .slice(0, 50);
  }, [tenants, search]);

  return (
    <div className="relative w-full">
      <Popover open={open && Boolean(search.trim())} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className={cn('relative w-full', className)}>
            {selectedTenant ? (
              <div className="flex items-center gap-2.5 h-12 px-3 border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl shadow-xs w-full">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center text-xs font-extrabold shrink-0 shadow-xs">
                  {selectedTenant.name?.charAt(0).toUpperCase() || 'T'}
                </div>
                <div className="truncate flex-1">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {selectedTenant.name}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-2 font-mono">
                    ({selectedTenant.phone || selectedTenant.email || 'Registered'})
                  </span>
                </div>
                <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900 shrink-0">
                  {selectedTenant.roomNumber ? `Room ${selectedTenant.roomNumber}` : 'Tenant'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onSelectTenant(null);
                    setSearch('');
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className="p-1 hover:bg-indigo-200/60 dark:hover:bg-indigo-900/60 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 ml-1"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative flex items-center w-full">
                <Search className="absolute left-3.5 h-4 w-4 text-indigo-500 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (e.target.value.trim()) setOpen(true);
                  }}
                  onFocus={() => {
                    if (search.trim()) setOpen(true);
                  }}
                  placeholder={placeholder}
                  className="w-full h-12 pl-10 pr-9 text-xs rounded-xl border border-indigo-200 dark:border-indigo-900/80 bg-indigo-50/30 dark:bg-indigo-950/20 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setOpen(false);
                    }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="w-[440px] p-1.5 shadow-2xl rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 max-h-[300px] overflow-y-auto"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {filteredTenants.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No registered tenant found matching <span className="font-bold text-slate-700 dark:text-slate-300">"{search}"</span>.
            </div>
          ) : (
            filteredTenants.map((t) => {
              const isSelected = t.id === selectedTenantId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onSelectTenant(t);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all border my-0.5',
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800 shadow-xs'
                      : 'bg-white dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60 hover:bg-indigo-50/60 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs">
                      {t.name?.charAt(0).toUpperCase() || 'T'}
                    </div>
                    <div className="truncate space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 text-xs truncate">{t.name}</p>
                        {((t as any).propertyName || (t as any).buildingName) && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-slate-700">
                            {(t as any).propertyName ? `${(t as any).propertyName}` : ''}
                            {(t as any).propertyName && (t as any).buildingName ? ' • ' : ''}
                            {(t as any).buildingName ? `${(t as any).buildingName}` : ''}
                          </span>
                        )}
                        {t.roomNumber && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                            <Home className="h-3 w-3 text-indigo-600" />
                            Room {t.roomNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                        {t.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-emerald-600" />
                            {t.phone}
                          </span>
                        )}
                        {t.email && (
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <Mail className="h-3 w-3 text-blue-500" />
                            {t.email}
                          </span>
                        )}
                        {t.rent ? (
                          <span className="flex items-center gap-0.5 font-bold text-slate-800 dark:text-slate-200">
                            <IndianRupee className="h-3 w-3 text-emerald-600" />
                            {formatCurrency(t.rent)}/mo
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

