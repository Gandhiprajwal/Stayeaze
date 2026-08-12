import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Hotel, ChevronLeft, ChevronRight, Menu, Search, Sun, Moon, LogOut,
  Settings as SettingsIcon, UserCog, Command, RotateCcw,
} from 'lucide-react';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { filterNavForRole } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } = useUIStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [resetDbOpen, setResetDbOpen] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);

  const { data: orgProfile } = useQuery({
    queryKey: ['org-billing-profile-onboarding'],
    queryFn: () => api.get<any>('/organization-billing-profile').then((r) => r.data),
    enabled: !!user && (user.role === 'OWNER' || user.role === 'ADMIN'),
  });

  const sections = user ? filterNavForRole(user.role) : [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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

  const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className={cn('flex h-16 items-center gap-2.5 border-b border-white/10 px-4', sidebarCollapsed && 'justify-center px-2')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Hotel className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="font-heading text-base font-bold leading-none tracking-tight">StayEaze</p>
            <p className="mt-0.5 text-[11px] text-white/50">Management Console</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto py-4 scrollbar-thin">
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
                  <item.icon className="h-4.5 w-4.5 h-5 w-5 shrink-0" />
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 transition-all duration-200 lg:block',
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-card px-4 sm:px-6">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          </Sheet>

          {/* Search — opens command palette */}
          <button
            onClick={() => setCmdOpen(true)}
            className="relative hidden max-w-md flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex"
          >
            <Search className="h-4 w-4" />
            <span>
              {user?.role === 'SUPER_ADMIN'
                ? 'Search properties, users, roles...'
                : ['ADMIN', 'PROPERTY_MANAGER', 'RECEPTIONIST'].includes(user?.role ?? '')
                ? 'Search tenants, rooms, check-ins, invoices...'
                : user?.role === 'ACCOUNTANT'
                ? 'Search invoices, payments, billing...'
                : 'Search pages & features...'}
            </span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:flex">
              <Command className="h-3 w-3" /> K
            </kbd>
          </button>

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
                <DropdownMenuItem disabled>
                  <UserCog className="mr-2 h-4 w-4" /> My Profile
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

        {/* Organization Onboarding Guard Banner */}
        {orgProfile && !orgProfile.isSetupComplete && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-900 dark:text-amber-200 shrink-0">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 text-xs font-medium sm:text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>Organization Setup Required:</strong> Please complete your organization legal name, address, and Razorpay credentials to enable full feature access.
                </span>
              </div>
              <Button size="sm" className="h-7 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0" onClick={() => navigate('/settings?tab=organization')}>
                Complete Setup
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

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
    </div>
  );
}

void Separator;
