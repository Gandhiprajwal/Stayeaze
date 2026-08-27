import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Hotel, ChevronLeft, ChevronRight, Menu, Search, Sun, Moon, LogOut,
  Settings as SettingsIcon, UserCog, Command, RotateCcw, Wrench, ShieldAlert, AlertTriangle, LifeBuoy, WifiOff,
} from 'lucide-react';
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { filterNavForRole } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { initials } from '@/lib/format';
import { roleLabels } from '@/lib/role-utils';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { MobileBottomNav } from './MobileBottomNav';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';

import { useQuery } from '@tanstack/react-query';

import { WorkspaceLockedModal } from '@/components/subscription/WorkspaceLockedModal';
import { OrganizationSetupGuardModal } from '@/components/subscription/OrganizationSetupGuardModal';
import { RaiseSupportTicketModal } from '@/components/support/RaiseSupportTicketModal';
import { SubscriptionStatusBanner } from '@/components/common/SubscriptionStatusBanner';
import { PropertySwitcher } from './PropertySwitcher';

import { useBranding } from '@/lib/branding-context';

interface SidebarContentProps {
  sidebarCollapsed: boolean;
  brandLogo: string | null;
  brandName: string;
  isWhiteLabeled: boolean;
  brandTagline?: string | null;
  sections: Array<{
    title: string;
    items: Array<{
      to: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string | number;
    }>;
  }>;
  toggleSidebar: () => void;
  onNavigate?: () => void;
}

