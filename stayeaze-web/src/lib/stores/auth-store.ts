import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, type AuthSession } from '../services/auth';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      async login(email, password) {
        set({ isLoading: true, error: null });
        try {
          const session: AuthSession = await authService.login({ email, password });
          set({ user: session.user, token: session.token, isLoading: false });
        } catch (e) {
          set({ isLoading: false, error: (e as Error).message });
          throw e;
        }
      },

      async hydrate() {
        const token = localStorage.getItem('stayeaze_token');
        if (!token) {
          authService.logout();
          set({ user: null, token: null });
          return;
        }
        const user = await authService.me();
        if (user) {
          set({ user, token });
        } else {
          authService.logout();
          set({ user: null, token: null });
        }
      },

      logout() {
        authService.logout();
        set({ user: null, token: null });
      },

      clearError() {
        set({ error: null });
      },
    }),
    {
      name: 'stayeaze-auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);
