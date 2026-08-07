import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { filterNavForRole } from '@/lib/nav';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Property, Tenant, Invoice, User, UserRole } from '@/lib/types';
import {
  Hotel, Users, Receipt, Search, ArrowRight, LayoutDashboard,
  LogIn, LogOut, MessageSquareWarning, Wrench, UserCheck, UserCog,
  ShieldCheck, ScrollText,
} from 'lucide-react';

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

  const role = user?.role;

  // Strict role-gated queries
  const canSeeProperties = role === 'SUPER_ADMIN';
  const canSeeUsers = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const canSeeTenants = role === 'ADMIN' || role === 'PROPERTY_MANAGER' || role === 'RECEPTIONIST';
  const canSeeInvoices = role === 'ADMIN' || role === 'PROPERTY_MANAGER' || role === 'ACCOUNTANT';

  const { data: properties } = useQuery({
    queryKey: ['cmd', 'properties'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { params: { pageSize: 50 } }).then((r) => r.data.data),
    enabled: open && canSeeProperties,
  });

  const { data: usersList } = useQuery({
    queryKey: ['cmd', 'users'],
    queryFn: () => api.get<{ data: User[] }>('/users', { params: { pageSize: 50 } }).then((r) => r.data.data),
    enabled: open && canSeeUsers,
  });

  const { data: tenants } = useQuery({
    queryKey: ['cmd', 'tenants'],
    queryFn: () => api.get<{ data: Tenant[] }>('/tenants', { params: { pageSize: 50 } }).then((r) => r.data.data),
    enabled: open && canSeeTenants,
  });

  const { data: invoices } = useQuery({
    queryKey: ['cmd', 'invoices'],
    queryFn: () => api.get<{ data: Invoice[] }>('/invoices', { params: { pageSize: 50 } }).then((r) => r.data.data),
    enabled: open && canSeeInvoices,
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
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

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

        <CommandSeparator />

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

        {/* Role-gated Properties (SUPER_ADMIN) */}
        {canSeeProperties && properties && properties.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Properties">
              {properties.slice(0, 6).map((p) => (
                <CommandItem key={p.id} onSelect={() => go(`/properties/${p.id}`)} value={`property ${p.name} ${p.code} ${p.city}`}>
                  <Hotel className="mr-2 h-4 w-4" />
                  <span>{p.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Role-gated System Users (SUPER_ADMIN / ADMIN) */}
        {canSeeUsers && usersList && usersList.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Users">
              {usersList.slice(0, 6).map((u) => (
                <CommandItem key={u.id} onSelect={() => go('/users')} value={`user ${u.name} ${u.email} ${u.role}`}>
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>{u.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{u.role}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Role-gated Tenants */}
        {canSeeTenants && tenants && tenants.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tenants">
              {tenants.slice(0, 6).map((t) => (
                <CommandItem key={t.id} onSelect={() => go(`/tenants/${t.id}`)} value={`tenant ${t.name} ${t.email} ${t.roomNumber}`}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>{t.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Room {t.roomNumber}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Role-gated Invoices */}
        {canSeeInvoices && invoices && invoices.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Invoices">
              {invoices.slice(0, 6).map((inv) => (
                <CommandItem key={inv.id} onSelect={() => go('/billing')} value={`invoice ${inv.invoiceNumber} ${inv.tenantName}`}>
                  <Receipt className="mr-2 h-4 w-4" />
                  <span>{inv.invoiceNumber}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{inv.tenantName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
