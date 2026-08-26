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

function extractUserRole(data: any): UserRole {
  const roles: string[] = Array.isArray(data?.roles) ? data.roles : [];
  const singleRole: string = data?.role || '';
  const all = [...roles, singleRole].map(r => String(r).toUpperCase());

  if (all.some(r => r.includes('SUPER_ADMIN'))) return 'SUPER_ADMIN';
  if (all.some(r => r.includes('SUPPORT'))) return 'SUPPORT';
  if (all.some(r => r.includes('OWNER') || r === 'ADMIN')) return 'ADMIN';
  if (all.some(r => r.includes('PROPERTY_MANAGER'))) return 'PROPERTY_MANAGER';
  if (all.some(r => r.includes('RECEPTIONIST'))) return 'RECEPTIONIST';
  if (all.some(r => r.includes('ACCOUNTANT'))) return 'ACCOUNTANT';
  if (all.some(r => r.includes('SECURITY_GUARD'))) return 'SECURITY_GUARD';
  if (all.some(r => r.includes('STAFF'))) return 'STAFF';
  if (all.some(r => r.includes('TENANT'))) return 'TENANT';

  return 'PROPERTY_MANAGER';
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthSession | { requires2FA: true; email: string; otpDev?: string; message: string }> {
    try {
      const res = await api.post('/auth/login', {
        email: payload.email,
        password: payload.password,
      });

      const data = res.data;
      if (data.mustChangePassword) {
        return {
          mustChangePassword: true,
          email: data.email,
          message: data.message || 'First-time login detected. Please change your password.',
        } as any;
      }

      if (data.requires2FA) {
        return {
          requires2FA: true,
          email: data.email,
          otpDev: data.otpDev,
          message: data.message,
        };
      }

      const token = data.accessToken || data.token;

      // Determine UserRole
      const role: UserRole = extractUserRole(data);
      const userEmail = data.email || payload.email;
      const name = data.name || (userEmail ? CharacterUpper(userEmail.split('@')[0]) : 'User');

      const user: User = {
        id: data.id,
        name: name,
        email: userEmail,
        phone: data.phone || data.mobile || '',
        avatarUrl: data.avatarUrl || '',
        role: role,
        status: 'active',
        propertyIds: data.propertyIds || [],
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const session: AuthSession = { token, user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(TOKEN_KEY, token);
      if (data.refreshToken) {
        localStorage.setItem('stayeaze_refresh_token', data.refreshToken);
      }
      return session;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid email or password';
      throw new Error(msg);
    }
  },

  async verify2FA(email: string, otp: string): Promise<AuthSession> {
    try {
      const res = await api.post('/auth/verify-2fa', { email, otp });
      const data = res.data;
      const token = data.accessToken || data.token;

      const role: UserRole = extractUserRole(data);
      const userEmail = data.email || email;
      const name = data.name || (userEmail ? CharacterUpper(userEmail.split('@')[0]) : 'User');

      const user: User = {
        id: data.id,
        name: name,
        email: userEmail,
        phone: data.phone || data.mobile || '',
        avatarUrl: data.avatarUrl || '',
        role: role,
        status: 'active',
        propertyIds: data.propertyIds || [],
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        twoFactorEnabled: true,
      };

      const session: AuthSession = { token, user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(TOKEN_KEY, token);
      if (data.refreshToken) {
        localStorage.setItem('stayeaze_refresh_token', data.refreshToken);
      }
      return session;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Invalid or expired 2FA code';
      throw new Error(msg);
    }
  },

  async resend2FA(email: string): Promise<{ message: string; otpDev?: string }> {
    try {
      const res = await api.post('/auth/resend-2fa', { email });
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend code';
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
      const res = await api.get('/users/me');
      const data = res.data;

      const updatedUser: User = {
        id: data.id,
        name: data.name || data.firstName || 'User',
        email: data.email,
        phone: data.mobile || data.phone || '',
        avatarUrl: data.avatarUrl || '',
        role: extractUserRole(data),
        status: 'active',
        propertyIds: data.propertyIds || [],
        lastActive: new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
      };

      const updatedSession: AuthSession = { token, user: updatedUser };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
      return updatedUser;
    } catch (e) {
      try {
        const session = JSON.parse(raw) as AuthSession;
        return session.user;
      } catch {
        this.logout();
        return null;
      }
    }
  },

  logout() {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('stayeaze_refresh_token');
    localStorage.removeItem('stayeaze-auth');
  },

  // keep import used
  _api: api,
};

function CharacterUpper(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
