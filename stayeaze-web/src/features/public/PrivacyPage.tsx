import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <Navbar />

      <main className="pt-32 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-3">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10">
            Data Security & Privacy
          </Badge>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white font-heading">Privacy Policy</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Last Updated: August 13, 2026</p>
        </div>

        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">1. Data Privacy Principles</h2>
            <p>
              StayEaze is committed to safeguarding personal and operational data in accordance with India's Digital Personal Data Protection Act (DPDP 2023) and global security best practices.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">2. Information Collection</h2>
            <p>
              We collect information provided during organization onboarding (Owner Name, Email, Phone, Banking Details, Property Address) and tenant operational records (KYC documents, Rent Receipts, Visitor Logs).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">3. Data Encryption & Storage</h2>
            <p>
              All data transmitted to StayEaze is encrypted via 256-bit TLS/SSL protocols. Database records are stored securely in ISO 27001 certified cloud infrastructure with role-based access control.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">4. Third-Party Services</h2>
            <p>
              StayEaze integrates with Razorpay for payment order verification and WhatsApp API providers for rent receipt dispatching. We do not sell or monetize customer or tenant data to third parties.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
