import { createCrudService } from './crud';
import type {
  AuditLog, Bed, Booking, Building, CheckIn, CheckOut, Complaint, Floor,
  Invoice, Maintenance, Payment, Property, Role, Room, Tenant, User, Visitor,
} from '../types';

export const userService = createCrudService<User>('/users');
export const roleService = createCrudService<Role>('/roles');
export const propertyService = createCrudService<Property>('/properties');
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
