import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Hotel, Loader2, Eye, EyeOff, ShieldCheck, Building2, UserRound, Wrench, KeyRound, ArrowLeft, CheckCircle2, Headset, ConciergeBell, Receipt, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { authService } from '@/lib/services/auth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

import { validateEmail } from '@/lib/validation';

function getRoleLanding(role?: string): string {
  switch (role) {
    case 'TENANT':
      return '/tenant/dashboard';
    case 'SUPPORT':
      return '/support/dashboard';
    case 'ACCOUNTANT':
      return '/accountant/dashboard';
    case 'RECEPTIONIST':
      return '/receptionist/dashboard';
    case 'SECURITY_GUARD':
      return '/security/dashboard';
    case 'STAFF':
      return '/staff/dashboard';
    case 'SUPER_ADMIN':
    case 'ADMIN':
    case 'OWNER':
    case 'PROPERTY_MANAGER':
    default:
      return '/dashboard';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, clearError } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auth states
  const [step, setStep] = useState<'login' | '2fa' | 'first_time_password'>('login');
  const [otpCode, setOtpCode] = useState('');
  const [otpDev, setOtpDev] = useState<string | undefined>();
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // First time password change state
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const { data: maintenanceData } = useQuery({
    queryKey: ['platform-maintenance-status-login'],
    queryFn: () => api.get<any>('/auth/maintenance-status').then((r) => r.data),
  });

  const isMaintenanceMode = maintenanceData?.maintenanceModeEnabled;
  const maintenanceMessage = maintenanceData?.maintenanceMessage || 'StayEaze is undergoing scheduled maintenance.';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);

    if (!email.trim() || !password.trim()) {
      setAuthError('Please fill in all required fields marked with *');
      return;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setAuthError(emailValidation.error || 'Invalid email address');
      return;
    }

    setLoadingLocal(true);
    try {
      const res: any = await authService.login({ email, password });
      if (res && res.mustChangePassword) {
        setTempPassword(password);
        setStep('first_time_password');
        toast({
          title: 'First-Time Login Detected',
          description: 'Please set your custom password before accessing the system.',
        });
      } else if ('requires2FA' in res && res.requires2FA) {
        setStep('2fa');
        setOtpDev(res.otpDev);
        toast({
          title: '2FA Verification Required',
          description: 'A 6-digit verification code has been generated.',
        });
      } else if ('token' in res) {
        setAuth(res.user, res.token);
        toast({ title: 'Welcome back!', description: 'Logged in successfully.' });
        navigate(getRoleLanding(res.user?.role));
      }
    } catch (err: any) {
      setAuthError(err.message || 'Invalid email or password');
    } finally {
      setLoadingLocal(false);
    }
  }

  async function handleFirstTimePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setAuthError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError('New password and confirm password do not match.');
      return;
    }
    setUpdatingPassword(true);
    setAuthError(null);
    try {
      const res = await api.post('/auth/first-time-change-password', {
        email,
        currentPassword: tempPassword,
        newPassword,
      });
      const data = res.data;
      const token = data.accessToken || data.token;
      let role: any = 'PROPERTY_MANAGER';
      if (data.roles) {
        if (data.roles.includes('ROLE_SUPER_ADMIN')) role = 'SUPER_ADMIN';
        else if (data.roles.includes('ROLE_SUPPORT')) role = 'SUPPORT';
        else if (data.roles.includes('ROLE_OWNER')) role = 'ADMIN';
        else if (data.roles.includes('ROLE_PROPERTY_MANAGER')) role = 'PROPERTY_MANAGER';
        else if (data.roles.includes('ROLE_ACCOUNTANT')) role = 'ACCOUNTANT';
        else if (data.roles.includes('ROLE_RECEPTIONIST')) role = 'RECEPTIONIST';
        else if (data.roles.includes('ROLE_SECURITY_GUARD')) role = 'SECURITY_GUARD';
        else if (data.roles.includes('ROLE_STAFF')) role = 'STAFF';
        else if (data.roles.includes('ROLE_TENANT')) role = 'TENANT';
      }
      const user: any = {
        id: data.id,
        name: data.name || email.split('@')[0],
        email: data.email,
        phone: data.phone || data.mobile || '',
        avatarUrl: data.avatarUrl || '',
        role: role,
        status: 'active',
        propertyIds: [],
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setAuth(user, token);
      toast({
        title: 'Password Updated Successfully',
        description: 'Your password has been saved. Welcome to StayEaze!',
      });
      navigate(getRoleLanding(role));
    } catch (err: any) {
      setAuthError(err.response?.data?.message || err.message || 'Failed to update password.');
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function handleVerify2FA(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      setAuthError('Please enter the full 6-digit verification code.');
      return;
    }
    setVerifyingOtp(true);
    setAuthError(null);
    try {
      const session = await authService.verify2FA(email, otpCode);
      setAuth(session.user, session.token);
      toast({
        title: '2FA Verified',
        description: 'Identity confirmed. Welcome back!',
      });
      const isTenant = session.user?.role === 'TENANT' || (session.user?.role && session.user.role.includes('TENANT'));
      navigate(isTenant ? '/tenant/dashboard' : '/dashboard');
    } catch (err: any) {
      setAuthError(err.message || 'Invalid or expired verification code');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleResend2FA() {
    setResendingOtp(true);
    setAuthError(null);
    try {
      const res = await authService.resend2FA(email);
      setOtpDev(res.otpDev);
      toast({
        title: 'New Code Generated',
        description: 'A fresh 6-digit OTP code has been issued.',
      });
    } catch (err: any) {
      setAuthError(err.message || 'Failed to resend code');
    } finally {
      setResendingOtp(false);
    }
  }

  function fillDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    clearError();
    setAuthError(null);
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

          {step === 'login' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h2 className="font-heading text-2xl font-bold tracking-tight">Welcome back</h2>
                <p className="text-sm text-muted-foreground">Sign in to the management console to continue.</p>
              </div>

              {isMaintenanceMode && (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200">
                    <Wrench className="h-4 w-4" /> Platform Maintenance Mode Active
                  </div>
                  <p className="mt-1">{maintenanceMessage}</p>
                  <p className="mt-1 font-semibold text-amber-700 dark:text-amber-400">
                    Only Super Admin accounts can sign in during maintenance.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" required>Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@stayeaze.in"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" required>Password</Label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
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
                      onChange={(e) => { setPassword(e.target.value); setAuthError(null); }}
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

                {authError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {authError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loadingLocal}>
                  {loadingLocal && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>

              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30 p-3.5 text-center space-y-1">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  Want to manage your PG or Hostel with StayEaze?
                </div>
                <Link to="/signup" className="inline-flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
                  Register Property & Start 14-Day Free Trial / Subscribe →
                </Link>
              </div>
            </div>
          )}

          {step === '2fa' && (
            /* 2FA OTP Step */
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setStep('login')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to email & password
              </button>

              <div className="space-y-1.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h2 className="font-heading text-2xl font-bold tracking-tight">Two-Factor Verification</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit authentication code sent to <strong className="text-foreground">{email}</strong>.
                </p>
              </div>

              {otpDev && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs text-blue-900 dark:text-blue-200">
                  <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                    <CheckCircle2 className="h-4 w-4" /> 2FA Dev Verification Code:
                  </div>
                  <div className="mt-1 font-mono text-lg font-extrabold tracking-widest text-blue-600 dark:text-blue-400">
                    {otpDev}
                  </div>
                  <p className="mt-1 text-[11px] opacity-80">
                    Click "Use Code" or copy code above to verify.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2 h-7 border-blue-400 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold"
                    onClick={() => setOtpCode(otpDev)}
                  >
                    Auto-Fill Code ({otpDev})
                  </Button>
                </div>
              )}

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp">6-Digit Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, ''));
                      setAuthError(null);
                    }}
                    className="text-center font-mono text-lg font-bold tracking-widest"
                    autoFocus
                    required
                  />
                </div>

                {authError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {authError}
                  </div>
                )}

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold" disabled={verifyingOtp}>
                  {verifyingOtp && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Verify Code & Sign In
                </Button>
              </form>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Didn't receive the code?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={resendingOtp}
                  onClick={handleResend2FA}
                  className="h-auto p-0 text-primary hover:bg-transparent hover:underline"
                >
                  {resendingOtp ? 'Resending...' : 'Resend Code'}
                </Button>
              </div>
            </div>
          )}

          {step === 'first_time_password' && (
            /* First-Time Password Change Step */
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => setStep('login')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>

              <div className="space-y-1.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h2 className="font-heading text-2xl font-bold tracking-tight">Set Your New Password</h2>
                <p className="text-sm text-muted-foreground">
                  First-time login detected for <strong className="text-foreground">{email}</strong>. Please set a new password before accessing the system.
                </p>
              </div>

              <form onSubmit={handleFirstTimePasswordChange} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New Password (min 6 characters)</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setAuthError(null); }}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setAuthError(null); }}
                    required
                  />
                </div>

                {authError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {authError}
                  </div>
                )}

                <Button type="submit" className="w-full font-semibold" disabled={updatingPassword}>
                  {updatingPassword && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Set Password & Access Portal
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

