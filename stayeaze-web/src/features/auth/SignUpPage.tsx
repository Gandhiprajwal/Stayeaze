import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, 
  Sparkles, CreditCard, Lock, Check, HelpCircle, Loader2, Landmark, 
  UserCheck, AlertCircle, Phone, Mail, MapPin, Hash, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/format';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Owner Credentials
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgSubdomain, setOrgSubdomain] = useState('');
  const [isSubdomainChecking, setIsSubdomainChecking] = useState(false);
  const [isSubdomainAvailable, setIsSubdomainAvailable] = useState<boolean | null>(null);

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

  const plans = [
    {
      id: 'starter',
      name: 'Starter PG Plan',
      monthlyPrice: 1499,
      annualPrice: 1199,
      bedsLimit: 'Up to 30 Beds',
      propertiesLimit: '1 Property',
      features: ['Building & Room Hierarchy', 'Tenant Rent Invoicing', 'WhatsApp Receipt Notices', 'Standard Reports & Analytics'],
      badge: 'Small PGs',
    },
    {
      id: 'pro',
      name: 'Professional Hostel Plan',
      monthlyPrice: 2999,
      annualPrice: 2399,
      bedsLimit: 'Up to 100 Beds',
      propertiesLimit: 'Up to 3 Properties',
      features: ['All Starter Features', 'Per-Property Razorpay Gateway', 'Staff Roles & Audit Logs', 'Complaints & Maintenance Hub', 'Custom Branding & GST Receipts'],
      badge: 'Most Popular',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise Co-Living Plan',
      monthlyPrice: 5999,
      annualPrice: 4799,
      bedsLimit: 'Unlimited Beds',
      propertiesLimit: 'Unlimited Properties',
      features: ['All Pro Features', 'Dedicated Support Manager', 'Custom SMS/WhatsApp Gateway', 'Multi-Branch Financial Audits', 'Super Admin Priority Queue'],
      badge: 'Large Operations',
    },
  ];

  const currentPlanObj = plans.find((p) => p.id === selectedPlan)!;
  const currentPrice = isTrial ? 0 : (isAnnual ? currentPlanObj.annualPrice * 12 : currentPlanObj.monthlyPrice);

  function validateStep1(): boolean {
    if (!ownerName.trim()) { toast.error('Please enter Owner / Admin Full Name'); return false; }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) { toast.error('Please enter a valid Email Address'); return false; }
    if (!ownerPhone.trim() || ownerPhone.length < 10) { toast.error('Please enter a valid 10-digit Mobile Number'); return false; }
    if (!ownerPassword || ownerPassword.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
    if (!orgName.trim()) { toast.error('Please enter Business / Organization Name'); return false; }
    if (!orgSubdomain.trim()) { toast.error('Please choose a Subdomain'); return false; }
    if (isSubdomainAvailable === false) { toast.error('Subdomain is already taken. Please choose a different subdomain.'); return false; }
    return true;
  }

  function validateStep2(): boolean {
    if (!propertyName.trim()) { toast.error('Please enter Property Name'); return false; }
    if (!propertyCode.trim()) { toast.error('Please enter Property Code (e.g. SE-PG1)'); return false; }
    if (!address.trim()) { toast.error('Please enter Full Address'); return false; }
    if (!city.trim()) { toast.error('Please enter City'); return false; }
    if (!stateName.trim()) { toast.error('Please enter State'); return false; }
    if (!pincode.trim()) { toast.error('Please enter Pincode'); return false; }
    if (!landlordPan.trim()) { toast.error('Please enter Landlord PAN'); return false; }
    if (!bankAccountName.trim()) { toast.error('Please enter Bank Account Holder Name'); return false; }
    if (!bankName.trim()) { toast.error('Please enter Bank Name'); return false; }
    if (!bankAccountNumber.trim()) { toast.error('Please enter Bank Account Number'); return false; }
    if (!bankIfsc.trim()) { toast.error('Please enter Bank IFSC Code'); return false; }
    return true;
  }

  function handleNext() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
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
        planId: selectedPlan, planName: currentPlanObj.name, planPrice: currentPrice,
        billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY', isTrial, seedSampleData,
      };

      // 1. Create Razorpay Subscription Order
      const orderRes = await api.post('/auth/create-subscription-order', onboardingPayload);
      const { orderId, keyId, amount } = orderRes.data;

      // If 14-Day Free Trial or Sandbox Test Key, Complete Directly
      if (isTrial || keyId.includes('StayeazeMasterKey') || !window.Razorpay) {
        toast.info(isTrial ? 'Activating 14-Day Free Trial...' : 'Processing SaaS subscription checkout...');
        const completeRes = await api.post('/auth/complete-onboarding', {
          ...onboardingPayload,
          razorpayOrderId: orderId,
          razorpayPaymentId: `pay_sub_${Date.now()}`,
        });

        const { accessToken, id, email, roles, orgId } = completeRes.data;
        setAuth({ id, email, role: roles[0] || 'OWNER', orgId }, accessToken);
        toast.success(`Welcome to StayEaze! Your account and property '${propertyName}' are activated!`);
        navigate('/dashboard');
        return;
      }

      // Live Razorpay Gateway Modal Checkout
      const options = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'StayEaze SaaS Platform',
        description: `${currentPlanObj.name} (${isAnnual ? 'Annual' : 'Monthly'})`,
        order_id: orderId,
        prefill: { name: ownerName, email: ownerEmail, contact: ownerPhone },
        theme: { color: '#2563eb' },
        handler: async (response: any) => {
          try {
            const completeRes = await api.post('/auth/complete-onboarding', {
              ...onboardingPayload,
              razorpayOrderId: response.razorpay_order_id || orderId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            const { accessToken, id, email, roles, orgId } = completeRes.data;
            setAuth({ id, email, role: roles[0] || 'OWNER', orgId }, accessToken);
            toast.success(`Subscription Payment Verified! Welcome to StayEaze!`);
            navigate('/dashboard');
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to complete registration');
          } finally {
            setIsProcessing(false);
          }
        },
        modal: { ondismiss: () => setIsProcessing(false) },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initialize subscription checkout');
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Background Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 max-w-7xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800/80">
        <Link to="/login" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">StayEaze</span>
        </Link>

        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>Already registered?</span>
          <Link to="/login">
            <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800 text-slate-200">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Wizard Content */}
      <main className="relative z-10 max-w-4xl mx-auto w-full py-8 space-y-8">
        {/* Step Indicator Progress Bar */}
        <div className="space-y-4 text-center">
          <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 px-3 py-1 text-xs">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Self-Serve Property Onboarding
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Get Started with StayEaze
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
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
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-950'
                      : step > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {step > s.num ? <Check className="h-5 w-5" /> : s.num}
                </div>
                <span className={`text-xs font-medium ${step >= s.num ? 'text-slate-200' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* STEP 1: OWNER & ACCOUNT CREDENTIALS */}
        {step === 1 && (
          <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-400" /> Step 1: Owner & Account Credentials
              </CardTitle>
              <CardDescription className="text-slate-400">
                Enter your contact details and choose your organization's unique web address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Owner / Admin Full Name <span className="text-rose-400">*</span></Label>
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Rajesh Sharma" className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Email Address <span className="text-rose-400">*</span></Label>
                  <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="rajesh@stayeaze.com" className="bg-slate-950 border-slate-800" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mobile Number <span className="text-rose-400">*</span></Label>
                  <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="9876543210" className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Create Password <span className="text-rose-400">*</span></Label>
                  <Input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Min 6 characters" className="bg-slate-950 border-slate-800" />
                </div>
              </div>

              <hr className="border-slate-800 my-4" />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business / Organization Name <span className="text-rose-400">*</span></Label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Greenland PG Group" className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Desired Subdomain <span className="text-rose-400">*</span></span>
                    {isSubdomainChecking && <span className="text-xs text-blue-400 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking...</span>}
                    {isSubdomainAvailable === true && <span className="text-xs text-emerald-400 font-medium">✓ Available</span>}
                    {isSubdomainAvailable === false && <span className="text-xs text-rose-400 font-medium">✗ Taken</span>}
                  </Label>
                  <div className="flex items-center">
                    <Input value={orgSubdomain} onChange={(e) => setOrgSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="greenland-pg" className="bg-slate-950 border-slate-800 rounded-r-none" />
                    <span className="bg-slate-800 text-slate-400 px-3 py-2 text-xs border border-l-0 border-slate-700 rounded-r-md font-mono">.stayeaze.com</span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-slate-800 pt-4">
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white">
                Next: Property Details <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 2: COMPULSORY PROPERTY & BANKING MASTER DETAILS */}
        {step === 2 && (
          <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" /> Step 2: Compulsory Property & Banking Details
              </CardTitle>
              <CardDescription className="text-slate-400">
                All property setup parameters required for invoice printing, tenant receipts, and banking clearance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Basic Property Info */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Property Name <span className="text-rose-400">*</span></Label>
                  <Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="e.g. Greenland Luxury PG" className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Property Code <span className="text-rose-400">*</span></Label>
                  <Input value={propertyCode} onChange={(e) => setPropertyCode(e.target.value.toUpperCase())} placeholder="e.g. GL-PG1" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-md p-2 text-sm text-slate-200">
                    <option value="PG">PG (Paying Guest)</option>
                    <option value="HOSTEL">Hostel</option>
                    <option value="CO_LIVING">Co-Living Space</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Property Address <span className="text-rose-400">*</span></Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Plot 123, Sector 44, Near Metro Station" className="bg-slate-950 border-slate-800" />
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City <span className="text-rose-400">*</span></Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Gurugram" className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>State <span className="text-rose-400">*</span></Label>
                  <Input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="Haryana" className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Pincode <span className="text-rose-400">*</span></Label>
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="122003" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
              </div>

              <hr className="border-slate-800 my-4" />

              {/* Regulatory & PAN */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Landlord / Business PAN <span className="text-rose-400">*</span></Label>
                  <Input value={landlordPan} onChange={(e) => setLandlordPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>PG License / Registration No</Label>
                  <Input value={pgLicenseNo} onChange={(e) => setPgLicenseNo(e.target.value)} placeholder="REG-2026-99" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Business GSTIN (Optional)</Label>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="07AAAAA0000A1Z5" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
              </div>

              <hr className="border-slate-800 my-4" />

              {/* Banking & UPI Master Details */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="h-4 w-4" /> Bank Account & UPI Details for Tenant Receipts
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bank Account Holder Name <span className="text-rose-400">*</span></Label>
                  <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Greenland PG Services" className="bg-slate-950 border-slate-800" />
                </div>
                <div className="space-y-2">
                  <Label>Bank Name <span className="text-rose-400">*</span></Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" className="bg-slate-950 border-slate-800" />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Account Number <span className="text-rose-400">*</span></Label>
                  <Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="50100234567890" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code <span className="text-rose-400">*</span></Label>
                  <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>UPI VPA ID (Optional)</Label>
                  <Input value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="greenland@hdfcbank" className="bg-slate-950 border-slate-800 font-mono" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setStep(1)} className="border-slate-700 hover:bg-slate-800 text-slate-300">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Credentials
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white">
                Next: Select SaaS Plan <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* STEP 3: SAAS SUBSCRIPTION PLAN SELECTION */}
        {step === 3 && (
          <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl backdrop-blur-md">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                <Sparkles className="h-6 w-6 text-amber-400" /> Step 3: Choose Your StayEaze Plan
              </CardTitle>
              <CardDescription className="text-slate-400">
                Select a subscription plan or activate a 14-day free trial with zero risk.
              </CardDescription>

              {/* Billing Toggle & Trial Switch */}
              <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
                <div className="flex items-center gap-3 bg-slate-950 p-1.5 rounded-full border border-slate-800 text-xs">
                  <span className={`px-3 py-1 rounded-full cursor-pointer font-medium ${!isAnnual ? 'bg-blue-600 text-white' : 'text-slate-400'}`} onClick={() => setIsAnnual(false)}>
                    Monthly Billing
                  </span>
                  <span className={`px-3 py-1 rounded-full cursor-pointer font-medium flex items-center gap-1 ${isAnnual ? 'bg-blue-600 text-white' : 'text-slate-400'}`} onClick={() => setIsAnnual(true)}>
                    Annual Billing <Badge className="bg-amber-500 text-slate-950 text-[10px] px-1 py-0 font-bold">20% OFF</Badge>
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
                  <Switch checked={isTrial} onCheckedChange={setIsTrial} id="trial-mode" />
                  <Label htmlFor="trial-mode" className="cursor-pointer font-medium text-amber-300">
                    Activate 14-Day Free Trial (No Card Needed)
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
                        ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {p.popular && (
                      <Badge className="absolute -top-2.5 right-4 bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider">
                        Most Popular
                      </Badge>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">{p.badge}</span>
                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${selectedPlan === p.id ? 'border-blue-400 bg-blue-600 text-white' : 'border-slate-700'}`}>
                          {selectedPlan === p.id && <Check className="h-3 w-3" />}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>

                      <div className="mb-4">
                        {isTrial ? (
                          <span className="text-2xl font-black text-amber-400">FREE</span>
                        ) : (
                          <div>
                            <span className="text-3xl font-black text-white">{formatCurrency(isAnnual ? p.annualPrice : p.monthlyPrice)}</span>
                            <span className="text-xs text-slate-400"> / month</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 mb-4 pb-4 border-b border-slate-800">
                        <div className="font-semibold text-blue-400">{p.bedsLimit}</div>
                        <div className="text-slate-400">{p.propertiesLimit}</div>
                      </div>

                      <ul className="space-y-2 text-xs text-slate-300">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sample Data Seeding Toggle */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-400" /> Pre-fill Sample Demo Data for Instant Testing
                  </div>
                  <div className="text-xs text-slate-400">
                    Automatically seeds 1 sample Building ("Tower A"), 2 Floors, 4 Rooms, and 8 Beds so you can explore immediately.
                  </div>
                </div>
                <Switch checked={seedSampleData} onCheckedChange={setSeedSampleData} />
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setStep(2)} className="border-slate-700 hover:bg-slate-800 text-slate-300">
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
          <Card className="bg-slate-900/90 border-slate-800 text-slate-100 shadow-2xl backdrop-blur-md max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold flex items-center justify-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-400" /> Step 4: Subscription Order Summary & Checkout
              </CardTitle>
              <CardDescription className="text-slate-400">
                Review your registered details and complete checkout to activate your back-office.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Order Summary Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="font-bold text-white text-base">{currentPlanObj.name}</h4>
                    <span className="text-xs text-slate-400">{isTrial ? '14-Day Free Trial' : `${isAnnual ? 'Annual Billing' : 'Monthly Billing'}`}</span>
                  </div>
                  <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                    {isTrial ? 'Free Trial' : formatCurrency(currentPrice)}
                  </Badge>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-300">
                  <div><span className="text-slate-500">Owner Name:</span> <strong className="text-slate-200">{ownerName}</strong></div>
                  <div><span className="text-slate-500">Email:</span> <strong className="text-slate-200">{ownerEmail}</strong></div>
                  <div><span className="text-slate-500">Subdomain:</span> <strong className="text-blue-400 font-mono">{orgSubdomain}.stayeaze.com</strong></div>
                  <div><span className="text-slate-500">Property:</span> <strong className="text-slate-200">{propertyName} ({propertyCode})</strong></div>
                  <div><span className="text-slate-500">City / State:</span> <strong className="text-slate-200">{city}, {stateName}</strong></div>
                  <div><span className="text-slate-500">Bank Account:</span> <strong className="text-slate-200">{bankName} ({bankAccountNumber.slice(-4)})</strong></div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-300">Total Payable Now:</span>
                  <span className="text-2xl font-black text-emerald-400">{formatCurrency(currentPrice)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>256-bit Encrypted SSL Gateway & Instant Access Guarantee</span>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
              <Button variant="outline" onClick={() => setStep(3)} disabled={isProcessing} className="border-slate-700 hover:bg-slate-800 text-slate-300">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Plans
              </Button>
              <Button
                onClick={handleCheckoutAndComplete}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 shadow-lg shadow-emerald-500/20"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying & Activating...
                  </>
                ) : isTrial ? (
                  <>
                    Activate 14-Day Trial & Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    Pay {formatCurrency(currentPrice)} & Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full text-center py-4 border-t border-slate-800/80 text-xs text-slate-500">
        © 2026 StayEaze SaaS Platform. All rights reserved. Self-Serve Property Onboarding & Subscription Portal.
      </footer>
    </div>
  );
}
