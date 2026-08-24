import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Settings as SettingsIcon, User, Server, LogOut, ShieldCheck, Database, RefreshCw } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { getBaseUrl, setCustomApiUrl } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [currentUrl, setCurrentUrl] = useState('Loading...');
  const [editingUrl, setEditingUrl] = useState(false);
  const [newServerIp, setNewServerIp] = useState('');

  useEffect(() => {
    getBaseUrl().then((url) => {
      setCurrentUrl(url);
      setNewServerIp(url);
    });
  }, []);

  const handleSaveServerIp = async () => {
    if (!newServerIp.trim()) return;
    await setCustomApiUrl(newServerIp.trim());
    const updated = await getBaseUrl();
    setCurrentUrl(updated);
    setEditingUrl(false);
    Alert.alert('Server URL Updated', `Backend API URL set to:\n${updated}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Settings & Profile</Text>
        <Text style={styles.screenSub}>Account details, server endpoint & app settings</Text>
      </View>

      {/* Profile Card */}
      <Card style={styles.card}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{(user?.name || 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name || 'User Profile'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@stayeaze.com'}</Text>
          </View>
          <Badge label={user?.role || 'ADMIN'} variant={user?.role === 'SUPER_ADMIN' ? 'danger' : 'indigo'} />
        </View>
      </Card>

      {/* Backend API Server Endpoint Configuration */}
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Server size={18} color="#2563eb" />
          <Text style={styles.sectionTitle}>Target Backend API URL</Text>
        </View>
        <Text style={styles.currentUrlText}>{currentUrl}</Text>

        {editingUrl ? (
          <View style={{ marginTop: 8 }}>
            <Input
              placeholder="e.g. 192.168.1.5:8080 or localhost:8080"
              value={newServerIp}
              onChangeText={setNewServerIp}
            />
            <Button title="Save Server URL" onPress={handleSaveServerIp} style={{ height: 38, marginTop: 4 }} />
          </View>
        ) : (
          <Button
            title="Edit Server IP Endpoint"
            onPress={() => setEditingUrl(true)}
            variant="outline"
            style={{ marginTop: 8, height: 38 }}
          />
        )}
      </Card>

      {/* App Version Info */}
      <Card style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>StayEaze Mobile Version</Text>
          <Text style={styles.infoVal}>v1.0.0 (Expo SDK 51+)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Target Backend Version</Text>
          <Text style={styles.infoVal}>v1.0.0 REST API</Text>
        </View>
      </Card>

      {/* Logout Action */}
      <Button
        title="Sign Out of Session"
        onPress={logout}
        variant="danger"
        icon={<LogOut size={16} color="#ffffff" />}
        style={{ marginTop: 12 }}
      />
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  currentUrlText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    fontFamily: 'monospace',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
});
