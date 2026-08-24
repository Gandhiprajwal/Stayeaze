import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface RowActionItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'indigo';
  disabled?: boolean;
  separatorBefore?: boolean;
  sectionHeader?: string;
  badge?: string;
  description?: string;
  className?: string;
}

interface RowActionsProps {
  items: (RowActionItem | false | null | undefined)[];
  label?: string;
  className?: string;
}

export function RowActions({ items, label = 'Actions', className = 'w-56' }: RowActionsProps) {
  const activeItems = items.filter(Boolean) as RowActionItem[];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/80 data-[state=open]:bg-muted">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={`${className} p-1.5 shadow-xl border-border/60 bg-popover/95 backdrop-blur-sm rounded-xl`}>
        {label && (
          <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </DropdownMenuLabel>
        )}
        {label && <DropdownMenuSeparator className="my-1 bg-border/40" />}
        {activeItems.map((item, idx) => (
          <React.Fragment key={`${item.label}-${idx}`}>
            {item.separatorBefore && <DropdownMenuSeparator className="my-1.5 bg-border/50" />}
            {item.sectionHeader && (
              <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                {item.sectionHeader}
              </div>
            )}
            <DropdownMenuItem
              onSelect={(e) => { e.preventDefault(); item.onSelect(); }}
              disabled={item.disabled}
              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-xs font-medium ${
                item.variant === 'destructive'
                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus:bg-rose-50 dark:focus:bg-rose-950/40 focus:text-rose-700'
                  : item.variant === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 focus:bg-emerald-50 dark:focus:bg-emerald-950/40'
                  : item.variant === 'indigo'
                  ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 focus:bg-indigo-50 dark:focus:bg-indigo-950/40'
                  : 'hover:bg-muted/70 focus:bg-muted/70'
              } ${item.className || ''}`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                <div className="flex flex-col text-left">
                  <span>{item.label}</span>
                  {item.description && (
                    <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                      {item.description}
                    </span>
                  )}
                </div>
              </div>
              {item.badge && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium h-4 shrink-0 border-muted-foreground/30">
                  {item.badge}
                </Badge>
              )}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
