import { create } from 'zustand';
import api, { getStoredToken, setStoredToken, removeStoredToken } from '../api/client';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  setAuth: (user: User, token: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,
  error: null,

  setAuth: async (user: User, token: string) => {
    await setStoredToken(token);
    set({ user, token, isLoading: false, error: null });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data;
      const token = data.accessToken || data.token;

      let role: UserRole = 'ADMIN';
      if (data.roles) {
        if (data.roles.includes('ROLE_SUPER_ADMIN') || data.roles.includes('SUPER_ADMIN')) role = 'SUPER_ADMIN';
        else if (data.roles.includes('ROLE_OWNER') || data.roles.includes('OWNER') || data.roles.includes('ROLE_ADMIN') || data.roles.includes('ADMIN')) role = 'ADMIN';
        else if (data.roles.includes('ROLE_PROPERTY_MANAGER') || data.roles.includes('PROPERTY_MANAGER')) role = 'PROPERTY_MANAGER';
        else if (data.roles.includes('ROLE_TENANT') || data.roles.includes('TENANT')) role = 'TENANT';
      }

      const user: User = {
        id: data.id,
        name: data.email ? data.email.split('@')[0].toUpperCase() : 'USER',
        email: data.email,
        phone: data.mobile || '+91 99999 99999',
        role: role,
        status: 'active',
        propertyIds: [],
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        orgId: data.orgId,
      };

      await setStoredToken(token);
      set({ user, token, isLoading: false, error: null });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  logout: async () => {
    await removeStoredToken();
    set({ user: null, token: null, isLoading: false, error: null });
  },

  hydrate: async () => {
    try {
      const token = await getStoredToken();
      if (!token) {
        set({ user: null, token: null, isHydrated: true });
        return;
      }

      const res = await api.get('/auth/me');
      const data = res.data;
      
      let role: UserRole = 'ADMIN';
      if (data.roles) {
        if (data.roles.includes('ROLE_SUPER_ADMIN')) role = 'SUPER_ADMIN';
        else if (data.roles.includes('ROLE_OWNER') || data.roles.includes('ROLE_ADMIN')) role = 'ADMIN';
        else if (data.roles.includes('ROLE_PROPERTY_MANAGER')) role = 'PROPERTY_MANAGER';
      }

      const user: User = {
        id: data.id || 'usr_me',
        name: data.email ? data.email.split('@')[0].toUpperCase() : 'USER',
        email: data.email,
        phone: data.phone || '+91 99999 99999',
        role: role,
        status: 'active',
        propertyIds: [],
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      set({ user, token, isHydrated: true });
    } catch {
      await removeStoredToken();
      set({ user: null, token: null, isHydrated: true });
    }
  },

  clearError: () => set({ error: null }),
}));
