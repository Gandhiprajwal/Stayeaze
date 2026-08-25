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
  setAuth: (user: User, token: string) => void;
  updateUser: (partialUser: Partial<User>) => void;
  hydrate: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      setAuth(user, token) {
        const session = { token, user };
        localStorage.setItem('stayeaze_session', JSON.stringify(session));
        localStorage.setItem('stayeaze_token', token);
        set({ user, token, isLoading: false, error: null });
      },

      updateUser(partialUser) {
        const current = get().user;
        if (!current) return;
        const updated = { ...current, ...partialUser };
        const token = get().token || localStorage.getItem('stayeaze_token') || '';
        localStorage.setItem('stayeaze_session', JSON.stringify({ token, user: updated }));
        set({ user: updated });
      },

      async login(email, password) {
        set({ isLoading: true, error: null });
        try {
          const session = await authService.login({ email, password });
          if ('token' in session && 'user' in session) {
            set({ user: session.user, token: session.token, isLoading: false });
          }
        } catch (e) {
          set({ isLoading: false, error: (e as Error).message });
          throw e;
        }
      },

      async hydrate() {
        const token = localStorage.getItem('stayeaze_token');
        const rawSession = localStorage.getItem('stayeaze_session');

        // Optimistic recovery: render instantly from valid local storage
        if (rawSession && token) {
          try {
            const parsed = JSON.parse(rawSession);
            if (parsed.user) {
              set({ user: parsed.user, token });
            }
          } catch (ignored) {}
        }

        if (!token) {
          set({ user: null, token: null });
          return;
        }

        // Try to verify token and sync latest user profile
        try {
          const user = await authService.me();
          if (user) {
            set({ user, token });
            return;
          }
        } catch (_meErr) {
          // /users/me failed — attempt silent refresh
        }

        // Proactively try silent token refresh via relative same-origin proxy
        try {
          const storedRefreshToken = localStorage.getItem('stayeaze_refresh_token');
          const { default: axios } = await import('axios');
          const refreshEndpoint = (import.meta.env.VITE_API_URL || '/api/v1') + '/auth/refresh';

          const refreshRes = await axios.post(
            refreshEndpoint,
            { refreshToken: storedRefreshToken || undefined },
            { withCredentials: true, timeout: 10000 }
          );

          const newAccessToken = refreshRes.data?.accessToken || refreshRes.data?.token;
          const newRefreshToken = refreshRes.data?.refreshToken;
          if (newAccessToken) {
            localStorage.setItem('stayeaze_token', newAccessToken);
            if (newRefreshToken) {
              localStorage.setItem('stayeaze_refresh_token', newRefreshToken);
            }
            // Retry fetching the user profile with the new token
            const refreshedUser = await authService.me();
            if (refreshedUser) {
              set({ user: refreshedUser, token: newAccessToken });
              return;
            }
          }
        } catch (refreshErr: any) {
          const isExplicitAuthFailure =
            refreshErr?.response?.status === 401 ||
            refreshErr?.response?.status === 403;

          // Only purge if backend explicitly rejected credentials as invalid
          if (isExplicitAuthFailure) {
            authService.logout();
            set({ user: null, token: null });
          }
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

// Listen to multi-tab storage updates
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'stayeaze_token' && event.newValue) {
      const rawSession = localStorage.getItem('stayeaze_session');
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed.user) {
            useAuthStore.setState({ user: parsed.user, token: event.newValue });
          }
        } catch (ignored) {}
      }
    }
  });
}
