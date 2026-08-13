import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import type { QueryParams } from '@/lib/types';

function invalidateAllRelated(qc: ReturnType<typeof useQueryClient>, endpoint: string) {
  const resource = endpoint.replace(/^\//, '');
  qc.invalidateQueries({ queryKey: [endpoint] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  qc.invalidateQueries({ queryKey: ['rep'] });
  qc.invalidateQueries({ queryKey: [`${resource}-stats`] });
  qc.invalidateQueries({
    predicate: (query) => {
      const keys = query.queryKey;
      return Array.isArray(keys) && keys.some(
        (k) => typeof k === 'string' && (k.includes(resource) || k.includes('stats') || k.includes('dashboard') || k.includes('rep'))
      );
    },
  });
}

// Generic mutation helpers for a CRUD endpoint.
export function useCreate<T>(endpoint: string, label = 'Record') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<T>) => {
      const { data } = await api.post<T>(endpoint, payload);
      return data;
    },
    onSuccess: () => {
      invalidateAllRelated(qc, endpoint);
      toast.success(`${label} created successfully`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdate<T>(endpoint: string, label = 'Record') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<T> }) => {
      const { data } = await api.put<T>(`${endpoint}/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      invalidateAllRelated(qc, endpoint);
      toast.success(`${label} updated successfully`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDelete(endpoint: string, label = 'Record') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${endpoint}/${id}`);
    },
    onSuccess: () => {
      invalidateAllRelated(qc, endpoint);
      toast.success(`${label} deleted successfully`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useBulkDelete(endpoint: string, label = 'Records') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.delete(`${endpoint}/${id}`)));
      return ids;
    },
    onSuccess: (ids) => {
      invalidateAllRelated(qc, endpoint);
      toast.success(`${ids.length} ${label} deleted`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Local form-state helper for create/edit dialogs.
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const setValue = <K extends keyof T>(key: K, value: T[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const reset = (next?: T) => {
    setValues(next ?? initial);
    setErrors({});
  };

  const validate = (rules: Partial<Record<keyof T, (v: unknown) => string | undefined>>) => {
    const next: Partial<Record<keyof T, string>> = {};
    let valid = true;
    for (const key in rules) {
      const rule = rules[key];
      if (rule) {
        const msg = rule(values[key]);
        if (msg) { next[key] = msg; valid = false; }
      }
    }
    setErrors(next);
    return valid;
  };

  return { values, errors, setValue, reset, validate, setErrors };
}

// List fetcher bound to an endpoint — used by pages that need raw data
// alongside the DataTable (e.g. to populate select options).
export function listFetcher<T>(endpoint: string) {
  return async (params?: QueryParams) => {
    const { data } = await api.get<{ data: T[] }>(endpoint, { params });
    return data.data;
  };
}
