import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  category?: string;
  badge?: string;
  badgeTone?: 'default' | 'success' | 'warning' | 'destructive' | 'indigo';
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  clearable?: boolean;
  groupByCategory?: boolean;
}

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search options...',
  emptyText = 'No matching options found.',
  className,
  triggerClassName,
  disabled = false,
  clearable = true,
  groupByCategory = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((opt) => {
      const label = (opt.label || '').toLowerCase();
      const sublabel = (opt.sublabel || '').toLowerCase();
      const cat = (opt.category || '').toLowerCase();
      return label.includes(q) || sublabel.includes(q) || cat.includes(q);
    });
  }, [options, search]);

  const groupedOptions = useMemo(() => {
    if (!groupByCategory) return { '': filteredOptions };
    const groups: Record<string, SearchableOption[]> = {};
    for (const opt of filteredOptions) {
      const cat = opt.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(opt);
    }
    return groups;
  }, [filteredOptions, groupByCategory]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const getBadgeVariant = (tone?: string) => {
    switch (tone) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
      case 'destructive':
        return 'bg-rose-500/10 text-rose-600 border border-rose-500/20';
      case 'indigo':
        return 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between h-10 px-3 text-left font-normal border-input hover:bg-muted/40 transition-colors',
              !selectedOption && 'text-muted-foreground',
              triggerClassName
            )}
          >
            <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
              {selectedOption ? (
                <>
                  {selectedOption.icon && (
                    <selectedOption.icon className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate font-medium text-foreground text-sm">
                    {selectedOption.label}
                  </span>
                  {selectedOption.badge && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0', getBadgeVariant(selectedOption.badgeTone))}>
                      {selectedOption.badge}
                    </span>
                  )}
                  {selectedOption.sublabel && (
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                      · {selectedOption.sublabel}
                    </span>
                  )}
                </>
              ) : (
                <span>{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {clearable && selectedOption && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onChange('');
                    }
                  }}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0 opacity-70" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[280px] max-w-[420px] shadow-xl border-border bg-popover rounded-xl overflow-hidden" align="start">
          <div className="flex items-center border-b px-3 py-2 bg-muted/30">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-xs bg-transparent placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto p-1 text-xs">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">{emptyText}</div>
            ) : (
              Object.entries(groupedOptions).map(([category, items]) => (
                <div key={category} className="mb-1 last:mb-0">
                  {category && category !== 'General' && category !== '' && (
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 bg-muted/20 rounded-sm">
                      {category}
                    </div>
                  )}
                  {items.map((opt) => {
                    const isSelected = opt.value === value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={opt.disabled}
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all',
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                            : 'hover:bg-accent text-foreground hover:text-accent-foreground',
                          opt.disabled && 'opacity-40 pointer-events-none'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                          {Icon && (
                            <Icon className={cn('h-4 w-4 shrink-0', isSelected ? 'text-primary-foreground' : 'text-primary')} />
                          )}
                          <div className="truncate min-w-0">
                            <div className="truncate font-medium leading-tight">{opt.label}</div>
                            {opt.sublabel && (
                              <div
                                className={cn(
                                  'text-[10px] truncate mt-0.5',
                                  isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                )}
                              >
                                {opt.sublabel}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {opt.badge && (
                            <span
                              className={cn(
                                'text-[9px] px-1.5 py-0.5 rounded font-bold uppercase',
                                isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : getBadgeVariant(opt.badgeTone)
                              )}
                            >
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-primary-foreground ml-1" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
