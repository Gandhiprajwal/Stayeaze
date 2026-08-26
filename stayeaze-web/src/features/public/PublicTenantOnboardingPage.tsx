import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Hotel, CheckCircle2, ShieldCheck, CreditCard, Sparkles, Building2,
  ArrowRight, Smartphone, Sun, Moon, Lock, Wallet, AlertCircle, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUIStore } from '@/lib/stores/ui-store';
import { formatCurrency } from '@/lib/format';
import { RoomSelect } from '@/components/common/RoomSelect';
import { toast } from 'sonner';
import axios from 'axios';

const PUBLIC_API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1') + '/public/tenants';

export default function PublicTenantOnboardingPage() {
  const [searchParams] = useSearchParams();
  const propertyIdFromUrl = searchParams.get('p') || searchParams.get('propertyId') || '';

  const { theme, toggleTheme } = useUIStore();

  const [loading, setLoading] = useState(false);
  const [propertyLoading, setPropertyLoading] = useState(!!propertyIdFromUrl);
  const [propertyName, setPropertyName] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [selectedPropId, setSelectedPropId] = useState(propertyIdFromUrl);
  const [rooms, setRooms] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    gender: 'MALE',
    occupation: 'STUDENT',
    roomNumber: '',
    bedNumber: '',
    rent: 0,
    deposit: 0,
    paymentMethod: 'RAZORPAY', // RAZORPAY or CASH (Desk)
  });

  const [onboardSuccess, setOnboardSuccess] = useState<any>(null);

  // Load Razorpay checkout.js dynamically if not already present
  useEffect(() => {
    if (!document.getElementById('razorpay-checkout-script')) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Fetch single property by ID from URL (secure — no listing of all properties)
  useEffect(() => {
    if (!propertyIdFromUrl) {
      setPropertyLoading(false);
      return;
    }
    setPropertyLoading(true);
    axios.get(`${PUBLIC_API_BASE}/properties/${propertyIdFromUrl}`)
      .then((r) => {
        setPropertyName(r.data.name || '');
        setPropertyCity(r.data.city || '');
        setSelectedPropId(r.data.id || propertyIdFromUrl);
        if (r.data.securityDeposit !== undefined && r.data.securityDeposit !== null) {
          setFormData((prev) => ({ ...prev, deposit: Number(r.data.securityDeposit) }));
        }
      })
      .catch(() => {
        toast.error('Invalid property link. Please contact reception.');
      })
      .finally(() => setPropertyLoading(false));
  }, [propertyIdFromUrl]);

  useEffect(() => {
    if (!selectedPropId) return;
    axios.get(`${PUBLIC_API_BASE}/rooms`, { params: { propertyId: selectedPropId } })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data as any).data || [];
        setRooms(list);
        if (list.length > 0 && !formData.roomNumber) {
          const firstVacantRoom = list.find((rm: any) => !rm.isFull) || list[0];
          setFormData((prev) => ({
            ...prev,
            roomNumber: firstVacantRoom.roomNumber,
            rent: Number(firstVacantRoom.baseRent || 0),
          }));
        }
      })
      .catch(() => {});
  }, [selectedPropId]);

  useEffect(() => {
    if (!formData.roomNumber) return;
    const selectedRoom = rooms.find((r) => r.roomNumber === formData.roomNumber);
    if (selectedRoom) {
      if (selectedRoom.baseRent !== undefined && selectedRoom.baseRent !== null) {
        setFormData((prev) => ({ ...prev, rent: Number(selectedRoom.baseRent) }));
      }
      axios.get(`${PUBLIC_API_BASE}/beds`, { params: { roomId: selectedRoom.id } })
        .then((r) => {
          const list = Array.isArray(r.data) ? r.data : (r.data as any).data || [];
          setBeds(list);
          const firstVacantBed = list.find((b: any) => !b.isOccupied);
          if (firstVacantBed) {
            setFormData((prev) => ({ ...prev, bedNumber: firstVacantBed.bedNumber }));
          } else {
            setFormData((prev) => ({ ...prev, bedNumber: '' }));
          }
        })
        .catch(() => {});
    }
  }, [formData.roomNumber, rooms]);

  const totalInitialAmount = Number(formData.rent || 0) + Number(formData.deposit || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.firstName || !formData.email || !formData.mobile) {
      toast.error('Please complete all required personal details');
      return;
    }
    if (!selectedPropId) {
      toast.error('Invalid onboarding link — property not specified.');
      return;
    }

    setLoading(true);

    // Option A: Pay Online via Razorpay
    if (formData.paymentMethod === 'RAZORPAY') {
      try {
        toast.info('Initializing Razorpay secure payment gateway...');
        const orderRes = await axios.post(`${PUBLIC_API_BASE}/create-order`, {
          propertyId: selectedPropId,
          rent: formData.rent,
          deposit: formData.deposit,
          tenantName: `${formData.firstName} ${formData.lastName}`,
          tenantEmail: formData.email,
          tenantPhone: formData.mobile,
        });

        const orderData = orderRes.data;

        // Check if Razorpay SDK loaded
        if (!(window as any).Razorpay) {
          throw new Error('Razorpay SDK is loading. Please try again in a moment.');
        }

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: orderData.businessName || orderData.propertyName || propertyName || 'StayEaze Residency',
          description: `Initial Onboarding Payment (Rent + Deposit)`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            try {
              const payload = {
                ...formData,
                propertyId: selectedPropId,
                status: 'READY_FOR_CHECKIN',
                paymentMethod: 'RAZORPAY',
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              };

              const res = await axios.post(`${PUBLIC_API_BASE}/onboard`, payload);
              setOnboardSuccess({ ...res.data, paidOnline: true });
              toast.success('🎉 Payment Successful! Account provisioned.');
            } catch (onbErr: any) {
              toast.error(onbErr.response?.data?.message || 'Failed to complete registration');
            } finally {
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
              toast.info('Payment cancelled. You can retry or choose Pay at Desk.');
            },
          },
          prefill: {
            name: `${formData.firstName} ${formData.lastName}`,
            email: formData.email,
            contact: formData.mobile,
          },
          theme: { color: '#4f46e5' },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (err: any) {
        setLoading(false);
        toast.error(err.response?.data?.message || err.message || 'Failed to initialize payment gateway.');
      }
      return;
    }

    // Option B: Pay at Desk / Cash (Requires Staff Approval)
    try {
      const payload = {
        ...formData,
        propertyId: selectedPropId,
        paymentMethod: 'CASH',
        status: 'PENDING_CHECKIN',
      };

      const res = await axios.post(`${PUBLIC_API_BASE}/onboard`, payload);
      setOnboardSuccess({ ...res.data, paidOnline: false });
      toast.success('🎉 Registration Submitted! Please hand over payment at reception desk.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to complete tenant onboarding');
    } finally {
      setLoading(false);
    }
  }

  // Invalid link — no property ID in URL
  if (!propertyIdFromUrl) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 transition-colors duration-300">
        <Card className="max-w-md w-full border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl text-center space-y-4 p-6 sm:p-8 rounded-2xl shadow-xl dark:shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Invalid Onboarding Link</h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This onboarding link is missing a valid property identifier. Please scan the QR code provided at your property's reception desk.
          </p>
        </Card>
      </div>
    );
  }

  if (onboardSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 transition-colors duration-300">
        <Card className="max-w-md w-full border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-xl text-center space-y-5 p-6 sm:p-8 rounded-2xl shadow-xl dark:shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-9 w-9 animate-bounce" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">Welcome to {propertyName || 'StayEaze'}!</h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {onboardSuccess.paidOnline
                ? 'Your initial payment has been received and your resident profile is active.'
                : 'Your registration is submitted. Please pay your initial dues at reception to activate room access.'}
            </p>
          </div>

          {/* Payment Summary Box */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-left text-xs space-y-2">
            <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400">
              <span>1st Month Advance Rent:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono">{formatCurrency(Number(formData.rent || 0))}</span>
            </div>
            <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400">
              <span>Refundable Security Deposit:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-200 font-mono">{formatCurrency(Number(formData.deposit || 0))}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-slate-900 dark:text-white">
              <span>{onboardSuccess.paidOnline ? 'Total Paid (Online):' : 'Total Due at Desk:'}</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm sm:text-base">{formatCurrency(totalInitialAmount)}</span>
            </div>
          </div>

          {!onboardSuccess.paidOnline && (
            <div className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30 text-left text-xs space-y-1">
              <div className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" /> Desk Payment Approval Pending
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Please hand over <strong>{formatCurrency(totalInitialAmount)}</strong> (Cash/UPI) to the receptionist or property manager. They will verify and approve your payment in the system.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/40 p-4 text-left space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>Your Login Credentials</span>
            </div>
            <div className="text-xs sm:text-sm font-mono space-y-1.5 text-slate-800 dark:text-slate-200">
              <div>Email: <strong className="text-indigo-600 dark:text-cyan-400 font-bold">{onboardSuccess.email || formData.email}</strong></div>
              <div>
                Temp Password:{' '}
                {onboardSuccess.tempPassword ? (
                  <strong className="text-indigo-600 dark:text-cyan-400 font-bold bg-indigo-100/60 dark:bg-indigo-900/40 px-2 py-0.5 rounded">{onboardSuccess.tempPassword}</strong>
                ) : (
                  <span className="text-xs font-sans text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                    ✓ Dispatched securely via Email & SMS
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              * A copy of your credentials has been sent via Email & SMS. You will be prompted to set your personal password upon first login.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button asChild className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md text-xs sm:text-sm">
              <Link to="/login">
                Proceed to Tenant Login <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 py-8 sm:py-12 transition-colors duration-300">
      {/* Theme Toggle Button */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon className="h-4 w-4 text-slate-700" /> : <Sun className="h-4 w-4 text-amber-400" />}
        </Button>
      </div>

      <div className="max-w-xl w-full space-y-5 sm:space-y-6">
        <div className="text-center space-y-2 px-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
            <Hotel className="h-3.5 w-3.5" />
            <span>Digital Express Check-In & Onboarding</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Resident Registration & Payment</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Complete your profile and pay initial deposit + rent to activate your stay</p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl dark:shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b">
            <CardTitle className="text-base sm:text-lg text-slate-900 dark:text-white">Personal & Accommodation Details</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">Step 1 of 2: Fill personal information</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Property — locked read-only from QR */}
              <div className="space-y-1.5">
                <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Allocated Property
                  <Lock className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                </Label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm cursor-not-allowed select-none">
                  <Building2 className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                  {propertyLoading ? (
                    <span className="text-slate-400 dark:text-slate-500 animate-pulse">Loading property...</span>
                  ) : (
                    <span className="truncate">{propertyName}{propertyCity ? ` — ${propertyCity}` : ''}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">First Name *</Label>
                  <Input
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="h-10 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">Last Name *</Label>
                  <Input
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="h-10 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">Email Address *</Label>
                  <Input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-10 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200"
                    placeholder="tenant@gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">Mobile Number *</Label>
                  <Input
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="h-10 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 dark:text-slate-300 font-medium text-xs">Room &amp; Bed Selection</Label>
                <RoomSelect
                  rooms={rooms}
                  beds={beds}
                  selectedRoomNumber={formData.roomNumber}
                  selectedBedNumber={formData.bedNumber}
                  onSelectRoom={(rNum, rId, rentVal) => {
                    setFormData((prev) => ({
                      ...prev,
                      roomNumber: rNum,
                      rent: rentVal && rentVal > 0 ? rentVal : prev.rent,
                      bedNumber: '',
                    }));
                    if (rId) {
                      axios.get(`${PUBLIC_API_BASE}/beds`, { params: { roomId: rId } })
                        .then((r) => setBeds(Array.isArray(r.data) ? r.data : (r.data as any).data || []))
                        .catch(() => {});
                    }
                  }}
                  onSelectBed={(bNum) => setFormData((prev) => ({ ...prev, bedNumber: bNum }))}
                />
              </div>

              {/* Initial Payment Dues Breakdown Card */}
              <div className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
                  <span>Initial Onboarding Dues</span>
                  <span className="font-mono text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-300">{formatCurrency(totalInitialAmount)}</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>1st Month Rent (Advance):</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(Number(formData.rent || 0))}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Refundable Security Deposit:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(Number(formData.deposit || 0))}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                  * Next recurring monthly rent will be billed automatically from month 2 onwards.
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 pt-1">
                <Label className="text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">Select Payment Method</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormData({ ...formData, paymentMethod: 'RAZORPAY' })}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                      formData.paymentMethod === 'RAZORPAY'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <CreditCard className={`h-4.5 w-4.5 ${formData.paymentMethod === 'RAZORPAY' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">Instant</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Razorpay Online Gateway</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">UPI, Debit/Credit Cards, Netbanking</div>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, paymentMethod: 'CASH' })}
                    className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                      formData.paymentMethod === 'CASH'
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <Wallet className={`h-4.5 w-4.5 ${formData.paymentMethod === 'CASH' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">Desk Handover</span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Pay at Reception Desk</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Requires Staff Payment Approval</div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading || propertyLoading}
                  className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md text-xs sm:text-sm"
                >
                  {loading
                    ? 'Processing...'
                    : formData.paymentMethod === 'RAZORPAY'
                    ? `Pay ${formatCurrency(totalInitialAmount)} & Activate Stay`
                    : `Submit Registration (Pay ${formatCurrency(totalInitialAmount)} at Desk)`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
