import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: string; direction: 'up' | 'down'; positive?: boolean };
  hint?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'info';
}

const accentMap = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
};

export function StatCard({ label, value, icon: Icon, trend, hint, accent = 'primary' }: StatCardProps) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 p-3.5 sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs sm:text-sm font-medium text-muted-foreground">{label}</p>
          <p className="font-heading text-xl sm:text-2xl font-bold tracking-tight truncate" title={String(value)}>{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          {trend && (
            <div className="flex items-center gap-1 text-xs font-medium">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded px-1 py-0.5',
                  trend.positive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                )}
              >
                {trend.direction === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {trend.value}
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={cn('flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg', accentMap[accent])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
