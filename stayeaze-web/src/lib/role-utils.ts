import type { UserRole } from './types';

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  SUPPORT: 'Platform Support',
  ADMIN: 'Admin (Owner)',
  OWNER: 'Admin (Owner)',
  PROPERTY_MANAGER: 'Property Manager',
  RECEPTIONIST: 'Receptionist',
  ACCOUNTANT: 'Accountant',
  SECURITY_GUARD: 'Security Guard',
  STAFF: 'Maintenance / Staff',
  TENANT: 'Resident / Tenant',
};

export const roleTone: Record<UserRole, 'destructive' | 'info' | 'default'> = {
  SUPER_ADMIN: 'destructive',
  SUPPORT: 'destructive',
  ADMIN: 'info',
  OWNER: 'info',
  PROPERTY_MANAGER: 'default',
  RECEPTIONIST: 'default',
  ACCOUNTANT: 'default',
  SECURITY_GUARD: 'default',
  STAFF: 'default',
  TENANT: 'default',
};

// Modules a role may access (for guards).
export const rolePermissions: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['*'],
  OWNER: ['*'],
  PROPERTY_MANAGER: [
    'dashboard', 'properties', 'buildings', 'floors', 'rooms', 'beds',
    'tenants', 'agreements', 'bookings', 'checkins', 'check-ins', 'checkouts', 'check-outs',
    'billing', 'utilities', 'payments', 'complaints', 'maintenance', 'visitors', 'parcels',
    'analytics', 'reports', 'accountant-dashboard', 'ledger', 'gst-reports', 'security-deposits',
    'users', 'roles', 'audit', 'audit-logs', 'settings'
  ],
  SUPPORT: ['support-dashboard', 'subscribers', 'leads', 'inquiries', 'complaints', 'system-logs', 'api-metrics', 'settings'],
  RECEPTIONIST: ['receptionist-dashboard', 'tenants', 'bookings', 'checkins', 'check-ins', 'checkouts', 'check-outs', 'visitors', 'parcels', 'inquiries', 'settings'],
  ACCOUNTANT: ['accountant-dashboard', 'billing', 'payments', 'ledger', 'gst-reports', 'security-deposits', 'reports', 'settings'],
  SECURITY_GUARD: ['security-dashboard', 'visitors', 'incidents', 'settings'],
  STAFF: ['staff-dashboard', 'complaints', 'maintenance', 'cleaning', 'settings'],
  TENANT: ['tenant-dashboard', 'tenant-billing', 'complaints', 'visitors', 'tenant-documents', 'settings'],
};

export function canAccess(role: UserRole | string, module: string): boolean {
  if (!role) return false;
  const cleanRole = (role.startsWith('ROLE_') ? role.replace('ROLE_', '') : role) as UserRole;
  const perms = rolePermissions[cleanRole] || rolePermissions[role as UserRole];
  if (!perms) return true;
  return perms.includes('*') || perms.includes(module);
}

export function formatRoleName(role: string): string {
  if (!role) return '';
  const cleanRole = (role.startsWith('ROLE_') ? role.replace('ROLE_', '') : role) as UserRole;
  if (cleanRole in roleLabels) {
    return roleLabels[cleanRole];
  }
  if (role in roleLabels) {
    return roleLabels[role as UserRole];
  }
  return role
    .replace('ROLE_', '')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
