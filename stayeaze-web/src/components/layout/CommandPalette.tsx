import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { filterNavForRole } from '@/lib/nav';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePropertyStore } from '@/lib/stores/property-store';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { UserRole } from '@/lib/types';
import {
  Hotel, Users, Receipt, ArrowRight, LayoutDashboard,
  LogIn, LogOut, MessageSquareWarning, Wrench, UserCheck, UserCog,
  ShieldCheck, ScrollText, Building2, Globe, Check, DoorOpen,
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const allQuickActions: QuickActionItem[] = [
  { label: 'Go to Dashboard', to: '/dashboard', icon: LayoutDashboard },
  // SuperAdmin Platform Management
  { label: 'Add New Property', to: '/properties', icon: Hotel, roles: ['SUPER_ADMIN'] },
  { label: 'Manage Users', to: '/users', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { label: 'Role Permissions', to: '/roles', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  { label: 'View Audit Logs', to: '/audit-logs', icon: ScrollText, roles: ['SUPER_ADMIN', 'ADMIN'] },

  // Property Admin / Owner / Manager Operations
  { label: 'Rooms & Space Matrix', to: '/rooms', icon: DoorOpen, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
  { label: 'Add New Tenant', to: '/tenants', icon: Users, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
  { label: 'New Check-in', to: '/check-ins', icon: LogIn, roles: ['ADMIN', 'PROPERTY_MANAGER', 'RECEPTIONIST'] },
  { label: 'New Check-out', to: '/check-outs', icon: LogOut, roles: ['ADMIN', 'PROPERTY_MANAGER', 'RECEPTIONIST'] },
  { label: 'Create Invoice', to: '/billing', icon: Receipt, roles: ['ADMIN', 'PROPERTY_MANAGER', 'ACCOUNTANT'] },
  { label: 'Log Complaint', to: '/complaints', icon: MessageSquareWarning, roles: ['ADMIN', 'PROPERTY_MANAGER', 'STAFF', 'TENANT'] },
  { label: 'New Maintenance Task', to: '/maintenance', icon: Wrench, roles: ['ADMIN', 'PROPERTY_MANAGER', 'STAFF'] },
  { label: 'Log Visitor', to: '/visitors', icon: UserCheck, roles: ['ADMIN', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD'] },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { selectedPropertyId, setSelectedPropertyId } = usePropertyStore();
  const [searchTerm, setSearchTerm] = useState('');

  const role = user?.role;
  const isOrgUser = role && role !== 'SUPER_ADMIN' && role !== 'SUPPORT' && role !== 'TENANT';

  // Lightweight Property list for quick switching
  const { data: orgProperties } = useQuery<any[]>({
    queryKey: ['cmd', 'org-properties'],
    queryFn: () => api.get('/properties/minimal').then((r) => Array.isArray(r.data) ? r.data : (r.data as any).data || []),
    enabled: open && !!isOrgUser,
  });

  // Fast Omni Search Query
  const { data: omniResults } = useQuery<{
    properties: any[];
    tenants: any[];
    rooms: any[];
    invoices: any[];
    users: any[];
  }>({
    queryKey: ['cmd', 'omni-search', searchTerm],
    queryFn: () => api.get('/search/omni', { params: { q: searchTerm } }).then((r) => r.data),
    enabled: open && searchTerm.trim().length > 1,
    staleTime: 5000,
  });

  const navSections = user ? filterNavForRole(user.role) : [];
  const allowedQuickActions = role
    ? allQuickActions.filter((a) => !a.roles || a.roles.includes(role))
    : allQuickActions.filter((a) => !a.roles);

  function go(to: string) {
    navigate(to);
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a command, room #, resident name, or search..."
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        <CommandEmpty>No matching results.</CommandEmpty>

        {/* Real-time Omni-Search Results */}
        {searchTerm.trim().length > 1 && omniResults && (
          <>
            {omniResults.tenants && omniResults.tenants.length > 0 && (
              <CommandGroup heading="Residents & Tenants">
                {omniResults.tenants.map((t: any) => (
                  <CommandItem key={t.id} onSelect={() => go(t.url)} value={`tenant ${t.title} ${t.subtitle}`}>
                    <Users className="mr-2 h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{t.title}</span>
                      <span className="text-xs text-muted-foreground">{t.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {omniResults.rooms && omniResults.rooms.length > 0 && (
              <CommandGroup heading="Rooms & Inventory">
                {omniResults.rooms.map((r: any) => (
                  <CommandItem key={r.id} onSelect={() => go(r.url)} value={`room ${r.title} ${r.subtitle}`}>
                    <DoorOpen className="mr-2 h-4 w-4 text-emerald-500" />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{r.title}</span>
                      <span className="text-xs text-muted-foreground">{r.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {omniResults.invoices && omniResults.invoices.length > 0 && (
              <CommandGroup heading="Invoices & Dues">
                {omniResults.invoices.map((inv: any) => (
                  <CommandItem key={inv.id} onSelect={() => go(inv.url)} value={`invoice ${inv.title} ${inv.subtitle}`}>
                    <Receipt className="mr-2 h-4 w-4 text-amber-500" />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{inv.title}</span>
                      <span className="text-xs text-muted-foreground">{inv.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {omniResults.properties && omniResults.properties.length > 0 && (
              <CommandGroup heading="Properties">
                {omniResults.properties.map((p: any) => (
                  <CommandItem key={p.id} onSelect={() => go(p.url)} value={`property ${p.title} ${p.subtitle}`}>
                    <Hotel className="mr-2 h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{p.title}</span>
                      <span className="text-xs text-muted-foreground">{p.subtitle}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />
          </>
        )}

        {/* Quick actions */}
        {allowedQuickActions.length > 0 && (
          <CommandGroup heading="Quick Actions">
            {allowedQuickActions.map((action) => (
              <CommandItem key={action.label} onSelect={() => go(action.to)} value={`action ${action.label}`}>
                <action.icon className="mr-2 h-4 w-4" />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Property Switching for Org Users */}
        {isOrgUser && orgProperties && orgProperties.length > 0 && (
          <>
            <CommandGroup heading="Switch Active Property">
              <CommandItem
                onSelect={() => {
                  setSelectedPropertyId('ALL', null);
                  onOpenChange(false);
                  toast.success('Switched to All Properties (Aggregate)');
                }}
                value="switch property all aggregate"
              >
                <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>All Properties (Aggregate)</span>
                {selectedPropertyId === 'ALL' && (
                  <Check className="ml-auto h-4 w-4 text-primary" />
                )}
              </CommandItem>
              {orgProperties.map((p: any) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => {
                    setSelectedPropertyId(p.id, p);
                    onOpenChange(false);
                    toast.success(`Switched to ${p.name}`);
                  }}
                  value={`switch property ${p.name} ${p.code || ''} ${p.city || ''}`}
                >
                  <Building2 className="mr-2 h-4 w-4 text-primary" />
                  <span>{p.name}</span>
                  {p.city && <span className="ml-2 text-xs text-muted-foreground">• {p.city}</span>}
                  {selectedPropertyId === p.id && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Role-filtered Navigation */}
        {navSections.map((section) => (
          <CommandGroup key={section.title} heading={section.title}>
            {section.items.map((item) => (
              <CommandItem key={item.to} onSelect={() => go(item.to)} value={`nav ${item.label}`}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-40" />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
