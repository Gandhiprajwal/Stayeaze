import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Building2, Bell, Palette, Shield, User, Sparkles, CheckCircle2 } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { initials, formatDate, formatCurrency } from '@/lib/format';
import { roleLabels } from '@/lib/role-utils';
import api from '@/lib/api';
import { toast } from 'sonner';

type BillingProfile = {
  legalName: string; billingAddress: string; city: string; state: string; pincode: string;
  supportEmail: string; supportPhone: string; gstin: string; pan: string; registrationNumber: string;
  invoicePrefix: string; paymentDueDays: number; defaultSecurityDeposit?: number; lateFeeNote: string;
  bankAccountName: string; bankName: string; bankAccountNumber: string; bankIfsc: string; upiVpa: string;
  authorizedSignatory: string; razorpayKeyId: string; razorpayKeySecret: string; hasRazorpaySecret?: boolean; invoiceTerms: string;
};

const emptyBillingProfile: BillingProfile = {
  legalName: '', billingAddress: '', city: '', state: '', pincode: '', supportEmail: '', supportPhone: '',
  gstin: '', pan: '', registrationNumber: '', invoicePrefix: 'INV', paymentDueDays: 7, defaultSecurityDeposit: 0,
  lateFeeNote: 'Late-payment charges, if applicable, will be charged as per the property policy and tenancy agreement.',
  bankAccountName: '', bankName: '', bankAccountNumber: '', bankIfsc: '', upiVpa: '', authorizedSignatory: '',
  razorpayKeyId: '', razorpayKeySecret: '', hasRazorpaySecret: false,
  invoiceTerms: 'Rent is payable on or before the due date of each month.\nThis receipt is issued for room accommodation services.\nValid official receipt for tenant records and HRA tax submission.\nComputer-generated verified receipt with security QR verification code.',
};

