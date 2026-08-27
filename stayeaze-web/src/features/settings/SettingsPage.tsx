import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings as SettingsIcon, Building2, Bell, Palette, Shield, ShieldCheck, User, Sparkles, CheckCircle2, Check, ExternalLink, Wifi } from 'lucide-react';
import { useBranding } from '@/lib/branding-context';
import WifiSettingsSection from '@/features/settings/WifiSettingsSection';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { initials, formatDate, formatCurrency } from '@/lib/format';
import { roleLabels } from '@/lib/role-utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { StateCityPincodeSelector } from '@/components/common/StateCityPincodeSelector';

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

interface NotifItem {
  key: string;
  label: string;
  desc: string;
}

function getRoleNotificationItems(role?: string): NotifItem[] {
  switch (role) {
    case 'SUPER_ADMIN':
      return [
        { key: 'emailAlerts', label: 'Critical Email Alerts', desc: 'Receive urgent platform and security alerts via email' },
        { key: 'systemAlerts', label: 'Platform Maintenance & System Status', desc: 'Alerts regarding server health, Redis, and DB maintenance' },
        { key: 'subscriptionAlerts', label: 'Subscriber Signups & Upgrades', desc: 'Notify when property owners register or change SaaS plans' },
        { key: 'revenueAlerts', label: 'SaaS Platform Revenue Digest', desc: 'Real-time alerts for subscription payments and renewals' },
        { key: 'weeklyReport', label: 'Executive Platform Summary', desc: 'Weekly analytics on total active tenants, properties, and revenue' },
      ];
    case 'OWNER':
    case 'ADMIN':
      return [
        { key: 'emailAlerts', label: 'Email Notifications', desc: 'Receive operational alerts directly in your inbox' },
        { key: 'bookingAlerts', label: 'New Tenant Bookings', desc: 'Notify immediately when a new tenant booking occurs' },
        { key: 'complaintAlerts', label: 'Tenant Complaint Escalations', desc: 'Alert when high-priority complaints are filed by tenants' },
        { key: 'paymentAlerts', label: 'Rent Payments & Invoices', desc: 'Notify on successful rent payments and overdue invoices' },
        { key: 'staffAlerts', label: 'Staff & Manager Activity', desc: 'Notify on staff check-ins, check-outs, and task updates' },
        { key: 'weeklyReport', label: 'Property Performance Digest', desc: 'Weekly report on occupancy rate, revenue, and pending dues' },
      ];
    case 'PROPERTY_MANAGER':
      return [
        { key: 'emailAlerts', label: 'Email Notifications', desc: 'Receive operational task alerts via email' },
        { key: 'bookingAlerts', label: 'Tenant Check-Ins & Bookings', desc: 'Notify when a new tenant completes booking/check-in' },
        { key: 'complaintAlerts', label: 'Maintenance & Repairs', desc: 'Real-time alerts for maintenance requests and room issues' },
        { key: 'checkInAlerts', label: 'Daily Move-Ins & Move-Outs', desc: 'Daily alerts for scheduled tenant move-ins and move-outs' },
        { key: 'allocationAlerts', label: 'Room & Bed Allocations', desc: 'Alert when room or bed status is changed' },
      ];
    case 'ACCOUNTANT':
      return [
        { key: 'emailAlerts', label: 'Email Receipts & Audits', desc: 'Receive copies of generated payment receipts and invoices' },
        { key: 'paymentAlerts', label: 'Tenant Rent Payments', desc: 'Notify when rent payments are collected or fail' },
        { key: 'gstBillingAlerts', label: 'GST & Invoice Tax Summaries', desc: 'Alert on tax invoice generation and GST reporting' },
        { key: 'payoutAlerts', label: 'Expense & Refund Alerts', desc: 'Notify when security deposit refunds or expenses are recorded' },
        { key: 'weeklyReport', label: 'Financial Performance Summary', desc: 'Weekly financial ledger and outstanding balance digest' },
      ];
    case 'RECEPTIONIST':
      return [
        { key: 'emailAlerts', label: 'Desk & Visitor Alerts', desc: 'Receive desk alerts and visitor logging notifications' },
        { key: 'visitorAlerts', label: 'Visitor Check-Ins', desc: 'Notify when visitors arrive at the property desk' },
        { key: 'complaintAlerts', label: 'Guest Complaints & Requests', desc: 'Alert when room service or complaint requests come in' },
        { key: 'roomAlerts', label: 'Room Availability & Cleaning', desc: 'Notify when rooms are marked cleaned or available' },
      ];
    default:
      return [
        { key: 'emailAlerts', label: 'Email Notifications', desc: 'Receive rent receipts and announcements via email' },
        { key: 'paymentAlerts', label: 'Rent Due & Receipt Alerts', desc: 'Notify when monthly rent invoice is issued or paid' },
        { key: 'complaintAlerts', label: 'Complaint Status Updates', desc: 'Alert when your reported maintenance issues are resolved' },
        { key: 'noticeAlerts', label: 'Notice Board & Announcements', desc: 'Notify when property owner posts important announcements' },
      ];
  }
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profile');

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAvatarUrl(dataUrl);
      toast.success('Photo preview updated! Click Save Changes to confirm.');
    };
    reader.readAsDataURL(file);
  };

  const [billingProfile, setBillingProfile] = useState<BillingProfile>(emptyBillingProfile);
  const [billingLoading, setBillingLoading] = useState(false);
  const canEditBilling = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canViewBilling = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER' || user?.role === 'ACCOUNTANT' || user?.role === 'SUPER_ADMIN';

  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    emailAlerts: true, bookingAlerts: true, complaintAlerts: true,
    paymentAlerts: true, weeklyReport: true, systemAlerts: true,
    subscriptionAlerts: true, revenueAlerts: true, staffAlerts: true,
    checkInAlerts: true, allocationAlerts: true, gstBillingAlerts: true,
    payoutAlerts: true, visitorAlerts: true, roomAlerts: true, noticeAlerts: true,
  });

  const { branding, refetchBranding } = useBranding();
  const canUseCustomBranding = Boolean(
    (user?.role === 'ADMIN' || user?.role === 'OWNER') &&
    (branding.isEnterprise || branding.allowCustomBranding)
  );

  useEffect(() => {
    if (activeTab === 'branding' && !canUseCustomBranding) {
      setActiveTab('profile');
      setSearchParams({ tab: 'profile' });
    }
  }, [activeTab, canUseCustomBranding, setSearchParams]);

  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingForm, setBrandingForm] = useState({
    customBrandingEnabled: false,
    brandName: '',
    brandTagline: '',
    brandLogoUrl: '',
    brandFaviconUrl: '',
    brandPrimaryColor: '#4f46e5',
    brandAccentColor: '#06b6d4',
    customFooterText: '',
    hideStayEazeBranding: false,
  });

  useEffect(() => {
    if (branding) {
      setBrandingForm({
        customBrandingEnabled: Boolean(branding.enabled),
        brandName: branding.brandName || '',
        brandTagline: branding.brandTagline || 'Smart PG & Co-Living Management',
        brandLogoUrl: branding.brandLogoUrl || '',
        brandFaviconUrl: branding.brandFaviconUrl || '',
        brandPrimaryColor: branding.brandPrimaryColor || '#4f46e5',
        brandAccentColor: branding.brandAccentColor || '#06b6d4',
        customFooterText: branding.customFooterText || `© ${new Date().getFullYear()} ${branding.brandName || 'Residency'}. All rights reserved.`,
        hideStayEazeBranding: Boolean(branding.hideStayEazeBranding),
      });
    }
  }, [branding]);

  const saveOrgBranding = async () => {
    setBrandingLoading(true);
    try {
      const res = await api.put('/branding/organization', brandingForm);
      toast.success(res.data?.message || 'White-Label Branding updated successfully!');
      refetchBranding();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save branding settings');
    } finally {
      setBrandingLoading(false);
    }
  };

  const [saasSettings, setSaasSettings] = useState({
    saasCompanyName: '',
    saasGstin: '',
    saasPan: '',
    saasSacCode: '',
    saasAddress: '',
    saasSupportEmail: '',
    saasSupportPhone: '',
    saasWebsiteUrl: '',
    invoicePrefix: '',
    defaultTaxRate: 18.0,
    currency: 'INR',
    invoiceTerms: '',
    gracePeriodDays: 3,
    lockoutAction: 'HARD_LOCKOUT',
    autoPdfEmailing: true,
    maintenanceModeEnabled: false,
    maintenanceMessage: '',
    razorpayMasterKeyId: '',
    razorpayMasterKeySecret: '',
  });
  const [saasLoading, setSaasLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;
    api.get('/super-admin/settings').then(({ data }) => {
      if (data) {
        setSaasSettings({
          saasCompanyName: data.saasCompanyName ?? '',
          saasGstin: data.saasGstin ?? '',
          saasPan: data.saasPan ?? '',
          saasSacCode: data.saasSacCode ?? '',
          saasAddress: data.saasAddress ?? '',
          saasSupportEmail: data.saasSupportEmail ?? '',
          saasSupportPhone: data.saasSupportPhone ?? '',
          saasWebsiteUrl: data.saasWebsiteUrl ?? '',
          invoicePrefix: data.invoicePrefix ?? '',
          defaultTaxRate: data.defaultTaxRate ?? 18.0,
          currency: data.currency ?? 'INR',
          invoiceTerms: data.invoiceTerms ?? '',
          gracePeriodDays: data.gracePeriodDays ?? 3,
          lockoutAction: data.lockoutAction ?? 'HARD_LOCKOUT',
          autoPdfEmailing: data.autoPdfEmailing !== false,
          maintenanceModeEnabled: !!data.maintenanceModeEnabled,
          maintenanceMessage: data.maintenanceMessage ?? '',
          razorpayMasterKeyId: data.razorpayMasterKeyId ?? '',
          razorpayMasterKeySecret: data.razorpayMasterKeySecret ?? '',
        });
      }
    }).catch(() => {});
  }, [user]);

  const [gstForm, setGstForm] = useState({
    gstEnabled: false,
    gstin: '',
    gstTradeName: '',
    defaultGstRate: 18.0,
  });
  const [gstLoading, setGstLoading] = useState(false);
  const [gstinError, setGstinError] = useState('');

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN' || user?.role === 'ACCOUNTANT') {
      api.get('/organization/financial-settings').then(({ data }) => {
        if (data) {
          setGstForm({
            gstEnabled: Boolean(data.gstEnabled),
            gstin: data.gstin || '',
            gstTradeName: data.gstTradeName || data.organizationName || '',
            defaultGstRate: data.defaultGstRate || 18.0,
          });
        }
      }).catch(() => {});
    }
  }, [user]);

  const validateGstin = (val: string) => {
    if (!val) return '';
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!regex.test(val)) {
      return 'Invalid 15-character GSTIN format (e.g. 27AAAAA0000A1Z5)';
    }
    return '';
  };

  const handleSaveGstSettings = async () => {
    const cleanGstin = gstForm.gstin.trim().toUpperCase();
    if (gstForm.gstEnabled) {
      if (!cleanGstin) {
        setGstinError('GSTIN is required when GST is enabled.');
        toast.error('GSTIN is required when GST is enabled.');
        return;
      }
      const err = validateGstin(cleanGstin);
      if (err) {
        setGstinError(err);
        toast.error(err);
        return;
      }
      if (!gstForm.gstTradeName.trim()) {
        toast.error('GST Legal Trade Name is required when GST is enabled.');
        return;
      }
    }

    setGstLoading(true);
    try {
      const { data } = await api.put('/organization/financial-settings', {
        ...gstForm,
        gstin: cleanGstin,
      });
      toast.success(data?.message || 'Organization GST Settings updated successfully!');
      setGstinError('');
      queryClient.invalidateQueries({ queryKey: ['accountant'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save GST settings');
    } finally {
      setGstLoading(false);
    }
  };

  async function saveSaasSettings() {
    setSaasLoading(true);
    try {
      const { data } = await api.put('/super-admin/settings', saasSettings);
      if (data) {
        setSaasSettings({
          saasCompanyName: data.saasCompanyName ?? '',
          saasGstin: data.saasGstin ?? '',
          saasPan: data.saasPan ?? '',
          saasSacCode: data.saasSacCode ?? '',
          saasAddress: data.saasAddress ?? '',
          saasSupportEmail: data.saasSupportEmail ?? '',
          saasSupportPhone: data.saasSupportPhone ?? '',
          saasWebsiteUrl: data.saasWebsiteUrl ?? '',
          invoicePrefix: data.invoicePrefix ?? '',
          defaultTaxRate: data.defaultTaxRate ?? 18.0,
          currency: data.currency ?? 'INR',
          invoiceTerms: data.invoiceTerms ?? '',
          gracePeriodDays: data.gracePeriodDays ?? 3,
          lockoutAction: data.lockoutAction ?? 'HARD_LOCKOUT',
          autoPdfEmailing: data.autoPdfEmailing !== false,
          maintenanceModeEnabled: !!data.maintenanceModeEnabled,
          maintenanceMessage: data.maintenanceMessage ?? '',
          razorpayMasterKeyId: data.razorpayMasterKeyId ?? '',
          razorpayMasterKeySecret: data.razorpayMasterKeySecret ?? '',
        });
      }
      toast.success('SaaS Platform Subscription & Invoice Settings Saved!');
    } catch (e) {
      toast.error('Could not save Super Admin settings');
    } finally {
      setSaasLoading(false);
    }
  }

  const [profileLoading, setProfileLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled ?? false);
  const [toggling2fa, setToggling2fa] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    api.get('/users/me').then(({ data }) => {
      if (data) {
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        if (data.phone) setPhone(data.phone);
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        if (typeof data.twoFactorEnabled === 'boolean') setTwoFactorEnabled(data.twoFactorEnabled);
        if (data.notificationPreferences && typeof data.notificationPreferences === 'object') {
          setNotifications((prev) => ({ ...prev, ...data.notificationPreferences }));
        }

        updateUser({
          name: data.name || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          avatarUrl: data.avatarUrl || undefined,
          twoFactorEnabled: data.twoFactorEnabled,
        });
      }
    }).catch(() => {});
  }, []);

  const handleToggle2FA = async (checked: boolean) => {
    setToggling2fa(true);
    try {
      const { data } = await api.put('/users/2fa', { enabled: checked });
      setTwoFactorEnabled(data.twoFactorEnabled);
      updateUser({ twoFactorEnabled: data.twoFactorEnabled });
      toast.success(data.message || (checked ? 'Two-Factor Authentication Enabled!' : 'Two-Factor Authentication Disabled'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update 2FA setting');
      setTwoFactorEnabled(!checked);
    } finally {
      setToggling2fa(false);
    }
  };


  async function saveProfile() {
    setProfileLoading(true);
    try {
      const { data } = await api.put('/users/me', { name, email, phone, avatarUrl });
      updateUser({ name: data.name || name, email: data.email || email, phone: data.phone || phone, avatarUrl: data.avatarUrl || avatarUrl });
      toast.success(data.message || 'Profile updated successfully and synced across app!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not update profile');
    } finally {
      setProfileLoading(false);
    }
  }

  async function updatePassword() {
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await api.put('/users/change-password', { currentPassword, newPassword });
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  }

  const [notifLoading, setNotifLoading] = useState(false);

  async function saveNotifications() {
    setNotifLoading(true);
    try {
      const { data } = await api.put('/users/me', { notificationPreferences: notifications });
      toast.success('Notification preferences saved successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save notification preferences');
    } finally {
      setNotifLoading(false);
    }
  }

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

  const queryClient = useQueryClient();

  async function saveBillingProfile() {
    if (!canEditBilling) {
      toast.error('Only the organization owner can change billing settings.');
      return;
    }
    setBillingLoading(true);
    try {
      const { data } = await api.put('/organization-billing-profile', billingProfile);
      setBillingProfile({ ...emptyBillingProfile, ...data });
      await queryClient.invalidateQueries({ queryKey: ['org-billing-profile-onboarding'] });
      await queryClient.invalidateQueries({ queryKey: ['organization-billing-profile'] });
      toast.success('Billing and invoice settings saved! Organization setup is up to date.');
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 w-full">
          <div className="w-full overflow-x-auto pb-1 scrollbar-none">
            <TabsList className="h-10.5 p-1 rounded-xl bg-muted/60 border border-border/60 gap-1 inline-flex shrink-0">
              <TabsTrigger value="profile" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                <User className="mr-1.5 h-3.5 w-3.5" /> Profile
              </TabsTrigger>
              <TabsTrigger value="appearance" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                <Palette className="mr-1.5 h-3.5 w-3.5" /> Appearance
              </TabsTrigger>
              <TabsTrigger value="notifications" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                <Bell className="mr-1.5 h-3.5 w-3.5" /> Notifications
              </TabsTrigger>
              {(user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'PROPERTY_MANAGER' || user?.role === 'RECEPTIONIST') && (
                <TabsTrigger value="wifi" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                  <Wifi className="mr-1.5 h-3.5 w-3.5 text-cyan-500" /> Wi-Fi Hub
                </TabsTrigger>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'PROPERTY_MANAGER' || user?.role === 'ACCOUNTANT') && (
                <TabsTrigger value="organization" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                  <Building2 className="mr-1.5 h-3.5 w-3.5" /> Organization
                </TabsTrigger>
              )}
              {canUseCustomBranding && (
                <TabsTrigger value="branding" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                  <Palette className="mr-1.5 h-3.5 w-3.5 text-purple-500" /> Custom Branding
                </TabsTrigger>
              )}
              {user?.role === 'SUPER_ADMIN' && (
                <TabsTrigger value="saas-invoicing" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> SaaS Invoicing
                </TabsTrigger>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'OWNER') && (
                <TabsTrigger value="subscription" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" /> Subscription
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="rounded-lg h-8.5 px-3 text-xs sm:text-sm font-semibold shrink-0">
                <Shield className="mr-1.5 h-3.5 w-3.5" /> Security
              </TabsTrigger>
            </TabsList>
          </div>
          {user?.role === 'SUPER_ADMIN' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/super-admin/integrations'}
              className="border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-semibold rounded-xl shrink-0"
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
                <Avatar className="h-16 w-16">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
                  <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{initials(name)}</AvatarFallback>
                </Avatar>
                <div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>Change Photo</Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rajesh Kumar" /></div>
                <div className="space-y-1.5"><Label>Role</Label><Input value={user ? roleLabels[user.role] : ''} disabled placeholder="User Role" /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. admin@stayeaze.com" /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" /></div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={profileLoading} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                <Switch checked={useUIStore.getState().compactMode} onCheckedChange={(v) => useUIStore.getState().setCompactMode(v)} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Sidebar collapsed by default</p><p className="text-xs text-muted-foreground">Start with a minimized sidebar.</p></div>
                <Switch checked={useUIStore.getState().sidebarCollapsedByDefault} onCheckedChange={(v) => useUIStore.getState().setSidebarCollapsedByDefault(v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Tailored alert preferences for your role: <span className="font-semibold text-primary">{user ? roleLabels[user.role] : 'User'}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {getRoleNotificationItems(user?.role).map((item, i) => (
                <div key={item.key}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key] ?? true}
                      onCheckedChange={(v) => setNotifications((n) => ({ ...n, [item.key]: v }))}
                    />
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-3">
                <Button onClick={saveNotifications} disabled={notifLoading}>
                  {notifLoading ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {user?.role === 'SUPER_ADMIN' && (
          <TabsContent value="saas-invoicing">
            <Card className="max-w-3xl border shadow-sm">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-500" /> SaaS Platform Subscription & Invoice Settings
                </CardTitle>
                <CardDescription>
                  Configure SaaS entity legal details, invoice header information, GSTIN, tax defaults, and subscription grace period policies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">SaaS Entity Legal Details & Invoice Header</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="SaaS Company Legal Name" value={saasSettings.saasCompanyName} onChange={(v) => setSaasSettings((s) => ({ ...s, saasCompanyName: v }))} placeholder="e.g. StayEaze SaaS Technologies Pvt. Ltd." />
                    <Field label="GSTIN Tax Number" value={saasSettings.saasGstin} onChange={(v) => setSaasSettings((s) => ({ ...s, saasGstin: v.toUpperCase() }))} placeholder="e.g. 29AAAAA0000A1Z5" />
                    <Field label="PAN Number" value={saasSettings.saasPan} onChange={(v) => setSaasSettings((s) => ({ ...s, saasPan: v.toUpperCase() }))} placeholder="e.g. ABCDE1234F" />
                    <Field label="SAC Code (Software Service)" value={saasSettings.saasSacCode} onChange={(v) => setSaasSettings((s) => ({ ...s, saasSacCode: v }))} placeholder="e.g. 998314" />
                    <Field label="Billing Support Email" value={saasSettings.saasSupportEmail} onChange={(v) => setSaasSettings((s) => ({ ...s, saasSupportEmail: v }))} type="email" placeholder="e.g. billing@stayeaze.com" />
                    <Field label="Support Phone Number" value={saasSettings.saasSupportPhone} onChange={(v) => setSaasSettings((s) => ({ ...s, saasSupportPhone: v }))} placeholder="e.g. +91 98765 43210" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Registered Office Address</Label>
                    <Textarea value={saasSettings.saasAddress} onChange={(e) => setSaasSettings((s) => ({ ...s, saasAddress: e.target.value }))} rows={2} placeholder="e.g. 100 SaaS Tech Park, Indiranagar, Bengaluru, KA 560038" />
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Subscription Invoicing Defaults & Tax Configuration</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Invoice Prefix" value={saasSettings.invoicePrefix} onChange={(v) => setSaasSettings((s) => ({ ...s, invoicePrefix: v }))} placeholder="e.g. SE-INV-" />
                    <div className="space-y-1.5">
                      <Label>Default Tax Rate (%)</Label>
                      <Input type="number" step="0.1" value={saasSettings.defaultTaxRate} onChange={(e) => setSaasSettings((s) => ({ ...s, defaultTaxRate: parseFloat(e.target.value) || 0 }))} placeholder="e.g. 18.0" />
                    </div>
                    <Field label="Billing Currency" value={saasSettings.currency} onChange={(v) => setSaasSettings((s) => ({ ...s, currency: v.toUpperCase() }))} placeholder="e.g. INR" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subscription Invoice Terms & Payment Notes</Label>
                    <Textarea value={saasSettings.invoiceTerms} onChange={(e) => setSaasSettings((s) => ({ ...s, invoiceTerms: e.target.value }))} rows={3} placeholder="Enter payment terms and HRA tax notes..." />
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Subscription Grace Period & Lockout Policy</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Grace Period Days (Post Due Date)</Label>
                      <Input type="number" value={saasSettings.gracePeriodDays} onChange={(e) => setSaasSettings((s) => ({ ...s, gracePeriodDays: parseInt(e.target.value) || 3 }))} placeholder="e.g. 3" />
                      <p className="text-xs text-muted-foreground">Days property owners are allowed past due date before lockout.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Lockout Enforcement Mode</Label>
                      <Select
                        value={saasSettings.lockoutAction}
                        onValueChange={(v) => setSaasSettings((s) => ({ ...s, lockoutAction: v }))}
                      >
                        <SelectTrigger className="w-full h-10 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HARD_LOCKOUT">Hard Lockout (Block non-admin, restrict admin to billing modal)</SelectItem>
                          <SelectItem value="SOFT_WARNING">Soft Warning (Banner alert only)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-sm font-medium">Auto Email PDF Receipts</p>
                      <p className="text-xs text-muted-foreground">Automatically generate and email PDF invoice receipt upon payment.</p>
                    </div>
                    <Switch checked={saasSettings.autoPdfEmailing} onCheckedChange={(v) => setSaasSettings((s) => ({ ...s, autoPdfEmailing: v }))} />
                  </div>
                </section>

                <Separator />

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400">Platform Maintenance Mode</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Enable Maintenance Mode</p>
                      <p className="text-xs text-muted-foreground">Place the entire SaaS platform into scheduled maintenance mode.</p>
                    </div>
                    <Switch checked={saasSettings.maintenanceModeEnabled} onCheckedChange={(v) => setSaasSettings((s) => ({ ...s, maintenanceModeEnabled: v }))} />
                  </div>
                  {saasSettings.maintenanceModeEnabled && (
                    <div className="space-y-1.5">
                      <Label>Maintenance Banner Message</Label>
                      <Input value={saasSettings.maintenanceMessage} onChange={(e) => setSaasSettings((s) => ({ ...s, maintenanceMessage: e.target.value }))} placeholder="e.g. StayEaze is undergoing scheduled maintenance." />
                    </div>
                  )}
                </section>

                <div className="flex justify-end pt-4">
                  <Button onClick={saveSaasSettings} disabled={saasLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
                    {saasLoading ? 'Saving...' : 'Save SaaS Subscription Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="organization">
          <Card className="max-w-3xl">
            <CardHeader><CardTitle>Organization Billing & Invoice Settings</CardTitle><CardDescription>Customize the receipt header, payment terms, and bank details for tenant invoices.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Legal entity & contact info</h3>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">* Required for application activation</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Legal business name *" value={billingProfile.legalName} onChange={(v) => updateBillingField('legalName', v)} disabled={!canEditBilling} placeholder="e.g. Grand Stay PG Services" />
                  <Field label="Billing email *" value={billingProfile.supportEmail} onChange={(v) => updateBillingField('supportEmail', v)} disabled={!canEditBilling} type="email" placeholder="e.g. contact@grandstaypg.com" />
                  <Field label="Support phone *" value={billingProfile.supportPhone} onChange={(v) => updateBillingField('supportPhone', v)} disabled={!canEditBilling} placeholder="e.g. +91 98765 43210" />
                  <Field label="GSTIN (Optional)" value={billingProfile.gstin} onChange={(v) => updateBillingField('gstin', v.toUpperCase())} disabled={!canEditBilling} placeholder="e.g. 29AAAAA0000A1Z5" />
                  <Field label="PAN / Tax Identification *" value={billingProfile.pan} onChange={(v) => updateBillingField('pan', v.toUpperCase())} disabled={!canEditBilling} placeholder="e.g. ABCDE1234F" />
                  <Field label="Registration / License number" value={billingProfile.registrationNumber} onChange={(v) => updateBillingField('registrationNumber', v)} disabled={!canEditBilling} placeholder="e.g. KA-BNG-2024-88" />
                </div>

                <div className="space-y-1.5"><Label>Billing address *</Label><Input value={billingProfile.billingAddress} onChange={(e) => updateBillingField('billingAddress', e.target.value)} disabled={!canEditBilling} placeholder="e.g. #42, 5th Cross, Koramangala" /></div>
                <StateCityPincodeSelector
                  state={billingProfile.state}
                  city={billingProfile.city}
                  pincode={billingProfile.pincode}
                  onStateChange={(v) => updateBillingField('state', v)}
                  onCityChange={(v) => updateBillingField('city', v)}
                  onPincodeChange={(v) => updateBillingField('pincode', v)}
                  disabled={!canEditBilling}
                />
              </section>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Invoice defaults & Security Deposit</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Invoice Prefix" value={billingProfile.invoicePrefix} onChange={(v) => updateBillingField('invoicePrefix', v)} disabled={!canEditBilling} placeholder="e.g. INV-" />
                  <div className="space-y-1.5"><Label>Payment Due Days</Label><Input type="number" value={billingProfile.paymentDueDays} onChange={(e) => updateBillingField('paymentDueDays', parseInt(e.target.value) || 7)} disabled={!canEditBilling} placeholder="e.g. 7" /></div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Default Security Deposit *</Label>
                      {(!billingProfile.defaultSecurityDeposit || billingProfile.defaultSecurityDeposit <= 0) && (
                        <span className="text-[10px] font-bold text-rose-500">Required</span>
                      )}
                    </div>
                    <Input type="number" value={billingProfile.defaultSecurityDeposit || ''} onChange={(e) => updateBillingField('defaultSecurityDeposit', parseFloat(e.target.value) || 0)} disabled={!canEditBilling} placeholder="e.g. 5000" />
                    <div className="flex gap-1.5 pt-1">
                      {[5000, 10000, 15000, 20000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => updateBillingField('defaultSecurityDeposit', amt)}
                          disabled={!canEditBilling}
                          className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                        >
                          ₹{amt.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Late fee terms / Policy note</Label><Textarea value={billingProfile.lateFeeNote} onChange={(e) => updateBillingField('lateFeeNote', e.target.value)} disabled={!canEditBilling} placeholder="e.g. Late fee of ₹100 per day applicable after due date." /></div>
                <div className="space-y-1.5"><Label>Invoice terms & conditions</Label><Textarea value={billingProfile.invoiceTerms} onChange={(e) => updateBillingField('invoiceTerms', e.target.value)} disabled={!canEditBilling} placeholder="Enter receipt terms and conditions..." /></div>
              </section>
              <Separator />
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Payout & Settlement Channel *</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Required for collecting payments and settling resident security deposit refunds. Enter Bank Account + IFSC or UPI ID.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Account holder name" value={billingProfile.bankAccountName} onChange={(v) => updateBillingField('bankAccountName', v)} disabled={!canEditBilling} placeholder="e.g. Grand Stay Services" />
                  <Field label="Bank name" value={billingProfile.bankName} onChange={(v) => updateBillingField('bankName', v)} disabled={!canEditBilling} placeholder="e.g. HDFC Bank" />
                  <Field label="Account number" value={billingProfile.bankAccountNumber} onChange={(v) => updateBillingField('bankAccountNumber', v)} disabled={!canEditBilling} placeholder="e.g. 5010023456789" />
                  <Field label="IFSC" value={billingProfile.bankIfsc} onChange={(v) => updateBillingField('bankIfsc', v.toUpperCase())} disabled={!canEditBilling} placeholder="e.g. HDFC0001234" />
                  <Field label="UPI ID (VPA)" value={billingProfile.upiVpa} onChange={(v) => updateBillingField('upiVpa', v)} disabled={!canEditBilling} placeholder="e.g. grandstay@hdfcbank" />
                  <Field label="Authorized signatory *" value={billingProfile.authorizedSignatory} onChange={(v) => updateBillingField('authorizedSignatory', v)} disabled={!canEditBilling} placeholder="e.g. Proprietor Name" />
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
              <Separator />
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> GST Tax Compliance & SAC Configuration
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Under Indian tax laws, residential PG / Co-Living accommodation is GST Exempt by default. Enable GST only if your business is GST registered.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="gst-toggle" className="text-xs font-semibold">Enable GST</Label>
                    <Switch
                      id="gst-toggle"
                      checked={gstForm.gstEnabled}
                      onCheckedChange={(val) => {
                        setGstForm((prev) => ({ ...prev, gstEnabled: val }));
                        if (!val) setGstinError('');
                      }}
                      disabled={!canEditBilling}
                    />
                  </div>
                </div>

                {gstForm.gstEnabled ? (
                  <div className="grid gap-4 sm:grid-cols-3 pt-2">
                    <div className="space-y-1.5">
                      <Label>15-Digit GSTIN *</Label>
                      <Input
                        value={gstForm.gstin}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setGstForm((prev) => ({ ...prev, gstin: val }));
                          setGstinError(validateGstin(val));
                        }}
                        disabled={!canEditBilling}
                        placeholder="e.g. 27AAAAA0000A1Z5"
                        maxLength={15}
                        className={gstinError ? "border-red-500 focus-visible:ring-red-500" : ""}
                      />
                      {gstinError ? (
                        <p className="text-[11px] text-red-500 font-medium">{gstinError}</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Format: 15-character GST registration code</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>GST Legal Trade Name *</Label>
                      <Input
                        value={gstForm.gstTradeName}
                        onChange={(e) => setGstForm((prev) => ({ ...prev, gstTradeName: e.target.value }))}
                        disabled={!canEditBilling}
                        placeholder="e.g. Grand Stay PG Services Private Limited"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default GST Tax Rate (%) *</Label>
                      <Select
                        value={gstForm.defaultGstRate.toString()}
                        onValueChange={(val) => setGstForm((prev) => ({ ...prev, defaultGstRate: parseFloat(val) || 18.0 }))}
                        disabled={!canEditBilling}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="18">18.00% (Standard SAC 998314)</SelectItem>
                          <SelectItem value="12">12.00% (Reduced Tax Slab)</SelectItem>
                          <SelectItem value="5">5.00% (Low Tax Slab)</SelectItem>
                          <SelectItem value="0">0.00% (Nil Rated)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-semibold">✓ Residential Hostel Exemption Active:</span> GST liability calculations and GSTR-1 return reports remain disabled.
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    onClick={handleSaveGstSettings}
                    disabled={!canEditBilling || gstLoading || Boolean(gstinError)}
                  >
                    {gstLoading ? 'Saving GST...' : 'Save GST Settings'}
                  </Button>
                </div>
              </section>
              <div className="flex justify-end"><Button onClick={saveBillingProfile} disabled={!canEditBilling || billingLoading}>{billingLoading ? 'Saving…' : 'Save Billing Settings'}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enterprise White-Label Custom Branding */}
        {canUseCustomBranding && (
          <TabsContent value="branding">
            <Card className="max-w-3xl border shadow-sm">
            <CardHeader className="border-b bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2 text-purple-950 dark:text-purple-200">
                    <Palette className="h-5 w-5 text-purple-600" /> Enterprise White-Label Custom Branding
                  </CardTitle>
                  <CardDescription>
                    Re-brand the portal with your brand logo, primary colors, custom brand name, and custom invoice receipts.
                  </CardDescription>
                </div>
                {branding.isEnterprise ? (
                  <Badge className="bg-purple-600 text-white font-semibold">
                    Enterprise Plan Unlocked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300 font-semibold">
                    Enterprise Feature
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {!branding.isEnterprise && !branding.allowCustomBranding ? (
                <div className="p-6 rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-amber-950 dark:text-amber-200">
                      White-Label Branding is Exclusive to the Enterprise Plan
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Upgrade to the Enterprise SaaS plan to remove StayEaze branding, customize theme colors, upload your company logo, and brand all tenant receipts.
                    </p>
                  </div>
                  <Button
                    onClick={() => { setActiveTab('subscription'); setSearchParams({ tab: 'subscription' }); }}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" /> View Enterprise Plan & Upgrade
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold text-purple-950 dark:text-purple-200">
                        Enable Custom White-Label Theme
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Activate your custom brand name, logo, and theme color across this portal.
                      </p>
                    </div>
                    <Switch
                      checked={brandingForm.customBrandingEnabled}
                      onCheckedChange={(c) => setBrandingForm((f) => ({ ...f, customBrandingEnabled: c }))}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Custom Brand Name *</Label>
                      <Input
                        value={brandingForm.brandName}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, brandName: e.target.value }))}
                        placeholder="e.g. Starlight Residences & Co-Living"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Brand Tagline</Label>
                      <Input
                        value={brandingForm.brandTagline}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, brandTagline: e.target.value }))}
                        placeholder="e.g. Premium Executive Living & Hospitality"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Logo Image URL</Label>
                      <Input
                        value={brandingForm.brandLogoUrl}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, brandLogoUrl: e.target.value }))}
                        placeholder="https://yourdomain.com/logo.png"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Favicon URL</Label>
                      <Input
                        value={brandingForm.brandFaviconUrl}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, brandFaviconUrl: e.target.value }))}
                        placeholder="https://yourdomain.com/favicon.ico"
                      />
                    </div>
                  </div>

                  {/* Color Palette */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Primary Brand Theme Color</Label>
                      <span className="text-xs font-mono font-bold text-muted-foreground">{brandingForm.brandPrimaryColor}</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {[
                        { name: 'Indigo Enterprise', hex: '#4f46e5' },
                        { name: 'Emerald Living', hex: '#059669' },
                        { name: 'Royal Purple', hex: '#7c3aed' },
                        { name: 'Crimson Executive', hex: '#dc2626' },
                        { name: 'Amber Gold', hex: '#d97706' },
                        { name: 'Ocean Cyan', hex: '#0284c7' },
                        { name: 'Midnight Slate', hex: '#1e293b' },
                      ].map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setBrandingForm((f) => ({ ...f, brandPrimaryColor: p.hex }))}
                          className={`h-9 rounded-md border flex items-center justify-center transition-all ${
                            brandingForm.brandPrimaryColor.toLowerCase() === p.hex.toLowerCase()
                              ? 'ring-2 ring-offset-2 ring-purple-600 scale-105'
                              : 'hover:opacity-80'
                          }`}
                          style={{ backgroundColor: p.hex }}
                          title={p.name}
                        >
                          {brandingForm.brandPrimaryColor.toLowerCase() === p.hex.toLowerCase() && (
                            <Check className="h-4 w-4 text-white drop-shadow-md" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="color"
                        value={brandingForm.brandPrimaryColor}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, brandPrimaryColor: e.target.value }))}
                        className="h-8 w-12 rounded cursor-pointer border p-0.5 bg-transparent"
                      />
                      <Input
                        value={brandingForm.brandPrimaryColor}
                        onChange={(e) => setBrandingForm((f) => ({ ...f, brandPrimaryColor: e.target.value }))}
                        placeholder="#4f46e5"
                        className="font-mono text-xs max-w-[140px]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Custom Footer Copyright</Label>
                    <Input
                      value={brandingForm.customFooterText}
                      onChange={(e) => setBrandingForm((f) => ({ ...f, customFooterText: e.target.value }))}
                      placeholder="e.g. © 2026 Starlight Residences. All rights reserved."
                    />
                  </div>

                  {/* Live Preview */}
                  <div className="p-4 rounded-xl border bg-slate-950 text-white space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-semibold border-b border-slate-800 pb-2">
                      <span>Brand Theme Preview</span>
                      <span className="font-mono">{brandingForm.brandPrimaryColor}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {brandingForm.brandLogoUrl ? (
                        <img src={brandingForm.brandLogoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-white/10 p-1" />
                      ) : (
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-white shadow"
                          style={{ backgroundColor: brandingForm.brandPrimaryColor }}
                        >
                          {brandingForm.brandName ? brandingForm.brandName.substring(0, 2).toUpperCase() : 'SE'}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-sm text-white">{brandingForm.brandName || 'Brand Name'}</h4>
                        <p className="text-xs text-slate-400">{brandingForm.brandTagline || 'Tagline description'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-md text-xs font-semibold text-white shadow"
                        style={{ backgroundColor: brandingForm.brandPrimaryColor }}
                      >
                        Action Button
                      </button>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {brandingForm.customFooterText || '© Custom Copyright'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={saveOrgBranding}
                      disabled={brandingLoading}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                    >
                      {brandingLoading ? 'Saving...' : 'Save & Apply Brand Settings'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        <TabsContent value="subscription">
          <Card className="max-w-3xl border shadow-sm">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" /> SaaS Subscription Status & Active Plan
                  </CardTitle>
                  <CardDescription>
                    Manage your active StayEaze SaaS subscription, bed entitlements, and billing cycles.
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-500 text-white font-bold px-3 py-1 text-xs">
                  ACTIVE PLAN
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid sm:grid-cols-3 gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
                <div>
                  <div className="text-xs text-muted-foreground">Active Subscription Plan</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {(billingProfile as any).subscriptionPlanName || 'Starter PG Plan'}
                  </div>
                  <div className="text-xs text-emerald-600 font-medium dark:text-emerald-400 mt-1">
                    Auto-Renews ({formatDate((billingProfile as any).subscriptionEndDate || new Date(Date.now() + 30*86400000).toISOString())})
                  </div>
                </div>

                <div className="sm:border-l sm:pl-4">
                  <div className="text-xs text-muted-foreground font-medium">Billing Cycle</div>
                  <div className="text-sm font-semibold text-foreground mt-1 uppercase">
                    {(billingProfile as any).subscriptionBillingCycle || 'MONTHLY'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    3-Day Grace Period Active
                  </div>
                </div>

                <div className="sm:border-l sm:pl-4">
                  <div className="text-xs text-muted-foreground">Plan Pricing</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency((billingProfile as any).subscriptionPlanPrice || 1499)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
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

        <TabsContent value="security">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Security</CardTitle><CardDescription>Manage password and access security.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Current Password</Label>
                  <Input type="password" placeholder="••••••••" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div />
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security requiring a 6-digit email code upon login.</p>
                </div>
                <Switch checked={twoFactorEnabled} disabled={toggling2fa} onCheckedChange={handleToggle2FA} />
              </div>

              <div className="flex justify-end">
                <Button onClick={updatePassword} disabled={passwordLoading} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wi-Fi Hub */}
        <TabsContent value="wifi">
          <WifiSettingsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, disabled, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string; placeholder?: string }) {
  return <div className="space-y-1.5"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} /></div>;
}
