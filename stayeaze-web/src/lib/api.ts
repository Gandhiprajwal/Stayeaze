import axios from 'axios';
import MockAdapter from './mock-adapter';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach mock adapter (simulates a Spring Boot backend in-memory).
// MockAdapter.attach(api);

// Request interceptor — attach bearer token.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('stayeaze_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Recursively lowercase the 'status' field on any object or array.
function normalizeStatus(data: unknown): unknown {
  if (data instanceof Blob || data instanceof ArrayBuffer || data instanceof FormData) {
    return data;
  }
  if (Array.isArray(data)) return data.map(normalizeStatus);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (key === 'status' && typeof obj[key] === 'string') {
        result[key] = (obj[key] as string).toLowerCase();
      } else {
        result[key] = normalizeStatus(obj[key]);
      }
    }
    return result;
  }
  return data;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor — normalise errors, handle automatic JWT refresh token retry, wrap plain list arrays, and fix status casing.
api.interceptors.response.use(
  (response) => {
    // Skip normalization for Blob or binary responses
    if (response.config.responseType === 'blob' || response.data instanceof Blob || response.data instanceof ArrayBuffer) {
      return response;
    }

    if (response.data) {
      response.data = normalizeStatus(response.data);
    }

    if (response.data && Array.isArray(response.data)) {
      response.data = {
        data: response.data,
        total: response.data.length,
        page: 1,
        pageSize: response.data.length,
        totalPages: 1,
      };
    }
    return response;
  },
  async (error) => {
    const originalRequest = error?.config;

    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry && !originalRequest.url?.includes('/auth/') && !!localStorage.getItem('stayeaze_token')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = localStorage.getItem('stayeaze_refresh_token');
        const refreshRes = await axios.post(
          (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1') + '/auth/refresh',
          { refreshToken: storedRefreshToken || undefined },
          { withCredentials: true }
        );

        const newAccessToken = refreshRes.data?.accessToken || refreshRes.data?.token;
        const newRefreshToken = refreshRes.data?.refreshToken;

        if (newRefreshToken) {
          localStorage.setItem('stayeaze_refresh_token', newRefreshToken);
        }

        if (newAccessToken) {
          localStorage.setItem('stayeaze_token', newAccessToken);

          // Update the Zustand persisted store token so in-memory state is consistent
          const rawSession = localStorage.getItem('stayeaze_session');
          if (rawSession) {
            try {
              const parsedSession = JSON.parse(rawSession);
              parsedSession.token = newAccessToken;
              localStorage.setItem('stayeaze_session', JSON.stringify(parsedSession));
            } catch (ignored) {}
          }
          try {
            const stayeazeAuth = localStorage.getItem('stayeaze-auth');
            if (stayeazeAuth) {
              const authState = JSON.parse(stayeazeAuth);
              if (authState?.state) authState.state.token = newAccessToken;
              localStorage.setItem('stayeaze-auth', JSON.stringify(authState));
            }
          } catch (ignored) {}

          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          isRefreshing = false;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        // Clear stale refresh token so we don't retry with an expired one
        localStorage.removeItem('stayeaze_refresh_token');
      }

      // If refresh token fails or doesn't exist, purge session and redirect
      const publicPaths = ['/pricing', '/', '/about', '/contact', '/faq', '/terms', '/privacy', '/login', '/signup', '/onboard'];
      const currentPath = window.location.pathname;
      const isPublicPage = publicPaths.some((p) => currentPath === p || (p !== '/' && currentPath.startsWith(p)));

      if (!isPublicPage) {
        localStorage.removeItem('stayeaze_session');
        localStorage.removeItem('stayeaze_token');
        localStorage.removeItem('stayeaze-auth');
        window.location.href = '/login';
      }
    }

    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default api;
