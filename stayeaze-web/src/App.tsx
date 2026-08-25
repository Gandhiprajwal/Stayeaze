import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/lib/stores/auth-store';
import { useUIStore } from '@/lib/stores/ui-store';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlobalLoader } from '@/components/common/GlobalLoader';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { BrandingProvider } from '@/lib/branding-context';
import { WebSocketProvider } from '@/lib/websocket/WebSocketProvider';
import api from '@/lib/api';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const SignUpPage = lazy(() => import('@/features/auth/SignUpPage'));
const PublicTenantOnboardingPage = lazy(() => import('@/features/public/PublicTenantOnboardingPage'));
const HomePage = lazy(() => import('@/features/public/HomePage'));
const AboutPage = lazy(() => import('@/features/public/AboutPage'));
const ContactPage = lazy(() => import('@/features/public/ContactPage'));
const PricingPage = lazy(() => import('@/features/public/PricingPage'));
const FaqPage = lazy(() => import('@/features/public/FaqPage'));
const TermsPage = lazy(() => import('@/features/public/TermsPage'));
const PrivacyPage = lazy(() => import('@/features/public/PrivacyPage'));
const SubscribersPage = lazy(() => import('@/features/super-admin/SubscribersPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const PropertiesPage = lazy(() => import('@/features/properties/PropertiesPage'));
const PropertyDetailPage = lazy(() => import('@/features/properties/PropertyDetailPage'));
const BuildingsPage = lazy(() => import('@/features/properties/BuildingsPage'));
const FloorsPage = lazy(() => import('@/features/properties/FloorsPage'));
const RoomsPage = lazy(() => import('@/features/properties/RoomsPage'));
const BedsPage = lazy(() => import('@/features/properties/BedsPage'));
const TenantsPage = lazy(() => import('@/features/tenants/TenantsPage'));
const TenantDetailPage = lazy(() => import('@/features/tenants/TenantDetailPage'));
const BookingsPage = lazy(() => import('@/features/bookings/BookingsPage'));
const BookingDetailPage = lazy(() => import('@/features/bookings/BookingDetailPage'));
const CheckInsPage = lazy(() => import('@/features/check-in/CheckInsPage'));
const CheckOutsPage = lazy(() => import('@/features/check-out/CheckOutsPage'));
const BillingPage = lazy(() => import('@/features/billing/BillingPage'));
const UtilitiesPage = lazy(() => import('@/features/utilities/UtilitiesPage'));
const SubscriptionPage = lazy(() => import('@/features/subscription/SubscriptionPage'));
const PaymentsPage = lazy(() => import('@/features/payments/PaymentsPage'));
const ComplaintsPage = lazy(() => import('@/features/complaints/ComplaintsPage'));
const MaintenancePage = lazy(() => import('@/features/maintenance/MaintenancePage'));
const VisitorsPage = lazy(() => import('@/features/visitors/VisitorsPage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const RolesPage = lazy(() => import('@/features/roles/RolesPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const AuditLogsPage = lazy(() => import('@/features/audit-logs/AuditLogsPage'));
const BackendLogsPage = lazy(() => import('@/features/super-admin/BackendLogsPage'));
import OfflinePage from '@/features/common/OfflinePage';

const SystemIntegrationsPage = lazy(() => import('@/features/super-admin/SystemIntegrationsPage'));
const SaaSPlansPage = lazy(() => import('@/features/super-admin/SaaSPlansPage'));
const SuperAdminApiMetricsPage = lazy(() => import('@/features/super-admin/SuperAdminApiMetricsPage'));
const SaaSInvoicesPage = lazy(() => import('@/features/super-admin/SaaSInvoicesPage'));
const DataBackupPage = lazy(() => import('@/features/super-admin/DataBackupPage'));
const SecuritySessionsPage = lazy(() => import('@/features/super-admin/SecuritySessionsPage'));
const SuperAdminLeadsPage = lazy(() => import('@/features/super-admin/SuperAdminLeadsPage'));
const SuperAdminEscalationsPage = lazy(() => import('@/features/super-admin/SuperAdminEscalationsPage'));
const UserJourneyTrackingPage = lazy(() => import('@/features/super-admin/UserJourneyTrackingPage'));
const NotFoundPage = lazy(() => import('@/features/common/NotFoundPage'));
const SystemMaintenancePage = lazy(() => import('@/features/common/MaintenancePage'));

const AccountantDashboardPage = lazy(() => import('@/features/accountant/AccountantDashboardPage'));
const FinancialLedgerPage = lazy(() => import('@/features/accountant/FinancialLedgerPage'));
const GstTaxReportsPage = lazy(() => import('@/features/accountant/GstTaxReportsPage'));
const SecurityDepositLedgerPage = lazy(() => import('@/features/accountant/SecurityDepositLedgerPage'));

const TenantDashboardPage = lazy(() => import('@/features/tenant-portal/TenantDashboardPage'));
const TenantBillingPage = lazy(() => import('@/features/tenant-portal/TenantBillingPage'));
const TenantDocumentsPage = lazy(() => import('@/features/tenant-portal/TenantDocumentsPage'));

const SupportDashboardPage = lazy(() => import('@/features/support/SupportDashboardPage'));
const SupportTicketsPage = lazy(() => import('@/features/support/SupportTicketsPage'));
const SupportSubscribersPage = lazy(() => import('@/features/support/SupportSubscribersPage'));
const SupportLeadsPage = lazy(() => import('@/features/support/SupportLeadsPage'));
const ReceptionistDashboardPage = lazy(() => import('@/features/receptionist/ReceptionistDashboardPage'));
const SecurityGuardDashboardPage = lazy(() => import('@/features/security/SecurityGuardDashboardPage'));
const StaffDashboardPage = lazy(() => import('@/features/staff/StaffDashboardPage'));

function getRoleDefaultLanding(role?: string): string {
  switch (role) {
    case 'TENANT':
      return '/tenant/dashboard';
    case 'SUPPORT':
      return '/support/dashboard';
    case 'ACCOUNTANT':
      return '/accountant/dashboard';
    case 'RECEPTIONIST':
      return '/receptionist/dashboard';
    case 'SECURITY_GUARD':
      return '/security/dashboard';
    case 'STAFF':
      return '/staff/dashboard';
    case 'SUPER_ADMIN':
      return '/super-admin/subscribers';
    case 'ADMIN':
    case 'OWNER':
    case 'PROPERTY_MANAGER':
    default:
      return '/dashboard';
  }
}

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
  const landingRoute = getRoleDefaultLanding(user?.role);

  // Warm the mock adapter with a harmless request.
  useQuery({
    queryKey: ['warmup'],
    queryFn: () => api.get('/properties/minimal').then(() => true),
    enabled: hasValidSession,
  });

  return (
    <ErrorBoundary>
      <BrandingProvider>
        <WebSocketProvider>
          <OfflineBanner />
          <Suspense fallback={<GlobalLoader message="Initializing StayEaze Quantum Matrix..." fullScreen />}>
            <Routes>
              <Route path="/login" element={hasValidSession ? <Navigate to={landingRoute} replace /> : <LoginPage />} />
              <Route path="/signup" element={hasValidSession ? <Navigate to={landingRoute} replace /> : <SignUpPage />} />
              <Route path="/onboard" element={<PublicTenantOnboardingPage />} />

              <Route
                element={
                  <RequireAuth>
                    <AppLayout />
                  </RequireAuth>
                }
              >
                {/* Tenant Portal Routes */}
                <Route path="/tenant/dashboard" element={<RequireAuth allowedRoles={['TENANT', 'ADMIN', 'PROPERTY_MANAGER']}><TenantDashboardPage /></RequireAuth>} />
                <Route path="/tenant/billing" element={<RequireAuth allowedRoles={['TENANT', 'ADMIN', 'PROPERTY_MANAGER']}><TenantBillingPage /></RequireAuth>} />
                <Route path="/tenant/documents" element={<RequireAuth allowedRoles={['TENANT', 'ADMIN', 'PROPERTY_MANAGER']}><TenantDocumentsPage /></RequireAuth>} />

                {/* Console Routes */}
                <Route path="/dashboard" element={<RequireAuth module="dashboard"><DashboardPage /></RequireAuth>} />
                <Route path="/properties" element={<RequireAuth module="properties"><PropertiesPage /></RequireAuth>} />
                <Route path="/properties/:id" element={<RequireAuth module="properties"><PropertyDetailPage /></RequireAuth>} />
                <Route path="/buildings" element={<RequireAuth module="properties"><BuildingsPage /></RequireAuth>} />
                <Route path="/floors" element={<RequireAuth module="properties"><FloorsPage /></RequireAuth>} />
                <Route path="/rooms" element={<RequireAuth module="rooms"><RoomsPage /></RequireAuth>} />
                <Route path="/beds" element={<RequireAuth module="rooms"><BedsPage /></RequireAuth>} />
                <Route path="/tenants" element={<RequireAuth module="tenants"><TenantsPage /></RequireAuth>} />
                <Route path="/tenants/:id" element={<RequireAuth module="tenants"><TenantDetailPage /></RequireAuth>} />
                <Route path="/bookings" element={<RequireAuth module="bookings"><BookingsPage /></RequireAuth>} />
                <Route path="/bookings/:id" element={<RequireAuth module="bookings"><BookingDetailPage /></RequireAuth>} />
                <Route path="/check-ins" element={<RequireAuth module="checkins"><CheckInsPage /></RequireAuth>} />
                <Route path="/check-outs" element={<RequireAuth module="checkouts"><CheckOutsPage /></RequireAuth>} />
                <Route path="/billing" element={<RequireAuth module="billing"><BillingPage /></RequireAuth>} />
                <Route path="/utilities" element={<RequireAuth module="billing"><UtilitiesPage /></RequireAuth>} />
                <Route path="/subscription" element={<RequireAuth module="settings"><SubscriptionPage /></RequireAuth>} />
                <Route path="/payments" element={<RequireAuth module="billing"><PaymentsPage /></RequireAuth>} />
                <Route path="/complaints" element={<RequireAuth module="complaints"><ComplaintsPage /></RequireAuth>} />
                <Route path="/maintenance" element={<RequireAuth module="maintenance"><MaintenancePage /></RequireAuth>} />
                <Route path="/visitors" element={<RequireAuth module="visitors"><VisitorsPage /></RequireAuth>} />
                <Route path="/reports" element={<RequireAuth module="reports"><ReportsPage /></RequireAuth>} />
                <Route path="/reports/gst-tax" element={<RequireAuth module="reports"><GstTaxReportsPage /></RequireAuth>} />
                <Route path="/reports/deposit-ledger" element={<RequireAuth module="reports"><SecurityDepositLedgerPage /></RequireAuth>} />
                <Route path="/reports/financial-ledger" element={<RequireAuth module="reports"><FinancialLedgerPage /></RequireAuth>} />
                <Route path="/users" element={<RequireAuth allowedRoles={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><UsersPage /></RequireAuth>} />
                <Route path="/roles" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><RolesPage /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth module="settings"><SettingsPage /></RequireAuth>} />
                <Route path="/audit-logs" element={<RequireAuth module="audit"><AuditLogsPage /></RequireAuth>} />
                <Route path="/security/sessions" element={<RequireAuth module="settings"><SecuritySessionsPage /></RequireAuth>} />
                <Route path="/security/backup" element={<RequireAuth module="settings"><DataBackupPage /></RequireAuth>} />
                <Route path="/super-admin/subscribers" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SubscribersPage /></RequireAuth>} />
                <Route path="/super-admin/leads" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SuperAdminLeadsPage /></RequireAuth>} />
                <Route path="/super-admin/escalations" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SuperAdminEscalationsPage /></RequireAuth>} />
                <Route path="/super-admin/invoices" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SaaSInvoicesPage /></RequireAuth>} />
                <Route path="/super-admin/plans" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SaaSPlansPage /></RequireAuth>} />
                <Route path="/super-admin/backup" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><DataBackupPage /></RequireAuth>} />
                <Route path="/super-admin/sessions" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SecuritySessionsPage /></RequireAuth>} />
                <Route path="/super-admin/api-metrics" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SuperAdminApiMetricsPage /></RequireAuth>} />
                <Route path="/super-admin/user-tracking" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><UserJourneyTrackingPage /></RequireAuth>} />
                <Route path="/super-admin/system-logs" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><BackendLogsPage /></RequireAuth>} />
                <Route path="/super-admin/integrations" element={<RequireAuth allowedRoles={['SUPER_ADMIN']}><SystemIntegrationsPage /></RequireAuth>} />
                <Route path="/support/dashboard" element={<RequireAuth allowedRoles={['SUPPORT']}><SupportDashboardPage /></RequireAuth>} />
                <Route path="/support/subscribers" element={<RequireAuth allowedRoles={['SUPPORT']}><SupportSubscribersPage /></RequireAuth>} />
                <Route path="/support/leads" element={<RequireAuth allowedRoles={['SUPPORT']}><SupportLeadsPage /></RequireAuth>} />
                <Route path="/support/tickets" element={<RequireAuth allowedRoles={['SUPPORT']}><SupportTicketsPage /></RequireAuth>} />
                <Route path="/accountant/dashboard" element={<RequireAuth allowedRoles={['ACCOUNTANT','ADMIN','OWNER']}><AccountantDashboardPage /></RequireAuth>} />
                <Route path="/accountant/ledger" element={<RequireAuth module="reports"><FinancialLedgerPage /></RequireAuth>} />
                <Route path="/accountant/gst-reports" element={<RequireAuth module="reports"><GstTaxReportsPage /></RequireAuth>} />
                <Route path="/accountant/security-deposits" element={<RequireAuth module="reports"><SecurityDepositLedgerPage /></RequireAuth>} />
                <Route path="/receptionist/dashboard" element={<RequireAuth allowedRoles={['RECEPTIONIST']}><ReceptionistDashboardPage /></RequireAuth>} />
                <Route path="/security/dashboard" element={<RequireAuth allowedRoles={['SECURITY_GUARD']}><SecurityGuardDashboardPage /></RequireAuth>} />
                <Route path="/staff/dashboard" element={<RequireAuth allowedRoles={['STAFF']}><StaffDashboardPage /></RequireAuth>} />
              </Route>

              {/* Public static and informational routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/offline" element={<OfflinePage />} />
              <Route path="/system-maintenance" element={<SystemMaintenancePage />} />

              {/* Catch-all Not Found Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </WebSocketProvider>
      </BrandingProvider>
    </ErrorBoundary>
  );
}