function SidebarContent({
  sidebarCollapsed,
  brandLogo,
  brandName,
  isWhiteLabeled,
  brandTagline,
  sections,
  toggleSidebar,
  onNavigate,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className={cn('flex h-16 items-center gap-2.5 border-b border-white/10 px-4', sidebarCollapsed && 'justify-center px-2')}>
        {brandLogo ? (
          <img src={brandLogo} alt={brandName} className="h-9 w-9 rounded-lg object-contain bg-white/10 p-0.5" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Hotel className="h-5 w-5" />
          </div>
        )}
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-heading text-base font-bold leading-none tracking-tight truncate">{brandName}</p>
            <p className="mt-0.5 text-[11px] text-white/50 truncate">
              {isWhiteLabeled && brandTagline ? brandTagline : 'Management Console'}
            </p>
          </div>
        )}
      </div>

      {/* Nav with naturally preserved scroll position & independent scrollbar */}
      <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden py-4 sidebar-scrollbar">
        {sections.map((section) => (
          <div key={section.title} className="px-3">
            {!sidebarCollapsed && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                      sidebarCollapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!sidebarCollapsed && item.badge && (
                    <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">{item.badge}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden border-t border-white/10 p-2 lg:block">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full justify-center text-white/70 hover:bg-white/10 hover:text-white"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
        </Button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useUIStore();
  const { brandName, brandLogo, branding, isWhiteLabeled } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [resetDbOpen, setResetDbOpen] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);

  const isOnline = useOnlineStatus();

  const { data: maintenanceData } = useQuery({
    queryKey: ['platform-maintenance-status'],
    queryFn: () => api.get<any>('/auth/maintenance-status').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isMaintenanceMode = maintenanceData?.maintenanceModeEnabled;
  const maintenanceMessage = maintenanceData?.maintenanceMessage || 'StayEaze is undergoing scheduled maintenance. We will be back shortly.';

  const isPlatformOrTenant = user?.role === 'SUPER_ADMIN' || user?.role === 'SUPPORT' || user?.role === 'TENANT';

  const { data: orgProfile } = useQuery({
    queryKey: ['org-billing-profile-onboarding'],
    queryFn: () => api.get<any>('/organization-billing-profile').then((r) => r.data),
    enabled: !!user && !isPlatformOrTenant,
  });

  const isSetupIncomplete = !!orgProfile && !orgProfile.isSetupComplete && !isPlatformOrTenant;
  const isSetupGuardOpen = isSetupIncomplete && !location.pathname.startsWith('/settings') && !location.pathname.startsWith('/subscription');

  const { data: subDetails } = useQuery<any>({
    queryKey: ['my-subscription-details-app-layout'],
    queryFn: () => api.get('/subscription/my-subscription').then((r) => r.data),
    enabled: !!user && !isPlatformOrTenant,
  });

  const isGraceExpired = subDetails?.endDate ? (new Date(subDetails.endDate).getTime() + 3 * 86400000) < Date.now() : false;
  const subStatus = (orgProfile?.subscriptionStatus || subDetails?.status || '').toUpperCase();
  const isSubStatusLocked = subStatus === 'PAYMENT_LOCKED' || subStatus === 'SUSPENDED' || subStatus === 'EXPIRED';
  const isWorkspaceLocked = (isGraceExpired || isSubStatusLocked) && !isPlatformOrTenant && !location.pathname.startsWith('/subscription');

  const sections = user ? filterNavForRole(user.role) : [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (isMaintenanceMode && user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-center text-white">
        <div className="mx-auto max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-8 shadow-2xl backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
            <Wrench className="h-8 w-8 animate-bounce" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <ShieldAlert className="h-3.5 w-3.5" /> Maintenance Mode Active
            </span>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-100">
              System Under Maintenance
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {maintenanceMessage}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs text-slate-400">
            <p className="font-semibold text-slate-300">Expected Resolution</p>
            <p className="mt-1">Our engineering team is conducting scheduled system updates. Services will resume shortly.</p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Button variant="outline" onClick={() => window.location.reload()} className="w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800">
              Refresh Page
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="w-full text-xs text-slate-500 hover:text-slate-300">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out of Console
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleResetDatabase = async () => {
    setResettingDb(true);
    try {
      await api.post('/super-admin/reset-database');
      toast({
        title: 'Database Reset Successfully',
        description: 'All operational data has been purged. Fresh empty environment initialized.',
      });
      setResetDbOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast({
        title: 'Reset Failed',
        description: e?.response?.data?.message || 'Failed to reset database.',
        variant: 'destructive',
      });
    } finally {
      setResettingDb(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 transition-all duration-200 lg:flex lg:flex-col h-full overflow-hidden border-r border-white/10',
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <SidebarContent
          sidebarCollapsed={sidebarCollapsed}
          brandLogo={brandLogo}
          brandName={brandName}
          isWhiteLabeled={isWhiteLabeled}
          brandTagline={branding?.brandTagline}
          sections={sections}
          toggleSidebar={toggleSidebar}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            sidebarCollapsed={false}
            brandLogo={brandLogo}
            brandName={brandName}
            isWhiteLabeled={isWhiteLabeled}
            brandTagline={branding?.brandTagline}
            sections={sections}
            toggleSidebar={toggleSidebar}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
        <SubscriptionStatusBanner />
        {isMaintenanceMode && user?.role === 'SUPER_ADMIN' && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 animate-spin" />
              <span>PLATFORM MAINTENANCE MODE IS ACTIVE: Non-superadmin access is currently locked out.</span>
            </div>
            <Link to="/settings?tab=saas-invoicing" className="underline hover:text-slate-900 font-extrabold ml-4">
              Manage Settings & Turn Off →
            </Link>
          </div>
        )}
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
          {/* Mobile menu trigger */}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>

          {/* Mobile search trigger button */}
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden text-muted-foreground hover:text-foreground rounded-xl h-9.5 w-9.5"
            onClick={() => setCmdOpen(true)}
            aria-label="Open search palette"
          >
            <Search className="h-4.5 w-4.5" />
          </Button>

          {/* Desktop/Tablet Search bar — opens command palette */}
          <button
            onClick={() => setCmdOpen(true)}
            className="relative hidden sm:flex items-center gap-2.5 rounded-xl border border-border/80 bg-background/90 px-3.5 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:border-primary/40 w-64 md:w-80 lg:w-96 shadow-xs"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs sm:text-sm">
              {user?.role === 'SUPER_ADMIN'
                ? 'Search properties, users, roles...'
                : ['ADMIN', 'PROPERTY_MANAGER', 'RECEPTIONIST'].includes(user?.role ?? '')
                ? 'Search tenants, rooms, check-ins...'
                : user?.role === 'ACCOUNTANT'
                ? 'Search invoices, payments...'
                : 'Search pages & features...'}
            </span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded-lg border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground lg:flex shrink-0">
              <Command className="h-3 w-3" /> K
            </kbd>
          </button>

          {/* Global Property Switcher */}
          <PropertySwitcher />

          <div className="ml-auto flex items-center gap-2">
            {/* Super Admin Reset DB Topbar Button */}
            {user?.role === 'SUPER_ADMIN' && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5 font-medium shadow-sm"
                onClick={() => setResetDbOpen(true)}
                title="Reset Database to clean empty state"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Reset DB</span>
              </Button>
            )}

            {/* Help & Support Button */}
            {user?.role !== 'SUPER_ADMIN' && user?.role !== 'SUPPORT' && (
              <RaiseSupportTicketModal
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
                    title="Raise Platform Support Ticket"
                  >
                    <LifeBuoy className="h-4 w-4 text-indigo-500" />
                    <span>Support</span>
                  </Button>
                }
              />
            )}

            {/* Notification bell */}
            <NotificationBell />

            {/* Theme toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent">
                  <Avatar className="h-8 w-8">
                    {user?.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {user ? initials(user.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{user ? roleLabels[user.role] : ''}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{user?.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setSupportModalOpen(true)}>
                  <LifeBuoy className="mr-2 h-4 w-4 text-indigo-500" /> Platform Support
                </DropdownMenuItem>
                {user?.role === 'SUPER_ADMIN' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={() => setResetDbOpen(true)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Reset Database
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Offline Status Warning Banner */}
        {!isOnline && (
          <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2 text-destructive dark:text-red-400 shrink-0 sticky top-16 z-30 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 text-xs font-semibold sm:text-sm">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 shrink-0 animate-pulse" />
                <span>You are currently offline. Changes made while offline will synchronize automatically when your internet reconnects.</span>
              </div>
              <span className="hidden sm:inline-block text-[11px] bg-destructive/20 px-2 py-0.5 rounded-full font-bold">
                Offline Mode
              </span>
            </div>
          </div>
        )}

        {/* Organization Onboarding Guard Banner */}
        {isSetupIncomplete && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-900 dark:text-amber-200 shrink-0">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 text-xs font-medium sm:text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Organization Setup Required ({orgProfile?.completionPercentage || 0}% complete):</strong> Features are locked until required details are saved.
                </span>
                {Array.isArray(orgProfile?.missingFields) && orgProfile.missingFields.length > 0 && (
                  <div className="hidden md:flex items-center gap-1.5 ml-1">
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">Missing:</span>
                    {orgProfile.missingFields.slice(0, 3).map((f: string, idx: number) => (
                      <span key={idx} className="bg-amber-200/60 dark:bg-amber-900/50 text-amber-950 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                        {f}
                      </span>
                    ))}
                    {orgProfile.missingFields.length > 3 && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        +{orgProfile.missingFields.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
                <Button size="sm" className="h-7 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 shadow-sm" onClick={() => navigate('/settings?tab=organization')}>
                  Complete Setup & Unlock
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Content with independent scrollbar */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full max-w-full main-page-scrollbar">
          <div className="mx-auto max-w-[1720px] w-full p-3 sm:p-6 lg:p-8 pb-20 md:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav onOpenMoreMenu={() => setMobileOpen(true)} />

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />

      <ConfirmDialog
        open={resetDbOpen}
        onOpenChange={setResetDbOpen}
        title="Reset Database to Fresh Empty State?"
        description="This action will permanently delete all properties, buildings, floors, rooms, beds, tenants, bookings, invoices, payments, and operational records. The system will start fresh with default Super Admin credentials."
        confirmLabel="Yes, Reset Database"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleResetDatabase}
        loading={resettingDb}
      />

      <WorkspaceLockedModal
        open={isWorkspaceLocked}
        expiryDate={subDetails?.endDate ? new Date(subDetails.endDate).toLocaleDateString('en-IN') : undefined}
        isAdmin={user?.role === 'OWNER' || user?.role === 'ADMIN'}
      />

      <OrganizationSetupGuardModal
        open={isSetupGuardOpen}
        missingFields={orgProfile?.missingFields}
        completionPercentage={orgProfile?.completionPercentage}
        isAdmin={user?.role === 'OWNER' || user?.role === 'ADMIN'}
      />

      <RaiseSupportTicketModal
        open={supportModalOpen}
        onOpenChange={setSupportModalOpen}
      />
    </div>
  );
}
