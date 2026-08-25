import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, Sparkles, ArrowRight, ShieldAlert, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/stores/auth-store';

export function SubscriptionStatusBanner() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const { data: profile } = useQuery({
    queryKey: ['org-billing-profile-banner'],
    queryFn: async () => {
      if (isSuperAdmin) return null;
      const res = await api.get('/organization-billing-profile');
      return res.data;
    },
    enabled: !isSuperAdmin && Boolean(currentUser),
    staleTime: 60000,
  });

  if (!profile) return null;

  const status = profile.subscriptionStatus?.toUpperCase() || 'ACTIVE';

  if (status === 'SUSPENDED') {
    return (
      <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 text-rose-900 dark:text-rose-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <Ban className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              <strong className="font-bold">Workspace Suspended:</strong> Your organization workspace has been suspended. Operational mutations and resident actions are locked.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/settings?tab=support')}
            className="h-7 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-xs shrink-0"
          >
            Contact Support <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  const handleBannerAction = () => {
    if (location.pathname === '/subscription') {
      const el = document.getElementById('subscription-plans-grid');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      else window.scrollTo({ top: 300, behavior: 'smooth' });
    } else {
      navigate('/subscription');
    }
  };

  if (status === 'EXPIRED' || status === 'CANCELLED') {
    return (
      <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 text-rose-900 dark:text-rose-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              <strong className="font-bold">Subscription Expired:</strong> Your plan has ended. Operational actions (adding rooms, beds, tenants, billing) are disabled.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleBannerAction}
            className="h-7 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-xs shrink-0"
          >
            {location.pathname === '/subscription' ? 'Choose Plan Below ↓' : 'Renew Plan Now'} <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'PAYMENT_LOCKED') {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-900 dark:text-amber-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong className="font-bold">Read-Only Mode:</strong> Your workspace subscription payment is pending. Mutations and check-ins are temporarily restricted.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/subscription')}
            className="h-7 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-xs shrink-0"
          >
            Renew Now <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'TRIAL') {
    return (
      <div className="bg-indigo-500/10 border-b border-indigo-500/20 px-4 py-2 text-indigo-900 dark:text-indigo-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0 animate-pulse" />
            <span>
              You are currently on a <strong className="font-bold">Free Trial</strong> ({profile.subscriptionPlanName || 'Starter'}). Upgrade anytime to unlock higher bed capacity.
            </span>
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate('/subscription')}
            className="h-auto p-0 text-xs font-bold text-indigo-600 dark:text-indigo-400"
          >
            Upgrade Plan &rarr;
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
