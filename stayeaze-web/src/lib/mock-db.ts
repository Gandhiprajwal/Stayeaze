import type { Paginated, QueryParams } from './types';

// In-memory data store map. Each resource returns a shallow-cloned array
// so consumers can sort/filter without mutating the seed.
import {
  auditLogs, beds, bookings, buildings, checkIns, checkOuts,
  complaints, floors, invoices, maintenance, payments, properties, roles,
  rooms, tenants, users, visitors,
} from './mock-data';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: Record<string, any[]> = {
  users,
  roles,
  properties,
  buildings,
  floors,
  rooms,
  beds,
  tenants,
  bookings,
  checkIns,
  checkOuts,
  invoices,
  payments,
  complaints,
  maintenance,
  visitors,
  auditLogs,
};

export function paginate<T>(items: T[], params: QueryParams = {}): Paginated<T> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyQuery<T extends Record<string, any>>(items: T[], params: QueryParams = {}, searchFields: string[]): T[] {
  let result = [...items];

  // search
  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter((item) =>
      searchFields.some((f) => {
        const v = item[f];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }

  // filters
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (!value || value === 'all') continue;

      // Date range filters: keys like "createdAt_from" / "createdAt_to"
      if (key.endsWith('_from')) {
        const field = key.slice(0, -5);
        result = result.filter((item) => {
          const v = item[field];
          return v != null && new Date(String(v)) >= new Date(value);
        });
        continue;
      }
      if (key.endsWith('_to')) {
        const field = key.slice(0, -3);
        result = result.filter((item) => {
          const v = item[field];
          return v != null && new Date(String(v)) <= new Date(value);
        });
        continue;
      }

      // Exact match filters
      result = result.filter((item) => String(item[key]).toLowerCase() === String(value).toLowerCase());
    }
  }

  // sort
  if (params.sortBy) {
    const { sortBy, sortOrder = 'asc' } = params;
    result.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      return sortOrder === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }

  return result;
}
