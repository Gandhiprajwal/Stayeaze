import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';
import { formatCurrency } from '@/lib/format';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);

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
          `Up to ${p.maxBeds} Beds Capacity`,
          `Up to ${p.maxProperties} Property Workspace(s)`,
          `Up to ${p.maxStaffUsers} Staff User Accounts`,
          p.allowWhatsApp ? 'Automated WhatsApp Notifications' : 'Standard Email Alerts',
          p.allowCustomBranding ? 'Custom Business Branding & GST Invoices' : 'Standard Receipts',
          p.allowRazorpayOnline ? 'Per-Property Razorpay Gateway Support' : 'Offline Payment Support',
        ],
      }))
    : [
        {
          name: 'Starter PG Plan',
          priceMonthly: 1499,
          priceAnnual: 1199,
          beds: 'Up to 25 Beds',
          properties: '1 Property',
          badge: 'Small PGs',
          features: [
            'Building, Floor & Room Allocation Grid',
            'Tenant Rent Invoicing & Receipts',
            'WhatsApp Receipt Auto-Dispatch',
            'Standard Reports & Analytics',
            'Mobile & Web Back-Office Console',
          ],
        },
        {
          name: 'Professional Hostel',
          priceMonthly: 2999,
          priceAnnual: 2399,
          beds: 'Up to 150 Beds',
          properties: 'Up to 3 Properties',
          badge: 'Most Popular',
          popular: true,
          features: [
            'All Starter PG Features',
            'Per-Property Razorpay Gateway Support',
            'Staff Roles & Permission Controls',
            'Complaints & Maintenance SLA Hub',
            'Custom Business Branding & GST Invoices',
            'Multi-Branch Audit Logs',
          ],
        },
        {
          name: 'Enterprise Co-Living',
          priceMonthly: 5999,
          priceAnnual: 4799,
          beds: 'Up to 1,000 Beds',
          properties: 'Up to 10 Properties',
          badge: 'Large Chains',
          features: [
            'All Pro Hostel Features',
            'Dedicated Account & Onboarding Manager',
            'Custom SMS & WhatsApp Gateway Integrations',
            'Multi-Branch Financial Audits & Exports',
            'Super Admin Priority Queue',
          ],
        },
      ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <Navbar />

      <main className="pt-24 sm:pt-32 pb-16 sm:pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 text-xs font-semibold px-3 py-1">
            Transparent SaaS Pricing
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
            Simple Plans That Grow With Your PG
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            All plans include a 14-day free trial. No credit card required to start.
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
              Annual Billing <Badge className="bg-amber-500 text-slate-950 text-[10px] font-bold">20% OFF</Badge>
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {plans.map((p, i) => (
            <div
              key={i}
              className={`rounded-2xl p-5 sm:p-6 flex flex-col justify-between transition-all ${
                p.popular
                  ? 'bg-blue-50/50 dark:bg-blue-950/40 border-2 border-blue-500 shadow-xl dark:shadow-2xl shadow-blue-500/10 dark:shadow-blue-500/20 relative'
                  : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {p.popular && (
                <Badge className="absolute -top-3 right-6 bg-amber-500 text-slate-950 font-bold uppercase text-[10px] shadow-xs">
                  Most Popular
                </Badge>
              )}

              <div className="space-y-4">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{p.badge}</span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading">{p.name}</h3>
                <div>
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">{formatCurrency(isAnnual ? p.priceAnnual : p.priceMonthly)}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400"> / month</span>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold pb-4 border-b border-slate-200 dark:border-slate-800">
                  {p.beds} • {p.properties}
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  {p.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Link to="/signup" className="pt-6">
                <Button className={`w-full font-bold rounded-xl h-11 text-xs sm:text-sm shadow-xs ${p.popular ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white'}`}>
                  Select {p.name}
                </Button>
              </Link>
            </div>
          ))}
        </div>

      </main>

      <Footer />
    </div>
  );
}
