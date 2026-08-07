import axios from 'axios';
import MockAdapter from './mock-adapter';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
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

// Response interceptor — normalise errors, wrap plain list arrays, and fix status casing.
api.interceptors.response.use(
  (response) => {
    // Normalize all status fields to lowercase (backend sends ACTIVE, frontend expects active)
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
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('stayeaze_session');
      localStorage.removeItem('stayeaze_token');
      localStorage.removeItem('stayeaze-auth');

      // Redirect to login page if we are not already there
      if (!window.location.pathname.startsWith('/login')) {
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
