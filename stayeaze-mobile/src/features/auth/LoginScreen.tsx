import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Building2, Lock, Mail, Server, Check, Edit2 } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { getBaseUrl, setCustomApiUrl } from '../../api/client';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUrl, setCurrentUrl] = useState('Loading...');
  const [editingUrl, setEditingUrl] = useState(false);
  const [newServerIp, setNewServerIp] = useState('');

  const { login, isLoading } = useAuthStore();

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
    Alert.alert('Server IP Updated', `Backend API URL updated to:\n${updated}`);
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return;
    }
    if (!password) {
      Alert.alert('Validation Error', 'Please enter your password');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Building2 size={32} color="#ffffff" />
          </View>
          <Text style={styles.title}>StayEaze Mobile</Text>
          <Text style={styles.subtitle}>Universal Platform for Super Admin, Owners & Staff</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <Input
            label="Work Email"
            placeholder="admin@stayeaze.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon={<Mail size={18} color="#64748b" />}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon={<Lock size={18} color="#64748b" />}
          />

          <Button
            title="Sign In to Mobile Console"
            onPress={handleLogin}
            loading={isLoading}
            style={{ marginTop: 12 }}
          />

          {/* Quick Role Credentials Assistant */}
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Supported Accounts & Roles:</Text>
            <Text style={styles.demoText}>• Super Admin: admin@stayeaze.com / admin123</Text>
            <Text style={styles.demoText}>• Property Owner: owner@stayeaze.com / owner123</Text>
            <Text style={styles.demoText}>• Manager: manager@stayeaze.com / manager123</Text>
          </View>

          {/* Active Server URL Bar */}
          <View style={styles.serverBox}>
            <View style={styles.serverHeader}>
              <Server size={14} color="#2563eb" />
              <Text style={styles.serverLabel}>Target Backend URL:</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditingUrl(!editingUrl)}>
                <Text style={styles.editBtnText}>{editingUrl ? 'Cancel' : 'Edit IP'}</Text>
              </TouchableOpacity>
            </View>

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
              <Text style={styles.serverUrlText} numberOfLines={1}>
                {currentUrl}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  demoBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  demoText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  serverBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  serverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serverLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e40af',
    marginLeft: 4,
    flex: 1,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#2563eb',
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  serverUrlText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
