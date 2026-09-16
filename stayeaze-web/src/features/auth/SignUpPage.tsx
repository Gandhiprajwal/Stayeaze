import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Building2, CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, 
  Sparkles, CreditCard, Lock, Check, HelpCircle, Loader2, Landmark, 
  UserCheck, AlertCircle, Phone, Mail, MapPin, Hash, FileText,
  Clock, Ticket, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/format';
import { validateEmail, validateMobile, validatePan, validatePincode, validateIfsc, validateGstin } from '@/lib/validation';
import { StateCityPincodeSelector } from '@/components/common/StateCityPincodeSelector';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeLeadId = searchParams.get('resume') || searchParams.get('leadId');
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [resumedLead, setResumedLead] = useState<any>(null);
  const [isResumingLead, setIsResumingLead] = useState(false);

  // Fetch Live SaaS Onboarding & Policy Controls
  const { data: onboardingPolicy } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      try {
        const res = await api.get('/auth/onboarding-status');
        return res.data;
      } catch (e) {
        return { onboardingMode: 'ENABLED' };
      }
    },
    staleTime: 30_000,
  });

  // Step 1: Owner Credentials & VIP Passcode
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSubdomain, setOrgSubdomain] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubdomainChecking, setIsSubdomainChecking] = useState(false);
  const [isSubdomainAvailable, setIsSubdomainAvailable] = useState<boolean | null>(null);

  // Resume Onboarding Session Hook
  useEffect(() => {
    if (!resumeLeadId) return;

    const fetchLeadForResume = async () => {
      try {
        setIsResumingLead(true);
        const res = await api.get(`/public/leads/resume/${resumeLeadId}`);
        const lead = res.data;
        if (lead) {
          setResumedLead(lead);
          if (lead.ownerName) setOwnerName(lead.ownerName);
          if (lead.ownerEmail) setOwnerEmail(lead.ownerEmail);
          if (lead.ownerPhone) setOwnerPhone(lead.ownerPhone);
          if (lead.propertyName) {
            setPropertyName(lead.propertyName);
            setOrgName(lead.propertyName);
          }
          if (lead.propertyCode) setPropertyCode(lead.propertyCode);
          toast.success(`Welcome back, ${lead.ownerName || 'Property Owner'}! Restored your onboarding details.`);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Onboarding session expired or not found.');
      } finally {
        setIsResumingLead(false);
      }
    };

    fetchLeadForResume();
  }, [resumeLeadId]);

  // Completion State for Waitlist / Invite-only
  const [resultStatus, setResultStatus] = useState<{
    status: 'WAITLISTED' | 'LEAD_CAPTURED' | 'ACTIVE';
    mode?: string;
    leadCode?: string;
    message?: string;
  } | null>(null);

  // Step 2: Compulsory Property Details
  const [propertyName, setPropertyName] = useState('');
  const [propertyCode, setPropertyCode] = useState('');
  const [propertyType, setPropertyType] = useState('PG');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [manager, setManager] = useState('');
  const [landlordPan, setLandlordPan] = useState('');
  const [pgLicenseNo, setPgLicenseNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [authorizedSignatory, setAuthorizedSignatory] = useState('');
  const [gstin, setGstin] = useState('');

  // Compulsory Lease & Settlement Policies (P3.3)
  const [minimumLockInMonths, setMinimumLockInMonths] = useState<number>(3);
  const [noticePeriodDays, setNoticePeriodDays] = useState<number>(30);
  const [defaultExitCleaningFee, setDefaultExitCleaningFee] = useState<number>(500);
  const [defaultElectricityRatePerUnit, setDefaultElectricityRatePerUnit] = useState<number>(10.0);

  // Step 3: Subscription & Trial
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [isAnnual, setIsAnnual] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [seedSampleData, setSeedSampleData] = useState(true);

  // Step 4: Checkout & Activation State
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-generate subdomain from Org Name
  useEffect(() => {
    if (!orgSubdomain && orgName) {
      const generated = orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
      setOrgSubdomain(generated);
    }
  }, [orgName]);

  // Real-Time Subdomain Availability Check
  useEffect(() => {
    if (!orgSubdomain || orgSubdomain.length < 3) {
      setIsSubdomainAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSubdomainChecking(true);
        const res = await api.get<{ available: boolean }>(`/auth/check-subdomain?subdomain=${encodeURIComponent(orgSubdomain)}`);
        setIsSubdomainAvailable(res.data.available);
      } catch (err) {
        setIsSubdomainAvailable(false);
      } finally {
        setIsSubdomainChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [orgSubdomain]);

  const { data: dbPlans } = useQuery<any[]>({
    queryKey: ['public-saas-plans'],
    queryFn: async () => {
      try {
        const res = await api.get('/saas/plans');
        if (Array.isArray(res.data) && res.data.length > 0) return res.data;
      } catch (e) {
        // Fallback to auth public plans
      }
      try {
        const fallbackRes = await api.get('/auth/public-plans');
        return fallbackRes.data;
      } catch (e) {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const plans = Array.isArray(dbPlans) && dbPlans.length > 0
    ? dbPlans.map((p) => {
        const id = (p.planKey || p.name).toLowerCase().includes('enterprise')
          ? 'enterprise'
          : ((p.planKey || p.name).toLowerCase().includes('pro') || (p.planKey || p.name).toLowerCase().includes('growth') ? 'pro' : 'starter');
        const monthly = Number(p.monthlyPrice) || 1499;
        const annual = Number(p.annualPrice) || Math.round(monthly * 10);
        return {
          id,
          rawPlanKey: p.planKey || id.toUpperCase(),
          name: p.name,
          description: p.description || (id === 'starter'
            ? 'Ideal for Single-Building Standalone PGs (Up to 15 Rooms / 35 Beds in 2 & 3 sharing, 2 Staff logins).'
            : id === 'pro'
            ? 'For Multi-Wing Hostels & 2-Branch PGs (Up to 4 Buildings, 50 Rooms / 120 Beds with Meter Engine & Digital Agreements).'
            : 'For Multi-City Co-Living Chains (Unlimited Buildings, 500+ Beds, Bulk Rent Runs, Custom Subdomain & Priority SLA).'),
          monthlyPrice: monthly,
          annualPrice: Math.round(annual / 12),
          bedsLimit: `Up to ${p.maxBeds || 35} Beds`,
          propertiesLimit: `Up to ${p.maxProperties || 1} Property Workspace(s)`,
          features: [
            `Up to ${p.maxBeds || 35} Beds Capacity`,
            `Up to ${p.maxProperties || 1} Property Workspace(s)`,
            `Up to ${p.maxStaffUsers || 2} Staff Account Logins`,
            p.allowWhatsApp ? 'Automated WhatsApp Notices & Rent Alerts' : 'Standard Email Alerts',
            p.allowRazorpayOnline ? 'Per-Property Online Razorpay Gateway' : 'Offline Payment Tracking',
            p.allowCustomBranding ? 'White-Label Custom Branding & Portal Header' : 'StayEaze Standard Suite',
          ],
          badge: p.planKey === 'PROFESSIONAL' ? 'Most Popular' : (p.planKey === 'ENTERPRISE' ? 'Large Operations' : 'Small PGs'),
          popular: p.planKey === 'PROFESSIONAL',
        };
      })
    : [
        {
          id: 'starter',
          name: 'Starter PG Plan',
          description: 'Ideal for Single-Building Standalone PGs (Up to 15 Rooms / 35 Beds in 2 & 3 sharing, 2 Staff logins).',
          monthlyPrice: 1499,
          annualPrice: 1199,
          bedsLimit: 'Up to 35 Beds',
          propertiesLimit: '1 Property',
          features: [
            'Up to 35 Beds Capacity',
            '1 Property Workspace',
            'Up to 2 Staff Account Logins',
            'Building & Room Hierarchy Matrix',
            'Tenant Rent Invoicing & Ledger',
            'Standard Email Alerts & Analytics'
          ],
          badge: 'Small PGs',
        },
        {
          id: 'pro',
          name: 'Growth Hostel & PG',
          description: 'For Multi-Wing Hostels & 2-Branch PGs (Up to 4 Buildings, 50 Rooms / 120 Beds with Meter Engine & Digital Agreements).',
          monthlyPrice: 3499,
          annualPrice: 2799,
          bedsLimit: 'Up to 120 Beds',
          propertiesLimit: 'Up to 2 Properties',
          features: [
            'Up to 120 Beds Capacity',
            'Up to 2 Property Workspaces',
            'Up to 6 Staff Account Logins',
            'Per-Property Razorpay Gateway',
            'Automated WhatsApp Notices & Alerts',
            'Sub-Meter Utility Engine & GST Receipts'
          ],
          badge: 'Most Popular',
          popular: true,
        },
        {
          id: 'enterprise',
          name: 'Enterprise Living Chain',
          description: 'For Multi-City Co-Living Chains (Unlimited Buildings, 500+ Beds, Bulk Rent Runs, Custom Subdomain & Priority SLA).',
          monthlyPrice: 7999,
          annualPrice: 6399,
          bedsLimit: 'Up to 500 Beds',
          propertiesLimit: 'Up to 10 Properties',
          features: [
            'Up to 500 Beds Capacity (Scalable)',
            'Up to 10 Property Workspaces',
            'Up to 25 Staff Account Logins',
            'Dedicated Platform Account Manager',
            'Custom WhatsApp / SMS Gateway',
            'White-Label Custom Branding & Priority SLA'
          ],
          badge: 'Large Operations',
        },
      ];

  const currentPlanObj = plans.find((p) => p.id === selectedPlan) || plans[0];
  const currentPrice = isTrial ? 2 : (isAnnual ? currentPlanObj.annualPrice * 12 : currentPlanObj.monthlyPrice);

  function validateStep1(): boolean {
    if (!ownerName.trim()) { toast.error('Please enter Owner / Admin Full Name'); return false; }
    
    const emailRes = validateEmail(ownerEmail);
    if (!emailRes.isValid) { toast.error(emailRes.error || 'Please enter a valid email address'); return false; }

    const mobileRes = validateMobile(ownerPhone);
    if (!mobileRes.isValid) { toast.error(mobileRes.error || 'Please enter a valid mobile number'); return false; }

    if (!ownerPassword || ownerPassword.length < 6) { toast.error('Password must be at least 6 characters long'); return false; }
    if (!orgName.trim()) { toast.error('Please enter Business / Organization Name'); return false; }
    if (!orgSubdomain.trim()) { toast.error('Please choose a Subdomain'); return false; }
    if (isSubdomainAvailable === false) { toast.error('Subdomain is already taken. Please choose a different subdomain.'); return false; }
    return true;
  }

  function validateStep2(): boolean {
    if (!propertyName.trim()) { toast.error('Please enter Property Name'); return false; }
    if (!propertyCode.trim()) { toast.error('Please enter Property Code (e.g. GL-PG1)'); return false; }
    if (!address.trim()) { toast.error('Please enter Property Address'); return false; }
    if (!stateName.trim()) { toast.error('Please select State'); return false; }
    if (!city.trim()) { toast.error('Please enter City'); return false; }

    const pinRes = validatePincode(pincode);
    if (!pinRes.isValid) { toast.error(pinRes.error || 'Please enter a valid 6-digit Pincode'); return false; }

    const panRes = validatePan(landlordPan);
    if (!panRes.isValid) { toast.error(panRes.error || 'Please enter a valid 10-character PAN'); return false; }

    if (gstin && gstin.trim()) {
      const gstinRes = validateGstin(gstin);
      if (!gstinRes.isValid) { toast.error(gstinRes.error || 'Please enter a valid 15-character GSTIN'); return false; }
    }

    if (!bankAccountName.trim()) { toast.error('Please enter Bank Account Holder Name'); return false; }
    if (!bankName.trim()) { toast.error('Please enter Bank Name'); return false; }
    if (!bankAccountNumber.trim() || bankAccountNumber.trim().length < 6) { toast.error('Please enter a valid Bank Account Number'); return false; }

    const ifscRes = validateIfsc(bankIfsc);
    if (!ifscRes.isValid) { toast.error(ifscRes.error || 'Please enter a valid 11-character IFSC Code'); return false; }

    return true;
  }

  async function handleDirectInviteLeadSubmit() {
    if (!ownerName.trim()) { toast.error('Please enter Owner / Admin Full Name'); return; }
    const emailRes = validateEmail(ownerEmail);
    if (!emailRes.isValid) { toast.error(emailRes.error || 'Please enter a valid email address'); return; }
    const mobileRes = validateMobile(ownerPhone);
    if (!mobileRes.isValid) { toast.error(mobileRes.error || 'Please enter a valid mobile number'); return; }
    if (!ownerPassword || ownerPassword.length < 6) { toast.error('Password must be at least 6 characters long'); return; }
    if (!orgName.trim()) { toast.error('Please enter Business / Organization Name'); return; }

    try {
      setIsProcessing(true);
      const res = await api.post('/auth/register', {
        orgName: orgName.trim(),
        ownerName: ownerName.trim(),
        email: ownerEmail.trim().toLowerCase(),
        mobile: ownerPhone.trim(),
        password: ownerPassword,
        inviteCode: inviteCode ? inviteCode.trim().toUpperCase() : undefined,
      });

      if (res.data?.status === 'LEAD_CAPTURED' || res.data?.status === 'WAITLISTED') {
        setResultStatus(res.data);
        toast.success(res.data.status === 'LEAD_CAPTURED' ? 'Invite-Only Application Received!' : 'Registration Placed on Waitlist!');
      } else if (res.data?.status === 'ACTIVE') {
        toast.success('Registration successful! Redirecting to sign in...');
        navigate('/login');
      } else {
        setResultStatus({
          status: 'LEAD_CAPTURED',
          leadCode: res.data?.leadCode || 'VIP-' + String(Date.now()).slice(-6),
          message: res.data?.message || 'Your application has been received by our onboarding team.'
        });
      }
    } catch (err: any) {
      toast.error(err?.message || err?.response?.data?.message || 'Failed to submit registration request.');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleNext() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) {
      if (onboardingPolicy?.onboardingMode === 'DISABLED' && !inviteCode.trim()) {
        handleDirectInviteLeadSubmit();
      } else {
        setStep(3);
      }
    }
    else if (step === 3) setStep(4);
  }

  async function handleCheckoutAndComplete() {
    try {
      setIsProcessing(true);

      const onboardingPayload = {
        ownerName, ownerEmail, ownerPhone, ownerPassword, orgName, orgSubdomain,
        propertyName, propertyCode, propertyType, address, city, state: stateName, pincode,
        manager: manager || ownerName, phone: ownerPhone, email: ownerEmail,
        landlordPan, pgLicenseNo, bankAccountName, bankName, bankAccountNumber, bankIfsc,
        upiVpa, authorizedSignatory: authorizedSignatory || ownerName, gstin,
        minimumLockInMonths, noticePeriodDays, defaultExitCleaningFee, defaultElectricityRatePerUnit,
        planId: selectedPlan, planName: currentPlanObj.name, planPrice: currentPrice,
        billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY', isTrial, seedSampleData,
        inviteCode: inviteCode ? inviteCode.trim().toUpperCase() : undefined,
      };

      // 1. Create Razorpay Subscription Order
      const orderRes = await api.post('/auth/create-subscription-order', onboardingPayload);
      const { orderId, keyId, amount } = orderRes.data;

      // Helper function to activate auto-login session upon successful payment verification
      const completeAutoLoginSession = (responseData: any) => {
        const { accessToken, token: fallbackToken, id, email, roles, orgId } = responseData;
        const jwtToken = accessToken || fallbackToken;

        let userRole: any = 'ADMIN';
        if (roles && Array.isArray(roles)) {
          if (roles.includes('ROLE_SUPER_ADMIN') || roles.includes('SUPER_ADMIN')) userRole = 'SUPER_ADMIN';
          else if (roles.includes('ROLE_OWNER') || roles.includes('OWNER') || roles.includes('ROLE_ADMIN') || roles.includes('ADMIN')) userRole = 'ADMIN';
          else if (roles.includes('ROLE_PROPERTY_MANAGER') || roles.includes('PROPERTY_MANAGER')) userRole = 'PROPERTY_MANAGER';
        }

        const userObj = {
          id: id || `usr_${Date.now()}`,
          name: ownerName || email?.split('@')[0] || 'Property Owner',
          email: email || ownerEmail,
          phone: ownerPhone || '+91 99999 99999',
          role: userRole,
          status: 'active' as const,
          propertyIds: [],
          lastActive: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          orgId: orgId,
        };

        setAuth(userObj, jwtToken);
        toast.success(`Payment & Property Registration Successful! Auto-logged into your Dashboard.`);
        navigate('/dashboard');
      };

      // If 14-Day Free Trial, Complete Directly without Payment Gateway
      if (isTrial) {
        toast.info('Activating 14-Day Free Trial...');
        const completeRes = await api.post('/auth/complete-onboarding', {
          ...onboardingPayload,
          razorpayOrderId: orderId,
          razorpayPaymentId: `pay_trial_${Date.now()}`,
        });

        completeAutoLoginSession(completeRes.data);
        return;
      }

      // Paid Subscription Plan: Trigger Razorpay Modal Checkout
      toast.info('Opening Razorpay Payment Checkout...');

      if (typeof window.Razorpay === 'undefined') {
        // Fallback SDK script loader if tag was not pre-rendered
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          document.body.appendChild(script);
        });
      }

      const options = {
        key: keyId && !keyId.includes('StayeazeMasterKey') ? keyId : 'rzp_test_1DP5mmOlF5G5ag',
        amount,
        currency: 'INR',
        name: 'StayEaze SaaS Platform',
        description: `${currentPlanObj.name} (${isAnnual ? 'Annual' : 'Monthly'})`,
        order_id: orderId.startsWith('sub_order_') ? undefined : orderId,
        prefill: { name: ownerName, email: ownerEmail, contact: ownerPhone },
        theme: { color: '#2563eb' },
        handler: async (response: any) => {
          try {
            const completeRes = await api.post('/auth/complete-onboarding', {
              ...onboardingPayload,
              razorpayOrderId: response.razorpay_order_id || orderId,
              razorpayPaymentId: response.razorpay_payment_id || (orderId.startsWith('sub_order_') ? `pay_sim_${Date.now()}` : undefined),
              razorpaySignature: response.razorpay_signature || (orderId.startsWith('sub_order_') ? 'sandbox_sig' : undefined),
            });

            completeAutoLoginSession(completeRes.data);
          } catch (err: any) {
            toast.error(err?.message || err?.response?.data?.message || 'Payment verification failed. Please register again.');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: { 
          ondismiss: () => {
            toast.error('Payment checkout cancelled. Please complete payment to register your property.');
            setIsProcessing(false);
          } 
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        toast.error(`Payment Failed: ${response.error?.description || 'Transaction cancelled'}`);
        setIsProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      const errorMsg = err?.message || err?.response?.data?.message || 'Failed to initialize subscription checkout';
      toast.error(errorMsg);
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 transition-colors">
      {/* Background Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/60 via-slate-50 to-slate-50 dark:from-blue-900/20 dark:via-slate-950 dark:to-slate-950 pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800/80 gap-2">
        <Link to="/login" className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">StayEaze</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 shrink-0">
          <span className="hidden sm:inline">Already registered?</span>
          <Link to="/login">
            <Button variant="outline" size="sm" className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm px-3">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Wizard Content */}
      <main className="relative z-10 max-w-4xl mx-auto w-full py-8 space-y-8">
        {resultStatus && (
          <Card className="bg-white dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl backdrop-blur-md overflow-hidden">
            <div className={`h-2 ${resultStatus.status === 'LEAD_CAPTURED' ? 'bg-purple-600' : 'bg-amber-500'}`} />
            <CardHeader className="text-center pb-2 pt-6">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                {resultStatus.status === 'LEAD_CAPTURED' ? (
                  <Sparkles className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Clock className="h-7 w-7 text-amber-500 dark:text-amber-400" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold">
                {resultStatus.status === 'LEAD_CAPTURED' ? 'Invite-Only Application Received!' : 'Registration Placed on Waitlist'}
              </CardTitle>
              <CardDescription className="text-sm max-w-md mx-auto mt-1">
                {resultStatus.message || (resultStatus.status === 'LEAD_CAPTURED' 
                  ? 'Thank you for your interest in StayEaze. Our onboarding team has received your details.' 
                  : 'Your organization has been queued for Super-Admin review.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md mx-auto pt-2 text-center">
              {resultStatus.leadCode && (
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3.5 space-y-1">
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Application Tracking Code</p>
                  <p className="text-xl font-mono font-bold tracking-widest text-slate-900 dark:text-white">{resultStatus.leadCode}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Save this code for faster support & early access invite redemption.</p>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-xs text-left text-slate-600 dark:text-slate-400 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-200">What happens next?</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Our Super-Admin operations team will review your property configuration.</li>
                  <li>You will receive an email confirmation at <span className="font-mono text-slate-900 dark:text-slate-200">{ownerEmail || 'your email'}</span> once approved.</li>
                  <li>Zero upfront payment was deducted.</li>
                </ul>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <Link to="/login" className="w-full sm:w-auto">
                  <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white">
                    Return to Sign In
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => { setResultStatus(null); setStep(1); }} className="w-full sm:w-auto">
                  Submit Another Property
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!resultStatus && (
          <>
            {/* Step Indicator Progress Bar */}
            <div className="space-y-4 text-center">
          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 text-xs">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Self-Serve Property Onboarding
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-white">
            Get Started with StayEaze
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-md mx-auto">
            Register your property, purchase a plan, and automate tenant billing, bed allocation & operations in minutes.
          </p>

          <div className="grid grid-cols-4 gap-2 pt-4 max-w-2xl mx-auto">
            {[
              { num: 1, label: 'Owner Credentials' },
              { num: 2, label: 'Property Master' },
              { num: 3, label: 'Subscription Plan' },
              { num: 4, label: 'Checkout & Launch' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center gap-1.5">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    step === s.num
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950'
                      : step > s.num
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                      : 'bg-slate-200 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border border-slate-300 dark:border-slate-800'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <span
                  className={`text-[11px] font-medium hidden sm:inline ${
                    step === s.num
                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                      : step > s.num
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ACTIVE RESUMED SESSION ALERT BANNER */}
        {resumedLead && (
          <div className="mb-6 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/90 dark:bg-indigo-950/50 p-4 text-xs flex items-start gap-3 shadow-xs">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-indigo-900 dark:text-indigo-200">
                  Resuming Onboarding for {resumedLead.propertyName}
                </span>
                <Badge variant="outline" className="text-[10px] border-indigo-400 text-indigo-700 dark:text-indigo-300">
                  24-Hour Active Recovery
                </Badge>
              </div>
              <p className="text-indigo-700 dark:text-indigo-300">
                Welcome back, <strong>{resumedLead.ownerName}</strong> ({resumedLead.ownerEmail}). Your property and contact details have been automatically restored. Proceed to checkout to finalize activation.
              </p>
            </div>
          </div>
        )}

        {/* STEP 1: OWNER & ACCOUNT CREDENTIALS */}
        {step === 1 && (
          <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl dark:shadow-2xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-500 dark:text-blue-400" /> Step 1: Owner & Account Credentials
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Enter your contact details and choose your organization's unique web address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dynamic Onboarding Policy Banners */}
              {onboardingPolicy?.onboardingMode === 'WAITLIST' && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800/80 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-amber-800 dark:text-amber-300">Waitlist Review Active</p>
                    <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                      New signups are placed in queue for Super-Admin approval. If you have an exclusive VIP passcode, enter it below to bypass the waitlist and activate immediately.
                    </p>
                  </div>
                </div>
              )}

              {onboardingPolicy?.onboardingMode === 'DISABLED' && (
                <div className="rounded-lg border border-purple-300 bg-purple-50 dark:border-purple-800/80 dark:bg-purple-950/40 p-3.5 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-3">
                  <Lock className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-purple-800 dark:text-purple-300">Private Beta / Invite-Only</p>
                    <p className="mt-0.5 text-purple-700 dark:text-purple-400">
                      Direct self-registration is currently invite-only. Enter your VIP Passcode to activate instantly, or submit your details to request an early access invite.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owner / Admin Full Name <span className="text-rose-500">*</span></Label>
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Rajesh Sharma" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Email Address <span className="text-rose-500">*</span></Label>
                  <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="rajesh@stayeaze.com" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mobile Number <span className="text-rose-500">*</span></Label>
                  <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="9876543210" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Create Password <span className="text-rose-500">*</span></Label>
                  <Input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Min 6 characters" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800 my-4" />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business / Organization Name <span className="text-rose-500">*</span></Label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Greenland PG Group" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Desired Subdomain <span className="text-rose-500">*</span></span>
                    {isSubdomainChecking && <span className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking...</span>}
                    {isSubdomainAvailable === true && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Available</span>}
                    {isSubdomainAvailable === false && <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">✗ Taken</span>}
                  </Label>
                  <div className="flex items-center">
                    <Input value={orgSubdomain} onChange={(e) => setOrgSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="greenland-pg" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 rounded-r-none" />
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-2 text-xs border border-l-0 border-slate-300 dark:border-slate-700 rounded-r-md font-mono">.stayeaze.com</span>
                  </div>
                </div>
              </div>

              {/* VIP Passcode Input Field */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Ticket className="h-4 w-4 text-purple-500" />
                  VIP Passcode / Invite Code (Optional)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. STAYVIP, EARLYBIRD"
                    className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 font-mono uppercase text-xs"
                  />
                  {inviteCode.trim() && (
                    <Badge variant="outline" className="border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs px-2.5 py-1 whitespace-nowrap">
                      Fast-Track Code
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Allows invited PG operators to bypass waitlist queues and activate their platform workspace instantly.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              {onboardingPolicy?.onboardingMode === 'DISABLED' && !inviteCode.trim() ? (
                <>
                  <Button 
                    type="button" 
                    onClick={handleDirectInviteLeadSubmit} 
                    disabled={isProcessing} 
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                  >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Submit Early Access Request (1-Click)
                  </Button>
                  <Button onClick={handleNext} variant="outline" className="w-full sm:w-auto border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    Enter Property Details <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button onClick={handleNext} className="ml-auto bg-blue-600 hover:bg-blue-500 text-white">
                  Next: Property Details <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {/* STEP 2: COMPULSORY PROPERTY & BANKING MASTER DETAILS */}
        {step === 2 && (
          <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl dark:shadow-2xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-500 dark:text-blue-400" /> Step 2: Compulsory Property & Banking Details
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                All property setup parameters required for invoice printing, tenant receipts, and banking clearance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Property Info */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Property Name <span className="text-rose-500">*</span></Label>
                  <Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="e.g. Greenland Luxury PG" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Property Code <span className="text-rose-500">*</span></Label>
                  <Input value={propertyCode} onChange={(e) => setPropertyCode(e.target.value.toUpperCase())} placeholder="e.g. GL-PG1" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PG">PG (Paying Guest)</SelectItem>
                      <SelectItem value="HOSTEL">Hostel</SelectItem>
                      <SelectItem value="CO_LIVING">Co-Living Space</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Property Address <span className="text-rose-500">*</span></Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Plot 123, Sector 44, Near Metro Station" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
              </div>

              <StateCityPincodeSelector
                state={stateName}
                city={city}
                pincode={pincode}
                onStateChange={setStateName}
                onCityChange={setCity}
                onPincodeChange={setPincode}
              />

              <hr className="border-slate-200 dark:border-slate-800 my-4" />

              {/* Regulatory & PAN */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Landlord / Business PAN <span className="text-rose-500">*</span></Label>
                  <Input value={landlordPan} onChange={(e) => setLandlordPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>PG License / Registration No</Label>
                  <Input value={pgLicenseNo} onChange={(e) => setPgLicenseNo(e.target.value)} placeholder="REG-2026-99" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Business GSTIN (Optional)</Label>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="07AAAAA0000A1Z5" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono" />
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800 my-4" />

              {/* Banking & UPI Master Details */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="h-4 w-4" /> Bank Account & UPI Details for Tenant Receipts
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Account Holder Name <span className="text-rose-500">*</span></Label>
                  <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Greenland PG Services" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Bank Name <span className="text-rose-500">*</span></Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800" />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Account Number <span className="text-rose-500">*</span></Label>
                  <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="50100234567890" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code <span className="text-rose-500">*</span></Label>
                  <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>UPI VPA ID (Optional)</Label>
                  <Input value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="greenland@hdfcbank" className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono" />
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800 my-4" />

              {/* Lease Terms & Move-Out Policies (P3.3) */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Property Tenancy, Deposit &amp; Billing Policies
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure default lock-in duration, notice period, security deposit, and checkout deductions for your resident agreements.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Minimum Lock-In Period (Months)</Label>
                  <Input
                    type="number"
                    value={minimumLockInMonths}
                    onChange={(e) => setMinimumLockInMonths(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="e.g. 3 (0 for monthly rolling)"
                    className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">0 = monthly rolling lease without early exit penalty</p>
                </div>
                <div className="space-y-2">
                  <Label>Required Notice Period (Days)</Label>
                  <Input
                    type="number"
                    value={noticePeriodDays}
                    onChange={(e) => setNoticePeriodDays(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="e.g. 30"
                    className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">Standard notice required from residents before move-out</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Exit Deep Cleaning Fee (₹)</Label>
                  <Input
                    type="number"
                    value={defaultExitCleaningFee}
                    onChange={(e) => setDefaultExitCleaningFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="e.g. 500"
                    className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">Auto-applied deep cleaning deduction on move-out</p>
                </div>
                <div className="space-y-2">
                  <Label>Default Electricity Tariff (₹/Unit)</Label>
                  <Input
                    type="number"
                    value={defaultElectricityRatePerUnit}
                    onChange={(e) => setDefaultElectricityRatePerUnit(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="e.g. 12.0"
                    className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 font-mono"
                  />
                  <p className="text-[11px] text-slate-500">Rate per sub-meter unit for utility auto-splits</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Credentials
              </Button>
              {onboardingPolicy?.onboardingMode === 'DISABLED' && !inviteCode.trim() ? (
                <Button onClick={handleNext} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20">
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Submit Invite-Only Application <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white">
                  Next: Select SaaS Plan <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {/* STEP 3: SAAS SUBSCRIPTION PLAN SELECTION */}
        {step === 3 && (
          <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl dark:shadow-2xl backdrop-blur-md">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-amber-500 dark:text-amber-400" /> Step 3: Choose Your StayEaze Plan
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Select a live verified subscription plan or activate a 14-day free trial with zero risk.
              </CardDescription>

              {/* Billing Toggle & Trial Switch */}
              <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
                <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs">
                  <span className={`px-3 py-1 rounded-full cursor-pointer font-medium ${!isAnnual ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'}`} onClick={() => setIsAnnual(false)}>
                    Monthly Billing
                  </span>
                  <span className={`px-3 py-1 rounded-full cursor-pointer font-medium flex items-center gap-1 ${isAnnual ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'}`} onClick={() => setIsAnnual(true)}>
                    Annual Billing <Badge className="bg-amber-500 text-slate-950 text-[10px] px-1 py-0 font-bold">20% OFF</Badge>
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs">
                  <Switch checked={isTrial} onCheckedChange={setIsTrial} id="trial-mode" />
                  <Label htmlFor="trial-mode" className="cursor-pointer font-medium text-amber-600 dark:text-amber-300">
                    Activate 14-Day Free Trial (₹2 Card / Auto-Pay Verification Charge)
                  </Label>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-4">
              {/* Plan Cards Grid */}
              <div className="grid lg:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id as any)}
                    className={`relative rounded-xl p-5 border cursor-pointer transition-all flex flex-col justify-between ${
                      selectedPlan === p.id
                        ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500'
                        : 'bg-slate-50/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {p.popular && (
                      <Badge className="absolute -top-2.5 right-4 bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider">
                        Most Popular
                      </Badge>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">{p.badge}</span>
                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${selectedPlan === p.id ? 'border-blue-400 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                          {selectedPlan === p.id && <Check className="h-3 w-3" />}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{p.name}</h3>
                      {p.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 min-h-[32px] line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      )}

                      <div className="mb-4">
                        {isTrial ? (
                          <div>
                            <span className="text-2xl font-black text-amber-500 dark:text-amber-400">₹2</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400"> (14-Day Trial • ₹2 Card Auth Charge)</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(isAnnual ? p.annualPrice : p.monthlyPrice)}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400"> / month</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">{p.bedsLimit}</div>
                        <div className="text-slate-500 dark:text-slate-400">{p.propertiesLimit}</div>
                      </div>

                      <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {/* Transparent SaaS Platform Policies Banner */}
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-blue-500" /> Transparent Subscription &amp; Operating Policies
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                    <strong className="text-slate-900 dark:text-slate-200 block">⚡ Instant Prorated Upgrades</strong>
                    <span>Upgrades activate immediately with credit for unused days from your current billing cycle.</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                    <strong className="text-slate-900 dark:text-slate-200 block">🔒 90-Day Downgrade Policy</strong>
                    <span>Downgrades are locked to once per 90 days to prevent quota abuse and preserve ledger history.</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                    <strong className="text-slate-900 dark:text-slate-200 block">🧾 100% GST Tax Invoices</strong>
                    <span>Official B2B tax receipts with GSTIN &amp; HRA compliance are automatically emailed on every billing run.</span>
                  </div>
                </div>
              </div>

              {/* Sample Data Seeding Toggle */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Pre-fill Sample Demo Data for Instant Testing
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Automatically seeds 1 sample Building ("Tower A"), 2 Floors, 4 Rooms, and 8 Beds so you can explore immediately.
                  </div>
                </div>
                <Switch checked={seedSampleData} onCheckedChange={setSeedSampleData} />
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Property Info
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white">
                Proceed to Checkout <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 4: ORDER REVIEW & CHECKOUT */}
        {step === 4 && (
          <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl dark:shadow-2xl backdrop-blur-md max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-500 dark:text-blue-400" /> Step 4: Subscription Order Summary &amp; Checkout
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Review your registered details and complete checkout to activate your back-office.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Order Summary Box */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">{currentPlanObj.name}</h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {isTrial
                        ? '14-Day Free Trial (₹2 Refundable Card Auth for Auto-Pay Mandate)'
                        : `${isAnnual ? 'Annual Billing (20% Discount Applied)' : 'Monthly Billing'}`}
                    </span>
                  </div>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold">
                    {isTrial ? '₹2 Card Auth' : formatCurrency(currentPrice)}
                  </Badge>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
                  <div><span className="text-slate-500">Owner Name:</span> <strong className="text-slate-900 dark:text-slate-200">{ownerName}</strong></div>
                  <div><span className="text-slate-500">Email:</span> <strong className="text-slate-900 dark:text-slate-200">{ownerEmail}</strong></div>
                  <div><span className="text-slate-500">Subdomain:</span> <strong className="text-blue-600 dark:text-blue-400 font-mono">{orgSubdomain}.stayeaze.com</strong></div>
                  <div><span className="text-slate-500">Property:</span> <strong className="text-slate-900 dark:text-slate-200">{propertyName} ({propertyCode})</strong></div>
                  <div><span className="text-slate-500">PAN / GSTIN:</span> <strong className="text-slate-900 dark:text-slate-200 font-mono">{landlordPan} {gstin ? `| ${gstin}` : ''}</strong></div>
                  <div><span className="text-slate-500">Tenancy Policies:</span> <strong className="text-slate-900 dark:text-slate-200">{minimumLockInMonths}m Lock-in • {noticePeriodDays}d Notice</strong></div>
                  <div><span className="text-slate-500">Cleaning &amp; Tariff:</span> <strong className="text-slate-900 dark:text-slate-200">₹{defaultExitCleaningFee} Exit • ₹{defaultElectricityRatePerUnit}/unit Power</strong></div>
                  <div><span className="text-slate-500">Bank Account:</span> <strong className="text-slate-900 dark:text-slate-200">{bankName} ({bankAccountNumber.slice(-4)})</strong></div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Payable Now:</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(currentPrice)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                <span>256-bit Encrypted SSL Gateway • 99.9% Uptime Guarantee • Instant Provisioning</span>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setStep(3)} disabled={isProcessing} className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Plans
              </Button>
              <Button
                onClick={handleCheckoutAndComplete}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 shadow-lg shadow-emerald-500/20"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying &amp; Activating...
                  </>
                ) : isTrial ? (
                  <>
                    Verify Card (₹2) &amp; Start 14-Day Trial <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Pay {formatCurrency(currentPrice)} &amp; Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </>
    )}
  </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full text-center py-4 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500">
        © 2026 StayEaze SaaS Platform. All rights reserved. Self-Serve Property Onboarding & Subscription Portal.
      </footer>
    </div>
  );
}
