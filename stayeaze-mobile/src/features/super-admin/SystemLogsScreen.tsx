import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Terminal, ShieldAlert, CheckCircle2, AlertTriangle, Search, Filter } from 'lucide-react-native';
import api from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';

export const SystemLogsScreen: React.FC = () => {
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [search, setSearch] = useState('');

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['systemLogs'],
    queryFn: async () => {
      const res = await api.get('/audit-logs');
      return res.data?.data || res.data || [];
    },
  });

  const logs = Array.isArray(logsData) ? logsData : [];

  const filteredLogs = logs.filter((log: any) => {
    const action = String(log.action || log.message || '').toUpperCase();
    let level = 'INFO';
    if (action.includes('ERROR') || action.includes('FAIL') || action.includes('EXCEPTION')) {
      level = 'ERROR';
    } else if (action.includes('WARN') || action.includes('DELETE') || action.includes('CANCEL')) {
      level = 'WARN';
    }

    if (levelFilter !== 'ALL' && level !== levelFilter) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        action.toLowerCase().includes(q) ||
        (log.user || '').toLowerCase().includes(q) ||
        (log.ipAddress || log.clientIp || '').includes(q)
      );
    }

    return true;
  });

  const renderLogItem = ({ item }: { item: any }) => {
    const action = String(item.action || item.message || 'System Action').toUpperCase();
    let level: 'info' | 'warning' | 'danger' = 'info';
    if (action.includes('ERROR') || action.includes('FAIL')) level = 'danger';
    else if (action.includes('WARN') || action.includes('DELETE')) level = 'warning';

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Terminal size={16} color="#2563eb" />
            <Text style={styles.logModule}>{item.module ? item.module.toUpperCase() : 'SYSTEM'}</Text>
          </View>
          <Badge label={level === 'danger' ? 'ERROR' : level === 'warning' ? 'WARN' : 'INFO'} variant={level === 'danger' ? 'danger' : level === 'warning' ? 'warning' : 'info'} />
        </View>

        <Text style={styles.actionText}>{item.action || item.message || 'Audit Event Log'}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.userText}>User: {item.user || item.username || 'SYSTEM'}</Text>
          <Text style={styles.ipText}>IP: {item.ipAddress || item.clientIp || '127.0.0.1'}</Text>
        </View>

        <Text style={styles.timeText}>
          {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Just now'}
        </Text>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>System & Audit Logs</Text>
        <Text style={styles.screenSub}>Real-time backend security audit trail stream</Text>

        <View style={{ marginTop: 10 }}>
          <Input
            placeholder="Search by action, user, or IP..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Search size={16} color="#64748b" />}
          />
        </View>

        {/* Level Filters */}
        <View style={styles.filterRow}>
          {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
            <TouchableOpacity
              key={lvl}
              style={[styles.filterPill, levelFilter === lvl ? styles.filterPillActive : null]}
              onPress={() => setLevelFilter(lvl)}
            >
              <Text style={[styles.filterPillText, levelFilter === lvl ? styles.filterPillTextActive : null]}>
                {lvl}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredLogs}
        keyExtractor={(item, idx) => item.id || String(idx)}
        renderItem={renderLogItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <Terminal size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No System Logs Found</Text>
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: '#2563eb',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 10,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logModule: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  userText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  ipText: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  timeText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
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
