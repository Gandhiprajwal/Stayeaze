import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Search, ChevronDown, Sparkles, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';

export default function FaqPage() {
  const [search, setSearch] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does per-property Razorpay credential isolation work?',
      a: 'Each property owner provides their own Razorpay Key ID and Secret under Settings -> Organization -> Razorpay Payment Gateway. When tenants pay rent online, payments land directly in that specific property bank account without mixing funds across properties or Super Admin.',
    },
    {
      q: 'What happens during the 14-day free trial?',
      a: 'You get full access to all features on the Professional plan with zero risk and no credit card required. You can seed pre-filled sample buildings, floors, rooms, and beds to test immediately.',
    },
    {
      q: 'Can I add multiple buildings and floors to a single property?',
      a: 'Yes! StayEaze provides a visual hierarchy allowing you to create multiple buildings (e.g., Tower A, Tower B), assign floor numbers, create room numbers with AC/Non-AC types, and configure bed capacities.',
    },
    {
      q: 'How are rent invoices and WhatsApp receipts sent?',
      a: 'When rent is recorded or billed, StayEaze generates an itemized official PDF receipt complete with security verification QR codes, Landlord PAN, and PG registration details, and automatically dispatches receipt notices via WhatsApp.',
    },
    {
      q: 'Is tenant data compliant with DPDP 2023 and privacy regulations?',
      a: 'Yes. All tenant Aadhaar/PAN identity documents and payment receipts are 256-bit encrypted. Access is strictly constrained by role permissions and logged in system audit trails.',
    },
    {
      q: 'Can Super Admin access or assist with my property setup?',
      a: 'Super Admin has support impersonation capability to log into your back-office console to assist with initial setup or troubleshooting upon your support request.',
    },
  ];

  const filtered = faqs.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <Navbar />

      <main className="pt-32 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div className="text-center space-y-4">
          <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
            Frequently Asked Questions
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading">
            Got Questions? We Have Answers.
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-lg mx-auto">
            Everything you need to know about StayEaze property onboarding, Razorpay integration, and subscription billing.
          </p>

          <div className="relative max-w-md mx-auto pt-2">
            <Search className="absolute left-3.5 top-5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FAQ keywords..."
              className="pl-10 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Accordion List */}
        <div className="space-y-4">
          {filtered.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left font-bold text-slate-900 dark:text-white flex items-center justify-between gap-4 text-base"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800/80 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still Have Questions CTA */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-md">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Still have questions?</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">Can't find the answer you're looking for? Reach out directly to our support team.</p>
          <Link to="/contact">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold">
              Contact Support Team <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
