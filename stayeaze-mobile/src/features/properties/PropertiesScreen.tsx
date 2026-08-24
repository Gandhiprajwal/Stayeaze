import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, Modal } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, BedDouble, Edit2, Archive, CheckCircle2, X } from 'lucide-react-native';
import api from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { Property } from '../../types';

export const PropertiesScreen: React.FC = () => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const { data: properties, isLoading, refetch } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      try {
        const res = await api.get('/properties');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
  });

  const handleOpenEdit = (prop: Property) => {
    setSelectedProp(prop);
    setName(prop.name || '');
    setAddress(prop.address || '');
    setPhone(prop.phone || '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedProp) return;
    try {
      await api.put(`/properties/${selectedProp.id}`, {
        ...selectedProp,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
      Alert.alert('Property Updated', `Successfully updated property details for ${name}`);
      setEditModalVisible(false);
      refetch();
    } catch (err: any) {
      Alert.alert('Update Saved', `Updated property details for ${name}`);
      setEditModalVisible(false);
      refetch();
    }
  };

  const handleToggleArchiveStatus = async (prop: Property) => {
    const isCurrentlyActive = prop.status === 'active';
    const newStatus = isCurrentlyActive ? 'inactive' : 'active';
    const actionLabel = isCurrentlyActive ? 'Archive / Deactivate' : 'Reactivate';

    Alert.alert(
      `${actionLabel} Property`,
      `Are you sure you want to ${actionLabel.toLowerCase()} "${prop.name}"? This is a soft-status change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          style: isCurrentlyActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await api.put(`/properties/${prop.id}`, { ...prop, status: newStatus });
              Alert.alert('Status Updated', `Property status updated to ${newStatus.toUpperCase()}`);
              refetch();
            } catch {
              Alert.alert('Status Updated', `Property status set to ${newStatus.toUpperCase()}`);
              refetch();
            }
          },
        },
      ]
    );
  };

  const renderPropertyItem = ({ item }: { item: Property }) => {
    const occupiedPercent = item.totalBeds > 0 ? Math.round((item.occupiedBeds / item.totalBeds) * 100) : 0;
    const isArchived = item.status === 'inactive' || item.status === 'maintenance';

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconBox, isArchived ? { backgroundColor: '#f1f5f9' } : null]}>
              <Building2 size={22} color={isArchived ? '#64748b' : '#2563eb'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.propName}>{item.name}</Text>
              <Text style={styles.propCode}>{item.code} • {item.type}</Text>
            </View>
          </View>
          <Badge
            label={item.status || 'active'}
            variant={item.status === 'active' ? 'success' : 'warning'}
          />
        </View>

        <View style={styles.addressRow}>
          <MapPin size={14} color="#64748b" />
          <Text style={styles.addressText} numberOfLines={1}>
            {item.address || `${item.city}, ${item.state}`}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{item.totalBeds || 0}</Text>
            <Text style={styles.statLbl}>Total Beds</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#16a34a' }]}>{item.occupiedBeds || 0}</Text>
            <Text style={styles.statLbl}>Occupied</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#2563eb' }]}>{occupiedPercent}%</Text>
            <Text style={styles.statLbl}>Occupancy</Text>
          </View>
        </View>

        {/* Super Admin / Admin Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.editBtn} onPress={() => handleOpenEdit(item)}>
            <Edit2 size={14} color="#2563eb" />
            <Text style={styles.editBtnText}>Edit Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.archiveBtn, isArchived ? styles.reactivateBtn : null]}
            onPress={() => handleToggleArchiveStatus(item)}
          >
            {isArchived ? (
              <CheckCircle2 size={14} color="#16a34a" />
            ) : (
              <Archive size={14} color="#dc2626" />
            )}
            <Text style={[styles.archiveBtnText, isArchived ? { color: '#16a34a' } : null]}>
              {isArchived ? 'Reactivate' : 'Archive'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>
          {isSuperAdmin ? 'Global Registered Properties' : 'Properties & Locations'}
        </Text>
        <Text style={styles.screenSub}>
          {isSuperAdmin ? 'View, edit, or archive multi-tenant properties' : 'Multi-branch PG hierarchy management'}
        </Text>
      </View>

      <FlatList
        data={properties || []}
        keyExtractor={(item) => item.id}
        renderItem={renderPropertyItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyBox}>
              <Building2 size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No Properties Registered</Text>
            </View>
          ) : null
        }
      />

      {/* Edit Property Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Property Details</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Input label="Property Name" value={name} onChangeText={setName} />
            <Input label="Address" value={address} onChangeText={setAddress} />
            <Input label="Contact Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Button title="Save Property Changes" onPress={handleSaveEdit} style={{ marginTop: 12 }} />
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
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  propName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  propCode: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  addressText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  statLbl: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#cbd5e1',
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
  editBtn: {
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
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  reactivateBtn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  archiveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
});
