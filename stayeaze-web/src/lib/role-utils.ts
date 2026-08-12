import type { UserRole } from './types';

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin (Owner)',
  OWNER: 'Property Owner',
  PROPERTY_MANAGER: 'Property Manager',
  RECEPTIONIST: 'Receptionist',
  ACCOUNTANT: 'Accountant',
  SECURITY_GUARD: 'Security Guard',
  STAFF: 'Support Staff',
  TENANT: 'Tenant',
};

export const roleTone: Record<UserRole, 'destructive' | 'info' | 'default'> = {
  SUPER_ADMIN: 'destructive',
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
  SUPER_ADMIN: ['dashboard', 'properties', 'users', 'roles', 'audit-logs', 'integrations', 'settings'],
  ADMIN: ['dashboard', 'buildings', 'tenants', 'bookings', 'check-ins', 'check-outs', 'billing', 'payments', 'complaints', 'maintenance', 'visitors', 'reports', 'users', 'audit-logs', 'settings'],
  OWNER: ['dashboard', 'buildings', 'tenants', 'bookings', 'check-ins', 'check-outs', 'billing', 'payments', 'complaints', 'maintenance', 'visitors', 'reports', 'users', 'audit-logs', 'settings'],
  PROPERTY_MANAGER: ['dashboard', 'buildings', 'tenants', 'bookings', 'check-ins', 'check-outs', 'billing', 'payments', 'complaints', 'maintenance', 'visitors', 'reports', 'settings'],  RECEPTIONIST: ['dashboard', 'tenants', 'bookings', 'check-ins', 'check-outs', 'visitors', 'settings'],
  ACCOUNTANT: ['dashboard', 'billing', 'payments', 'reports', 'settings'],
  SECURITY_GUARD: ['visitors', 'settings'],
  STAFF: ['complaints', 'maintenance', 'settings'],
  TENANT: ['complaints', 'settings'],
};

export function canAccess(role: UserRole, module: string): boolean {
  const perms = rolePermissions[role];
  return perms.includes('*') || perms.includes(module);
}

export function formatRoleName(role: string): string {
  if (role in roleLabels) {
    return roleLabels[role as UserRole];
  }
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
