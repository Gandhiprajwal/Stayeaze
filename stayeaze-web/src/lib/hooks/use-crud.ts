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
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || `Failed to create ${label.toLowerCase()}`;
      toast.error(msg);
    },
  });
}

export function useUpdate<T extends { id?: string }>(endpoint: string, label = 'Record') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<T> }) => {
      const { data } = await api.put<T>(`${endpoint}/${id}`, payload);
      return data;
    },
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: [endpoint] });
      const previousData = qc.getQueryData([endpoint]);
      qc.setQueriesData({ queryKey: [endpoint] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((item: any) => (item.id === id ? { ...item, ...payload } : item));
        }
        if (old.data && Array.isArray(old.data)) {
          return {
            ...old,
            data: old.data.map((item: any) => (item.id === id ? { ...item, ...payload } : item)),
          };
        }
        return old;
      });
      return { previousData };
    },
    onError: (e: any, _vars, context: any) => {
      if (context?.previousData) {
        qc.setQueryData([endpoint], context.previousData);
      }
      const msg = e?.response?.data?.message || e?.message || `Failed to update ${label.toLowerCase()}`;
      toast.error(msg);
    },
    onSuccess: () => {
      toast.success(`${label} updated successfully`);
    },
    onSettled: () => {
      invalidateAllRelated(qc, endpoint);
    },
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
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const setValue = <K extends keyof T>(key: K, value: T[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const setFieldTouched = <K extends keyof T>(key: K, isTouched = true) =>
    setTouched((t) => ({ ...t, [key]: isTouched }));

  const reset = (next?: T) => {
    setValues(next ?? initial);
    setErrors({});
    setTouched({});
  };

  const validateField = <K extends keyof T>(key: K, rule?: (v: unknown) => string | undefined) => {
    if (!rule) return undefined;
    const msg = rule(values[key]);
    setErrors((prev) => ({ ...prev, [key]: msg }));
    setTouched((prev) => ({ ...prev, [key]: true }));
    return msg;
  };

  const handleBlur = <K extends keyof T>(key: K, rule?: (v: unknown) => string | undefined) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    if (rule) {
      const msg = rule(values[key]);
      setErrors((prev) => ({ ...prev, [key]: msg }));
    }
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
    // Mark all rules as touched when overall validate is called
    const allTouched: Partial<Record<keyof T, boolean>> = {};
    for (const key in rules) { allTouched[key] = true; }
    setTouched(allTouched);

    if (!valid) {
      toast.error('Please fill in all required fields marked with *');
    }
    return valid;
  };

  return { values, errors, touched, setValue, setFieldTouched, handleBlur, validateField, reset, validate, setErrors };
}

// List fetcher bound to an endpoint — used by pages that need raw data
// alongside the DataTable (e.g. to populate select options).
export function listFetcher<T>(endpoint: string) {
  return async (params?: QueryParams) => {
    const { data } = await api.get<{ data: T[] }>(endpoint, { params });
    return data.data;
  };
}
