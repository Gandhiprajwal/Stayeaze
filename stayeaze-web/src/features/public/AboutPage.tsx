import { Link } from 'react-router-dom';
import { 
  Building2, ShieldCheck, Users, Target, Award, Sparkles, ArrowRight, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/public/Navbar';
import { Footer } from '@/components/public/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
      <Navbar />

      <main className="pt-32 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10">
            About StayEaze
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white font-heading">
            Empowering Property Owners Across India
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
            StayEaze was founded with a single mission: to modernize Paying Guest (PG) and Hostel operations through intelligent automation, dedicated per-property banking clearance, and transparent financial reporting.
          </p>
        </div>

        {/* Stats counters */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-4xl font-black text-blue-600 dark:text-blue-400 font-heading">15,000+</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Active Beds Managed</div>
          </div>
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400 font-heading">₹45 Cr+</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Annual Rent Processed</div>
          </div>
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-4xl font-black text-purple-600 dark:text-purple-400 font-heading">250+</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Registered PG Brands</div>
          </div>
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <div className="text-4xl font-black text-amber-600 dark:text-amber-400 font-heading">99.9%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">System Uptime SLA</div>
          </div>
        </div>

        {/* Core Values */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center font-heading">Our Core Pillars</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-3 shadow-sm">
              <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Property Autonomy</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                We believe each property deserves its own dedicated banking setup and configuration so revenue is never mixed.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-3 shadow-sm">
              <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Uncompromising Security</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Complete DPDP 2023 compliance, tenant KYC encryption, and role-based audit logs for total legal protection.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-3 shadow-sm">
              <Award className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Zero-Dummy Integrity</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                All analytics, occupancy rates, and MoM trends are computed strictly from real verified ledgers.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-md">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Join the StayEaze Revolution</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Experience modern PG administration with our 14-day free trial.
          </p>
          <Link to="/signup">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5">
              Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>

      </main>

      <Footer />
    </div>
  );
}
