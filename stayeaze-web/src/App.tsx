import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import api from '@/lib/api';

import LoginPage from '@/features/auth/LoginPage';
import SignUpPage from '@/features/auth/SignUpPage';
import SubscribersPage from '@/features/super-admin/SubscribersPage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import PropertiesPage from '@/features/properties/PropertiesPage';
import PropertyDetailPage from '@/features/properties/PropertyDetailPage';
import BuildingsPage from '@/features/properties/BuildingsPage';
import FloorsPage from '@/features/properties/FloorsPage';
import RoomsPage from '@/features/properties/RoomsPage';
import BedsPage from '@/features/properties/BedsPage';
import TenantsPage from '@/features/tenants/TenantsPage';
import TenantDetailPage from '@/features/tenants/TenantDetailPage';
import BookingsPage from '@/features/bookings/BookingsPage';
import BookingDetailPage from '@/features/bookings/BookingDetailPage';
import CheckInsPage from '@/features/check-in/CheckInsPage';
import CheckOutsPage from '@/features/check-out/CheckOutsPage';
import BillingPage from '@/features/billing/BillingPage';
import PaymentsPage from '@/features/payments/PaymentsPage';
import ComplaintsPage from '@/features/complaints/ComplaintsPage';
import MaintenancePage from '@/features/maintenance/MaintenancePage';
import VisitorsPage from '@/features/visitors/VisitorsPage';
import ReportsPage from '@/features/reports/ReportsPage';
import UsersPage from '@/features/users/UsersPage';
import RolesPage from '@/features/roles/RolesPage';
import SettingsPage from '@/features/settings/SettingsPage';
import AuditLogsPage from '@/features/audit-logs/AuditLogsPage';
import BackendLogsPage from '@/features/super-admin/BackendLogsPage';
import SystemIntegrationsPage from '@/features/super-admin/SystemIntegrationsPage';
import NotFoundPage from '@/features/common/NotFoundPage';

export default function App() {
  const { user, token, hydrate } = useAuthStore();
  const { theme } = useUIStore();
  const location = useLocation();

  // Hydrate session once on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Apply theme class whenever it changes.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // Scroll to top on route change.
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const hasValidSession = !!(user && token && localStorage.getItem('stayeaze_token'));

  // Warm the mock adapter with a harmless request.
  useQuery({
    queryKey: ['warmup'],
    queryFn: () => api.get('/properties/minimal').then(() => true),
    enabled: hasValidSession,
  });

  return (
    <Routes>
      <Route path="/login" element={hasValidSession ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/signup" element={hasValidSession ? <Navigate to="/dashboard" replace /> : <SignUpPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<RequireAuth module="dashboard"><DashboardPage /></RequireAuth>} />
        <Route path="/properties" element={<RequireAuth module="properties"><PropertiesPage /></RequireAuth>} />
        <Route path="/properties/:id" element={<RequireAuth module="properties"><PropertyDetailPage /></RequireAuth>} />
        <Route path="/buildings" element={<RequireAuth module="buildings"><BuildingsPage /></RequireAuth>} />
        <Route path="/floors" element={<RequireAuth module="buildings"><FloorsPage /></RequireAuth>} />
        <Route path="/rooms" element={<RequireAuth module="buildings"><RoomsPage /></RequireAuth>} />
        <Route path="/beds" element={<RequireAuth module="buildings"><BedsPage /></RequireAuth>} />
        <Route path="/tenants" element={<RequireAuth module="tenants"><TenantsPage /></RequireAuth>} />
        <Route path="/tenants/:id" element={<RequireAuth module="tenants"><TenantDetailPage /></RequireAuth>} />
        <Route path="/bookings" element={<RequireAuth module="bookings"><BookingsPage /></RequireAuth>} />
        <Route path="/bookings/:id" element={<RequireAuth module="bookings"><BookingDetailPage /></RequireAuth>} />
        <Route path="/check-ins" element={<RequireAuth module="check-ins"><CheckInsPage /></RequireAuth>} />
        <Route path="/check-outs" element={<RequireAuth module="check-outs"><CheckOutsPage /></RequireAuth>} />
        <Route path="/billing" element={<RequireAuth module="billing"><BillingPage /></RequireAuth>} />
        <Route path="/payments" element={<RequireAuth module="payments"><PaymentsPage /></RequireAuth>} />
        <Route path="/complaints" element={<RequireAuth module="complaints"><ComplaintsPage /></RequireAuth>} />
        <Route path="/maintenance" element={<RequireAuth module="maintenance"><MaintenancePage /></RequireAuth>} />
        <Route path="/visitors" element={<RequireAuth module="visitors"><VisitorsPage /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth module="reports"><ReportsPage /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth module="users"><UsersPage /></RequireAuth>} />
        <Route path="/roles" element={<RequireAuth module="roles"><RolesPage /></RequireAuth>} />
        <Route path="/audit-logs" element={<RequireAuth module="audit-logs"><AuditLogsPage /></RequireAuth>} />
        <Route path="/super-admin/subscribers" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SubscribersPage /></RequireAuth>} />
        <Route path="/super-admin/system-logs" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><BackendLogsPage /></RequireAuth>} />
        <Route path="/super-admin/integrations" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SystemIntegrationsPage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth module="settings"><SettingsPage /></RequireAuth>} />
      </Route>

      <Route path="/" element={<Navigate to={hasValidSession ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
