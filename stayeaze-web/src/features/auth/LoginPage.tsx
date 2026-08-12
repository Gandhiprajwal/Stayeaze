import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hotel, Loader2, Eye, EyeOff, ShieldCheck, Building2, UserRound } from 'lucide-react';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const demoAccounts = [
    { role: 'Super Admin', email: 'superadmin@stayeaze.com', password: 'Friend@2010', icon: ShieldCheck, accent: 'text-destructive' },
    { role: 'Admin (Owner)', email: 'owner@stayeaze.com', password: 'owner123', icon: Building2, accent: 'text-info' },
    { role: 'Property Manager', email: 'manager@stayeaze.com', password: 'manager123', icon: UserRound, accent: 'text-primary' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      /* error surfaced via store */
    }
  }

  function fillDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    clearError();
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Hotel className="h-6 w-6" />
          </div>
          <div>
            <p className="font-heading text-xl font-bold leading-none">StayEaze</p>
            <p className="mt-1 text-xs text-white/50">PG / Hostel Management</p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
            The operations console for modern co-living.
          </h1>
          <p className="mt-4 text-base text-white/60">
            Manage properties, tenants, billing and facilities from one enterprise-grade back-office.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { label: 'Properties', value: '4' },
              { label: 'Active Tenants', value: '300+' },
              { label: 'Occupancy', value: '82%' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur">
                <p className="font-heading text-2xl font-bold">{s.value}</p>
                <p className="mt-0.5 text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} StayEaze Technologies. Back-office access only.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2.5 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Hotel className="h-5 w-5" />
              </div>
              <span className="font-heading text-lg font-bold">StayEaze</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? 'Dark' : 'Light'} mode
            </Button>
          </div>

          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to the management console to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@stayeaze.in"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError(); }}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">Quick demo access</span>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                onClick={() => fillDemo(acc.email, acc.password)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:shadow-sm'
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                  <acc.icon className={cn('h-4 w-4', acc.accent)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{acc.role}</p>
                  <p className="truncate text-xs text-muted-foreground">{acc.email}</p>
                </div>
                <span className="text-xs font-medium text-primary">Use</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
