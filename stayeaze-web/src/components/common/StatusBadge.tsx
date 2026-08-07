import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'neutral';

const toneClasses: Record<Tone, string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-info/10 text-info border-info/20',
  neutral: 'bg-muted text-muted-foreground border-border',
};

interface StatusBadgeProps {
  status: string;
  tone?: Tone;
  className?: string;
}

export function StatusBadge({ status, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn('capitalize', toneClasses[tone], className)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// Helper to map common statuses to tones.
export function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (['active', 'paid', 'success', 'completed', 'resolved', 'closed', 'confirmed', 'checked_in', 'available', 'checked_out'].includes(s)) return 'success';
  if (['pending', 'partial', 'notice_period', 'partially_occupied', 'in_progress'].includes(s)) return 'warning';
  if (['reserved', 'partially_reserved', 'open', 'low', 'medium', 'high'].includes(s)) return 'info';
  if (['occupied', 'fully_occupied'].includes(s)) return 'default';
  if (['overdue', 'failed', 'cancelled', 'expired', 'suspended', 'critical', 'inactive', 'maintenance', 'blocked', 'archived'].includes(s)) return 'destructive';
  return 'neutral';
}
