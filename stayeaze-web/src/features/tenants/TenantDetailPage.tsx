import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Phone, Mail, MapPin, Calendar, Briefcase,
  CreditCard, ShieldCheck, Wallet, Home,
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
import type { Tenant, Property, Invoice } from '@/lib/types';
import { formatCurrency, formatDate, initials } from '@/lib/format';

export default function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get<Tenant>(`/tenants/${id}`).then((r) => r.data),
    enabled: !!id,
  });
  const { data: property } = useQuery({
    queryKey: ['tenant-property', tenant?.propertyId],
    queryFn: () => api.get<Property>(`/properties/${tenant?.propertyId}`).then((r) => r.data),
    enabled: !!tenant?.propertyId,
  });
  const { data: invoices } = useQuery({
    queryKey: ['tenant-invoices', id],
    queryFn: () => api.get<Invoice[]>(`/tenants/${id}/invoices`).then((r) => {
      const payload = r.data as unknown;
      if (Array.isArray(payload)) return payload as Invoice[];
      return (payload as { data: Invoice[] }).data ?? [];
    }),
    enabled: !!id,
  });

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (!tenant) return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate('/tenants')}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Tenants</Button>
      <p className="text-muted-foreground">Tenant profile not found.</p>
    </div>
  );

  const outstanding = (invoices ?? []).filter((i) => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount || 0) - Number(i.paidAmount || 0)), 0);

  const emergencyText = (tenant.emergencyName || tenant.emergencyContact)
    ? `${tenant.emergencyName || ''} ${tenant.emergencyContact ? `(${tenant.emergencyContact})` : ''}`.trim()
    : '—';

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild><Link to="/tenants"><ArrowLeft className="mr-1.5 h-4 w-4" /> Tenants</Link></Button>
      <PageHeader
        title={tenant.name}
        description={`${tenant.occupation || 'Tenant'} · ${tenant.email || tenant.phone}`}
        icon={Users}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Rent" value={formatCurrency(Number(tenant.rent || 0))} icon={Wallet} accent="primary" />
        <StatCard label="Deposit Paid" value={formatCurrency(Number(tenant.deposit || 0))} icon={CreditCard} accent="info" />
        <StatCard label="Outstanding" value={formatCurrency(outstanding)} icon={Wallet} accent={outstanding > 0 ? 'destructive' : 'success'} />
        <StatCard label="Lease Ends" value={tenant.leaseEnd ? formatDate(tenant.leaseEnd) : 'Ongoing / None'} icon={Calendar} accent="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tenant Profile</CardTitle>
            <CardDescription>Personal and identity information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials(tenant.name)}</AvatarFallback></Avatar>
              <div>
                <h3 className="font-heading text-lg font-semibold">{tenant.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={tenant.status} tone={statusTone(tenant.status)} />
                  {tenant.createdAt && <span className="text-xs text-muted-foreground">Registered {formatDate(tenant.createdAt)}</span>}
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Phone} label="Phone" value={tenant.phone || '—'} />
              <InfoRow icon={Mail} label="Email" value={tenant.email || '—'} />
              <InfoRow icon={Calendar} label="Date of Birth" value={tenant.dob ? formatDate(tenant.dob) : '—'} />
              <InfoRow icon={Briefcase} label="Occupation" value={tenant.occupation || '—'} />
              <InfoRow icon={CreditCard} label="ID Type" value={(tenant.idType || 'aadhaar').replace('_', ' ')} />
              <InfoRow icon={ShieldCheck} label="ID Number" value={tenant.idNumber || '—'} />
              <InfoRow icon={Users} label="Emergency Contact" value={emergencyText} />
              <InfoRow icon={MapPin} label="Location" value={`Room ${tenant.roomNumber || '—'} · Bed ${tenant.bedNumber || '—'}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment</CardTitle>
            <CardDescription>Property &amp; room allocation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={Home} label="Property" value={property?.name ?? '—'} />
            <InfoRow icon={MapPin} label="Building" value={tenant.buildingName || property?.name || '—'} />
            <InfoRow icon={Home} label="Room / Bed" value={`Room ${tenant.roomNumber || '—'} · Bed ${tenant.bedNumber || '—'}`} />
            <Separator />
            <InfoRow icon={Calendar} label="Lease Start" value={tenant.leaseStart ? formatDate(tenant.leaseStart) : '—'} />
            <InfoRow icon={Calendar} label="Lease End" value={tenant.leaseEnd ? formatDate(tenant.leaseEnd) : 'Ongoing / None'} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Recent invoices for this tenant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(invoices && invoices.length > 0) ? invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{inv.period} · Due {formatDate(inv.dueDate)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums">{formatCurrency(inv.amount)}</span>
                <StatusBadge status={inv.status} tone={statusTone(inv.status)} />
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No recent invoices found for this tenant.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4.5 w-4.5" /></div>
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium capitalize">{value}</p></div>
    </div>
  );
}