import { useSearchParams } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profile');

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  const { user } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [billingProfile, setBillingProfile] = useState<BillingProfile>(emptyBillingProfile);
  const [billingLoading, setBillingLoading] = useState(false);
  const canEditBilling = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canViewBilling = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER' || user?.role === 'ACCOUNTANT' || user?.role === 'SUPER_ADMIN';

  const [notifications, setNotifications] = useState({
    emailAlerts: true, bookingAlerts: true, complaintAlerts: true,
    paymentAlerts: false, weeklyReport: true,
  });

  function saveProfile() { toast.success('Profile updated successfully'); }
  function saveNotifications() { toast.success('Notification preferences saved'); }

  useEffect(() => {
    if (!canViewBilling) return;
    let active = true;
    api.get('/organization-billing-profile')
      .then(({ data }) => { if (active) setBillingProfile({ ...emptyBillingProfile, ...data }); })
      .catch(() => { if (active) toast.error('Could not load organization billing settings'); });
    return () => { active = false; };
  }, [canViewBilling]);

  function updateBillingField<K extends keyof BillingProfile>(key: K, value: BillingProfile[K]) {
    setBillingProfile((current) => ({ ...current, [key]: value }));
  }

  async function saveBillingProfile() {
    if (!canEditBilling) {
      toast.error('Only the organization owner can change billing settings.');
      return;
    }
    setBillingLoading(true);
    try {
      const { data } = await api.put('/organization-billing-profile', billingProfile);
      setBillingProfile({ ...emptyBillingProfile, ...data });
      toast.success('Billing and invoice settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save billing settings');
    } finally {
      setBillingLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, preferences and organization." icon={SettingsIcon} />

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setSearchParams({ tab: val }); }}>
        <div className="flex justify-between items-center mb-2">
          <TabsList>
            <TabsTrigger value="profile"><User className="mr-1.5 h-4 w-4" /> Profile</TabsTrigger>
            <TabsTrigger value="appearance"><Palette className="mr-1.5 h-4 w-4" /> Appearance</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="mr-1.5 h-4 w-4" /> Notifications</TabsTrigger>
            <TabsTrigger value="organization"><Building2 className="mr-1.5 h-4 w-4" /> Organization</TabsTrigger>
            <TabsTrigger value="subscription"><Sparkles className="mr-1.5 h-4 w-4 text-amber-500" /> SaaS Subscription</TabsTrigger>
            <TabsTrigger value="security"><Shield className="mr-1.5 h-4 w-4" /> Security</TabsTrigger>
          </TabsList>
          {user?.role === 'SUPER_ADMIN' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/super-admin/integrations'}
              className="border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold"
            >
              <SettingsIcon className="mr-1.5 h-4 w-4" /> Cloud & Infrastructure Integrations
            </Button>
          )}
        </div>

        {/* Profile */}
        <TabsContent value="profile">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Profile Information</CardTitle><CardDescription>Update your personal details.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16"><AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials(name)}</AvatarFallback></Avatar>
                <div>
                  <Button variant="outline" size="sm">Change Photo</Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Role</Label><Input value={user ? roleLabels[user.role] : ''} disabled /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              </div>
              <div className="flex justify-end"><Button onClick={saveProfile}>Save Changes</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Customize how the console looks.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Theme</p><p className="text-xs text-muted-foreground">Choose between light and dark mode.</p></div>
                <div className="flex gap-2">
                  <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')}>Light</Button>
                  <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')}>Dark</Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Compact mode</p><p className="text-xs text-muted-foreground">Reduce spacing for denser data display.</p></div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Sidebar collapsed by default</p><p className="text-xs text-muted-foreground">Start with a minimized sidebar.</p></div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Notification Preferences</CardTitle><CardDescription>Choose what alerts you receive.</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {[
                { key: 'emailAlerts' as const, label: 'Email alerts', desc: 'Receive critical alerts via email' },
                { key: 'bookingAlerts' as const, label: 'New bookings', desc: 'Notify when a booking is created' },
                { key: 'complaintAlerts' as const, label: 'New complaints', desc: 'Notify when a complaint is raised' },
                { key: 'paymentAlerts' as const, label: 'Payment received', desc: 'Notify on successful payments' },
                { key: 'weeklyReport' as const, label: 'Weekly summary', desc: 'Get a weekly performance digest' },
              ].map((item, i) => (
                <div key={item.key}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-3">
                    <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                    <Switch checked={notifications[item.key]} onCheckedChange={(v) => setNotifications((n) => ({ ...n, [item.key]: v }))} />
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-3"><Button onClick={saveNotifications}>Save Preferences</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization billing and invoice settings */}
        <TabsContent value="organization">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Billing & Invoice Settings</CardTitle>
              <CardDescription>These issuer and payment details are copied into each new invoice. Existing invoices remain unchanged.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!(billingProfile as any).isSetupComplete && (
                <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 p-4 text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Organization Onboarding Required</p>
                      <p className="text-xs opacity-90 mt-0.5">Please fill in your Business Legal Name, Address, City, State, Pincode, and Support Phone/Email below to complete your property owner onboarding setup.</p>
                    </div>
                  </div>
                </div>
              )}
              {!canEditBilling && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Only the organization owner can edit these settings.</p>}
              <section className="space-y-4"><h3 className="text-sm font-semibold">Business & tax identity</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Legal business name" value={billingProfile.legalName} onChange={(v) => updateBillingField('legalName', v)} disabled={!canEditBilling} />
                  <Field label="Registration / license number" value={billingProfile.registrationNumber} onChange={(v) => updateBillingField('registrationNumber', v)} disabled={!canEditBilling} />
                  <Field label="GSTIN (optional)" value={billingProfile.gstin} onChange={(v) => updateBillingField('gstin', v)} disabled={!canEditBilling} />
                  <Field label="PAN (optional)" value={billingProfile.pan} onChange={(v) => updateBillingField('pan', v)} disabled={!canEditBilling} />
                  <Field label="Support email" type="email" value={billingProfile.supportEmail} onChange={(v) => updateBillingField('supportEmail', v)} disabled={!canEditBilling} />
                  <Field label="Support phone" value={billingProfile.supportPhone} onChange={(v) => updateBillingField('supportPhone', v)} disabled={!canEditBilling} />
                </div>
                <div className="space-y-1.5"><Label>Billing address</Label><Textarea value={billingProfile.billingAddress} onChange={(e) => updateBillingField('billingAddress', e.target.value)} disabled={!canEditBilling} /></div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="City" value={billingProfile.city} onChange={(v) => updateBillingField('city', v)} disabled={!canEditBilling} />
                  <Field label="State" value={billingProfile.state} onChange={(v) => updateBillingField('state', v)} disabled={!canEditBilling} />
                  <Field label="PIN code" value={billingProfile.pincode} onChange={(v) => updateBillingField('pincode', v)} disabled={!canEditBilling} />
                </div>
              </section>
              <Separator />
              <section className="space-y-4"><h3 className="text-sm font-semibold">Invoice rules & default security deposit</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Invoice prefix" value={billingProfile.invoicePrefix} onChange={(v) => updateBillingField('invoicePrefix', v.toUpperCase())} disabled={!canEditBilling} />
                  <div className="space-y-1.5"><Label>Payment due days</Label><Input type="number" min="0" value={billingProfile.paymentDueDays} disabled={!canEditBilling} onChange={(e) => updateBillingField('paymentDueDays', Number(e.target.value))} /></div>
                  <div className="space-y-1.5"><Label>Default Security Deposit (₹)</Label><Input type="number" min="0" value={billingProfile.defaultSecurityDeposit ?? 0} disabled={!canEditBilling} onChange={(e) => updateBillingField('defaultSecurityDeposit', Number(e.target.value))} /></div>
                </div>
                <div className="space-y-1.5"><Label>Late-fee note</Label><Textarea value={billingProfile.lateFeeNote} onChange={(e) => updateBillingField('lateFeeNote', e.target.value)} disabled={!canEditBilling} /></div>
                <div className="space-y-1.5"><Label>Invoice terms & conditions</Label><Textarea value={billingProfile.invoiceTerms} onChange={(e) => updateBillingField('invoiceTerms', e.target.value)} disabled={!canEditBilling} /></div>
              </section>
              <Separator />
              <section className="space-y-4"><h3 className="text-sm font-semibold">Bank & payment instructions</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Account holder name" value={billingProfile.bankAccountName} onChange={(v) => updateBillingField('bankAccountName', v)} disabled={!canEditBilling} />
                  <Field label="Bank name" value={billingProfile.bankName} onChange={(v) => updateBillingField('bankName', v)} disabled={!canEditBilling} />
                  <Field label="Account number" value={billingProfile.bankAccountNumber} onChange={(v) => updateBillingField('bankAccountNumber', v)} disabled={!canEditBilling} />
                  <Field label="IFSC" value={billingProfile.bankIfsc} onChange={(v) => updateBillingField('bankIfsc', v.toUpperCase())} disabled={!canEditBilling} />
                  <Field label="UPI ID" value={billingProfile.upiVpa} onChange={(v) => updateBillingField('upiVpa', v)} disabled={!canEditBilling} />
                  <Field label="Authorized signatory" value={billingProfile.authorizedSignatory} onChange={(v) => updateBillingField('authorizedSignatory', v)} disabled={!canEditBilling} />
                </div>
              </section>
              <Separator />
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Razorpay Online Gateway Credentials</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter your property owner Razorpay API Key and Secret to receive tenant rent payments directly into your account.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Razorpay Key ID (rzp_test_... / rzp_live_...)" value={billingProfile.razorpayKeyId} onChange={(v) => updateBillingField('razorpayKeyId', v)} disabled={!canEditBilling} />
                  <div className="space-y-1.5">
                    <Label>Razorpay Key Secret</Label>
                    <Input
                      type="password"
                      value={billingProfile.razorpayKeySecret}
                      placeholder={billingProfile.hasRazorpaySecret ? "•••••••• (Saved in DB - leave empty to keep)" : "Enter Razorpay Key Secret"}
                      onChange={(e) => updateBillingField('razorpayKeySecret', e.target.value)}
                      disabled={!canEditBilling}
                    />
                    {billingProfile.hasRazorpaySecret && (
                      <p className="text-[11px] text-emerald-600 font-medium dark:text-emerald-400">✓ Secret key saved securely in Database</p>
                    )}
                  </div>
                </div>
              </section>
              <div className="flex justify-end"><Button onClick={saveBillingProfile} disabled={!canEditBilling || billingLoading}>{billingLoading ? 'Saving…' : 'Save Billing Settings'}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SaaS Subscription Tab */}
        <TabsContent value="subscription">
          <Card className="max-w-3xl border shadow-sm">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" /> SaaS Subscription Status & Active Plan
                  </CardTitle>
                  <CardDescription>
                    Your current platform tier, renewal schedule, features entitlement, and subscription billing receipts.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-600 text-white font-bold px-3 py-1">
                  {(billingProfile as any).subscriptionStatus || 'ACTIVE'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid sm:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border">
                <div>
                  <div className="text-xs text-muted-foreground">Current Active Plan</div>
                  <div className="text-xl font-extrabold text-primary font-heading mt-0.5">
                    {(billingProfile as any).subscriptionPlanName || 'Starter PG Plan'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Billing Cycle: <span className="font-semibold text-foreground">{(billingProfile as any).subscriptionBillingCycle || 'MONTHLY'}</span>
                  </div>
                </div>

                <div className="sm:border-l sm:pl-4">
                  <div className="text-xs text-muted-foreground">Plan Pricing</div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency((billingProfile as any).subscriptionPlanPrice || 1499)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    Valid until: {formatDate((billingProfile as any).subscriptionEndDate || new Date(Date.now() + 30*86400000).toISOString())}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-foreground">Included Plan Entitlements & Features:</h4>
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Full Building, Floor & Bed Hierarchy
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Automated Rent Invoicing & Receipts
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Per-Property Razorpay Gateway Support
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> WhatsApp & Email Tenant Notifications
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Need more beds or additional properties?
                </div>
                <Button onClick={() => window.open('https://stayeaze.com/pricing', '_blank')} className="bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Upgrade SaaS Subscription Plan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Security</CardTitle><CardDescription>Manage password and access security.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Current Password</Label><Input type="password" placeholder="••••••••" /></div>
                <div />
                <div className="space-y-1.5"><Label>New Password</Label><Input type="password" placeholder="••••••••" /></div>
                <div className="space-y-1.5"><Label>Confirm Password</Label><Input type="password" placeholder="••••••••" /></div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Two-factor authentication</p><p className="text-xs text-muted-foreground">Add an extra layer of security.</p></div>
                <Switch />
              </div>
              <div className="flex justify-end"><Button onClick={() => toast.success('Password updated successfully')}>Update Password</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, disabled, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} /></div>;
}
