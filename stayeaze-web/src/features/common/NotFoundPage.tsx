import { Link } from 'react-router-dom';
import { Compass, ArrowLeft, Home, Building2, Users, Receipt, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  const quickLinks = [
    { label: 'Dashboard Overview', path: '/dashboard', icon: Home, desc: 'View live occupancy & analytics' },
    { label: 'Properties & Beds', path: '/properties', icon: Building2, desc: 'Manage your buildings & inventory' },
    { label: 'Tenant Management', path: '/tenants', icon: Users, desc: 'Check tenant status & active stays' },
    { label: 'Billing & Invoices', path: '/billing', icon: Receipt, desc: 'Collect rent & manage statements' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6 relative overflow-hidden select-none transition-colors duration-300">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl pointer-events-none" />
      
      <div className="relative z-10 max-w-xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 shadow-xl">
            <Compass className="h-12 w-12 animate-pulse text-indigo-600 dark:text-indigo-400" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-mono">
              HTTP ERROR 404
            </span>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">Page Not Found</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              The page or resource you are trying to access doesn't exist, has been moved, or is temporarily unavailable.
            </p>
          </div>
        </div>

        {/* Recommended destinations */}
        <div className="bg-card border border-border rounded-3xl p-6 text-left shadow-xl space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Quick Navigation Shortcuts
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className="group flex items-center justify-between p-3.5 rounded-2xl bg-secondary/50 border border-border hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{link.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{link.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 text-xs shadow-lg shadow-indigo-600/20 rounded-xl">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
