import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Linking, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Users, Phone, DoorOpen, ShieldCheck, Search } from 'lucide-react-native';
import api from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import type { Tenant } from '../../types';

export const TenantsScreen: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: tenantsData, isLoading, refetch } = useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      try {
        const res = await api.get('/tenants');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
  });

  const tenants: Tenant[] = Array.isArray(tenantsData) ? tenantsData : [];

  const filteredTenants = tenants.filter((t) =>
    (t.name || `${t.firstName || ''} ${t.lastName || ''}`)
      .toLowerCase()
      .includes(search.toLowerCase()) ||
    (t.phone || t.mobile || '').includes(search)
  );

  const makeCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const renderTenantItem = ({ item }: { item: Tenant }) => {
    const displayName = item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Tenant';
    const displayPhone = item.phone || item.mobile || 'N/A';

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tenantName}>{displayName}</Text>
            <Text style={styles.tenantPhone}>{displayPhone}</Text>
          </View>
          <Badge
            label={item.kycStatus || 'VERIFIED'}
            variant={item.kycStatus === 'VERIFIED' ? 'success' : 'warning'}
          />
        </View>

        <View style={styles.roomRow}>
          <View style={styles.roomBadge}>
            <DoorOpen size={14} color="#2563eb" />
            <Text style={styles.roomText}>Room {item.roomNumber || '101'} • Bed {item.bedNumber || 'A'}</Text>
          </View>
          <Text style={styles.rentText}>₹{item.rent ? item.rent.toLocaleString() : '8,500'}/mo</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.callBtn} onPress={() => makeCall(displayPhone)}>
            <Phone size={14} color="#2563eb" />
            <Text style={styles.callBtnText}>Call Tenant</Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Tenant Directory</Text>
        <Text style={styles.screenSub}>Active tenant KYC & room allocations</Text>
        <View style={{ marginTop: 10 }}>
          <Input
            placeholder="Search tenant by name or mobile..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Search size={16} color="#64748b" />}
          />
        </View>
      </View>

      <FlatList
        data={filteredTenants}
        keyExtractor={(item) => item.id}
        renderItem={renderTenantItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <Users size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Tenants Found</Text>
            </View>
          ) : null
        }
      />
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
    paddingBottom: 12,
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
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  tenantPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  roomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roomText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
  },
  rentText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16a34a',
  },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  callBtnText: {
    fontSize: 12,
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
});
