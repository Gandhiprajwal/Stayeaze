import { createCrudService } from './crud';
import type {
  AuditLog, Bed, Booking, Building, CheckIn, CheckOut, Complaint, Floor,
  Invoice, Maintenance, Payment, Property, Role, Room, Tenant, User, Visitor,
} from '../types';

import api from '../api';

export const userService = createCrudService<User>('/users');
export const roleService = createCrudService<Role>('/roles');
export const propertyService = {
  ...createCrudService<Property>('/properties'),
  async getMinimal() {
    const res = await api.get('/properties/minimal');
    const payload = res.data as any;
    if (Array.isArray(payload)) return payload as Partial<Property>[];
    if (payload && Array.isArray(payload.data)) return payload.data as Partial<Property>[];
    return [] as Partial<Property>[];
  },
};
export const buildingService = createCrudService<Building>('/buildings');
export const floorService = createCrudService<Floor>('/floors');
export const roomService = createCrudService<Room>('/rooms');
export const bedService = createCrudService<Bed>('/beds');
export const tenantService = createCrudService<Tenant>('/tenants');
export const bookingService = createCrudService<Booking>('/bookings');
export const checkInService = createCrudService<CheckIn>('/check-ins');
export const checkOutService = createCrudService<CheckOut>('/check-outs');
export const invoiceService = createCrudService<Invoice>('/invoices');
export const paymentService = createCrudService<Payment>('/payments');
export const complaintService = createCrudService<Complaint>('/complaints');
export const maintenanceService = createCrudService<Maintenance>('/maintenance');
export const visitorService = createCrudService<Visitor>('/visitors');
export const auditLogService = createCrudService<AuditLog>('/audit-logs');
