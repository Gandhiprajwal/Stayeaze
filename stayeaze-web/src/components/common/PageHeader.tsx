import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap w-full sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
