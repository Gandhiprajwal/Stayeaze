import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Sparkles, ArrowRight, CheckCircle2, ShieldCheck, CreditCard, 
  Users, Receipt, BarChart3, Wrench, ChevronRight, 
  Star, Zap, Layers, DoorOpen, BedDouble, Landmark, Check, FileText, UserCheck,
  QrCode, Wifi, ShieldAlert, Smartphone, ArrowUpRight, HelpCircle, Laptop,
  Cpu, Award, IndianRupee, Shield, Split, Clock, RefreshCw
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
  const [activeDemoTab, setActiveDemoTab] = useState<'matrix' | 'invoice' | 'onboarding' | 'tenant'>('matrix');
  const [activeRoleTab, setActiveRoleTab] = useState<'owner' | 'manager' | 'accountant' | 'security' | 'tenant'>('owner');

  // Dynamic ROI calculation
  const hoursSavedPerMonth = Math.round(roiBeds * 0.85);
  const extraRevenueCollected = Math.round(roiBeds * 480);
  const utilityLeakageSaved = Math.round(roiBeds * 220);

  const pillars = [
    {
      id: 'matrix',
      icon: Layers,
      title: 'Visual Bed & Floor Matrix',
      badge: 'Zero Revenue Leakage',
      tagline: 'See every bed in every room across multiple towers in real-time.',
      description: 'Dynamic floor grid color-codes occupied, available, reserved, and under-maintenance beds. Filter by AC/Non-AC, sharing type, and instantly allocate rooms.',
      bullets: [
        'Multi-tower, multi-floor hierarchical room tree',
        'Single, Double, Triple & Custom sharing configurations',
        'Batch space generator creates 50+ rooms in 10 seconds',
        'Smart Space Matcher finds the ideal vacant bed for walk-ins'
      ],
      color: 'blue'
    },
    {
      id: 'billing',
      icon: CreditCard,
      title: 'Per-Property Razorpay & Sub-Meters',
      badge: '100% Direct Bank Deposits',
      tagline: 'Independent payment gateways per property with automated electricity sub-meter calculation.',
      description: 'Direct rent deposits into each property specific bank account with zero mixed organization funds. Record electricity meter units and automatically add charges to monthly rent.',
      bullets: [
        'Independent Razorpay API keys per property branch',
        'Electricity sub-meter kWh unit logging & formula billing',
        'Automated WhatsApp rent invoices & payment links',
        'Custom late fee rules & automated payment reconciliation'
      ],
      color: 'indigo'
    },
    {
      id: 'onboarding',
      icon: QrCode,
      title: 'Reception QR & Self-Check-in',
      badge: 'Contactless Digital KYC',
      tagline: 'Printable reception poster enables tenants to complete Aadhaar KYC from their phones.',
      description: 'Tenants scan your front-desk QR code, upload Aadhaar/PAN, enter emergency contacts, and accept house rules. Manager approves check-in with 1 click.',
      bullets: [
        'Printable reception counter standee poster generator',
        'Digital Aadhaar, PAN & College/Company ID verification',
        'Zero paper registration forms or lost tenant files',
        'Instant WhatsApp confirmation on manager approval'
      ],
      color: 'emerald'
    },
    {
      id: 'settlement',
      icon: Landmark,
      title: 'Security Deposit & Checkout Engine',
      badge: 'Zero Refund Disputes',
      tagline: 'Transparent deductions for room damages, notice period shortfall & unpaid dues.',
      description: 'When a resident checks out, StayEaze automatically calculates deposit deductions, pending electricity bills, and generates an itemized NEFT/UPI refund receipt.',
      bullets: [
        'Notice period compliance tracker (30/60 days)',
        'Itemized room damage & deep cleaning deductions',
        'Automated bank account details capture from tenant',
        'Downloadable official settlement voucher with signature seal'
      ],
      color: 'amber'
    },
    {
      id: 'portal',
      icon: Smartphone,
      title: 'Dedicated Tenant Mobile Space',
      badge: 'Delightful Resident Experience',
      tagline: 'Mobile-first portal for residents to pay rent, view Wi-Fi keys, and raise maintenance tickets.',
      description: 'Give your tenants a modern digital hostel experience. 1-click online rent payment, official HRA tax receipts, food menu schedules, and SLA-tracked complaints.',
      bullets: [
        '1-click UPI / Card rent payment with zero manual confirmation',
        'Download official HRA rent receipts for Section 10(13A) tax claims',
        'Wi-Fi password & network captive portal provisioning',
        'Photo-based complaint ticketing with staff resolution SLA'
      ],
      color: 'cyan'
    },
    {
      id: 'security',
      icon: ShieldCheck,
      title: 'Gate Pass, Visitors & Wi-Fi Sync',
      badge: 'Campus Grade Security',
      tagline: 'Guard gatehouse interface for visitor QR badges and automated router access.',
      description: 'Log walk-in visitors, issue digital gate passes with validity timers, and track overstays. Sync tenant check-ins directly with MicroTik Wi-Fi routers.',
      bullets: [
        'Security guard gatehouse tablet interface',
        'Digital visitor QR pass generation with overstay alerts',
        'MicroTik / Router captive portal user provisioning',
        'Comprehensive multi-role audit trail & activity logs'
      ],
      color: 'purple'
    }
  ];

  const roleSolutions = {
    owner: {
      role: 'PG & Hostel Owners',
      headline: 'Consolidated Revenue, Zero Leakage & Absolute Peace of Mind',
      description: 'Track multi-city PG branches from your phone. Rent hits your bank accounts directly through property-specific Razorpay gateways without mixing funds.',
      highlights: [
        'Real-time consolidated occupancy & financial overview',
        'Direct-to-bank rent collection with zero cash leakage',
        'Automated GST invoicing, GSTR-1 summaries & profit metrics',
        'Staff permission controls and activity audit logs'
      ],
      stat: '99.4%',
      statLabel: 'On-time rent collections across all properties'
    },
    manager: {
      role: 'Property Managers & Wardens',
      headline: 'Automate Daily Check-ins, Room Shifts & Maintenance SLAs',
      description: 'Stop juggling WhatsApp messages and diary entries. Manage room allotments, track lease anniversaries, and assign repair requests to field staff instantly.',
      highlights: [
        '1-click room allotment from visual bed matrix',
        'Automated check-in & check-out checklists',
        'Staff complaint tracking with resolution timers',
        'Automated WhatsApp payment reminders to overdue rooms'
      ],
      stat: '85%',
      statLabel: 'Reduction in manual admin & register paperwork'
    },
    accountant: {
      role: 'Accountants & Tax Advisors',
      headline: 'Audit-Ready Ledgers, GST Reports & Security Deposit Reconciliation',
      description: 'Export itemized financial ledgers, GST tax invoices with Landlord PAN, and track security deposit inflows and deduction settlements seamlessly.',
      highlights: [
        'Downloadable GST compliant tax invoices with HSN/SAC codes',
        'Itemized security deposit ledger with deduction receipts',
        '1-click CSV & PDF export for Chartered Accountant audits',
        'Sub-meter electricity unit consumption reconciliation'
      ],
      stat: '100%',
      statLabel: 'Audit compliance with zero reconciliation mismatches'
    },
    security: {
      role: 'Security Guards & Gate Staff',
      headline: 'Digital Visitor Logs & Campus Perimeter Control',
      description: 'Equip your gate team with a simple, high-contrast mobile interface to verify tenant identity, issue digital visitor passes, and log incoming deliveries.',
      highlights: [
        'Rapid visitor registration with photo & resident verification',
        'Overstay alert banners for unauthorized campus visitors',
        'Real-time resident in/out verification',
        'Gatehouse tablet mode optimized for touch devices'
      ],
      stat: '< 15s',
      statLabel: 'To register and issue a digital visitor gate pass'
    },
    tenant: {
      role: 'Residents (Students & Working Pros)',
      headline: 'Transparent Billing, 1-Click Payments & Official HRA Tax Receipts',
      description: 'Tenants get their own mobile portal with itemized electricity bills, UPI rent payments, Wi-Fi access credentials, and instant maintenance request updates.',
      highlights: [
        '1-click rent payment via UPI, Credit Card, or NetBanking',
        'Download verified HRA rent receipts with QR verification',
        'Track maintenance requests in real-time from mobile',
        'View room Wi-Fi credentials and notices on the go'
      ],
      stat: '4.9 / 5',
      statLabel: 'Resident satisfaction rating across managed hostels'
    }
  };

  const comparisons = [
    {
      feature: 'Online Rent Collection',
      registers: 'Manual UPI screenshots & cash logs',
      generic: 'Mixed into one platform wallet (slow payouts)',
      stayeaze: 'Per-property direct-to-bank Razorpay gateway',
      stayeazeWins: true
    },
    {
      feature: 'Bed & Room Inventory',
      registers: 'Paper register / notebook entries',
      generic: 'Basic list of room numbers',
      stayeaze: 'Interactive visual building-floor-bed state matrix',
      stayeazeWins: true
    },
    {
      feature: 'Tenant KYC & Onboarding',
      registers: 'Photocopies of Aadhaar in physical folders',
      generic: 'Manual typing of each tenant field',
      stayeaze: 'Contactless reception QR scan-to-check-in with KYC',
      stayeazeWins: true
    },
    {
      feature: 'Electricity Sub-Meter Billing',
      registers: 'Manual calculator math & paper slips',
      generic: 'Not supported (flat rate only)',
      stayeaze: 'Formula unit billing auto-merged into rent bills',
      stayeazeWins: true
    },
    {
      feature: 'Deposit Refund & Checkout',
      registers: 'Arguments over memory of damages',
      generic: 'Manual cash return with no receipt',
      stayeaze: 'Itemized damage deduction voucher with seal',
      stayeazeWins: true
    },
    {
      feature: 'HRA Tax Rent Receipts',
      registers: 'Handwritten slips rejected by HR/CA',
      generic: 'Generic non-compliant PDF',
      stayeaze: 'Official Section 10(13A) receipts with QR verification',
      stayeazeWins: true
    },
    {
      feature: 'Role-Based Access Control',
      registers: 'Anyone can see everything in notebook',
      generic: 'Single admin login shared with staff',
      stayeaze: '6 dedicated portals: Owner, Manager, Guard, Accountant, Tenant',
      stayeazeWins: true
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white flex flex-col justify-between transition-colors">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative pt-28 pb-16 lg:pt-36 lg:pb-28 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/15 to-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md shadow-xs">
            <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 tracking-wide uppercase">
              Next-Gen Multi-Property PG & Hostel OS
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading max-w-5xl mx-auto leading-[1.08]">
            Automate Rent Collection, Bed Allocations & <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">PG Operations</span>
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-base sm:text-xl max-w-3xl mx-auto font-normal leading-relaxed">
            The complete operating system for Indian PGs, Hostels & Co-Living spaces. Dedicated Razorpay credentials per property, automated electricity sub-meters, reception QR check-ins, and verified HRA tax receipts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link to="/signup">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base px-8 py-6 rounded-xl shadow-xl shadow-blue-600/30 hover:scale-105 transition-all">
                Start 14-Day Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-base px-8 py-6 rounded-xl backdrop-blur-md shadow-xs">
                Sign In to Console
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No Credit Card Required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 100% Direct Bank Deposits</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Instant 5-Minute Setup</span>
          </div>

          {/* INTERACTIVE PRODUCT CONSOLE PREVIEW */}
          <div className="pt-8 max-w-5xl mx-auto relative">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 p-3 sm:p-4 shadow-2xl backdrop-blur-2xl text-left">
              
              {/* Interactive Tabs Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl overflow-x-auto max-w-full">
                  <button
                    onClick={() => setActiveDemoTab('matrix')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeDemoTab === 'matrix'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Visual Bed Matrix</span>
                  </button>
                  <button
                    onClick={() => setActiveDemoTab('invoice')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeDemoTab === 'invoice'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>HRA Rent Receipt</span>
                  </button>
                  <button
                    onClick={() => setActiveDemoTab('onboarding')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeDemoTab === 'onboarding'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Reception QR Standee</span>
                  </button>
                  <button
                    onClick={() => setActiveDemoTab('tenant')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      activeDemoTab === 'tenant'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>Resident Mobile App</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Interactive Console
                  </span>
                </div>
              </div>

              {/* Demo Content Screen */}
              <div className="pt-4 pb-2">
                {activeDemoTab === 'matrix' && (
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">Tower A — Floor 2 (AC Rooms)</span>
                        <p className="text-slate-500 text-[11px]">8 Rooms • 24 Total Beds • 22 Occupied (91.6%)</p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Occupied (22)</span>
                        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Vacant (2)</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { room: '201', type: 'Triple AC', beds: ['B1: Rahul S.', 'B2: Amit K.', 'B3: VACANT'], available: true },
                        { room: '202', type: 'Double AC', beds: ['B1: Priya M.', 'B2: Sneha D.'], available: false },
                        { room: '203', type: 'Triple AC', beds: ['B1: Vicky P.', 'B2: Aniket R.', 'B3: Roshan T.'], available: false },
                        { room: '204', type: 'Double AC', beds: ['B1: VACANT', 'B2: Manish J.'], available: true },
                      ].map((rm, idx) => (
                        <div key={idx} className={`p-3 rounded-xl border ${rm.available ? 'border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">Room {rm.room}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{rm.type}</Badge>
                          </div>
                          <div className="space-y-1.5 pt-2">
                            {rm.beds.map((b, bIdx) => (
                              <div key={bIdx} className={`text-[10px] px-2 py-1 rounded-md font-medium flex items-center justify-between ${b.includes('VACANT') ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300'}`}>
                                <span className="truncate">{b}</span>
                                {b.includes('VACANT') && <span className="text-[9px] bg-blue-600 text-white px-1 rounded font-bold">ALLOT</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeDemoTab === 'invoice' && (
                  <div className="bg-white dark:bg-slate-950 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-2xl mx-auto space-y-4 shadow-sm">
                    <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-base text-blue-600">Greenland Luxury PG</span>
                          <Badge className="bg-emerald-500/20 text-emerald-600 text-[10px] border-0">HRA Tax Compliant</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Plot 45, Sector 44, Gurugram • Landlord PAN: ABCDE1234F</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold">INV-2026-0842</span>
                        <p className="text-[10px] text-slate-400">Date: 01 Aug 2026</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                      <div>
                        <span className="text-slate-400 text-[10px]">Billed To:</span>
                        <p className="font-bold">Rahul Sharma (Room 201-B1)</p>
                        <p className="text-slate-500 text-[10px]">Aadhaar Verified • +91 98765 43210</p>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[10px]">Payment Status:</span>
                        <p className="font-bold text-emerald-600">✓ PAID VIA RAZORPAY</p>
                        <p className="text-slate-500 text-[10px] font-mono">Txn: pay_PQx892NLa</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span>Room Rent (Aug 2026 - AC Triple Sharing)</span>
                        <span className="font-bold">₹8,500</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span>Electricity Sub-Meter (42 Units @ ₹12/unit)</span>
                        <span className="font-bold">₹504</span>
                      </div>
                      <div className="flex justify-between py-1.5 font-bold text-sm text-blue-600">
                        <span>Total Paid</span>
                        <span>₹9,004</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeDemoTab === 'onboarding' && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-4 max-w-xl mx-auto">
                    <div className="inline-flex p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
                      <QrCode className="h-28 w-28 sm:h-36 sm:w-36 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">Scan at Reception to Self Check-In</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        Prospective residents scan this printable standee, enter their mobile number, upload Aadhaar/College ID, and submit room preferences directly from their phone.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <span className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full font-bold">
                        ✓ Instant Police KYC Verification
                      </span>
                      <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold">
                        ✓ 1-Click Manager Approval
                      </span>
                    </div>
                  </div>
                )}

                {activeDemoTab === 'tenant' && (
                  <div className="bg-white dark:bg-slate-950 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 max-w-md mx-auto space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">RS</div>
                        <div>
                          <span className="font-bold text-xs">Rahul's Tenant Portal</span>
                          <p className="text-[10px] text-slate-400">Greenland Luxury PG • Room 201</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/20 text-emerald-600 text-[10px] border-0">Active Resident</Badge>
                    </div>

                    <div className="bg-blue-600 text-white p-3.5 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="opacity-80">Next Rent Due: 05 Sep 2026</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">UPI / Cards</span>
                      </div>
                      <div className="text-2xl font-black">₹9,004</div>
                      <button className="w-full bg-white text-blue-600 font-bold text-xs py-2 rounded-lg hover:bg-blue-50 transition-colors shadow-xs">
                        Pay Rent via Razorpay →
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Wi-Fi Network</span>
                        <span className="font-bold text-xs text-blue-600">Greenland_5G</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Active Tickets</span>
                        <span className="font-bold text-xs text-emerald-600">0 Open (Resolved)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* METRIC TRUST HIGHLIGHTS BAR */}
      <section className="py-8 bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 font-heading">100%</div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Direct Bank Deposits (Zero Mixed Funds)</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-heading">Police KYC Ready</div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Digital Aadhaar &amp; Tenant Verification</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-heading">Section 10(13A)</div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Verified HRA Rent Receipts with QR</p>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 font-heading">6 Portals</div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Owner, Warden, Guard, Accountant, Tenant</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6 CORE CAPABILITY PILLARS */}
      <section className="py-20 bg-slate-100/70 dark:bg-slate-950/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
              End-to-End Operating System
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
              Everything Your PG & Hostel Needs to Scale
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base">
              Replace fragmented Excel sheets, WhatsApp groups, and lost registers with six integrated pillars built for Indian co-living operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {pillars.map((p, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-blue-500/40 transition-all duration-300 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <p.icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline" className="border-slate-200 dark:border-slate-800 text-[10px] font-bold">
                      {p.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white font-heading">{p.title}</h3>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">{p.tagline}</p>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{p.description}</p>

                  <ul className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {p.bullets.map((b, bIdx) => (
                      <li key={bIdx} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ROLE BASED EXPERIENCE SECTION */}
      <section className="py-20 bg-white dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10">
              Multi-Role Empowerment
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">
              Built for Every Member of Your Property Team
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Different roles need different tools. StayEaze provides dedicated workflows tailored to each persona.
            </p>
          </div>

          {/* Role Navigation Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {(['owner', 'manager', 'accountant', 'security', 'tenant'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setActiveRoleTab(r)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeRoleTab === r
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {roleSolutions[r].role}
              </button>
            ))}
          </div>

          {/* Active Role Card */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 max-w-4xl mx-auto shadow-xl">
            <div className="grid md:grid-cols-3 gap-8 items-center">
              <div className="md:col-span-2 space-y-4">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Role Solution: {roleSolutions[activeRoleTab].role}
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
                  {roleSolutions[activeRoleTab].headline}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                  {roleSolutions[activeRoleTab].description}
                </p>

                <div className="grid sm:grid-cols-2 gap-2.5 pt-2">
                  {roleSolutions[activeRoleTab].highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-center space-y-2 shadow-sm">
                <div className="text-4xl font-black text-blue-600 dark:text-blue-400 font-heading">
                  {roleSolutions[activeRoleTab].stat}
                </div>
                <p className="text-xs text-slate-500 font-medium leading-snug">
                  {roleSolutions[activeRoleTab].statLabel}
                </p>
                <div className="pt-3">
                  <Link to="/signup">
                    <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-xs">
                      Try Free Trial →
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* COMPETITIVE COMPARISON MATRIX */}
      <section className="py-20 bg-slate-100/70 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10">
              Why We Are Different
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">
              StayEaze vs Old Registers & Generic Apps
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              See why property owners are switching from manual notebooks and mixed-wallet apps to StayEaze.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[700px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <th className="p-4 font-bold text-slate-700 dark:text-slate-300 w-1/4">Key Capability</th>
                    <th className="p-4 font-bold text-slate-500 dark:text-slate-400 w-1/4">Paper / Excel Registers</th>
                    <th className="p-4 font-bold text-slate-500 dark:text-slate-400 w-1/4">Generic Property Apps</th>
                    <th className="p-4 font-extrabold text-blue-600 dark:text-blue-400 w-1/4 bg-blue-50/50 dark:bg-blue-950/40">StayEaze PG OS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {comparisons.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">{row.feature}</td>
                      <td className="p-4 text-slate-500">{row.registers}</td>
                      <td className="p-4 text-slate-500">{row.generic}</td>
                      <td className="p-4 font-semibold text-blue-700 dark:text-blue-300 bg-blue-50/30 dark:bg-blue-950/20">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          {row.stayeaze}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      {/* HARDWARE & MODERN API INTEGRATIONS */}
      <section className="py-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-center">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enterprise Ecosystem Integrations</span>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              Seamlessly Connected to the Tools You Trust
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col items-center justify-center gap-1.5">
              <CreditCard className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">Razorpay PG</span>
              <span className="text-[10px] text-slate-500">Direct Bank Routing</span>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col items-center justify-center gap-1.5">
              <Zap className="h-6 w-6 text-emerald-500" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">WhatsApp Cloud API</span>
              <span className="text-[10px] text-slate-500">Instant Bills & Receipts</span>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col items-center justify-center gap-1.5">
              <Wifi className="h-6 w-6 text-indigo-500" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">MicroTik Routers</span>
              <span className="text-[10px] text-slate-500">Auto Wi-Fi Provisioning</span>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col items-center justify-center gap-1.5">
              <ShieldCheck className="h-6 w-6 text-amber-500" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">DigiLocker / Aadhaar</span>
              <span className="text-[10px] text-slate-500">Police KYC Verification</span>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col items-center justify-center gap-1.5">
              <IndianRupee className="h-6 w-6 text-purple-500" />
              <span className="font-bold text-xs text-slate-900 dark:text-white">UPI & QR Dynamic</span>
              <span className="text-[10px] text-slate-500">Instant Reconciliation</span>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE ROI SAVINGS CALCULATOR */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 relative overflow-hidden">
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

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-300">Total Managed Beds Capacity:</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">{roiBeds} Beds</span>
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

            <div className="grid sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 font-medium">Monthly Admin Hours Saved</span>
                <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-heading">{hoursSavedPerMonth} Hours / mo</div>
                <p className="text-[11px] text-slate-500">Automates room allotments, KYC & WhatsApp notices.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 font-medium">Recovered Late Fees & Rent</span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-heading">{formatCurrency(extraRevenueCollected)} / mo</div>
                <p className="text-[11px] text-slate-500">Zero missed rent invoices or uncollected deposits.</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 font-medium">Sub-Meter Electricity Recovery</span>
                <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 font-heading">{formatCurrency(utilityLeakageSaved)} / mo</div>
                <p className="text-[11px] text-slate-500">Accurate kWh sub-meter calculation per room.</p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* FINAL HIGH IMPACT CTA BANNER */}
      <section className="py-20 relative overflow-hidden bg-gradient-to-br from-blue-50 via-slate-100 to-indigo-50 dark:from-blue-900/40 dark:via-slate-950 dark:to-indigo-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <Badge className="bg-blue-600 text-white text-xs px-3 py-1 font-bold">14-Day Full Access Trial</Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading">
            Ready to Automate Your PG & Hostel Operations?
          </h2>
          <p className="text-slate-700 dark:text-slate-300 text-base max-w-xl mx-auto">
            Join forward-thinking PG and co-living owners scaling their properties effortlessly with StayEaze.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-10 py-6 rounded-xl shadow-2xl shadow-blue-500/30 hover:scale-105 transition-all">
                Start Your 14-Day Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-base px-8 py-6 rounded-xl shadow-xs">
                View Detailed Pricing Matrix →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
