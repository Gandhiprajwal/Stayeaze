import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareWarning, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import api from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { Complaint } from '../../types';

export const ComplaintsScreen: React.FC = () => {
  const { data: complaintsData, isLoading, refetch } = useQuery({
    queryKey: ['complaints'],
    queryFn: async () => {
      const res = await api.get('/complaints');
      return res.data?.data || res.data || [];
    },
  });

  const complaints: Complaint[] = Array.isArray(complaintsData) ? complaintsData : [];

  const getPriorityVariant = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
      case 'closed':
        return 'success';
      case 'in_progress':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const renderComplaintItem = ({ item }: { item: Complaint }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketNum}>{item.ticketNumber || 'TKT-101'}</Text>
            <Text style={styles.category}>{item.category ? item.category.toUpperCase() : 'PLUMBING'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Badge label={item.priority || 'HIGH'} variant={getPriorityVariant(item.priority)} />
            <Badge label={item.status || 'OPEN'} variant={getStatusVariant(item.status)} />
          </View>
        </View>

        <Text style={styles.description}>{item.description || 'Issue reported by tenant in room'}</Text>

        <View style={styles.footerRow}>
          <Text style={styles.tenantMeta}>
            By: {item.tenantName || 'Tenant'} • Room {item.roomNumber || '101'}
          </Text>
          <Text style={styles.dateText}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Today'}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Complaints & Issues</Text>
        <Text style={styles.screenSub}>Tenant maintenance requests & SLA tracking</Text>
      </View>

      <FlatList
        data={complaints}
        keyExtractor={(item) => item.id}
        renderItem={renderComplaintItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <MessageSquareWarning size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Active Complaints</Text>
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
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  category: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tenantMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  dateText: {
    fontSize: 11,
    color: '#94a3b8',
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
