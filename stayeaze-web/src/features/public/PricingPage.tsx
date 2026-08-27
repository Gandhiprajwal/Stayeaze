import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Check, Sparkles, HelpCircle, ArrowRight, X, ShieldCheck, 
  CreditCard, Smartphone, Zap, IndianRupee, Layers, FileText,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';
import { formatCurrency } from '@/lib/format';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: dbPlans } = useQuery<any[]>({
    queryKey: ['public-saas-plans'],
    queryFn: () => api.get('/auth/public-plans').then((r) => r.data),
  });

  const plans = Array.isArray(dbPlans) && dbPlans.length > 0
    ? dbPlans.map((p) => ({
        name: p.name,
        priceMonthly: p.monthlyPrice,
        priceAnnual: Math.round((p.annualPrice || p.monthlyPrice * 10) / 12),
        beds: `Up to ${p.maxBeds} Beds`,
        properties: `Up to ${p.maxProperties} Property Workspace(s)`,
        badge: p.planKey === 'PROFESSIONAL' ? 'Most Popular' : (p.planKey === 'ENTERPRISE' ? 'Large Chains' : 'Small PGs'),
        popular: p.planKey === 'PROFESSIONAL',
        features: [
          `Up to ${p.maxBeds} Total Beds`,
          `Up to ${p.maxProperties} Properties / Branches`,
          `Up to ${p.maxStaffUsers} Staff Logins`,
          p.allowWhatsApp ? 'Automated WhatsApp Notifications' : 'Standard Email Alerts',
          p.allowCustomBranding ? 'Custom Organization Branding & Logo' : 'Standard StayEaze Receipts',
          p.allowRazorpayOnline ? 'Per-Property Razorpay Gateway Support' : 'Offline Payment Support',
        ],
      }))
    : [
        {
          name: 'Starter PG Plan',
          priceMonthly: 1499,
          priceAnnual: 1199,
          beds: 'Up to 30 Beds',
          properties: '1 Property',
          badge: 'Small PGs',
          features: [
            'Up to 30 Total Beds',
            '1 Property Workspace',
            '2 Staff Accounts (Manager & Warden)',
            'Building & Room Visual Bed Matrix',
            'Tenant Rent Invoicing & Receipts',
            'WhatsApp Receipt Auto-Dispatch',
            'Standard Reports & Analytics',
          ],
        },
        {
          name: 'Professional Hostel',
          priceMonthly: 2999,
          priceAnnual: 2399,
          beds: 'Up to 100 Beds',
          properties: 'Up to 3 Properties',
          badge: 'Most Popular',
          popular: true,
          features: [
            'Up to 100 Total Beds',
            'Up to 3 Property Workspaces',
            '10 Staff Accounts across all branches',
            'Per-Property Razorpay Gateway Credentials',
            'Sub-Meter Electricity Formula Billing',
            'Contactless Reception QR Standee',
            'Complaints & Maintenance SLA Hub',
            'Custom Organization Branding & Logo',
          ],
        },
        {
          name: 'Enterprise Co-Living',
          priceMonthly: 5999,
          priceAnnual: 4799,
          beds: 'Up to 500 Beds',
          properties: 'Up to 10 Properties',
          badge: 'Large Chains',
          features: [
            'Up to 500 Total Beds (or Custom)',
            'Up to 10 Property Workspaces',
            'Unlimited Staff & Multi-Role Logins',
            'Dedicated Account & Onboarding Manager',
            'Custom WhatsApp Cloud Gateway Integrations',
            'MicroTik Router Wi-Fi Provisioning',
            'Full Multi-Branch GSTR-1 & Audit Exports',
            'Super Admin Priority Support Queue',
          ],
        },
      ];

  const featureMatrix = [
    {
      category: 'Capacity & Infrastructure',
      items: [
        { feature: 'Maximum Bed Capacity', starter: '30 Beds', pro: '100 Beds', ent: '500+ Beds' },
        { feature: 'Property Workspaces', starter: '1 Property', pro: '3 Properties', ent: '10 Properties (Expandable)' },
        { feature: 'Staff & Manager Logins', starter: '2 Users', pro: '10 Users', ent: 'Unlimited Users' },
        { feature: 'Visual Bed & Room Matrix', starter: true, pro: true, ent: true },
        { feature: 'Batch Space Generator', starter: true, pro: true, ent: true },
        { feature: 'Smart Vacant Bed Matcher', starter: false, pro: true, ent: true },
      ]
    },
    {
      category: 'Billing & Payment Automation',
      items: [
        { feature: 'Per-Property Direct Razorpay', starter: false, pro: true, ent: true },
        { feature: 'Automated Rent Invoices', starter: true, pro: true, ent: true },
        { feature: 'Sub-Meter Electricity Unit Billing', starter: false, pro: true, ent: true },
        { feature: 'WhatsApp Invoice & Receipt Dispatch', starter: true, pro: true, ent: true },
        { feature: 'HRA Compliant Section 10(13A) Receipts', starter: true, pro: true, ent: true },
        { feature: 'Automated Late Fee Calculation', starter: true, pro: true, ent: true },
        { feature: 'Security Deposit Deductions & Settlements', starter: false, pro: true, ent: true },
      ]
    },
    {
      category: 'Resident & Reception Experience',
      items: [
        { feature: 'Contactless Reception QR Poster', starter: false, pro: true, ent: true },
        { feature: 'Online Aadhaar / Police KYC Upload', starter: true, pro: true, ent: true },
        { feature: 'Tenant Self-Service Mobile Portal', starter: true, pro: true, ent: true },
        { feature: 'Maintenance Ticket SLAs & Staff Assign', starter: false, pro: true, ent: true },
        { feature: 'Digital Visitor Gate Pass & QR Badges', starter: false, pro: true, ent: true },
        { feature: 'MicroTik Wi-Fi Router Sync', starter: false, pro: false, ent: true },
      ]
    },
    {
      category: 'Accounting, Branding & Governance',
      items: [
        { feature: 'Custom Organization Logo & Header', starter: false, pro: true, ent: true },
        { feature: 'Multi-Role Portals (Guard, Accountant, etc.)', starter: false, pro: true, ent: true },
        { feature: 'Downloadable GSTR-1 & Financial Ledgers', starter: false, pro: true, ent: true },
        { feature: 'Multi-Branch Audit Logs', starter: false, pro: true, ent: true },
        { feature: 'Dedicated Onboarding Specialist', starter: false, pro: false, ent: true },
      ]
    }
  ];

  const faqs = [
    {
      q: 'How does per-property Razorpay gateway support work?',
      a: 'Unlike generic rental apps that force you to collect money in their platform wallet and take days to pay you out, StayEaze connects directly to each property individual Razorpay account. When a tenant pays online, 100% of the funds settle directly into that specific property bank account.'
    },
    {
      q: 'Can I upgrade or downgrade my SaaS subscription later?',
      a: 'Yes, anytime! When you upgrade, StayEaze automatically calculates fair proration: any unused balance from your current billing cycle is credited against your new plan. Downgrades are subject to a standard 90-day cooldown to ensure capacity stability.'
    },
    {
      q: 'How do the HRA tax rent receipts work?',
      a: 'StayEaze generates official rent receipts that comply with Indian Income Tax Section 10(13A). Receipts include your Landlord PAN, tenant Aadhaar verification status, detailed rent and electricity breakdown, and a verification QR code for HR/employer audits.'
    },
    {
      q: 'Can I migrate my existing tenant data from Excel?',
      a: 'Yes! StayEaze has a built-in Bulk CSV Tenant Importer in the Residents module. You can import 100+ active tenants with their room assignments, rent amounts, and deposit balances in under 60 seconds.'
    },
    {
      q: 'Do I need a credit card to start the 14-day trial?',
      a: 'No. You can sign up with just your name, email, and property details. You get full access to all features for 14 days without entering any payment card.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <Navbar />

      <main className="pt-24 sm:pt-32 pb-16 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 sm:space-y-24">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 text-xs font-semibold px-3 py-1">
            Simple & Transparent SaaS Plans
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
            Predictable Pricing That Scales With Your Bed Count
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            Every plan includes a full 14-day free trial. Direct bank settlements, zero mixed funds, and automatic prorated upgrades.
          </p>

          <div className="flex items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4 flex-wrap">
            <span className={`text-xs font-semibold ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Monthly Billing</span>
            <div
              onClick={() => setIsAnnual(!isAnnual)}
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${isAnnual ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-800'}`}
            >
              <div className={`h-4 w-4 rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              Annual Commitment <Badge className="bg-amber-500 text-slate-950 text-[10px] font-bold">20% OFF (2 Months Free)</Badge>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {plans.map((p, i) => (
            <div
              key={i}
              className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all ${
                p.popular
                  ? 'bg-blue-50/60 dark:bg-blue-950/40 border-2 border-blue-500 shadow-2xl shadow-blue-500/20 relative scale-100 lg:scale-105 z-10'
                  : 'bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {p.popular && (
                <Badge className="absolute -top-3 right-8 bg-amber-500 text-slate-950 font-bold uppercase text-[10px] shadow-sm px-3 py-0.5">
                  Most Popular For Hostels
                </Badge>
              )}

              <div className="space-y-4">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{p.badge}</span>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">{p.name}</h3>
                <div>
                  <span className="text-4xl font-black text-slate-900 dark:text-white font-mono">{formatCurrency(isAnnual ? p.priceAnnual : p.priceMonthly)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400"> / month</span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold pb-4 border-b border-slate-200 dark:border-slate-800">
                  {p.beds} • {p.properties}
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  {p.features.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link to="/signup" className="pt-6">
                <Button className={`w-full font-bold rounded-xl h-11 text-xs sm:text-sm shadow-xs ${p.popular ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white'}`}>
                  Start 14-Day Free Trial →
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* COMPREHENSIVE SIDE-BY-SIDE FEATURE MATRIX */}
        <div className="space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
              Complete Feature Comparison Matrix
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Deep dive into every capability included across our starter, professional, and enterprise tiers.
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[750px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <th className="p-4 sm:p-5 font-bold text-slate-700 dark:text-slate-300 w-2/5 text-sm">Capability Overview</th>
                    <th className="p-4 sm:p-5 font-bold text-slate-700 dark:text-slate-300 w-1/5 text-center">Starter PG</th>
                    <th className="p-4 sm:p-5 font-extrabold text-blue-600 dark:text-blue-400 w-1/5 text-center bg-blue-50/40 dark:bg-blue-950/40">Professional</th>
                    <th className="p-4 sm:p-5 font-bold text-purple-600 dark:text-purple-400 w-1/5 text-center">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {featureMatrix.map((section, sIdx) => (
                    <>
                      <tr key={`sec-${sIdx}`} className="bg-slate-100/60 dark:bg-slate-950/60">
                        <td colSpan={4} className="px-5 py-3 font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                          {section.category}
                        </td>
                      </tr>
                      {section.items.map((row, rIdx) => (
                        <tr key={`row-${sIdx}-${rIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-4 sm:px-5 font-medium text-slate-800 dark:text-slate-200">
                            {row.feature}
                          </td>
                          <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                            {typeof row.starter === 'boolean' ? (
                              row.starter ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : <X className="h-4 w-4 text-slate-300 dark:text-slate-700 mx-auto" />
                            ) : (
                              <span className="font-semibold">{row.starter}</span>
                            )}
                          </td>
                          <td className="p-4 text-center font-bold text-blue-700 dark:text-blue-300 bg-blue-50/20 dark:bg-blue-950/20">
                            {typeof row.pro === 'boolean' ? (
                              row.pro ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : <X className="h-4 w-4 text-slate-300 dark:text-slate-700 mx-auto" />
                            ) : (
                              <span className="font-bold">{row.pro}</span>
                            )}
                          </td>
                          <td className="p-4 text-center font-bold text-purple-700 dark:text-purple-300">
                            {typeof row.ent === 'boolean' ? (
                              row.ent ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : <X className="h-4 w-4 text-slate-300 dark:text-slate-700 mx-auto" />
                            ) : (
                              <span className="font-bold">{row.ent}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FREQUENTLY ASKED QUESTIONS ACCORDION */}
        <div className="space-y-8 max-w-4xl mx-auto">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Clear answers to the most common questions about subscriptions, Razorpay payments, and migration.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div 
                key={i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 cursor-pointer shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-4">
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {faq.q}
                  </h4>
                  {openFaq === i ? (
                    <ChevronUp className="h-4 w-4 text-blue-600 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </div>
                {openFaq === i && (
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CALL TO ACTION */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-3xl p-8 sm:p-12 text-center text-white space-y-4 shadow-2xl">
          <h3 className="text-2xl sm:text-4xl font-extrabold font-heading">
            Experience the Future of PG & Hostel Operations
          </h3>
          <p className="text-blue-100 text-sm max-w-xl mx-auto">
            Get started in 5 minutes with our 14-day free trial. Zero credit card required.
          </p>
          <div className="pt-2">
            <Link to="/signup">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 py-6 rounded-xl shadow-xl text-base">
                Claim 14-Day Free Access Now →
              </Button>
            </Link>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
