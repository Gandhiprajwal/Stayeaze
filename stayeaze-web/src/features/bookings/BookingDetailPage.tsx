import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarCheck, Calendar, Wallet, Home,
  MapPin, Phone, Mail, User, ShieldCheck, Tag, CreditCard,
} from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import api from '@/lib/api';
import { propertyService } from '@/lib/services';
import type { Booking } from '@/lib/types';
import { formatCurrency, formatDate, initials } from '@/lib/format';

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get<Booking>(`/bookings/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: minimalProperties } = useQuery({
    queryKey: ['properties-minimal'],
    queryFn: () => propertyService.getMinimal(),
  });
  const propList = Array.isArray(minimalProperties) ? minimalProperties : (minimalProperties as any)?.data || [];
  const propertyName = propList.find((p: any) => p.id === booking?.propertyId)?.name;

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (!booking) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate('/bookings')}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Bookings</Button>
      <p className="text-muted-foreground">Booking details not found.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/bookings"><ArrowLeft className="mr-1.5 h-4 w-4" /> Bookings</Link>
      </Button>

      <PageHeader
        title={`Booking ${booking.bookingCode || 'Details'}`}
        description={`${booking.tenantName} · Source: ${booking.source}`}
        icon={CalendarCheck}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Rent" value={formatCurrency(Number(booking.rent || 0))} icon={Wallet} accent="primary" />
        <StatCard label="Deposit Agreed" value={formatCurrency(Number(booking.deposit || 0))} icon={CreditCard} accent="info" />
        <StatCard label="Duration" value={`${booking.durationMonths || 6} Months`} icon={Calendar} accent="warning" />
        <StatCard label="Check-in Date" value={booking.checkInDate ? formatDate(booking.checkInDate) : '—'} icon={CalendarCheck} accent="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tenant & Contact Information</CardTitle>
            <CardDescription>Guest details provided during booking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {initials(booking.tenantName || 'Guest')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-heading text-lg font-semibold">{booking.tenantName}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={booking.status} tone={statusTone(booking.status)} />
                  {booking.createdAt && <span className="text-xs text-muted-foreground">Booked on {formatDate(booking.createdAt)}</span>}
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={User} label="Tenant Name" value={booking.tenantName || '—'} />
              <InfoRow icon={Mail} label="Email Address" value={booking.tenantEmail || '—'} />
              <InfoRow icon={Phone} label="Phone Number" value={booking.tenantPhone || '—'} />
              <InfoRow icon={Tag} label="Booking Source" value={booking.source || 'direct'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Room Allocation</CardTitle>
            <CardDescription>Property &amp; bed assignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={Home} label="Property" value={propertyName ?? '—'} />
            <InfoRow icon={MapPin} label="Room Number" value={booking.roomNumber ? `Room ${booking.roomNumber}` : '—'} />
            <InfoRow icon={ShieldCheck} label="Bed Number" value={booking.bedNumber || '—'} />
            <Separator />
            <InfoRow icon={CalendarCheck} label="Check-in Date" value={booking.checkInDate ? formatDate(booking.checkInDate) : '—'} />
            <InfoRow icon={Calendar} label="Duration" value={`${booking.durationMonths || 6} Months`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  const isEmailOrId = label.toLowerCase().includes('email') || label.toLowerCase().includes('id') || label.toLowerCase().includes('phone');
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4.5 w-4.5" /></div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-medium ${isEmailOrId ? 'normal-case' : 'capitalize'}`}>{value}</p>
      </div>
    </div>
  );
}
