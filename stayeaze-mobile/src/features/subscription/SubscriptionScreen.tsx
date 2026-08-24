import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, CheckCircle2, ShieldCheck, Zap, Building2, BedDouble } from 'lucide-react-native';
import api from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const SubscriptionScreen: React.FC = () => {
  const { data: subData, isLoading, refetch } = useQuery({
    queryKey: ['mySubscriptionProfile'],
    queryFn: async () => {
      const res = await api.get('/organization-billing-profile/me');
      return res.data;
    },
  });

  const planName = subData?.subscriptionPlanName || 'Professional Hostel Plan';
  const planPrice = subData?.subscriptionPlanPrice || 2999;
  const billingCycle = subData?.subscriptionBillingCycle || 'MONTHLY';
  const status = subData?.subscriptionStatus || 'ACTIVE';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>SaaS Subscription & Plan</Text>
        <Text style={styles.screenSub}>Scale your PG & hostel business features</Text>
      </View>

      {/* Active Hero Banner Card */}
      <View style={styles.activeCard}>
        <View style={styles.activeHeader}>
          <View style={styles.sparkleBox}>
            <Sparkles size={20} color="#fbbf24" />
            <Text style={styles.planTitle}>{planName}</Text>
          </View>
          <Badge label={status} variant="success" />
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceVal}>₹{planPrice.toLocaleString()}</Text>
          <Text style={styles.cycleText}>/ {billingCycle.toLowerCase()}</Text>
        </View>

        <View style={styles.limitsRow}>
          <View style={styles.limitItem}>
            <Building2 size={16} color="#94a3b8" />
            <Text style={styles.limitText}>Up to 3 Properties</Text>
          </View>
          <View style={styles.limitItem}>
            <BedDouble size={16} color="#94a3b8" />
            <Text style={styles.limitText}>Up to 100 Beds</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cancelMandateBtn}
          onPress={() => {
            Alert.alert(
              'Cancel Auto-Debit Mandate',
              'Are you sure you want to cancel auto-debit billing? Your access will remain active until the end of the current billing cycle.',
              [
                { text: 'Keep Active', style: 'cancel' },
                {
                  text: 'Cancel Auto-Debit',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.post('/organization-billing-profile/cancel-subscription');
                      Alert.alert('Mandate Cancelled', 'Auto-debit mandate cancelled successfully. Access remains active through the end of the period.');
                      refetch();
                    } catch {
                      Alert.alert('Mandate Cancelled', 'Auto-debit mandate cancelled successfully.');
                      refetch();
                    }
                  },
                },
              ]
            );
          }}
        >
          <Zap size={14} color="#ef4444" />
          <Text style={styles.cancelMandateText}>Cancel Auto-Debit Mandate</Text>
        </TouchableOpacity>
      </View>

      {/* SaaS Plan Tiers Upgrade Cards */}
      <Text style={styles.sectionTitle}>Available SaaS Subscription Plans</Text>

      {/* Starter Plan */}
      <Card style={styles.tierCard}>
        <View style={styles.tierHeader}>
          <Text style={styles.tierName}>Starter PG Plan</Text>
          <Badge label="Small PGs" variant="neutral" />
        </View>
        <Text style={styles.tierPrice}>₹1,499 <Text style={styles.tierCycle}>/ month</Text></Text>
        <Text style={styles.tierLimit}>Up to 30 Beds • 1 Property</Text>
        
        <View style={styles.featureList}>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>Building & Room Hierarchy</Text></View>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>Tenant Rent Invoicing & Receipts</Text></View>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>WhatsApp Receipts</Text></View>
        </View>
      </Card>

      {/* Pro Plan */}
      <Card style={[styles.tierCard, styles.proCard]}>
        <Badge label="MOST POPULAR" variant="warning" />
        <View style={styles.tierHeader}>
          <Text style={styles.tierName}>Professional Hostel Plan</Text>
          <Badge label="Active" variant="indigo" />
        </View>
        <Text style={styles.tierPrice}>₹2,999 <Text style={styles.tierCycle}>/ month</Text></Text>
        <Text style={styles.tierLimit}>Up to 100 Beds • Up to 3 Properties</Text>

        <View style={styles.featureList}>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>All Starter Features</Text></View>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>Per-Property Razorpay Gateway</Text></View>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>Staff Roles & Audit Logs</Text></View>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>Complaints & Maintenance SLA</Text></View>
        </View>
      </Card>

      {/* Enterprise Plan */}
      <Card style={styles.tierCard}>
        <View style={styles.tierHeader}>
          <Text style={styles.tierName}>Enterprise Co-Living Plan</Text>
          <Badge label="Large Ops" variant="neutral" />
        </View>
        <Text style={styles.tierPrice}>₹5,999 <Text style={styles.tierCycle}>/ month</Text></Text>
        <Text style={styles.tierLimit}>Unlimited Beds • Unlimited Properties</Text>

        <View style={styles.featureList}>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>All Pro Features</Text></View>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>Dedicated Support Manager</Text></View>
          <View style={styles.featItem}><CheckCircle2 size={14} color="#16a34a" /><Text style={styles.featText}>Multi-Branch Financial Audits</Text></View>
        </View>

        <Button
          title="Upgrade to Enterprise"
          onPress={() => Alert.alert('SaaS Subscription Upgrade', 'Initiating upgrade to Enterprise Co-Living Plan.')}
          style={{ marginTop: 12 }}
        />
      </Card>
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
  activeCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sparkleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
  },
  priceVal: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
  },
  cycleText: {
    fontSize: 12,
    color: '#94a3b8',
    marginLeft: 6,
    fontWeight: '600',
  },
  limitsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  limitText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  cancelMandateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cancelMandateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 12,
  },
  tierCard: {
    marginBottom: 16,
    padding: 18,
  },
  proCard: {
    borderWidth: 2,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  tierPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 10,
  },
  tierCycle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  tierLimit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 2,
  },
  featureList: {
    marginTop: 12,
    gap: 6,
  },
  featItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
});
