import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const TOKEN_KEY = 'stayeaze_token';
const API_URL_KEY = 'stayeaze_custom_api_url';

let activeBaseUrl: string | null = null;

// Dynamically extract computer LAN IP address from Expo Constants for physical mobile devices
export const getBaseUrl = async (): Promise<string> => {
  if (activeBaseUrl) return activeBaseUrl;

  try {
    const custom = Platform.OS === 'web' ? localStorage.getItem(API_URL_KEY) : await SecureStore.getItemAsync(API_URL_KEY);
    if (custom && custom.trim()) {
      activeBaseUrl = custom.trim();
      return activeBaseUrl;
    }
  } catch {}

  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.developer?.inputs?.find((i: any) => i.type === 'http')?.url;
  
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      activeBaseUrl = `http://${ip}:8080/api/v1`;
      return activeBaseUrl;
    }
  }

  if (Platform.OS === 'android') {
    activeBaseUrl = 'http://10.0.2.2:8080/api/v1';
    return activeBaseUrl;
  }
  activeBaseUrl = 'http://localhost:8080/api/v1';
  return activeBaseUrl;
};

export const setCustomApiUrl = async (url: string): Promise<void> => {
  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  if (!cleanUrl.endsWith('/api/v1')) {
    cleanUrl = cleanUrl.endsWith('/') ? `${cleanUrl}api/v1` : `${cleanUrl}/api/v1`;
  }
  activeBaseUrl = cleanUrl;
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(API_URL_KEY, cleanUrl);
    } else {
      await SecureStore.setItemAsync(API_URL_KEY, cleanUrl);
    }
  } catch {}
};

export const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor updates target baseURL dynamically before request execution
api.interceptors.request.use(async (config) => {
  const currentBase = await getBaseUrl();
  config.baseURL = currentBase;
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Secure Store helpers for cross-platform JWT persistence
export const getStoredToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = async (token: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (err) {
    console.error('Failed to store auth token:', err);
  }
};

export const removeStoredToken = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to remove auth token:', err);
  }
};

// Request Interceptor — auto-attach Bearer Token
api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Recursively normalize status field casing (e.g. "ACTIVE" -> "active")
function normalizeStatus(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(normalizeStatus);
  if (data && typeof data === 'object' && data !== null) {
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

// Response Interceptor — normalize data payloads & handles errors
api.interceptors.response.use(
  (response) => {
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
    if (error?.response?.status === 401) {
      await removeStoredToken();
    }
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default api;
