import { Link } from 'react-router-dom';
import { 
  Building2, ShieldCheck, Mail, Phone, MapPin, ArrowRight, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Footer() {
  return (
    <footer className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 text-sm relative overflow-hidden transition-colors">
      {/* Footer Ambient Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-blue-600/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
                StayEaze
              </span>
            </Link>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              India's premier multi-property PG, Hostel, and Co-Living management platform. Automate bed allocations, tenant rent invoicing, WhatsApp receipts, and per-property Razorpay gateways seamlessly.
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-400 pt-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>DPDP 2023 Compliant • 256-Bit SSL Encrypted Banking</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-slate-900 dark:text-white font-bold text-sm tracking-wider uppercase">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/pricing" className="hover:text-blue-400 transition-colors">Pricing Plans</Link></li>
              <li><Link to="/about" className="hover:text-blue-400 transition-colors">About StayEaze</Link></li>
              <li><Link to="/faq" className="hover:text-blue-400 transition-colors">Frequently Asked Questions</Link></li>
              <li><Link to="/signup" className="hover:text-blue-400 transition-colors">Start Free Trial</Link></li>
              <li><Link to="/login" className="hover:text-blue-400 transition-colors">Owner Console Sign In</Link></li>
            </ul>
          </div>

          {/* Legal & Compliance Links */}
          <div className="space-y-3">
            <h4 className="text-slate-900 dark:text-white font-bold text-sm tracking-wider uppercase">Legal & Security</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/terms" className="hover:text-blue-400 transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-blue-400 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/contact" className="hover:text-blue-400 transition-colors">Contact Support</Link></li>
              <li><span className="text-slate-500">Security Audit SLA</span></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-white font-bold text-sm tracking-wider uppercase">Headquarters</h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Sector 44, Golf Course Extension, Gurugram, Haryana 122003</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-400 shrink-0" />
                <span>+91 98765 43210 / +91 124 400 9900</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-400 shrink-0" />
                <span>support@stayeaze.com</span>
              </li>
            </ul>
          </div>

        </div>

        <hr className="border-slate-800/80 my-8" />

        {/* Bottom copyright line */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2026 StayEaze SaaS Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-1">
            <span>Built with precision for PG & Hostel Operations across India</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
