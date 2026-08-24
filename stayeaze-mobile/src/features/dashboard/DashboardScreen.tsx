import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Building2, BedDouble, Users, CreditCard, Sparkles, LogOut, ArrowRight, ShieldCheck, Wrench, Terminal, Activity } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import api from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { Property, Tenant, Invoice } from '../../types';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuthStore();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const isManager = user?.role === 'PROPERTY_MANAGER';
  const isTenant = user?.role === 'TENANT';

  // Real Queries
  const { data: propertiesData, isLoading: loadingProps, refetch: refetchProps } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await api.get('/properties');
      return res.data?.data || res.data || [];
    },
    enabled: !isTenant,
  });

  const { data: tenantsData, isLoading: loadingTenants, refetch: refetchTenants } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get('/tenants');
      return res.data?.data || res.data || [];
    },
    enabled: !isTenant,
  });

  const { data: invoicesData, isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const res = await api.get('/invoices');
      return res.data?.data || res.data || [];
    },
  });

  const { data: subscribersData, isLoading: loadingSubscribers, refetch: refetchSubscribers } = useQuery({
    queryKey: ['superAdminSubscribersDashboard'],
    queryFn: async () => {
      try {
        const res = await api.get('/super-admin/subscribers');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
    enabled: isSuperAdmin,
  });

  const subscribers = Array.isArray(subscribersData) ? subscribersData : [];
  const activeSubCount = subscribers.filter((s: any) => (s.subscriptionStatus || 'ACTIVE') === 'ACTIVE').length;
  const totalMrr = subscribers.reduce((acc: number, s: any) => acc + (s.subscriptionPlanPrice || 0), 0);

  const properties: Property[] = Array.isArray(propertiesData) ? propertiesData : [];
  const tenants: Tenant[] = Array.isArray(tenantsData) ? tenantsData : [];
  const invoices: Invoice[] = Array.isArray(invoicesData) ? invoicesData : [];

  // Computed Real Analytics Metrics
  const totalBeds = properties.reduce((acc, p) => acc + (p.totalBeds || 0), 0);
  const totalCollectedRent = invoices
    .filter((i) => i.status === 'paid')
    .reduce((acc, i) => acc + (i.amount || 0), 0);

  const isRefreshing = loadingProps || loadingTenants || loadingInvoices || loadingSubscribers;

  const handleRefresh = () => {
    if (isSuperAdmin) refetchSubscribers();
    refetchProps();
    refetchTenants();
    refetchInvoices();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      {/* Top Welcome Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <View style={{ marginTop: 4 }}>
            <Badge label={user?.role || 'ADMIN'} variant={isSuperAdmin ? 'danger' : 'indigo'} />
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Role Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.sparkleBadge}>
            <Sparkles size={16} color="#fbbf24" />
            <Text style={styles.sparkleText}>
              {isSuperAdmin ? 'SUPER ADMIN MASTER CONSOLE' : isOwner ? 'ORGANIZATION OWNER' : isManager ? 'PROPERTY MANAGER' : 'TENANT RESIDENT'}
            </Text>
          </View>
          <Badge label="LIVE BACKEND" variant="success" />
        </View>
        <Text style={styles.heroTitle}>
          {isSuperAdmin ? 'Master SaaS Platform Control' : isOwner ? 'PG & Hostel Operations' : isManager ? 'Property Operations Hub' : 'My Stay & Rent Dashboard'}
        </Text>
        <Text style={styles.heroSub}>
          {isSuperAdmin
            ? `Governing ${subscribers.length} subscriber organizations and platform operations.`
            : isOwner
            ? `Managing ${properties.length} registered properties and ${tenants.length} active tenants.`
            : 'Handling daily room check-ins, maintenance SLA tickets, and gate passes.'}
        </Text>
      </View>

      {/* KPI Stats Grid */}
      <Text style={styles.sectionTitle}>Real-Time Platform Metrics</Text>
      <View style={styles.kpiGrid}>
        {isSuperAdmin ? (
          <>
            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#fef2f2' }]}>
                <ShieldCheck size={20} color="#dc2626" />
              </View>
              <Text style={styles.kpiValue}>{subscribers.length}</Text>
              <Text style={styles.kpiLabel}>Total Orgs</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#dcfce7' }]}>
                <Sparkles size={20} color="#16a34a" />
              </View>
              <Text style={styles.kpiValue}>{activeSubCount}</Text>
              <Text style={styles.kpiLabel}>Active Plans</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#dbeafe' }]}>
                <CreditCard size={20} color="#2563eb" />
              </View>
              <Text style={styles.kpiValue}>₹{totalMrr.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Platform MRR</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#f3e8ff' }]}>
                <Building2 size={20} color="#9333ea" />
              </View>
              <Text style={styles.kpiValue}>{properties.length}</Text>
              <Text style={styles.kpiLabel}>Global Properties</Text>
            </Card>
          </>
        ) : !isTenant ? (
          <>
            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#dbeafe' }]}>
                <Building2 size={20} color="#2563eb" />
              </View>
              <Text style={styles.kpiValue}>{properties.length}</Text>
              <Text style={styles.kpiLabel}>Properties</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#dcfce7' }]}>
                <BedDouble size={20} color="#16a34a" />
              </View>
              <Text style={styles.kpiValue}>{totalBeds}</Text>
              <Text style={styles.kpiLabel}>Total Beds</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
                <Users size={20} color="#d97706" />
              </View>
              <Text style={styles.kpiValue}>{tenants.length}</Text>
              <Text style={styles.kpiLabel}>Tenants</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#f3e8ff' }]}>
                <CreditCard size={20} color="#9333ea" />
              </View>
              <Text style={styles.kpiValue}>₹{totalCollectedRent.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Collected Rent</Text>
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#fef3c7' }]}>
                <Users size={20} color="#d97706" />
              </View>
              <Text style={styles.kpiValue}>Active</Text>
              <Text style={styles.kpiLabel}>Resident Status</Text>
            </Card>

            <Card style={styles.kpiCard}>
              <View style={[styles.iconWrapper, { backgroundColor: '#f3e8ff' }]}>
                <CreditCard size={20} color="#9333ea" />
              </View>
              <Text style={styles.kpiValue}>₹{totalCollectedRent.toLocaleString()}</Text>
              <Text style={styles.kpiLabel}>Paid Rent</Text>
            </Card>
          </>
        )}
      </View>

      {/* Role-tailored Management Actions */}
      <Text style={styles.sectionTitle}>Quick Management Actions</Text>

      {isSuperAdmin && (
        <>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Subscribers')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef2f2' }]}>
                <ShieldCheck size={20} color="#dc2626" />
              </View>
              <View>
                <Text style={styles.actionTitle}>SaaS Subscribers Directory</Text>
                <Text style={styles.actionSub}>View platform organizations & MRR revenue</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Properties')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
                <Building2 size={20} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Global System Properties</Text>
                <Text style={styles.actionSub}>View all registered properties across organizations</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Users')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
                <Users size={20} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.actionTitle}>User Management</Text>
                <Text style={styles.actionSub}>System users, emails & active accounts</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Roles')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#f3e8ff' }]}>
                <ShieldCheck size={20} color="#9333ea" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Roles & Access Matrix</Text>
                <Text style={styles.actionSub}>System security roles & permission scopes</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SystemLogsTab')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#fff7ed' }]}>
                <Terminal size={20} color="#ea580c" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Backend System Event Logs</Text>
                <Text style={styles.actionSub}>Real-time security audit trail stream</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('InfraHealthTab')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#e0e7ff' }]}>
                <Activity size={20} color="#4338ca" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Cloud Infrastructure Health</Text>
                <Text style={styles.actionSub}>HikariCP DB pool, Redis L2 cache & JVM heap</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>
        </>
      )}

      {!isSuperAdmin && !isTenant && (
        <>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Properties')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
                <Building2 size={20} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Property & Bed Allocations</Text>
                <Text style={styles.actionSub}>Floor-by-floor room grid & vacant beds</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Tenants')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#f0fdf4' }]}>
                <Users size={20} color="#16a34a" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Tenant Directory & KYC</Text>
                <Text style={styles.actionSub}>Check-ins, Aadhaar verification & check-outs</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Invoices')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#fff7ed' }]}>
                <CreditCard size={20} color="#ea580c" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Rent Invoices & Payments</Text>
                <Text style={styles.actionSub}>Razorpay checkout links & HRA receipts</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Complaints')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Wrench size={20} color="#d97706" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Complaints & Maintenance</Text>
                <Text style={styles.actionSub}>SLA ticket resolution & photo issues</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>
        </>
      )}

      {isTenant && (
        <>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Invoices')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#fff7ed' }]}>
                <CreditCard size={20} color="#ea580c" />
              </View>
              <View>
                <Text style={styles.actionTitle}>My Rent Bills & Receipts</Text>
                <Text style={styles.actionSub}>Pay online via Razorpay & download HRA bills</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Complaints')}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Wrench size={20} color="#d97706" />
              </View>
              <View>
                <Text style={styles.actionTitle}>Raise Maintenance Issue</Text>
                <Text style={styles.actionSub}>Report plumbing, electrical, or cleanliness issues</Text>
              </View>
            </View>
            <ArrowRight size={18} color="#94a3b8" />
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingTop: 50,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  logoutBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  heroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sparkleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sparkleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  heroSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  kpiCard: {
    width: '48%',
    padding: 14,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  kpiLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
