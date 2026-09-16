import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Crown, ArrowRight, CheckCircle2, Lock, ShieldCheck, Zap } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';

export interface FeatureUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureTitle: string;
  featureDescription?: string;
  requiredTier?: 'GROWTH' | 'ENTERPRISE';
  highlightBenefits?: string[];
}

export function FeatureUpgradeDialog({
  open,
  onOpenChange,
  featureTitle,
  featureDescription,
  requiredTier = 'GROWTH',
  highlightBenefits,
}: FeatureUpgradeDialogProps) {
  const navigate = useNavigate();

  const isEnterprise = requiredTier === 'ENTERPRISE';
  const tierName = isEnterprise ? 'Enterprise Living Chain' : 'Growth Hostel & PG';
  const tierPriceMonthly = isEnterprise ? 7999 : 3499;
  const tierBadge = isEnterprise ? 'Enterprise Tier' : 'Most Popular Plan';

  const defaultBenefits = isEnterprise
    ? [
        'Up to 10 Properties & Unlimited Buildings',
        'Up to 500 Beds Capacity (Scalable)',
        'Up to 25 Staff Logins with Custom Permissions',
        'White-Label Custom Branding (Logo, Favicon, Tagline)',
        '1-Click Bulk Monthly Rent Run across all branches',
        'Security Audit Logs & Dedicated SLA Support',
      ]
    : [
        'Up to 2 Properties & Up to 4 Buildings',
        'Up to 120 Beds Capacity (50 Rooms)',
        'Up to 6 Staff Logins (Manager, Accountant, Receptionist)',
        'Automated WhatsApp Alerts & Payment Notices',
        'Sub-Meter Utility Tariff Engine & Digital Agreements',
        'GST-1 Tax Reports & HRA Statement Generator',
      ];

  const benefits = highlightBenefits && highlightBenefits.length > 0 ? highlightBenefits : defaultBenefits;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden border-indigo-100 shadow-2xl">
        {/* Header Banner */}
        <div className={`p-6 text-white relative overflow-hidden ${
          isEnterprise 
            ? 'bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900' 
            : 'bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-800'
        }`}>
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md px-3 py-1 font-semibold flex items-center gap-1.5">
              {isEnterprise ? <Crown className="w-3.5 h-3.5 text-amber-300" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
              {tierBadge}
            </Badge>
            <span className="text-xs text-white/80 font-mono tracking-wider uppercase">Upgrade Required</span>
          </div>

          <div className="flex items-start gap-3 mt-1">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20 shrink-0">
              <Lock className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white tracking-tight">
                {featureTitle}
              </DialogTitle>
              <DialogDescription className="text-blue-100/90 text-sm mt-1 leading-relaxed">
                {featureDescription || `This feature requires the ${tierName} plan.`}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Plan Benefits & Value Props */}
        <div className="p-6 space-y-4 bg-slate-50/50">
          <div className="flex items-baseline justify-between p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-sm">
            <div>
              <div className="text-xs text-slate-500 font-medium">Recommended Upgrade</div>
              <div className="text-base font-bold text-slate-900">{tierName}</div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-indigo-600">{formatCurrency(tierPriceMonthly)}</span>
              <span className="text-xs text-slate-500"> / month</span>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
              Everything Unlocked with {tierName}:
            </div>
            <div className="grid grid-cols-1 gap-2">
              {benefits.slice(0, 5).map((b, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <DialogFooter className="p-4 bg-white border-t border-slate-100 flex sm:justify-between items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-600 hover:text-slate-900"
          >
            Maybe Later
          </Button>
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              navigate('/subscription');
            }}
            className={`font-semibold shadow-md gap-2 ${
              isEnterprise 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            <span>Upgrade to {tierName.split(' ')[0]}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
