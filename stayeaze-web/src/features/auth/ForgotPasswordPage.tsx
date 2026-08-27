import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  KeyRound, Mail, Lock, ArrowLeft, ArrowRight, CheckCircle2,
  AlertCircle, Eye, EyeOff, Loader2, ShieldCheck, Sparkles, Hotel, Sun, Moon
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUIStore } from '@/lib/stores/ui-store';
import { validateEmail } from '@/lib/validation';
import api from '@/lib/api';

type ResetStep = 'EMAIL_REQUEST' | 'VERIFY_AND_RESET' | 'SUCCESS';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useUIStore();

  const [step, setStep] = useState<ResetStep>('EMAIL_REQUEST');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'EMAIL_REQUEST') {
      setTimeout(() => emailInputRef.current?.focus(), 100);
    } else if (step === 'VERIFY_AND_RESET') {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Password strength checker
  const passwordCriteria = {
    length: newPassword.length >= 8,
    hasLetter: /[a-zA-Z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };
  const isPasswordValid = passwordCriteria.length && passwordCriteria.hasLetter && passwordCriteria.hasNumber;

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.isValid) {
      setErrorMsg(emailCheck.error || 'Please enter a valid email address.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      
      // Check if ID/email is present in DB and dispatch OTP
      const res = await api.post('/auth/forgot-password', { email: cleanEmail });
      
      if (res.data?.otpDev) {
        setDevOtp(res.data.otpDev);
      }

      toast.success('Verification Code Dispatched!', {
        description: `A 6-digit code has been sent to ${cleanEmail}.`,
      });

      setResendCooldown(45);
      // Only advance to next page if user exists and OTP was dispatched successfully
      setStep('VERIFY_AND_RESET');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'No account found with this email address. Please check and try again.';
      setErrorMsg(msg);
      toast.error('Account Lookup Failed', { description: msg });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0 || isLoading) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      if (res.data?.otpDev) {
        setDevOtp(res.data.otpDev);
      }
      toast.success('New verification code sent!', {
        description: 'Please check your email inbox.',
      });
      setResendCooldown(45);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to resend code.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const cleanOtp = otp.trim();

    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg('New password must be at least 8 characters with letters and numbers.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        newPassword: newPassword.trim(),
      });

      toast.success('Password reset successfully!', {
        description: 'You can now sign in using your new password.',
      });
      setStep('SUCCESS');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please verify your code.';
      setErrorMsg(msg);
      toast.error('Reset Failed', { description: msg });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-foreground relative overflow-hidden transition-colors duration-200">
      {/* Background Ambience Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-primary/10 dark:bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-violet-600/10 dark:bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Navbar Toolbar */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 px-2 z-10">
        <Link to="/login" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Hotel className="h-4.5 w-4.5" />
          </div>
          <span className="font-heading text-lg font-bold">StayEaze</span>
        </Link>

        {/* Theme Toggle Button based on stored preference */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
          <span className="capitalize">{theme === 'light' ? 'Dark' : 'Light'}</span>
        </Button>
      </div>

      {/* Main Form Card Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Header Title */}
        <div className="text-center mb-6 space-y-1.5">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-xs mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {step === 'SUCCESS' ? 'Password Reset Complete' : 'Reset Your Password'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
            {step === 'EMAIL_REQUEST' && 'Enter your registered email address to check your account and receive a secure recovery code.'}
            {step === 'VERIFY_AND_RESET' && `Enter the 6-digit code sent to ${email} and set your new password.`}
            {step === 'SUCCESS' && 'Your account security credentials have been successfully updated.'}
          </p>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 rounded-3xl bg-card border border-border/80 shadow-xl space-y-5">
          {/* Error Alert Box */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-fade-in font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Dev OTP Helper Badge */}
          {devOtp && step === 'VERIFY_AND_RESET' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Dev OTP Code: <strong className="font-mono text-foreground text-sm font-black">{devOtp}</strong></span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:text-foreground px-2"
                onClick={() => setOtp(devOtp)}
              >
                Auto-fill
              </Button>
            </div>
          )}

          {/* STEP 1: EMAIL REQUEST */}
          {step === 'EMAIL_REQUEST' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Registered Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    ref={emailInputRef}
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                    className="pl-10 h-11 rounded-xl text-sm"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full h-11 rounded-xl font-bold text-sm shadow-md shadow-primary/20 gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying Account & Sending Code...
                  </>
                ) : (
                  <>
                    Verify & Send Code <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* STEP 2: VERIFY CODE & NEW PASSWORD */}
          {step === 'VERIFY_AND_RESET' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="otp" className="text-xs font-semibold">
                    6-Digit Verification Code
                  </Label>
                  <button
                    type="button"
                    onClick={() => { setStep('EMAIL_REQUEST'); setErrorMsg(null); }}
                    className="text-[11px] text-primary hover:underline transition-colors"
                  >
                    Change Email
                  </button>
                </div>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="otp"
                    ref={otpInputRef}
                    type="text"
                    maxLength={10}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value); setErrorMsg(null); }}
                    className="pl-10 h-11 rounded-xl font-mono tracking-widest text-sm"
                    required
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" required className="text-xs font-semibold">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(null); }}
                    className="pl-10 pr-10 h-11 rounded-xl text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" required className="text-xs font-semibold">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(null); }}
                    className="pl-10 pr-10 h-11 rounded-xl text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Quality Criteria Checklist */}
              {newPassword && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${passwordCriteria.length ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                    <span className={passwordCriteria.length ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${passwordCriteria.hasLetter && passwordCriteria.hasNumber ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                    <span className={passwordCriteria.hasLetter && passwordCriteria.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}>Contains letters & numbers</span>
                  </div>
                  {confirmPassword && (
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${passwordCriteria.match ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className={passwordCriteria.match ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>Passwords match</span>
                    </div>
                  )}
                </div>
              )}

              {/* Submit & Resend Controls */}
              <Button
                type="submit"
                disabled={isLoading || !otp.trim() || !isPasswordValid || newPassword !== confirmPassword}
                className="w-full h-11 rounded-xl font-bold text-sm shadow-md shadow-primary/20 gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Updating Password...
                  </>
                ) : (
                  <>
                    Reset Password & Sign In <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center pt-1 text-xs text-muted-foreground">
                <span>Didn't receive the code?</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isLoading}
                  className="ml-1.5 font-semibold text-primary hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 'SUCCESS' && (
            <div className="text-center py-4 space-y-5 animate-fade-in">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Password Updated!</h3>
                <p className="text-xs text-muted-foreground">
                  Your password has been reset successfully. You can now use your new password to sign in.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 gap-2"
              >
                Sign In Now <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Back to Login Footer */}
          {step !== 'SUCCESS' && (
            <div className="pt-2 border-t border-border text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
