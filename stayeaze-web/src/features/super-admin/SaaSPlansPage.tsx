import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CreditCard, Plus, Pencil, Trash2, CheckCircle2, XCircle, 
  Sparkles, Building2, Hotel, Users, MessageSquare, ShieldCheck, Zap,
  Wand2, Check, ArrowRight, Gauge, FileSignature, Receipt
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

const PRESET_PLANS = {
  STARTER: {
    name: 'Starter PG Plan',
    planKey: 'STARTER',
    monthlyPrice: 1499,
    annualPrice: 14390,
    maxProperties: 1,
    maxBeds: 35,
    maxStaffUsers: 2,
    allowWhatsApp: false,
    allowRazorpayOnline: true,
    allowCustomBranding: false,
    isActive: true,
    description: 'Ideal for Single-Building Standalone PGs (Up to 15 Rooms / 35 Beds in 2 & 3 sharing, 2 Staff logins).',
  },
  PROFESSIONAL: {
    name: 'Growth Hostel & PG',
    planKey: 'PROFESSIONAL',
    monthlyPrice: 3499,
    annualPrice: 33590,
    maxProperties: 2,
    maxBeds: 120,
    maxStaffUsers: 6,
    allowWhatsApp: true,
    allowRazorpayOnline: true,
    allowCustomBranding: false,
    isActive: true,
    description: 'For Multi-Wing Hostels & 2-Branch PGs (Up to 4 Buildings, 50 Rooms / 120 Beds with Meter Engine & Digital Agreements).',
  },
  ENTERPRISE: {
    name: 'Enterprise Living Chain',
    planKey: 'ENTERPRISE',
    monthlyPrice: 7999,
    annualPrice: 76790,
    maxProperties: 10,
    maxBeds: 500,
    maxStaffUsers: 25,
    allowWhatsApp: true,
    allowRazorpayOnline: true,
    allowCustomBranding: true,
    isActive: true,
    description: 'For Multi-City Co-Living Chains (Unlimited Buildings, 500+ Beds, Bulk Rent Runs, Custom Subdomain & Priority SLA).',
  },
};

