import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Receipt, Calendar, CreditCard, Share2, CheckCircle2 } from 'lucide-react-native';
import api from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { Invoice } from '../../types';

export const InvoicesScreen: React.FC = () => {
  const { data: invoicesData, isLoading, refetch } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      try {
        const res = await api.get('/invoices');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
  });

  const invoices: Invoice[] = Array.isArray(invoicesData) ? invoicesData : [];

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'success';
      case 'unpaid':
        return 'danger';
      case 'partial':
        return 'warning';
      case 'overdue':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const renderInvoiceItem = ({ item }: { item: Invoice }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.invNumber}>{item.invoiceNumber || 'INV-2026-001'}</Text>
            <Text style={styles.tenantName}>{item.tenantName || 'Tenant Name'}</Text>
          </View>
          <Badge label={item.status || 'UNPAID'} variant={getStatusVariant(item.status)} />
        </View>

        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Total Rent Invoice</Text>
            <Text style={styles.amountValue}>₹{item.amount ? item.amount.toLocaleString() : '8,500'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Paid Amount</Text>
            <Text style={styles.paidValue}>₹{item.paidAmount ? item.paidAmount.toLocaleString() : '0'}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.dateBadge}>
            <Calendar size={13} color="#64748b" />
            <Text style={styles.dateText}>Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Next Month'}</Text>
          </View>

          {item.status !== 'paid' && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => Alert.alert('Razorpay Checkout', `Initiate online payment for ${item.invoiceNumber}`)}
            >
              <CreditCard size={14} color="#ffffff" />
              <Text style={styles.payBtnText}>Pay Online</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Rent Invoices & Payments</Text>
        <Text style={styles.screenSub}>Tenant rent billing & Razorpay checkout</Text>
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        renderItem={renderInvoiceItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <Receipt size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Invoices Found</Text>
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
  invNumber: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  tenantName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  amountLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  paidValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16a34a',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
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
