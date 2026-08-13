import {
  LayoutDashboard, Building2, Layers, DoorOpen, BedDouble, Users, CalendarCheck, LogIn, LogOut, Receipt,
  Wallet, MessageSquareWarning, Wrench, UserCheck, BarChart3, UserCog,
  ShieldCheck, Settings, ScrollText, Hotel, Terminal,
} from 'lucide-react';
import type { UserRole } from '@/lib/types';

export interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Properties', to: '/properties', icon: Hotel, roles: ['SUPER_ADMIN'] },
      { label: 'Buildings', to: '/buildings', icon: Building2, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Floors', to: '/floors', icon: Layers, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Rooms', to: '/rooms', icon: DoorOpen, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Beds', to: '/beds', icon: BedDouble, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Tenants', to: '/tenants', icon: Users, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Bookings', to: '/bookings', icon: CalendarCheck, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Check-in', to: '/check-ins', icon: LogIn, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Check-out', to: '/check-outs', icon: LogOut, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Rent & Billing', to: '/billing', icon: Receipt, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Payments', to: '/payments', icon: Wallet, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Facilities',
    items: [
      { label: 'Complaints', to: '/complaints', icon: MessageSquareWarning, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Maintenance', to: '/maintenance', icon: Wrench, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
      { label: 'Visitors', to: '/visitors', icon: UserCheck, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports', to: '/reports', icon: BarChart3, roles: ['ADMIN', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Users', to: '/users', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN', 'OWNER'] },
      { label: 'Roles', to: '/roles', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
      { label: 'SaaS Subscribers', to: '/super-admin/subscribers', icon: Sparkles, roles: ['SUPER_ADMIN'] },
      { label: 'Audit Logs', to: '/audit-logs', icon: ScrollText, roles: ['SUPER_ADMIN', 'ADMIN', 'OWNER'] },
      { label: 'Backend System Logs', to: '/super-admin/system-logs', icon: Terminal, roles: ['SUPER_ADMIN'] },
      { label: 'Cloud Infrastructure', to: '/super-admin/integrations', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
      { label: 'Settings', to: '/settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST', 'SECURITY_GUARD', 'STAFF', 'TENANT'] },
    ],
  },
];

export function filterNavForRole(role: UserRole): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);
}
