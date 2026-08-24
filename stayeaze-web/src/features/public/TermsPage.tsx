import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <Navbar />

      <main className="pt-32 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-3">
          <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
            Legal Compliance
          </Badge>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white font-heading">Terms of Service</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Last Updated: August 13, 2026</p>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">1. Agreement to Terms</h2>
            <p>
              By registering an organization or property on StayEaze ("Platform"), you agree to be bound by these Terms of Service. If you are registering on behalf of a business, PG entity, or hostel group, you represent that you have full legal authority to bind that entity.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">2. Account Registration & Compulsory Details</h2>
            <p>
              To initialize an operational back-office console, property owners must complete all mandatory registration fields including Property Name, Property Code, Landlord PAN, Bank Account Holder Name, Account Number, IFSC Code, and Property Address. You warrant that all provided information is accurate.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">3. SaaS Subscriptions & Billing</h2>
            <p>
              StayEaze offers subscription tiers (Starter PG, Professional Hostel, Enterprise Co-Living). Platform subscription fees are billed monthly or annually in advance using Super Admin master payment credentials. Subscriptions renew automatically unless cancelled prior to the renewal date.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">4. Per-Property Razorpay Isolation</h2>
            <p>
              Property owners configure their own distinct Razorpay credentials for collecting tenant rent payments. StayEaze acts solely as the software interface provider and bears no liability for property-level payment disputes, refunds, or bank settlements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">5. Service Level Agreement (SLA) & Support</h2>
            <p>
              StayEaze targets 99.9% platform availability. Super Admin maintains support impersonation rights to troubleshoot platform issues upon customer request.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