const emptyForm = {
  name: '',
  planKey: 'CUSTOM',
  monthlyPrice: 1499,
  annualPrice: 14390,
  maxProperties: 1,
  maxBeds: 35,
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

  const { data: plansData } = useQuery<any>({
    queryKey: ['super-admin-plans'],
    queryFn: () => api.get('/super-admin/plans').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
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
      allowRazorpayOnline: plan.allowRazorpayOnline ?? true,
      allowCustomBranding: plan.allowCustomBranding,
      isActive: plan.isActive,
      description: plan.description || '',
    });
    setDialogOpen(true);
  }

  function loadPreset(presetKey: keyof typeof PRESET_PLANS) {
    const preset = PRESET_PLANS[presetKey];
    if (preset) {
      setForm({ ...preset });
    }
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Plan Name is required');
      return;
    }
    if (!form.planKey.trim()) {
      toast.error('Plan Key is required');
      return;
    }
    saveMutation.mutate(form);
  }

  const activePlansCount = plansList.filter((p) => p.isActive).length;
  const maxBedLimit = plansList.reduce((max, p) => Math.max(max, p.maxBeds || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="SaaS Subscription Plans & Pricing Policies"
        description="Configure PG & hostel pricing tiers, sharing bed caps, property limits, and feature entitlements."
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
          <Card key={plan.id} className={`flex flex-col rounded-3xl transition-all hover:shadow-lg ${!plan.isActive ? 'opacity-60 border-dashed' : ''} ${plan.planKey === 'PROFESSIONAL' ? 'border-2 border-blue-500/60 shadow-md shadow-blue-500/10' : ''}`}>
            <CardHeader className="p-6 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant={plan.planKey === 'ENTERPRISE' ? 'default' : plan.planKey === 'PROFESSIONAL' ? 'secondary' : 'outline'} className="mb-2 uppercase text-[10px] font-bold">
                    {plan.planKey}
                  </Badge>
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => openEdit(plan)}>
                  <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
              </div>
              <CardDescription className="text-xs mt-1 line-clamp-2 leading-relaxed">{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="px-6 flex-1 space-y-4">
              <div className="border-y border-border/60 py-3.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold font-mono">{formatCurrency(plan.monthlyPrice)}</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                  <span>Annual: {formatCurrency(plan.annualPrice)}/yr</span>
                  <Badge variant="outline" className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300">
                    20% Discount
                  </Badge>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-primary" /> Properties & Wings</span>
                  <span className="font-semibold">{plan.maxProperties} Workspace(s)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Hotel className="h-3.5 w-3.5 text-blue-500" /> Max Bed Capacity</span>
                  <span className="font-semibold text-primary">{plan.maxBeds} Beds (2 & 3 sharing)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-amber-500" /> Max Staff Accounts</span>
                  <span className="font-semibold">{plan.maxStaffUsers} Logins</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Automation</span>
                  {plan.allowWhatsApp ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold">Enabled</Badge>
                  ) : (
                    <span className="text-muted-foreground font-mono text-[11px]">1-Click Only</span>
                  )}
                </div>
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5 text-indigo-500" /> Direct Razorpay Gateway</span>
                  {plan.allowRazorpayOnline ? (
                    <Badge variant="secondary" className="text-[10px] bg-indigo-500/10 text-indigo-600 font-semibold">Per-Property Payout</Badge>
                  ) : (
                    <span className="text-muted-foreground font-mono text-[11px]">Offline Tracking</span>
                  )}
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-purple-500" /> Custom Subdomain & Branding</span>
                  {plan.allowCustomBranding ? (
                    <Badge variant="secondary" className="text-[10px] bg-purple-500/10 text-purple-600 font-semibold">White-label</Badge>
                  ) : (
                    <span className="text-muted-foreground font-mono text-[11px]">Standard</span>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t bg-muted/20 px-6 py-3.5 rounded-b-3xl flex justify-between items-center">
              <Badge variant={plan.isActive ? 'secondary' : 'outline'} className="text-[10px] font-semibold">
                {plan.isActive ? 'Published / Active' : 'Inactive Tier'}
              </Badge>
              {plan.isActive && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => deleteMutation.mutate(plan.id)}>
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
        title={editing ? 'Edit Subscription Plan & Policies' : 'Create New SaaS Subscription Plan'}
        onSubmit={handleSubmit}
        loading={saveMutation.isPending}
        submitLabel={editing ? 'Save Changes' : 'Create Plan'}
        size="lg"
      >
        <div className="space-y-4">
          {/* 1-Click Template Presets */}
          <div className="p-3 bg-muted/30 rounded-xl border space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <span>1-Click Real-World PG Plan Presets</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] font-medium rounded-lg hover:bg-primary/10 hover:text-primary"
                onClick={() => loadPreset('STARTER')}
              >
                Starter PG (₹1,499 / 35 Beds)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] font-medium rounded-lg hover:bg-primary/10 hover:text-primary"
                onClick={() => loadPreset('PROFESSIONAL')}
              >
                Growth Hostel (₹3,499 / 120 Beds)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] font-medium rounded-lg hover:bg-primary/10 hover:text-primary"
                onClick={() => loadPreset('ENTERPRISE')}
              >
                Enterprise Living (₹7,999 / 500+ Beds)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="Plan Display Name"
              required
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Growth Hostel & PG"
            />
            <FormInput
              label="Plan Key Code"
              required
              id="planKey"
              value={form.planKey}
              onChange={(e) => setForm({ ...form, planKey: e.target.value.toUpperCase() })}
              placeholder="STARTER / PROFESSIONAL / ENTERPRISE"
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
              placeholder="e.g. 3499"
            />
            <FormInput
              label="Annual Price (₹ with 20% OFF)"
              type="number"
              required
              id="annualPrice"
              value={form.annualPrice}
              onChange={(e) => setForm({ ...form, annualPrice: Number(e.target.value) })}
              placeholder="e.g. 33590"
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
              placeholder="e.g. 2"
            />
            <FormInput
              label="Max Bed Cap (2/3 sharing)"
              type="number"
              required
              id="maxBeds"
              value={form.maxBeds}
              onChange={(e) => setForm({ ...form, maxBeds: Number(e.target.value) })}
              placeholder="e.g. 120"
            />
            <FormInput
              label="Max Staff Accounts"
              type="number"
              required
              id="maxStaffUsers"
              value={form.maxStaffUsers}
              onChange={(e) => setForm({ ...form, maxStaffUsers: Number(e.target.value) })}
              placeholder="e.g. 6"
            />
          </div>

          <FormTextarea
            label="Plan Description & Policies"
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="e.g. For Multi-Wing Hostels & 2-Branch PGs (Up to 4 Buildings, 50 Rooms / 120 Beds with Meter Engine & Digital Agreements)."
          />

          <div className="space-y-2.5 rounded-xl border p-3.5 bg-muted/20">
            <Label className="text-xs font-semibold">Operational Policies & Feature Entitlements</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg border bg-background hover:bg-muted/40">
                <Checkbox
                  checked={form.allowWhatsApp}
                  onCheckedChange={(checked) => setForm({ ...form, allowWhatsApp: !!checked })}
                />
                <span className="font-medium">Automated WhatsApp Notifications & Deep Links</span>
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg border bg-background hover:bg-muted/40">
                <Checkbox
                  checked={form.allowRazorpayOnline}
                  onCheckedChange={(checked) => setForm({ ...form, allowRazorpayOnline: !!checked })}
                />
                <span className="font-medium">Direct Per-Property Razorpay Settlements</span>
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg border bg-background hover:bg-muted/40">
                <Checkbox
                  checked={form.allowCustomBranding}
                  onCheckedChange={(checked) => setForm({ ...form, allowCustomBranding: !!checked })}
                />
                <span className="font-medium">Custom Subdomain & White-Label Branding</span>
              </label>

              <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded-lg border bg-background hover:bg-muted/40">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: !!checked })}
                />
                <span className="font-medium">Published & Active for Subscription</span>
              </label>
            </div>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
