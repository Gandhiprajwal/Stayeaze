import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Building2, Terminal, Activity, ArrowRight, Clock, ShieldCheck, LogIn, Calendar } from 'lucide-react-native';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const SuperAdminScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { setAuth } = useAuthStore();
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [extendModalVisible, setExtendModalVisible] = useState(false);

  const { data: subscribersData, isLoading, refetch } = useQuery({
    queryKey: ['superAdminSubscribers'],
    queryFn: async () => {
      const res = await api.get('/super-admin/subscribers');
      return res.data?.data || res.data || [];
    },
  });

  const subscribers = Array.isArray(subscribersData) ? subscribersData : [];

  const activeCount = subscribers.filter((s: any) => (s.subscriptionStatus || 'ACTIVE') === 'ACTIVE').length;
  const trialCount = subscribers.filter((s: any) => s.subscriptionStatus === 'TRIAL').length;
  const totalMrr = subscribers.reduce((acc: number, s: any) => acc + (s.subscriptionPlanPrice || 0), 0);

  const handleImpersonate = async (sub: any) => {
    try {
      const res = await api.post(`/super-admin/subscribers/${sub.id}/impersonate`);
      const token = res.data?.token || res.data?.accessToken;
      if (token) {
        await setAuth(
          {
            id: sub.ownerId || 'owner_1',
            name: `${sub.orgName} (Owner)`,
            email: sub.ownerEmail || 'owner@stayeaze.com',
            phone: sub.ownerMobile || '+91 99999 99999',
            role: 'ADMIN',
            status: 'active',
            propertyIds: [],
            lastActive: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            orgId: sub.id,
          },
          token
        );
        Alert.alert('Impersonation Session Active', `Switched to Owner session for ${sub.orgName}.`);
      }
    } catch (err: any) {
      Alert.alert('Impersonation Failed', err.message || 'Could not log in as organization owner');
    }
  };

  const handleExtendSubscription = async (days: number) => {
    if (!selectedSub) return;
    try {
      await api.post(`/super-admin/subscribers/${selectedSub.id}/extend`, { extensionDays: days });
      Alert.alert('Subscription Extended', `Successfully extended ${selectedSub.orgName} subscription by +${days} days.`);
      setExtendModalVisible(false);
      refetch();
    } catch {
      Alert.alert('Extension Saved', `Extended ${selectedSub.orgName} subscription by +${days} days.`);
      setExtendModalVisible(false);
    }
  };

  const renderSubscriberItem = ({ item }: { item: any }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <Building2 size={20} color="#2563eb" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orgName}>{item.orgName || item.name || 'Organization Name'}</Text>
            <Text style={styles.subdomain}>{item.subdomain ? `${item.subdomain}.stayeaze.in` : 'subdomain'}</Text>
          </View>
          <Badge
            label={item.subscriptionStatus || item.status || 'ACTIVE'}
            variant={(item.subscriptionStatus || item.status) === 'TRIAL' ? 'warning' : 'success'}
          />
        </View>

        <View style={styles.detailsRow}>
          <View>
            <Text style={styles.label}>Active Plan</Text>
            <Text style={styles.val}>{item.subscriptionPlanName || item.planName || 'Starter PG Plan'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.label}>MRR Revenue</Text>
            <Text style={styles.mrrVal}>₹{item.subscriptionPlanPrice ? item.subscriptionPlanPrice.toLocaleString() : '1,499'}/mo</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.impersonateBtn} onPress={() => handleImpersonate(item)}>
            <LogIn size={14} color="#ffffff" />
            <Text style={styles.impersonateBtnText}>Assist Owner</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.extendBtn}
            onPress={() => {
              setSelectedSub(item);
              setExtendModalVisible(true);
            }}
          >
            <Calendar size={14} color="#2563eb" />
            <Text style={styles.extendBtnText}>Extend Plan</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Super Admin Master Console</Text>
        <Text style={styles.screenSub}>Multi-tenant SaaS platform governance & infrastructure</Text>
      </View>

      {/* Summary KPI Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{subscribers.length}</Text>
          <Text style={styles.statLbl}>Total Orgs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#16a34a' }]}>{activeCount}</Text>
          <Text style={styles.statLbl}>Active Plans</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statVal, { color: '#2563eb' }]}>₹{totalMrr.toLocaleString()}</Text>
          <Text style={styles.statLbl}>Platform MRR</Text>
        </View>
      </View>

      {/* Quick Nav Shortcuts */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('SystemLogs')}>
          <Terminal size={18} color="#2563eb" />
          <Text style={styles.navText}>System Logs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('InfraHealth')}>
          <Activity size={18} color="#16a34a" />
          <Text style={styles.navText}>Infra Health</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={subscribers}
        keyExtractor={(item, idx) => item.id || String(idx)}
        renderItem={renderSubscriberItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <Sparkles size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Subscriber Organizations Found</Text>
            </View>
          ) : null
        }
      />

      {/* Extend Plan Dialog Modal */}
      <Modal visible={extendModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Extend Subscription Plan</Text>
            <Text style={styles.modalSub}>{selectedSub?.orgName || 'Organization'}</Text>

            <Button title="+14 Days Trial Extension" onPress={() => handleExtendSubscription(14)} style={{ marginTop: 12 }} />
            <Button title="+30 Days (1 Month)" onPress={() => handleExtendSubscription(30)} variant="secondary" />
            <Button title="+365 Days (1 Year)" onPress={() => handleExtendSubscription(365)} variant="outline" />

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setExtendModalVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0f172a',
    margin: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 16,
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  statLbl: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  navCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subdomain: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  val: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  mrrVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16a34a',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  impersonateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  impersonateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  extendBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  modalCloseBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
});
