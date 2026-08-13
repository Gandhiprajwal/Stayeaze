import { useState } from 'react';
import { 
  Users, Building2, Wallet, Calendar, ShieldCheck, Sparkles, 
  Search, Download, RefreshCw, LogIn, Clock, ArrowUpRight, CheckCircle2, AlertTriangle, XCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, statusTone } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency, formatDate, exportToCSV } from '@/lib/format';
import { useAuthStore } from '@/lib/stores/auth-store';

export interface Subscriber {
  id: string;
  name: string;
  subdomain: string;
  ownerName: string;
  ownerEmail: string;
  ownerMobile: string;
  propertyCount: number;
  totalBeds: number;
  occupiedBeds: number;
  planName: string;
  planPrice: number;
  billingCycle: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED';
  paymentId?: string;
  orderId?: string;
  gstin?: string;
}

export default function SubscribersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [search, setSearch] = useState('');
  const [extendTarget, setExtendTarget] = useState<Subscriber | null>(null);
  const [extendDays, setExtendDays] = useState<number>(30);

  const { data: subscribers, isLoading } = useQuery<Subscriber[]>({
    queryKey: ['super-admin-subscribers'],
    queryFn: () => api.get('/super-admin/subscribers').then((r) => r.data),
  });

  const totalSubscribers = subscribers?.length ?? 0;
  const activeSubscribers = subscribers?.filter((s) => s.status === 'ACTIVE').length ?? 0;
  const trialSubscribers = subscribers?.filter((s) => s.status === 'TRIAL').length ?? 0;
  const totalProperties = subscribers?.reduce((sum, s) => sum + (s.propertyCount || 0), 0) ?? 0;
  const totalBeds = subscribers?.reduce((sum, s) => sum + (s.totalBeds || 0), 0) ?? 0;
  const totalSaasRev = subscribers?.filter((s) => s.status === 'ACTIVE').reduce((sum, s) => sum + (s.planPrice || 0), 0) ?? 0;

  // Extend Subscription Mutation
  const extendMut = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const res = await api.post(`/super-admin/subscribers/${id}/extend?days=${days}`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Subscription validity extended successfully!');
      setExtendTarget(null);
      queryClient.invalidateQueries({ queryKey: ['super-admin-subscribers'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to extend subscription');
    },
  });

  // Support Impersonation Mutation
  const impersonateMut = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await api.post(`/super-admin/subscribers/${orgId}/impersonate`);
      return res.data;
    },
    onSuccess: (data) => {
      const { accessToken, id, email, roles, orgId } = data;
      setAuth({ id, email, role: roles[0] || 'OWNER', orgId }, accessToken);
      toast.success(`Logged in as Subscriber Owner (${email}) for support assistance!`);
      navigate('/dashboard');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to log in as subscriber');
    },
  });

  const filtered = (subscribers ?? []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.subdomain.toLowerCase().includes(q) ||
      s.ownerName.toLowerCase().includes(q) ||
      s.ownerEmail.toLowerCase().includes(q) ||
      s.planName.toLowerCase().includes(q)
    );
  });

  const columns: Column<Subscriber>[] = [
    {
      key: 'name',
      header: 'Subscriber Business',
      sortable: true,
      cell: (r) => (
        <div className="space-y-0.5">
          <div className="font-bold text-slate-900 dark:text-slate-100">{r.name}</div>
          <div className="text-xs font-mono text-blue-600 dark:text-blue-400">{r.subdomain}.stayeaze.com</div>
        </div>
      ),
    },
    {
      key: 'ownerName',
      header: 'Owner Contact',
      cell: (r) => (
        <div className="space-y-0.5 text-xs">
          <div className="font-medium text-slate-800 dark:text-slate-200">{r.ownerName}</div>
          <div className="text-slate-500">{r.ownerEmail} • {r.ownerMobile}</div>
        </div>
      ),
    },
    {
      key: 'planName',
      header: 'Plan & Billing',
      cell: (r) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{r.planName}</div>
          <div className="text-xs text-slate-500 font-mono">
            {formatCurrency(r.planPrice)} / {r.billingCycle}
          </div>
        </div>
      ),
    },
    {
      key: 'propertyCount',
      header: 'Properties & Beds',
      cell: (r) => (
        <div className="text-xs space-y-0.5">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{r.propertyCount} Property(s)</span>
          <div className="text-slate-500">{r.occupiedBeds}/{r.totalBeds} beds occupied</div>
        </div>
      ),
    },
    {
      key: 'endDate',
      header: 'Expiry Date',
      sortable: true,
      cell: (r) => (
        <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
          {formatDate(r.endDate)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => {
        const tone = r.status === 'ACTIVE' ? 'success' : r.status === 'TRIAL' ? 'warning' : 'danger';
        return <StatusBadge tone={statusTone[tone]} label={r.status} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExtendTarget(r)}
            className="text-xs h-7 px-2"
          >
            <Clock className="mr-1 h-3 w-3 text-blue-500" /> Extend
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => impersonateMut.mutate(r.id)}
            disabled={impersonateMut.isPending}
            className="text-xs h-7 px-2 text-slate-600 hover:text-blue-600"
            title="Log in as Subscriber Owner to troubleshoot"
          >
            <LogIn className="mr-1 h-3 w-3" /> Support Login
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="SaaS Subscribers & Active Plans"
        description="Comprehensive directory of registered property owners, SaaS subscription plans, renewal dates, and support impersonation."
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToCSV('saas-subscribers', filtered)}>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total SaaS Subscribers" value={totalSubscribers} icon={Users} accent="primary" hint="Registered organizations" />
        <StatCard label="Active Paying Clients" value={activeSubscribers} icon={CheckCircle2} accent="success" hint="Paid subscription active" />
        <StatCard label="14-Day Free Trials" value={trialSubscribers} icon={Sparkles} accent="warning" hint="In trial period" />
        <StatCard label="Total Properties Managed" value={totalProperties} icon={Building2} accent="info" hint={`${totalBeds} total beds`} />
        <StatCard label="Monthly SaaS Revenue" value={formatCurrency(totalSaaSRev)} icon={Wallet} accent="success" hint="Current active recurring MRR" />
      </div>

      {/* Main Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Subscriber Name, Subdomain, Owner Email, or Plan..."
              className="pl-9"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          searchKey="name"
          searchPlaceholder="Filter subscribers..."
        />
      </div>

      {/* Extend Subscription Validity Dialog */}
      <Dialog open={!!extendTarget} onOpenChange={(open) => !open && setExtendTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Subscription Validity</DialogTitle>
            <DialogDescription>
              Grant additional validity days to subscriber <strong>{extendTarget?.name}</strong> ({extendTarget?.subdomain}.stayeaze.com).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Current Expiry Date: <strong className="font-mono">{extendTarget ? formatDate(extendTarget.endDate) : ''}</strong>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Select Extension Days:</label>
              <div className="grid grid-cols-3 gap-2">
                {[30, 60, 90].map((d) => (
                  <Button
                    key={d}
                    variant={extendDays === d ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExtendDays(d)}
                  >
                    +{d} Days
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTarget(null)}>Cancel</Button>
            <Button
              onClick={() => extendTarget && extendMut.mutate({ id: extendTarget.id, days: extendDays })}
              disabled={extendMut.isPending}
            >
              {extendMut.isPending ? 'Extending...' : 'Confirm Extension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
