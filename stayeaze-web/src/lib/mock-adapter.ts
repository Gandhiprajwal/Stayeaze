import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { db, applyQuery, paginate } from './mock-db';
import type { QueryParams } from './types';

// Maps URL patterns to a resource + searchable fields.
const resourceMap: Record<string, { resource: string; searchFields: string[] }> = {
  '/users': { resource: 'users', searchFields: ['name', 'email', 'phone', 'role'] },
  '/roles': { resource: 'roles', searchFields: ['name', 'description'] },
  '/properties': { resource: 'properties', searchFields: ['name', 'code', 'city', 'manager'] },
  '/buildings': { resource: 'buildings', searchFields: ['name', 'code'] },
  '/floors': { resource: 'floors', searchFields: ['name'] },
  '/rooms': { resource: 'rooms', searchFields: ['number', 'type'] },
  '/beds': { resource: 'beds', searchFields: ['number', 'status'] },
  '/tenants': { resource: 'tenants', searchFields: ['name', 'email', 'phone', 'roomNumber'] },
  '/bookings': { resource: 'bookings', searchFields: ['bookingCode', 'tenantName', 'tenantEmail'] },
  '/check-ins': { resource: 'checkIns', searchFields: ['code', 'tenantName'] },
  '/check-outs': { resource: 'checkOuts', searchFields: ['code', 'tenantName'] },
  '/invoices': { resource: 'invoices', searchFields: ['invoiceNumber', 'tenantName'] },
  '/payments': { resource: 'payments', searchFields: ['receiptNumber', 'tenantName'] },
  '/complaints': { resource: 'complaints', searchFields: ['ticketNumber', 'tenantName', 'description'] },
  '/maintenance': { resource: 'maintenance', searchFields: ['ticketNumber', 'asset', 'description'] },
  '/visitors': { resource: 'visitors', searchFields: ['visitorName', 'tenantName'] },
  '/audit-logs': { resource: 'auditLogs', searchFields: ['user', 'action', 'module'] },
  '/super-admin/system-logs': { resource: 'auditLogs', searchFields: ['user', 'action', 'module'] },
};

function matchResource(url: string) {
  const clean = url.split('?')[0].replace(/^\/api\/v1/, '');
  for (const [key, value] of Object.entries(resourceMap)) {
    if (clean === key || clean.startsWith(key + '/')) {
      return { ...value, clean };
    }
  }
  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseQueryParams(params?: Record<string, unknown>): QueryParams {
  if (!params) return {};
  return {
    page: params.page ? Number(params.page) : undefined,
    pageSize: params.pageSize ? Number(params.pageSize) : undefined,
    search: params.search as string | undefined,
    sortBy: params.sortBy as string | undefined,
    sortOrder: params.sortOrder as 'asc' | 'desc' | undefined,
    filters: params.filters as QueryParams['filters'],
  };
}

export const mockAdapter = {
  async onGet(config: InternalAxiosRequestConfig) {
    const match = matchResource(config.url || '');
    if (!match) return null;

    const { resource, searchFields, clean } = match;
    // detail by id
    const idMatch = clean.match(/\/([^/]+)$/);
    if (idMatch && idMatch[1] !== resource && !clean.endsWith(resource)) {
      const id = idMatch[1];
      const record = db[resource].find((r) => r.id === id);
      if (!record) {
        await delay(200);
        return { status: 404, data: { message: 'Record not found' } };
      }
      await delay(180);
      return { status: 200, data: record };
    }

    const params = parseQueryParams(config.params as Record<string, unknown>);
    const filtered = applyQuery(db[resource], params, searchFields);
    const result = paginate(filtered, params);
    await delay(250);
    return { status: 200, data: result };
  },

  async onPost(config: InternalAxiosRequestConfig) {
    const match = matchResource(config.url || '');
    if (!match) return null;
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const newRecord = { ...body, id: `${match.resource}-${Date.now()}`, createdAt: new Date().toISOString() };
    db[match.resource].unshift(newRecord);
    await delay(300);
    return { status: 201, data: newRecord };
  },

  async onPut(config: InternalAxiosRequestConfig) {
    const match = matchResource(config.url || '');
    if (!match) return null;
    const clean = match.clean;
    const id = clean.split('/').pop() as string;
    const idx = db[match.resource].findIndex((r) => r.id === id);
    if (idx === -1) {
      await delay(200);
      return { status: 404, data: { message: 'Record not found' } };
    }
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    db[match.resource][idx] = { ...db[match.resource][idx], ...body };
    await delay(280);
    return { status: 200, data: db[match.resource][idx] };
  },

  async onDelete(config: InternalAxiosRequestConfig) {
    const match = matchResource(config.url || '');
    if (!match) return null;
    const clean = match.clean;
    const id = clean.split('/').pop() as string;
    const idx = db[match.resource].findIndex((r) => r.id === id);
    if (idx === -1) {
      await delay(200);
      return { status: 404, data: { message: 'Record not found' } };
    }
    db[match.resource].splice(idx, 1);
    await delay(220);
    return { status: 204, data: null };
  },
};

const mock = {
  attach(instance: AxiosInstance) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const method = (config.method || 'get').toLowerCase();
      let result: { status: number; data: unknown } | null = null;
      try {
        if (method === 'get') result = await mockAdapter.onGet(config);
        else if (method === 'post') result = await mockAdapter.onPost(config);
        else if (method === 'put') result = await mockAdapter.onPut(config);
        else if (method === 'delete') result = await mockAdapter.onDelete(config);
      } catch (e) {
        return Promise.reject({ response: { status: 500, data: { message: (e as Error).message } } });
      }

      if (!result) {
        return Promise.reject({
          response: { status: 404, data: { message: `No mock handler for ${config.method?.toUpperCase()} ${config.url}` } },
        });
      }

      if (result.status >= 400) {
        return Promise.reject({ response: result });
      }
      return {
        data: result.data,
        status: result.status,
        statusText: 'OK',
        headers: {},
        config,
      } as never;
    };
  },
};

export default mock;
