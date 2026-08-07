import { useState } from 'react';
import { Settings as SettingsIcon, Building2, Bell, Palette, Globe, Shield, User } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { initials } from '@/lib/format';
import { roleLabels } from '@/lib/role-utils';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');

  const [notifications, setNotifications] = useState({
    emailAlerts: true, bookingAlerts: true, complaintAlerts: true,
    paymentAlerts: false, weeklyReport: true,
  });

  function saveProfile() { toast.success('Profile updated successfully'); }
  function saveNotifications() { toast.success('Notification preferences saved'); }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, preferences and organization." icon={SettingsIcon} />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="mr-1.5 h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="mr-1.5 h-4 w-4" /> Appearance</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-1.5 h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="organization"><Building2 className="mr-1.5 h-4 w-4" /> Organization</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-1.5 h-4 w-4" /> Security</TabsTrigger>
        </TabsList>

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

        {/* Organization */}
        <TabsContent value="organization">
          <Card className="max-w-2xl">
            <CardHeader><CardTitle>Organization</CardTitle><CardDescription>Company-wide settings.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Organization Name</Label><Input defaultValue="StayEaze Technologies" /></div>
                <div className="space-y-1.5"><Label>Currency</Label><Input defaultValue="INR (₹)" disabled /></div>
                <div className="space-y-1.5"><Label>Timezone</Label><Input defaultValue="Asia/Kolkata (IST)" /></div>
                <div className="space-y-1.5"><Label><Globe className="mr-1 inline h-3.5 w-3.5" /> Date Format</Label><Input defaultValue="DD MMM YYYY" /></div>
              </div>
              <div className="flex justify-end"><Button onClick={() => toast.success('Organization settings saved')}>Save</Button></div>
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
