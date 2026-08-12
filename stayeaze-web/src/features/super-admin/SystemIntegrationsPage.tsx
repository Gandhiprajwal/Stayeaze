import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Database, Cloud, ShieldCheck, Key, Save, CheckCircle2, MessageSquare, Mail } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SystemIntegrationsPage() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['system-integration-settings'],
    queryFn: () => api.get('/super-admin/settings').then((r) => r.data),
  });

  const { data: systemConfig } = useQuery({
    queryKey: ['system-configs'],
    queryFn: () => api.get<any>('/system-configs').then((r) => r.data),
  });

  const [form, setForm] = useState({
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


  const saveMut = useMutation({
    mutationFn: async (payload: typeof form) => {
      // 1. Save super-admin infra settings
      const settingsPayload = {
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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Cloud Infrastructure & API Gateways"
        description="Unified management for Redis L2 Caching, AWS S3 Bucket Storage, Twilio SMS, SMTP Email Relay, Bucket4j Rate Limiting, and Razorpay Gateways."
        icon={Server}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Redis Caching Configuration */}
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Redis L2 Cache Cluster Settings (1,000+ RPS Scale)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Distributed in-memory L2 caching for high-concurrency property, tenant, and billing profile queries.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="redisEnabled" className="text-xs font-semibold">Enable Redis</Label>
              <Switch
                id="redisEnabled"
                checked={form.redisEnabled}
                onCheckedChange={(v) => setForm({ ...form, redisEnabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
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
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Cloud className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                AWS S3 Cloud Storage Credentials
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Secure cloud bucket storage for tenant KYC documents, property photos, and digital receipt PDFs.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="awsS3Enabled" className="text-xs font-semibold">Enable AWS S3</Label>
              <Switch
                id="awsS3Enabled"
                checked={form.awsS3Enabled}
                onCheckedChange={(v) => setForm({ ...form, awsS3Enabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Twilio SMS & OTP Gateway Credentials
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                SMS gateway credentials for sending tenant check-in OTPs, booking confirmations, and notice alerts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="twilioEnabled" className="text-xs font-semibold">Enable Twilio</Label>
              <Switch
                id="twilioEnabled"
                checked={form.twilioEnabled}
                onCheckedChange={(v) => setForm({ ...form, twilioEnabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Email Dispatcher Relay (SMTP Server)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                SMTP relay server details for automated PDF tax invoice dispatches, rent receipts, and password resets.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="smtpEnabled" className="text-xs font-semibold">Enable SMTP</Label>
              <Switch
                id="smtpEnabled"
                checked={form.smtpEnabled}
                onCheckedChange={(v) => setForm({ ...form, smtpEnabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
          </CardContent>
        </Card>

        {/* 5. Razorpay Master Gateway Keys */}
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Key className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Master Razorpay Gateway Credentials
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Global Razorpay credentials override for platform-wide rent payments and online collections.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="razorpayEnabled" className="text-xs font-semibold">Enable Razorpay</Label>
              <Switch
                id="razorpayEnabled"
                checked={form.razorpayEnabled}
                onCheckedChange={(v) => setForm({ ...form, razorpayEnabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
          </CardContent>
        </Card>


        {/* 6. API Rate Limiting & Security */}
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Bucket4j Rate Limiting & Brute-Force Defense
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Token bucket rate limiting to prevent API overload, DDoS attacks, and login brute-force attempts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="rateLimitingEnabled" className="text-xs font-semibold">Enable Rate Limits</Label>
              <Switch
                id="rateLimitingEnabled"
                checked={form.rateLimitingEnabled}
                onCheckedChange={(v) => setForm({ ...form, rateLimitingEnabled: v })}
              />
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
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
          <CardFooter className="bg-muted/30 border-t px-6 py-4 flex justify-between items-center">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Credentials take immediate effect upon saving.
            </p>
            <Button type="submit" disabled={saveMut.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Save className="mr-1.5 h-4 w-4" /> Save Cloud Infrastructure Credentials
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
