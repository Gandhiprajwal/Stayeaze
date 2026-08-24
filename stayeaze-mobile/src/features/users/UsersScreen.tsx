import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { UserCog, Mail, Phone, ShieldCheck, Search } from 'lucide-react-native';
import api from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import type { User } from '../../types';

export const UsersScreen: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const res = await api.get('/users');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
  });

  const users: User[] = Array.isArray(usersData) ? usersData : [];

  const filteredUsers = users.filter(
    (u) =>
      (u.name || u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || '').includes(search)
  );

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'danger';
      case 'OWNER':
      case 'ADMIN':
        return 'indigo';
      case 'PROPERTY_MANAGER':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{(item.name || item.email || 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{item.name || item.email.split('@')[0]}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          <Badge label={item.role || 'STAFF'} variant={getRoleVariant(item.role)} />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.phoneText}>Phone: {item.phone || 'N/A'}</Text>
          <Badge label={item.status || 'active'} variant={item.status === 'active' ? 'success' : 'neutral'} />
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>User Management</Text>
        <Text style={styles.screenSub}>System users, roles & permission assignments</Text>

        <View style={{ marginTop: 10 }}>
          <Input
            placeholder="Search by name, email or phone..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Search size={16} color="#64748b" />}
          />
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <UserCog size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Users Found</Text>
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
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
  phoneText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
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
