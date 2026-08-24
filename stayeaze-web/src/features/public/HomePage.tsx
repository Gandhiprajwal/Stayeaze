import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Sparkles, ArrowRight, CheckCircle2, ShieldCheck, CreditCard, 
  Users, Receipt, BarChart3, Wrench, MessageSquareWarning, ChevronRight, 
  Star, Zap, Layers, DoorOpen, BedDouble, Landmark, Check, FileText, UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';
import { formatCurrency } from '@/lib/format';

export default function HomePage() {
  const [roiBeds, setRoiBeds] = useState(50);
  const [isAnnual, setIsAnnual] = useState(false);

  // Dynamic ROI calculation
  const hoursSavedPerMonth = Math.round(roiBeds * 0.8);
  const extraRevenueCollected = Math.round(roiBeds * 450);

  const features = [
    {
      icon: CreditCard,
      title: 'Per-Property Razorpay Gateway',
      description: 'Each property uses its own owner-configured Razorpay credentials. Online rent payments go directly to that property bank account without mixing funds.',
      benefit: 'Direct Bank Deposits — Zero mixed organization funds or manual accounting reconciliation.',
      badge: 'Separate Credentials',
    },
    {
      icon: Layers,
      title: 'Building, Floor & Bed Hierarchy',
      description: 'Easily structure multi-tower properties, AC / Non-AC rooms, single/double sharing beds, and monitor real-time occupancy status.',
      benefit: 'Zero Revenue Leakage — 100% bed availability tracking prevents unrented inventory.',
      badge: 'Visual Floor Grid',
    },
    {
      icon: Receipt,
      title: 'Automated Rent Invoicing & Receipts',
      description: 'Generate itemized rent bills with GST, late fee rules, electricity sub-meter charges, and auto-dispatch official receipts via WhatsApp.',
      benefit: '85% Faster Collections — Eliminates paper bills & saves 20+ hours of admin work every month.',
      badge: 'WhatsApp Receipts',
    },
    {
      icon: FileText,
      title: 'HRA Tax Compliant Rent Receipts',
      description: 'Official printable rent receipts formatted for House Rent Allowance (HRA) tax exemption claims under Section 10(13A).',
      benefit: 'Tenant Delight & Anti-Fraud — Features Landlord PAN, signature seal & QR code verification.',
      badge: 'Tax Exemption Ready',
    },
    {
      icon: UserCheck,
      title: 'Digital Tenant KYC & Onboarding',
      description: 'Digital tenant profiles with Aadhaar & PAN document verification, check-in anniversaries, and clear deposit refund logs.',
      benefit: '100% Police Compliance — Verified identity records & zero disputes on security deposit refunds.',
      badge: 'Police Verification',
    },
    {
      icon: Wrench,
      title: 'Complaints & Maintenance SLA Hub',
      description: 'Tenants submit maintenance issues (Plumbing, Wi-Fi, Electrical) with descriptions. Assign staff and track resolution SLAs.',
      benefit: 'Higher Retention — Fast complaint resolution reduces tenant churn and ensures staff accountability.',
      badge: 'Staff SLA Audit',
    },
    {
      icon: BarChart3,
      title: 'Real MoM Financial Analytics',
      description: 'No dummy figures. Accurate dashboard analytics calculated directly from verified tenant ledgers, payments, and expense records.',
      benefit: '100% Accurate Audits — Live revenue forecasting & 1-click CSV/PDF exports for tax filing.',
      badge: 'Accurate Data',
    },
    {
      icon: ShieldCheck,
      title: 'Super Admin Multi-Branch Control',
      description: 'Master organization dashboard for multi-branch PG owners. Support impersonation, staff permissions, and subscription management.',
      benefit: 'Instant Support & Governance — Full control over multi-city PG branches from one dashboard.',
      badge: 'Multi-Branch SaaS',
    },
  ];

  const testimonials = [
    {
      name: 'Rajesh Sharma',
      role: 'Owner, Greenland Luxury PGs (3 Properties, 210 Beds)',
      city: 'Gurugram',
      quote: 'StayEaze eliminated rent collection delays completely. The per-property Razorpay feature allows payments for our Sector 44 PG to hit its own bank account directly!',
      stars: 5,
    },
    {
      name: 'Ananya Deshmukh',
      role: 'Managing Director, Starlight Co-Living',
      city: 'Bengaluru',
      quote: 'Managing 350+ beds across Electronic City used to take 2 full-time accountants. Now StayEaze handles automated WhatsApp receipts and room allocations in minutes.',
      stars: 5,
    },
    {
      name: 'Vikram Singh',
      role: 'Owner, Royal Boys Hostel',
      city: 'Pune',
      quote: 'The 14-day free trial converted me immediately. Pre-filled demo data let me test room assignments within 5 minutes of signing up. Highly recommended!',
      stars: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white flex flex-col justify-between transition-colors">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Ambient Neon Background Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 tracking-wide uppercase">
              Next-Gen Multi-Property PG & Hostel OS
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading max-w-5xl mx-auto leading-[1.1]">
            Automate Rent Collection, Bed Allocations & <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">PG Operations</span>
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-xl max-w-3xl mx-auto font-normal leading-relaxed">
            The all-in-one property management platform built for Indian PGs, Hostels & Co-Living spaces. Dedicated Razorpay credentials per property, WhatsApp rent invoices, and real-time financial reporting.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base px-8 py-6 rounded-xl shadow-xl shadow-blue-600/30 hover:scale-105 transition-all">
                Start 14-Day Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-base px-8 py-6 rounded-xl backdrop-blur-md">
                Sign In to Console
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 pt-6 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Instant 5-Minute Setup</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Cancel Anytime</span>
          </div>

          {/* Interactive Console Screenshot Preview Card */}
          <div className="pt-12 max-w-5xl mx-auto relative">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-3 shadow-xl dark:shadow-2xl backdrop-blur-2xl">
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 space-y-6">
                
                {/* Mock Header */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shrink-0">SE</div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 leading-tight">
                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Greenland Luxury PG</span>
                      <span className="hidden sm:inline text-slate-400 text-xs">— Management Console</span>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] sm:text-xs px-2 py-0.5 font-bold shrink-0">
                    ✓ Live Operations
                  </Badge>
                </div>

                {/* Mock Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-left">
                  <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">Occupancy Rate</span>
                    <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white mt-1 truncate">96.4%</div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block truncate">+4.2% MoM</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">Total Active Beds</span>
                    <div className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 truncate">420 Beds</div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">3 Properties</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">Monthly Rent</span>
                    <div className="text-base sm:text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 truncate" title="₹18,45,000">₹18,45,000</div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block truncate">100% Verified</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl shadow-sm min-w-0 overflow-hidden">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">Pending Complaints</span>
                    <div className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 truncate">2 Pending</div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">98% SLA Resolved</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* CORE FEATURES GRID */}
      <section className="py-20 bg-slate-100/70 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
              Why Choose StayEaze?
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
              Engineered Specifically for Indian PG & Hostel Owners
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base">
              Say goodbye to manual registers, mixed bank accounts, and missing rent payments. StayEaze automates your entire property lifecycle.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 hover:border-blue-500/50 hover:bg-slate-50 dark:hover:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <f.icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 text-[10px]">
                      {f.badge}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading">{f.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{f.description}</p>
                  
                  {/* Direct Business Benefit Highlight */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl p-2.5 flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 leading-tight">
                        {f.benefit}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* INTERACTIVE ROI SAVINGS CALCULATOR */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center space-y-3">
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10">
              Interactive ROI Estimator
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">
              Calculate Your Monthly Time & Revenue Savings
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl mx-auto">
              Drag the slider to select your total bed capacity across all properties and see how much time and money StayEaze saves you.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl dark:shadow-2xl space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-300">Total Managed Beds Capacity:</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">{roiBeds} Beds</span>
              </div>
              <Slider
                value={[roiBeds]}
                min={10}
                max={500}
                step={5}
                onValueChange={(val) => setRoiBeds(val[0])}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>10 Beds</span>
                <span>250 Beds</span>
                <span>500+ Beds</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Monthly Administrative Hours Saved</span>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 font-heading">{hoursSavedPerMonth} Hours / mo</div>
                <p className="text-xs text-slate-500">Automates room allocations, billing reminders & receipts.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Estimated Extra Recovered Late Fees & Rent</span>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-heading">{formatCurrency(extraRevenueCollected)} / mo</div>
                <p className="text-xs text-slate-500">Zero missed rent invoices or uncollected security deposits.</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* PRICING SECTION */}
      <section className="py-20 bg-slate-100/70 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
              Simple Transparent SaaS Pricing
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading">
              Predictable Plans for Every Property Scale
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              All plans include 14-day free trial. Upgrade or downgrade anytime without hidden fees.
            </p>

            <div className="flex items-center justify-center gap-4 pt-2">
              <span className={`text-xs font-semibold ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Monthly Billing</span>
              <div
                onClick={() => setIsAnnual(!isAnnual)}
                className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${isAnnual ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-800'}`}
              >
                <div className={`h-4 w-4 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
              <span className={`text-xs font-semibold flex items-center gap-1 ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                Annual Billing <Badge className="bg-amber-500 text-slate-950 text-[10px] font-bold">20% OFF</Badge>
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Starter PG */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Small PGs</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Starter PG Plan</h3>
                <div>
                  <span className="text-4xl font-black text-slate-900 dark:text-white">{formatCurrency(isAnnual ? 1199 : 1499)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400"> / month</span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold pb-4 border-b border-slate-200 dark:border-slate-800">
                  Up to 30 Beds • 1 Property
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Building & Room Allocation Grid</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Tenant Rent Invoicing & Receipts</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> WhatsApp Payment Notices</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Standard Financial Reports</li>
                </ul>
              </div>
              <Link to="/signup" className="pt-6">
                <Button className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold">Choose Starter</Button>
              </Link>
            </div>

            {/* Pro Hostel */}
            <div className="bg-blue-50/50 dark:bg-blue-950/40 border-2 border-blue-500 rounded-2xl p-6 flex flex-col justify-between relative shadow-xl dark:shadow-2xl shadow-blue-500/10 dark:shadow-blue-500/20">
              <Badge className="absolute -top-3 right-6 bg-amber-500 text-slate-950 font-bold uppercase text-[10px]">
                Most Popular
              </Badge>
              <div className="space-y-4">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Growing Hostels</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Professional Hostel</h3>
                <div>
                  <span className="text-4xl font-black text-slate-900 dark:text-white">{formatCurrency(isAnnual ? 2399 : 2999)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400"> / month</span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold pb-4 border-b border-slate-200 dark:border-slate-800">
                  Up to 100 Beds • Up to 3 Properties
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> All Starter Features</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Per-Property Razorpay Gateway</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Staff Roles & Audit Trail</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Complaints & Maintenance Hub</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Custom Branding & GST Receipts</li>
                </ul>
              </div>
              <Link to="/signup" className="pt-6">
                <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">Get Started Pro</Button>
              </Link>
            </div>

            {/* Enterprise Co-Living */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="space-y-4">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Large Chains</span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Enterprise Co-Living</h3>
                <div>
                  <span className="text-4xl font-black text-slate-900 dark:text-white">{formatCurrency(isAnnual ? 4799 : 5999)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400"> / month</span>
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold pb-4 border-b border-slate-200 dark:border-slate-800">
                  Unlimited Beds • Unlimited Properties
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> All Pro Features</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Dedicated Account Manager</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Custom SMS & WhatsApp API</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /> Multi-Branch Audit Exports</li>
                </ul>
              </div>
              <Link to="/signup" className="pt-6">
                <Button className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold">Contact Enterprise</Button>
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="py-20 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10">
              Trusted Across India
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">
              Loved by PG Owners & Property Managers
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-4 flex flex-col justify-between shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
                    {[...Array(t.stars)].map((_, idx) => (
                      <Star key={idx} className="h-4 w-4 fill-amber-500 dark:fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-xs italic leading-relaxed">"{t.quote}"</p>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{t.name}</h4>
                    <span className="text-slate-500">{t.role}</span>
                  </div>
                  <Badge variant="outline" className="border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 text-[10px]">
                    {t.city}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* FINAL HIGH IMPACT CTA BANNER */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-br from-blue-50 via-slate-100 to-indigo-50 dark:from-blue-900/40 dark:via-slate-950 dark:to-indigo-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading">
            Ready to Automate Your PG Operations?
          </h2>
          <p className="text-slate-700 dark:text-slate-300 text-base max-w-xl mx-auto">
            Join hundreds of PG and hostel owners scaling their business effortlessly with StayEaze.
          </p>
          <div className="pt-4">
            <Link to="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-10 py-6 rounded-xl shadow-2xl shadow-blue-500/30 hover:scale-105 transition-all">
                Start Your 14-Day Free Trial Now <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
