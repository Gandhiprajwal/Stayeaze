import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ShieldCheck, CheckCircle2, Lock } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export const RolesScreen: React.FC = () => {
  const rolesList = [
    {
      name: 'SUPER_ADMIN',
      badge: 'PLATFORM OWNER',
      description: 'Complete system access, SaaS subscriber management, audit logs, and infrastructure health.',
      permissions: ['Manage SaaS Subscribers', 'Impersonate Owners', 'View Backend Logs', 'Infra Settings'],
      variant: 'danger' as const,
    },
    {
      name: 'OWNER / ADMIN',
      badge: 'CLIENT ORG ADMIN',
      description: 'Full management of PG properties, buildings, floors, rooms, beds, tenants, and billing.',
      permissions: ['Manage Properties & Beds', 'Tenant KYC & Onboarding', 'Razorpay & Invoices', 'Staff Accounts'],
      variant: 'indigo' as const,
    },
    {
      name: 'PROPERTY_MANAGER',
      badge: 'ON-SITE MANAGER',
      description: 'On-site room allocations, tenant check-ins/check-outs, maintenance tickets, and gate passes.',
      permissions: ['Check-in & Check-out', 'Resolve Complaints', 'Visitor Gate Passes', 'Room View'],
      variant: 'info' as const,
    },
    {
      name: 'TENANT',
      badge: 'RESIDENT',
      description: 'Resident self-service portal for paying rent online, downloading receipts, and raising complaints.',
      permissions: ['Pay Rent Online', 'Raise Complaints', 'Download HRA Receipts', 'View Lease'],
      variant: 'success' as const,
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Roles & Access Matrix</Text>
        <Text style={styles.screenSub}>System security roles & permission capabilities</Text>
      </View>

      {rolesList.map((role) => (
        <Card key={role.name} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <ShieldCheck size={20} color="#2563eb" />
              <Text style={styles.roleName}>{role.name}</Text>
            </View>
            <Badge label={role.badge} variant={role.variant} />
          </View>

          <Text style={styles.description}>{role.description}</Text>

          <View style={styles.permList}>
            {role.permissions.map((perm) => (
              <View key={perm} style={styles.permItem}>
                <CheckCircle2 size={14} color="#16a34a" />
                <Text style={styles.permText}>{perm}</Text>
              </View>
            ))}
          </View>
        </Card>
      ))}
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
  topBar: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  screenSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  card: {
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  description: {
    fontSize: 12,
    color: '#475569',
    marginTop: 8,
    lineHeight: 16,
  },
  permList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  permItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
});
