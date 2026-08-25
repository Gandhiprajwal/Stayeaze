import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Database, Cloud, ShieldCheck, Key, Save, CheckCircle2, MessageSquare, Mail, UserCheck, Sparkles, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SystemIntegrationsPage() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['system-integration-settings'],
    queryFn: () => api.get('/super-admin/settings').then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes (Instant navigation)
    gcTime: 10 * 60 * 1000,
  });

  const { data: systemConfig } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => api.get<any>('/system-configs').then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes (Instant navigation)
    gcTime: 10 * 60 * 1000,
  });

  const [form, setForm] = useState({
    // Onboarding Policy Settings
    onboardingMode: 'ENABLED',
    vipInviteCodes: 'STAYVIP,EARLYBIRD,LAUNCH2026',
    onboardingMessage: '',

    // Infra settings
    redisEnabled: false,
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: '',
    awsS3Enabled: false,
    awsAccessKey: '',
    awsSecretKey: '',
    awsRegion: 'ap-south-1',
    awsBucketName: 'stayeaze-media-storage',
    rateLimitingEnabled: true,
    maxRequestsPerSec: 50,
    authBruteForceLimitPerMin: 5,
    razorpayMasterKeyId: '',
    razorpayMasterKeySecret: '',

    // Gateway configs (Twilio, SMTP, Razorpay)
    smsProvider: 'Twilio',
    emailProvider: 'SMTP',
    twilioEnabled: true,
    smtpEnabled: true,
    razorpayEnabled: true,
    twilioSid: '',
    twilioAuthToken: '',
    smtpHost: '',
    smtpPort: '587',
    smtpUsername: '',
    smtpPassword: '',
  });

  useEffect(() => {
    if (settings || systemConfig) {
      setForm({
        onboardingMode: settings?.onboardingMode || 'ENABLED',
        vipInviteCodes: settings?.vipInviteCodes || 'STAYVIP,EARLYBIRD,LAUNCH2026',
        onboardingMessage: settings?.onboardingMessage || '',

        redisEnabled: !!settings?.redisEnabled,
        redisHost: settings?.redisHost || 'localhost',
        redisPort: settings?.redisPort || 6379,
        redisPassword: settings?.redisPassword || '',
        awsS3Enabled: !!settings?.awsS3Enabled,
        awsAccessKey: settings?.awsAccessKey || '',
        awsSecretKey: settings?.awsSecretKey || '',
        awsRegion: settings?.awsRegion || 'ap-south-1',
        awsBucketName: settings?.awsBucketName || 'stayeaze-media-storage',
        rateLimitingEnabled: settings?.rateLimitingEnabled !== false,
        maxRequestsPerSec: settings?.maxRequestsPerSec || 50,
        authBruteForceLimitPerMin: settings?.authBruteForceLimitPerMin || 5,
        razorpayMasterKeyId: settings?.razorpayMasterKeyId || systemConfig?.razorpayKeyId || '',
        razorpayMasterKeySecret: settings?.razorpayMasterKeySecret || systemConfig?.razorpayKeySecret || '',

        smsProvider: systemConfig?.smsProvider || 'Twilio',
        emailProvider: systemConfig?.emailProvider || 'SMTP',
        twilioEnabled: !!(systemConfig?.twilioSid || settings?.twilioSid),
        smtpEnabled: !!(systemConfig?.smtpHost || settings?.smtpHost),
        razorpayEnabled: !!(settings?.razorpayMasterKeyId || systemConfig?.razorpayKeyId),
        twilioSid: systemConfig?.twilioSid || '',
        twilioAuthToken: systemConfig?.twilioAuthToken || '',
        smtpHost: systemConfig?.smtpHost || '',
        smtpPort: systemConfig?.smtpPort || '587',
        smtpUsername: systemConfig?.smtpUsername || '',
        smtpPassword: systemConfig?.smtpPassword || '',
      });
    }
  }, [settings, systemConfig]);


  const [testEmail, setTestEmail] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  async function handleSendTestEmail() {
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Please enter a valid recipient email address.');
      return;
    }
    setTestingEmail(true);
    toast.info('Sending test email via configured SMTP relay...');
    try {
      const res = await api.post('/system-configs/test-email', { email: testEmail });
      toast.success(res.data.message || 'Test email dispatched successfully! Check your inbox.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'SMTP Test Dispatch Failed');
    } finally {
      setTestingEmail(false);
    }
  }

  const [testingRazorpay, setTestingRazorpay] = useState(false);

  async function handleTestRazorpay() {
    if (!form.razorpayMasterKeyId || !form.razorpayMasterKeySecret) {
      toast.error('Please enter both Master Key ID and Key Secret before testing.');
      return;
    }
    setTestingRazorpay(true);
    toast.info('Verifying Razorpay credentials with Razorpay Gateway API...');
    try {
      const res = await api.post('/system-configs/test-razorpay', {
        keyId: form.razorpayMasterKeyId,
        keySecret: form.razorpayMasterKeySecret,
      });
      toast.success(res.data.message || 'Razorpay Connected & Authenticated Successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Razorpay Authentication Failed');
    } finally {
      setTestingRazorpay(false);
    }
  }

  const saveOnboardingPolicyMut = useMutation({
    mutationFn: async (payload: { onboardingMode: string; vipInviteCodes: string }) => {
      const res = await api.put('/super-admin/settings', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Onboarding Policy updated to ${data.onboardingMode} with VIP codes!`);
      queryClient.invalidateQueries({ queryKey: ['system-integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update onboarding policy.');
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: typeof form) => {
      // 1. Save super-admin infra & onboarding settings
      const settingsPayload = {
        onboardingMode: payload.onboardingMode,
        vipInviteCodes: payload.vipInviteCodes,
        onboardingMessage: payload.onboardingMessage,

        redisEnabled: payload.redisEnabled,
        redisHost: payload.redisHost,
        redisPort: payload.redisPort,
        redisPassword: payload.redisPassword,
        awsS3Enabled: payload.awsS3Enabled,
        awsAccessKey: payload.awsAccessKey,
        awsSecretKey: payload.awsSecretKey,
        awsRegion: payload.awsRegion,
        awsBucketName: payload.awsBucketName,
        rateLimitingEnabled: payload.rateLimitingEnabled,
        maxRequestsPerSec: payload.maxRequestsPerSec,
        authBruteForceLimitPerMin: payload.authBruteForceLimitPerMin,
        razorpayMasterKeyId: payload.razorpayMasterKeyId,
        razorpayMasterKeySecret: payload.razorpayMasterKeySecret,
      };
      await api.put('/super-admin/settings', settingsPayload);

      // 2. Save gateway configs (Twilio, SMTP, Razorpay)
      const gatewayPayload = {
        smsProvider: payload.smsProvider,
        emailProvider: payload.emailProvider,
        allowSelfRegistration: true,
        maintenanceMode: false,
        twilioSid: payload.twilioSid,
        twilioAuthToken: payload.twilioAuthToken,
        smtpHost: payload.smtpHost,
        smtpPort: payload.smtpPort,
        smtpUsername: payload.smtpUsername,
        smtpPassword: payload.smtpPassword,
        razorpayKeyId: payload.razorpayMasterKeyId,
        razorpayKeySecret: payload.razorpayMasterKeySecret,
      };
      await api.put('/system-configs', gatewayPayload);
    },
    onSuccess: () => {
      toast.success('Cloud Infrastructure & API Gateway credentials updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['system-integration-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-configs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'system-metrics'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save integration settings.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMut.mutate(form);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <PageHeader
        title="Cloud Infrastructure & API Gateways"
        description="Unified management for Redis L2 Caching, AWS S3 Bucket Storage, Twilio SMS, SMTP Email Relay, Bucket4j Rate Limiting, and Razorpay Gateways."
        icon={Server}
        actions={
          <Button type="button" onClick={handleSubmit} disabled={saveMut.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm">
            <Save className="h-4 w-4" /> Save All Credentials
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. SaaS Onboarding Policy & Waitlist Control */}
        <Card className="border shadow-sm overflow-hidden border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                SaaS Self-Registration Policy & Waitlist Controls
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Control how prospective PG Owners onboard onto StayEaze (Open instant signup, Queue for approval, or Invite-Only).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                form.onboardingMode === 'ENABLED'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : form.onboardingMode === 'WAITLIST'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}>
                {form.onboardingMode === 'ENABLED' ? 'OPEN SIGNUP' : form.onboardingMode === 'WAITLIST' ? 'APPROVAL QUEUE' : 'INVITE ONLY'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Onboarding Access Mode</Label>
              <Select
                value={form.onboardingMode}
                onValueChange={(v) => setForm({ ...form, onboardingMode: v })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Select Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENABLED" className="text-xs font-medium">
                    🟢 ENABLED — Instant Open Onboarding (Active immediately)
                  </SelectItem>
                  <SelectItem value="WAITLIST" className="text-xs font-medium">
                    🟡 WAITLIST — Approval Required (Enters Super Admin Queue)
                  </SelectItem>
                  <SelectItem value="DISABLED" className="text-xs font-medium">
                    🔴 DISABLED — Invite Only (Captures VIP Leads)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {form.onboardingMode === 'ENABLED' && 'Anyone can register and start managing their PG immediately without waiting.'}
                {form.onboardingMode === 'WAITLIST' && 'New signups are placed in PENDING_APPROVAL status until approved, unless they provide a VIP pass.'}
                {form.onboardingMode === 'DISABLED' && 'Public registration is closed. Registrations capture leads for sales outreach.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">VIP Passcodes (Bypass Waitlist)</Label>
              <Input
                value={form.vipInviteCodes}
                onChange={(e) => setForm({ ...form, vipInviteCodes: e.target.value.toUpperCase() })}
                placeholder="STAYVIP, EARLYBIRD, LAUNCH2026"
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Comma-separated codes that allow invited proprietors to bypass waitlists and activate instantly.
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50/50 dark:bg-slate-900/50 border-t flex justify-between items-center py-2.5 px-4">
            <p className="text-[11px] text-slate-500">
              Changes take effect immediately across all landing & registration pages.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={saveOnboardingPolicyMut.isPending}
              onClick={() => saveOnboardingPolicyMut.mutate({
                onboardingMode: form.onboardingMode,
                vipInviteCodes: form.vipInviteCodes,
              })}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {saveOnboardingPolicyMut.isPending ? 'Saving Policy...' : 'Save Onboarding Policy'}
            </Button>
          </CardFooter>
        </Card>

        {/* 2. Redis L2 Cache Cluster Configuration */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Redis L2 Cache Cluster Settings (1,000+ RPS Scale)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Distributed in-memory L2 caching for high-concurrency property, tenant, and billing profile queries.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${form.redisEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {form.redisEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="redisEnabled" className="text-xs font-semibold">Enable</Label>
                <Switch
                  id="redisEnabled"
                  checked={form.redisEnabled}
                  onCheckedChange={(v) => setForm({ ...form, redisEnabled: v })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Redis Host / URI</Label>
              <Input
                value={form.redisHost}
                onChange={(e) => setForm({ ...form, redisHost: e.target.value })}
                placeholder="redis.internal or 127.0.0.1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Redis Port</Label>
              <Input
                type="number"
                value={form.redisPort}
                onChange={(e) => setForm({ ...form, redisPort: Number(e.target.value) })}
                placeholder="6379"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Redis Auth Password</Label>
              <Input
                type="password"
                value={form.redisPassword}
                onChange={(e) => setForm({ ...form, redisPassword: e.target.value })}
                placeholder="Enter Redis Password"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. AWS S3 Cloud Storage Configuration */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Cloud className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                AWS S3 Cloud Storage Credentials
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Secure cloud bucket storage for tenant KYC documents, property photos, and digital receipt PDFs.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${form.awsS3Enabled ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {form.awsS3Enabled ? 'ACTIVE' : 'DISABLED'}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="awsS3Enabled" className="text-xs font-semibold">Enable</Label>
                <Switch
                  id="awsS3Enabled"
                  checked={form.awsS3Enabled}
                  onCheckedChange={(v) => setForm({ ...form, awsS3Enabled: v })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AWS Access Key ID</Label>
              <Input
                value={form.awsAccessKey}
                onChange={(e) => setForm({ ...form, awsAccessKey: e.target.value })}
                placeholder="AKIA..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AWS Secret Access Key</Label>
              <Input
                type="password"
                value={form.awsSecretKey}
                onChange={(e) => setForm({ ...form, awsSecretKey: e.target.value })}
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AWS Region</Label>
              <Input
                value={form.awsRegion}
                onChange={(e) => setForm({ ...form, awsRegion: e.target.value })}
                placeholder="ap-south-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AWS S3 Bucket Name</Label>
              <Input
                value={form.awsBucketName}
                onChange={(e) => setForm({ ...form, awsBucketName: e.target.value })}
                placeholder="stayeaze-media-storage"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Twilio SMS / OTP Gateway */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Twilio SMS & OTP Gateway Credentials
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                SMS gateway credentials for sending tenant check-in OTPs, booking confirmations, and notice alerts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${form.twilioEnabled ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {form.twilioEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="twilioEnabled" className="text-xs font-semibold">Enable</Label>
                <Switch
                  id="twilioEnabled"
                  checked={form.twilioEnabled}
                  onCheckedChange={(v) => setForm({ ...form, twilioEnabled: v })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Twilio Account SID</Label>
              <Input
                value={form.twilioSid}
                onChange={(e) => setForm({ ...form, twilioSid: e.target.value })}
                placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Twilio Auth Token</Label>
              <Input
                type="password"
                value={form.twilioAuthToken}
                onChange={(e) => setForm({ ...form, twilioAuthToken: e.target.value })}
                placeholder="Enter Auth Token"
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. SMTP Email Dispatcher Relay */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Email Dispatcher Relay (SMTP Server)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                SMTP relay server details for automated PDF tax invoice dispatches, rent receipts, and password resets.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${form.smtpEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {form.smtpEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="smtpEnabled" className="text-xs font-semibold">Enable</Label>
                <Switch
                  id="smtpEnabled"
                  checked={form.smtpEnabled}
                  onCheckedChange={(v) => setForm({ ...form, smtpEnabled: v })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SMTP Server Host</Label>
              <Input
                value={form.smtpHost}
                onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com or smtp.sendgrid.net"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SMTP Port</Label>
              <Input
                value={form.smtpPort}
                onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                placeholder="587"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SMTP Username</Label>
              <Input
                value={form.smtpUsername}
                onChange={(e) => setForm({ ...form, smtpUsername: e.target.value })}
                placeholder="notifications@stayeaze.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">SMTP App Password</Label>
              <Input
                type="password"
                value={form.smtpPassword}
                onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                placeholder="Enter App Password"
              />
            </div>
            
            {/* Live SMTP Diagnostic Test Section */}
            <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex-1 w-full flex items-center gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter recipient email to test (e.g. admin@gmail.com)"
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={testingEmail || !testEmail}
                  onClick={handleSendTestEmail}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shrink-0"
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  {testingEmail ? 'Sending...' : 'Send Test Email'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Razorpay Master Gateway Keys */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Key className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Master Razorpay Gateway Credentials
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Global Razorpay credentials override for platform-wide rent payments and online collections.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${form.razorpayEnabled ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {form.razorpayEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="razorpayEnabled" className="text-xs font-semibold">Enable</Label>
                <Switch
                  id="razorpayEnabled"
                  checked={form.razorpayEnabled}
                  onCheckedChange={(v) => setForm({ ...form, razorpayEnabled: v })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Master Key ID</Label>
              <Input
                value={form.razorpayMasterKeyId}
                onChange={(e) => setForm({ ...form, razorpayMasterKeyId: e.target.value })}
                placeholder="rzp_live_..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Master Key Secret</Label>
              <Input
                type="password"
                value={form.razorpayMasterKeySecret}
                onChange={(e) => setForm({ ...form, razorpayMasterKeySecret: e.target.value })}
                placeholder="Enter Secret Key"
              />
            </div>

            {/* Live Razorpay Diagnostic Test Section */}
            <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Click to authenticate credentials against Razorpay servers and test online order creation.
              </p>
              <Button
                type="button"
                size="sm"
                disabled={testingRazorpay || !form.razorpayMasterKeyId || !form.razorpayMasterKeySecret}
                onClick={handleTestRazorpay}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9 shrink-0 gap-1.5 shadow-xs"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {testingRazorpay ? 'Testing Connection...' : 'Test Razorpay Connection'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 6. API Rate Limiting & Security */}
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-slate-50/50 dark:bg-slate-900/50 border-b">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Bucket4j Rate Limiting & Brute-Force Defense
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Token bucket rate limiting to prevent API overload, DDoS attacks, and login brute-force attempts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${form.rateLimitingEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {form.rateLimitingEnabled ? 'ACTIVE' : 'DISABLED'}
              </span>
              <div className="flex items-center gap-2">
                <Label htmlFor="rateLimitingEnabled" className="text-xs font-semibold">Enable</Label>
                <Switch
                  id="rateLimitingEnabled"
                  checked={form.rateLimitingEnabled}
                  onCheckedChange={(v) => setForm({ ...form, rateLimitingEnabled: v })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Requests / Sec (Per IP)</Label>
              <Input
                type="number"
                value={form.maxRequestsPerSec}
                onChange={(e) => setForm({ ...form, maxRequestsPerSec: Number(e.target.value) })}
                placeholder="50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Auth Login Limit / Min (Per IP)</Label>
              <Input
                type="number"
                value={form.authBruteForceLimitPerMin}
                onChange={(e) => setForm({ ...form, authBruteForceLimitPerMin: Number(e.target.value) })}
                placeholder="5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Floating / Sticky Footer Save Action Bar */}
        <div className="sticky bottom-4 z-20 flex items-center justify-between gap-4 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:px-6">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Credentials take immediate effect upon saving.</span>
          </p>
          <Button type="submit" disabled={saveMut.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 shadow-md">
            <Save className="h-4 w-4" /> Save Cloud Infrastructure Credentials
          </Button>
        </div>
      </form>
    </div>
  );
}
