import api from '../api';
import type { Paginated, QueryParams } from '../types';

export interface CrudService<T> {
  list: (params?: QueryParams) => Promise<Paginated<T>>;
  getById: (id: string) => Promise<T>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  remove: (id: string) => Promise<void>;
}

export function createCrudService<T>(endpoint: string): CrudService<T> {
  return {
    async list(params?: QueryParams) {
      const { data } = await api.get<Paginated<T>>(endpoint, { params });
      return data;
    },
    async getById(id: string) {
      const { data } = await api.get<T>(`${endpoint}/${id}`);
      return data;
    },
    async create(payload: Partial<T>) {
      const { data } = await api.post<T>(endpoint, payload);
      return data;
    },
    async update(id: string, payload: Partial<T>) {
      const { data } = await api.put<T>(`${endpoint}/${id}`, payload);
      return data;
    },
    async remove(id: string) {
      await api.delete(`${endpoint}/${id}`);
    },
  };
}
