import {
  LayoutDashboard, Building2, Layers, DoorOpen, BedDouble, Users, CalendarCheck, LogIn, LogOut, Receipt,
  Wallet, MessageSquareWarning, Wrench, UserCheck, BarChart3, UserCog,
  ShieldCheck, Settings, ScrollText, Hotel, Terminal, Sparkles, CreditCard, Activity,
  FileText, Database, ShieldAlert, Home, Headset, ConciergeBell, LifeBuoy, Zap, Package, BellRing
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
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Front Desk Overview', to: '/receptionist/dashboard', icon: ConciergeBell, roles: ['RECEPTIONIST'] },
      { label: 'Security Gate Console', to: '/security/dashboard', icon: ShieldCheck, roles: ['SECURITY_GUARD'] },
      { label: 'Staff Task Hub', to: '/staff/dashboard', icon: Sparkles, roles: ['STAFF'] },
      { label: 'My Space', to: '/tenant/dashboard', icon: Home, roles: ['TENANT'] },
    ],
  },
  {
    title: 'Platform Support',
    items: [
      { label: 'Support Overview', to: '/support/dashboard', icon: Headset, roles: ['SUPPORT'] },
      { label: 'App Support Tickets', to: '/support/tickets', icon: LifeBuoy, roles: ['SUPPORT'] },
      { label: 'Subscriber Directory', to: '/support/subscribers', icon: Sparkles, roles: ['SUPPORT'] },
      { label: 'Onboarding Leads', to: '/support/leads', icon: UserCheck, roles: ['SUPPORT'] },
    ],
  },
  {
    title: 'Platform Administration',
    items: [
      { label: 'Support Escalations', to: '/super-admin/escalations', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
      { label: 'SaaS Subscribers', to: '/super-admin/subscribers', icon: Sparkles, roles: ['SUPER_ADMIN'] },
      { label: 'Global Users', to: '/users', icon: UserCog, roles: ['SUPER_ADMIN'] },
      { label: 'Roles & Permissions', to: '/roles', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
      { label: 'Onboarding Leads', to: '/super-admin/leads', icon: UserCheck, roles: ['SUPER_ADMIN'] },
      { label: 'SaaS Plans & Limits', to: '/super-admin/plans', icon: CreditCard, roles: ['SUPER_ADMIN'] },
      { label: 'Platform Tax Invoices', to: '/super-admin/invoices', icon: FileText, roles: ['SUPER_ADMIN'] },
      { label: 'Tenant Data Backup', to: '/super-admin/backup', icon: Database, roles: ['SUPER_ADMIN'] },
      { label: 'Security & Sessions', to: '/super-admin/sessions', icon: ShieldAlert, roles: ['SUPER_ADMIN'] },
      { label: 'Live API Hit Metrics', to: '/super-admin/api-metrics', icon: Activity, roles: ['SUPER_ADMIN'] },
      { label: 'User Journey & Telemetry', to: '/super-admin/user-tracking', icon: Activity, roles: ['SUPER_ADMIN'] },
      { label: 'Backend System Logs', to: '/super-admin/system-logs', icon: Terminal, roles: ['SUPER_ADMIN'] },
      { label: 'Cloud Infrastructure', to: '/super-admin/integrations', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Properties', to: '/properties', icon: Hotel, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Rooms & Inventory', to: '/rooms', icon: DoorOpen, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Tenants', to: '/tenants', icon: Users, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Parcel & Courier Desk', to: '/parcels', icon: Package, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'SECURITY_GUARD'] },
      { label: 'Lease Agreements', to: '/agreements', icon: ScrollText, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Bookings', to: '/bookings', icon: CalendarCheck, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Check-in', to: '/check-ins', icon: LogIn, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST'] },
      { label: 'Check-out', to: '/check-outs', icon: LogOut, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST'] },
    ],
  },
  {
    title: 'Front Desk & Reception',
    items: [
      { label: 'Parcel Desk', to: '/parcels', icon: Package, roles: ['RECEPTIONIST'] },
      { label: 'Visitor Pass Log', to: '/visitors', icon: UserCheck, roles: ['RECEPTIONIST'] },
      { label: 'Inquiries & Prospects', to: '/bookings', icon: CalendarCheck, roles: ['RECEPTIONIST'] },
    ],
  },
  {
    title: 'Gate & Security',
    items: [
      { label: 'Parcel Deliveries', to: '/parcels', icon: Package, roles: ['SECURITY_GUARD'] },
      { label: 'Gate Pass Verification', to: '/visitors', icon: UserCheck, roles: ['SECURITY_GUARD'] },
      { label: 'Gate Console', to: '/security/dashboard', icon: ShieldCheck, roles: ['SECURITY_GUARD'] },
    ],
  },
  {
    title: 'Housekeeping & Repairs',
    items: [
      { label: 'My Work Orders', to: '/complaints', icon: MessageSquareWarning, roles: ['STAFF'] },
      { label: 'Maintenance Tasks', to: '/maintenance', icon: Wrench, roles: ['STAFF'] },
      { label: 'Room Turnover Status', to: '/staff/dashboard', icon: Sparkles, roles: ['STAFF'] },
    ],
  },
  {
    title: 'Living & Services',
    items: [
      { label: 'Rent & Bills', to: '/tenant/billing', icon: Receipt, roles: ['TENANT'] },
      { label: 'Complaints & Repairs', to: '/complaints', icon: MessageSquareWarning, roles: ['TENANT'] },
      { label: 'Visitor Pass', to: '/visitors', icon: UserCheck, roles: ['TENANT'] },
      { label: 'KYC & Agreement', to: '/tenant/documents', icon: ShieldCheck, roles: ['TENANT'] },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Rent & Billing', to: '/billing', icon: Receipt, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT'] },
      { label: 'Utilities & Meters', to: '/utilities', icon: Zap, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT'] },
      { label: 'Payments', to: '/payments', icon: Wallet, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT'] },
      { label: 'SaaS Subscription', to: '/subscription', icon: Sparkles, roles: ['ADMIN', 'OWNER'] },
    ],
  },
  {
    title: 'Accounting & Finance',
    items: [
      { label: 'Accountant Overview', to: '/accountant/dashboard', icon: LayoutDashboard, roles: ['ACCOUNTANT', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'General Ledger', to: '/accountant/ledger', icon: ScrollText, roles: ['ACCOUNTANT', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'GST & Tax Reports', to: '/accountant/gst-reports', icon: FileText, roles: ['ACCOUNTANT', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER'], badge: 'PRO' },
      { label: 'Security Deposit Ledger', to: '/accountant/security-deposits', icon: Wallet, roles: ['ACCOUNTANT', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Facilities',
    items: [
      { label: 'Complaints', to: '/complaints', icon: MessageSquareWarning, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Maintenance', to: '/maintenance', icon: Wrench, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Visitors', to: '/visitors', icon: UserCheck, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Executive Analytics', to: '/analytics', icon: Activity, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT'] },
      { label: 'Reports', to: '/reports', icon: BarChart3, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
    ],
  },
  {
    title: 'Organization Administration',
    items: [
      { label: 'Users', to: '/users', icon: UserCog, roles: ['ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Notification Logs', to: '/notification-logs', icon: BellRing, roles: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST'] },
      { label: 'Audit Logs', to: '/audit-logs', icon: ScrollText, roles: ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER'] },
      { label: 'Settings', to: '/settings', icon: Settings, roles: ['SUPER_ADMIN', 'SUPPORT', 'ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST', 'SECURITY_GUARD', 'STAFF', 'TENANT'] },
    ],
  },
];

export function filterNavForRole(role: UserRole): NavSection[] {
  const effectiveRoles: UserRole[] = (role === 'OWNER' || role === 'ADMIN')
    ? ['ADMIN', 'OWNER']
    : [role];

  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => 
        !item.roles || item.roles.some((r) => effectiveRoles.includes(r))
      ),
    }))
    .filter((section) => section.items.length > 0);
}
