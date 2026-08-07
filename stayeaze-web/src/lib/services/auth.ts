import api from '../api';
import type { User, UserRole } from '../types';

const SESSION_KEY = 'stayeaze_session';
const TOKEN_KEY = 'stayeaze_token';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

// Demo accounts (mock auth — replace with real Spring Boot auth later).
const demoAccounts: Record<string, { password: string; user: User }> = {
  'superadmin@stayeaze.in': { password: 'admin123', user: mockUser('user-1', 'Arjun Mehta', 'superadmin@stayeaze.in', 'SUPER_ADMIN') },
  'admin@stayeaze.in': { password: 'admin123', user: mockUser('user-2', 'Priya Reddy', 'admin@stayeaze.in', 'ADMIN') },
  'manager@stayeaze.in': { password: 'admin123', user: mockUser('user-3', 'Sai Nair', 'manager@stayeaze.in', 'PROPERTY_MANAGER') },
};

function mockUser(id: string, name: string, email: string, role: UserRole): User {
  return {
    id, name, email, phone: '+91 98000 00000', role, status: 'active',
    propertyIds: role === 'SUPER_ADMIN' ? [] : role === 'ADMIN' ? ['prop-1', 'prop-2'] : ['prop-1'],
    lastActive: new Date().toISOString(), createdAt: '2024-01-01T00:00:00Z',
  };
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession> {
    try {
      const res = await api.post('/auth/login', {
        email: payload.email,
        password: payload.password,
      });

      const data = res.data;
      const token = data.accessToken || data.token;

      // Determine UserRole
      let role: UserRole = 'PROPERTY_MANAGER';
      if (data.roles) {
        if (data.roles.includes('ROLE_SUPER_ADMIN')) role = 'SUPER_ADMIN';
        else if (data.roles.includes('ROLE_OWNER')) role = 'ADMIN';
        else if (data.roles.includes('ROLE_PROPERTY_MANAGER')) role = 'PROPERTY_MANAGER';
      }

      const namePart = data.email.split('@')[0];
      const name = CharacterUpper(namePart);

      const user: User = {
        id: data.id,
        name: name,
        email: data.email,
        phone: data.mobile || '+91 99999 99999',
        role: role,
        status: 'active',
        propertyIds: [],
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const session: AuthSession = { token, user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(TOKEN_KEY, token);
      return session;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      throw new Error(msg);
    }
  },

  async me(): Promise<User | null> {
    const raw = localStorage.getItem(SESSION_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!raw || !token) {
      this.logout();
      return null;
    }
    try {
      const session = JSON.parse(raw) as AuthSession;
      return session.user;
    } catch {
      this.logout();
      return null;
    }
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('stayeaze-auth');
  },

  demoAccounts: [
    { role: 'Super Admin', email: 'admin@stayeaze.com', password: 'admin123' },
    { role: 'Admin (Owner)', email: 'owner@stayeaze.com', password: 'owner123' },
    { role: 'Property Manager', email: 'manager@stayeaze.com', password: 'manager123' },
  ],

  // keep import used
  _api: api,
};

function CharacterUpper(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
