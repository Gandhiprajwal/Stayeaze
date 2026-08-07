import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, MessageSquareWarning, CalendarCheck } from 'lucide-react';

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import api from '@/lib/api';
import type { Invoice, Complaint, Booking } from '@/lib/types';
import { formatCurrency, formatDate, timeAgo } from '@/lib/format';

interface Alert {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  time: string;
  tone: 'destructive' | 'warning' | 'info' | 'success';
}

export function NotificationBell() {
  const { data: invoices } = useQuery({
    queryKey: ['notif', 'invoices'],
    queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { params: { pageSize: 100 } }).then((r) => r.data.data),
  });
  const { data: complaints } = useQuery({
    queryKey: ['notif', 'complaints'],
    queryFn: () => api.get<{ data: Complaint[] }>('/complaints', { params: { pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' } }).then((r) => r.data.data),
  });
  const { data: bookings } = useQuery({
    queryKey: ['notif', 'bookings'],
    queryFn: () => api.get<{ data: Booking[] }>('/bookings', { params: { pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' } }).then((r) => r.data.data),
  });

  const overdueInvoices = invoices?.filter((i) => i.status === 'overdue').slice(0, 3) ?? [];
  const openComplaints = complaints?.filter((c) => c.status === 'open').slice(0, 3) ?? [];
  const recentBookings = bookings?.filter((b) => b.status === 'pending').slice(0, 3) ?? [];

  const allAlerts: Alert[] = [
    ...overdueInvoices.map((inv) => ({
      id: inv.id, icon: AlertTriangle, title: `Overdue: ${inv.invoiceNumber}`,
      description: `${inv.tenantName} — ${formatCurrency(inv.amount - inv.paidAmount)} outstanding`,
      time: formatDate(inv.dueDate), tone: 'destructive' as const,
    })),
    ...openComplaints.map((c) => ({
      id: c.id, icon: MessageSquareWarning, title: `Complaint ${c.ticketNumber}`,
      description: c.description, time: timeAgo(c.createdAt), tone: 'warning' as const,
    })),
    ...recentBookings.map((b) => ({
      id: b.id, icon: CalendarCheck, title: `New booking: ${b.bookingCode}`,
      description: `${b.tenantName} — check-in ${formatDate(b.checkInDate)}`,
      time: timeAgo(b.createdAt), tone: 'info' as const,
    })),
  ];

  const alertCount = allAlerts.length;
  const toneColor = {
    destructive: 'text-destructive bg-destructive/10',
    warning: 'text-warning bg-warning/10',
    info: 'text-info bg-info/10',
    success: 'text-success bg-success/10',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
          <span>Notifications</span>
          <Badge variant="secondary" className="text-[10px]">{alertCount} new</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-[360px]">
          {allAlerts.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
              No new notifications
            </div>
          ) : (
            allAlerts.map((alert) => (
              <DropdownMenuItem key={alert.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneColor[alert.tone]}`}>
                  <alert.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{alert.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{alert.description}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{alert.time}</p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem className="justify-center px-3 py-2 text-xs font-medium text-primary">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
