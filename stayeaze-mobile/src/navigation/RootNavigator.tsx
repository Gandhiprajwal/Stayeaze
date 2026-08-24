import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Building2, Home, Users, Receipt, MessageSquareWarning, Sparkles, ShieldCheck, Terminal, Activity } from 'lucide-react-native';

import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from '../features/auth/LoginScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { SuperAdminScreen } from '../features/super-admin/SuperAdminScreen';
import { PropertiesScreen } from '../features/properties/PropertiesScreen';
import { TenantsScreen } from '../features/tenants/TenantsScreen';
import { InvoicesScreen } from '../features/billing/InvoicesScreen';
import { ComplaintsScreen } from '../features/complaints/ComplaintsScreen';
import { SubscriptionScreen } from '../features/subscription/SubscriptionScreen';

import { SystemLogsScreen } from '../features/super-admin/SystemLogsScreen';
import { InfraHealthScreen } from '../features/super-admin/InfraHealthScreen';
import { UsersScreen } from '../features/users/UsersScreen';
import { RolesScreen } from '../features/roles/RolesScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { user } = useAuthStore();

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const isManager = user?.role === 'PROPERTY_MANAGER';
  const isTenant = user?.role === 'TENANT';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />

      {isSuperAdmin && (
        <Tab.Screen
          name="Subscribers"
          component={SuperAdminScreen}
          options={{
            tabBarLabel: 'Subscribers',
            tabBarIcon: ({ color, size }) => <ShieldCheck size={size} color={color} />,
          }}
        />
      )}

      {isSuperAdmin && (
        <Tab.Screen
          name="SystemLogsTab"
          component={SystemLogsScreen}
          options={{
            tabBarLabel: 'Logs',
            tabBarIcon: ({ color, size }) => <Terminal size={size} color={color} />,
          }}
        />
      )}

      {isSuperAdmin && (
        <Tab.Screen
          name="InfraHealthTab"
          component={InfraHealthScreen}
          options={{
            tabBarLabel: 'Health',
            tabBarIcon: ({ color, size }) => <Activity size={size} color={color} />,
          }}
        />
      )}

      {!isTenant && !isSuperAdmin && (
        <Tab.Screen
          name="Properties"
          component={PropertiesScreen}
          options={{
            tabBarLabel: 'Properties',
            tabBarIcon: ({ color, size }) => <Building2 size={size} color={color} />,
          }}
        />
      )}

      {!isTenant && !isSuperAdmin && (
        <Tab.Screen
          name="Tenants"
          component={TenantsScreen}
          options={{
            tabBarLabel: 'Tenants',
            tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
          }}
        />
      )}

      {!isSuperAdmin && (
        <Tab.Screen
          name="Invoices"
          component={InvoicesScreen}
          options={{
            tabBarLabel: isTenant ? 'My Rent' : 'Invoices',
            tabBarIcon: ({ color, size }) => <Receipt size={size} color={color} />,
          }}
        />
      )}

      {!isSuperAdmin && (
        <Tab.Screen
          name="Complaints"
          component={ComplaintsScreen}
          options={{
            tabBarLabel: 'Complaints',
            tabBarIcon: ({ color, size }) => <MessageSquareWarning size={size} color={color} />,
          }}
        />
      )}

      {isOwner && (
        <Tab.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{
            tabBarLabel: 'SaaS Plan',
            tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
          }}
        />
      )}
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const { user, token, isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user || !token ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Properties" component={PropertiesScreen} />
            <Stack.Screen name="Users" component={UsersScreen} />
            <Stack.Screen name="Roles" component={RolesScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="SystemLogs" component={SystemLogsScreen} />
            <Stack.Screen name="InfraHealth" component={InfraHealthScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
