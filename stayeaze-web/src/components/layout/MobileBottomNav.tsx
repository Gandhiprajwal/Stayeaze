import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BedDouble, Users, ReceiptText, MoreHorizontal,
  FileText, ShieldCheck, Terminal, CreditCard, MessageSquareWarning
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  onOpenMoreMenu: () => void;
}

export function MobileBottomNav({ onOpenMoreMenu }: MobileBottomNavProps) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;

  const isTenant = user.role === 'TENANT';
  const isSuperAdmin = user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT';

  const tenantNavItems = [
    { label: 'My Space', to: '/tenant/dashboard', icon: LayoutDashboard },
    { label: 'Billing', to: '/tenant/billing', icon: ReceiptText },
    { label: 'Complaints', to: '/complaints', icon: MessageSquareWarning },
    { label: 'Documents', to: '/tenant/documents', icon: ShieldCheck },
  ];

  const adminNavItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Rooms', to: '/rooms', icon: BedDouble },
    { label: 'Residents', to: '/tenants', icon: Users },
    { label: 'Billing', to: '/billing', icon: ReceiptText },
  ];

  const superAdminNavItems = [
    { label: 'Subscribers', to: '/super-admin/subscribers', icon: LayoutDashboard },
    { label: 'SaaS Plans', to: '/super-admin/plans', icon: CreditCard },
    { label: 'Invoices', to: '/super-admin/invoices', icon: ReceiptText },
    { label: 'System Logs', to: '/super-admin/system-logs', icon: Terminal },
  ];

  const activeNavItems = isTenant ? tenantNavItems : (isSuperAdmin ? superAdminNavItems : adminNavItems);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pointer-events-none">
      <nav className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-2xl shadow-primary/5 px-2 py-1.5 flex items-center justify-around">
        {activeNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: linkActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 text-xs font-medium relative',
                  linkActive || isActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground active:scale-95'
                )
              }
            >
              {({ isActive: linkActive }) => (
                <>
                  <div className={cn(
                    'p-1 rounded-lg transition-all duration-200',
                    (linkActive || isActive) && 'bg-primary/10 scale-110 shadow-sm shadow-primary/20'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="mt-0.5 text-[10px] tracking-tight">{item.label}</span>
                  {(linkActive || isActive) && (
                    <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* More Drawer Button */}
        <button
          type="button"
          onClick={onOpenMoreMenu}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-muted-foreground hover:text-foreground active:scale-95 transition-all duration-200 text-xs font-medium"
        >
          <div className="p-1 rounded-lg">
            <MoreHorizontal className="h-5 w-5" />
          </div>
          <span className="mt-0.5 text-[10px] tracking-tight">Menu</span>
        </button>
      </nav>
    </div>
  );
}
