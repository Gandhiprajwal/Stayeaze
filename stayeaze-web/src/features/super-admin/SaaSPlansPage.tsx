import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CreditCard, Plus, Pencil, Trash2, CheckCircle2, XCircle, 
  Sparkles, Building2, Hotel, Users, MessageSquare, ShieldCheck, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { FormDialog } from '@/components/common/FormDialog';
import { FormInput, FormTextarea } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/format';

export interface SaaSPlan {
  id: string;
  name: string;
  planKey: string;
  monthlyPrice: number;
  annualPrice: number;
  maxProperties: number;
  maxBeds: number;
  maxStaffUsers: number;
  allowWhatsApp: boolean;
  allowRazorpayOnline: boolean;
  allowCustomBranding: boolean;
  isActive: boolean;
  description: string;
}

const emptyForm = {
  name: '',
  planKey: 'CUSTOM',
  monthlyPrice: 1499,
  annualPrice: 14990,
  maxProperties: 1,
  maxBeds: 25,
  maxStaffUsers: 2,
  allowWhatsApp: false,
  allowRazorpayOnline: true,
  allowCustomBranding: false,
  isActive: true,
  description: '',
};

export default function SaaSPlansPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SaaSPlan | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: plansData, isLoading } = useQuery<any>({
    queryKey: ['super-admin-plans'],
    queryFn: () => api.get('/super-admin/plans').then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes (Instant navigation)
    gcTime: 10 * 60 * 1000,
  });

  const plansList: SaaSPlan[] = Array.isArray(plansData) 
    ? plansData 
    : (Array.isArray((plansData as any)?.data) ? (plansData as any).data : []);

  const saveMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editing) {
        return api.put(`/super-admin/plans/${editing.id}`, payload);
      }
      return api.post('/super-admin/plans', payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Plan updated successfully' : 'New SaaS plan created');
      qc.invalidateQueries({ queryKey: ['super-admin-plans'] });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/plans/${id}`),
    onSuccess: () => {
      toast.success('Plan deactivated');
      qc.invalidateQueries({ queryKey: ['super-admin-plans'] });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(plan: SaaSPlan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      planKey: plan.planKey,
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice,
      maxProperties: plan.maxProperties,
      maxBeds: plan.maxBeds,
      maxStaffUsers: plan.maxStaffUsers,
      allowWhatsApp: plan.allowWhatsApp,
      allowRazorpayOnline: plan.allowRazorpayOnline,
      allowCustomBranding: plan.allowCustomBranding,
      isActive: plan.isActive,
      description: plan.description || '',
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Plan Name is required');
      return;
    }
    saveMutation.mutate(form);
  }

  const activePlansCount = plansList.filter((p) => p.isActive).length;
  const maxBedLimit = plansList.reduce((max, p) => Math.max(max, p.maxBeds || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SaaS Subscription Plans & Limits"
        description="Configure database-driven pricing tiers, property caps, bed limits, and feature flags."
        icon={CreditCard}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Create SaaS Plan
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total SaaS Plans" value={plansList.length} icon={CreditCard} accent="primary" />
        <StatCard label="Active Published Tiers" value={activePlansCount} icon={CheckCircle2} accent="success" />
        <StatCard label="Highest Bed Cap" value={`${maxBedLimit} beds`} icon={Hotel} accent="warning" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plansList.map((plan) => (
          <Card key={plan.id} className={`flex flex-col transition-all hover:shadow-lg ${!plan.isActive ? 'opacity-60 border-dashed' : ''}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant={plan.planKey === 'ENTERPRISE' ? 'default' : plan.planKey === 'PROFESSIONAL' ? 'secondary' : 'outline'} className="mb-2">
                    {plan.planKey}
                  </Badge>
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(plan)}>
                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              </div>
              <CardDescription className="text-xs mt-1 line-clamp-2">{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-4">
              <div className="border-y py-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold">{formatCurrency(plan.monthlyPrice)}</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Annual: {formatCurrency(plan.annualPrice)}/yr</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /> Max Properties</span>
                  <span className="font-semibold">{plan.maxProperties} Workspace(s)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Hotel className="h-3.5 w-3.5 text-info" /> Max Bed Cap</span>
                  <span className="font-semibold">{plan.maxBeds} Beds</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-warning" /> Max Staff Accounts</span>
                  <span className="font-semibold">{plan.maxStaffUsers} Users</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Notifications</span>
                  {plan.allowWhatsApp ? <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">Enabled</Badge> : <span className="text-muted-foreground font-mono">Off</span>}
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-purple-500" /> Custom Branding</span>
                  {plan.allowCustomBranding ? <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600">Enabled</Badge> : <span className="text-muted-foreground font-mono">Off</span>}
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t bg-muted/20 pt-3 flex justify-between items-center">
              <Badge variant={plan.isActive ? 'secondary' : 'outline'} className="text-[10px]">
                {plan.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {plan.isActive && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(plan.id)}>
                  Deactivate
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit Subscription Plan' : 'Create New SaaS Plan'}
        onSubmit={handleSubmit}
        loading={saveMutation.isPending}
        submitLabel={editing ? 'Save Changes' : 'Create Plan'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="Plan Display Name"
              required
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Starter Plan"
            />
            <FormInput
              label="Plan Key Code"
              required
              id="planKey"
              value={form.planKey}
              onChange={(e) => setForm({ ...form, planKey: e.target.value.toUpperCase() })}
              placeholder="STARTER / PRO / ENTERPRISE"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="Monthly Price (₹)"
              type="number"
              required
              id="monthlyPrice"
              value={form.monthlyPrice}
              onChange={(e) => setForm({ ...form, monthlyPrice: Number(e.target.value) })}
              placeholder="e.g. 1499"
            />
            <FormInput
              label="Annual Price (₹)"
              type="number"
              required
              id="annualPrice"
              value={form.annualPrice}
              onChange={(e) => setForm({ ...form, annualPrice: Number(e.target.value) })}
              placeholder="e.g. 14990"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormInput
              label="Max Properties"
              type="number"
              required
              id="maxProperties"
              value={form.maxProperties}
              onChange={(e) => setForm({ ...form, maxProperties: Number(e.target.value) })}
              placeholder="e.g. 1"
            />
            <FormInput
              label="Max Bed Cap"
              type="number"
              required
              id="maxBeds"
              value={form.maxBeds}
              onChange={(e) => setForm({ ...form, maxBeds: Number(e.target.value) })}
              placeholder="e.g. 50"
            />
            <FormInput
              label="Max Staff Users"
              type="number"
              required
              id="maxStaffUsers"
              value={form.maxStaffUsers}
              onChange={(e) => setForm({ ...form, maxStaffUsers: Number(e.target.value) })}
              placeholder="e.g. 5"
            />
          </div>

          <FormTextarea
            label="Plan Description"
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="e.g. Ideal for single PG owners looking for complete operational automation."
          />

          <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
            <Label className="text-xs font-semibold">Feature Access Flags</Label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={form.allowWhatsApp}
                  onCheckedChange={(checked) => setForm({ ...form, allowWhatsApp: !!checked })}
                />
                <span>Allow Automated WhatsApp Alerts</span>
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={form.allowCustomBranding}
                  onCheckedChange={(checked) => setForm({ ...form, allowCustomBranding: !!checked })}
                />
                <span>Allow Custom Property Branding</span>
              </label>
            </div>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
