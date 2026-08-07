// Domain types shared across the StayEaze back-office.

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PROPERTY_MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'SECURITY_GUARD' | 'STAFF' | 'TENANT';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string;
  propertyIds: string[];
  lastActive: string;
  createdAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  isSystem: boolean;
  createdAt: string;
}

export interface Property {
  id: string;
  name: string;
  code: string;
  type: 'PG' | 'HOSTEL' | 'CO_LIVING';
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalBuildings: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  status: 'active' | 'inactive' | 'maintenance';
  manager: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Building {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  floors: number;
  rooms: number;
  beds: number;
  occupied: number;
  status: 'active' | 'inactive';
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  number: number;
  rooms: number;
  beds: number;
  occupied: number;
}

export interface Room {
  id: string;
  floorId: string;
  buildingId: string;
  propertyId: string;
  number: string;
  type: 'single' | 'double' | 'triple' | 'dorm';
  sharing: number;
  beds: number;
  occupied: number;
  rent: number;
  status: 'available' | 'occupied' | 'partially_occupied' | 'maintenance' | 'reserved' | 'partially_reserved' | 'archived' | 'blocked';
  amenities: string[];
}

export interface Bed {
  id: string;
  roomId: string;
  number: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'archived' | 'blocked';
  tenantId?: string;
  tenantName?: string;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  gender: 'male' | 'female' | 'other';
  dob: string;
  occupation: string;
  idType: 'aadhaar' | 'pan' | 'passport' | 'driving_license';
  idNumber: string;
  emergencyContact: string;
  emergencyName: string;
  propertyId: string;
  buildingName: string;
  roomNumber: string;
  bedNumber: string;
  rent: number;
  deposit: number;
  leaseStart: string;
  leaseEnd: string;
  status: 'active' | 'inactive' | 'notice_period' | 'checked_out';
  photo?: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  propertyId: string;
  roomNumber: string;
  bedNumber: string;
  checkInDate: string;
  durationMonths: number;
  rent: number;
  deposit: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'checked_in';
  source: 'direct' | 'website' | 'agent' | 'referral';
  createdAt: string;
}

export interface CheckIn {
  id: string;
  code: string;
  tenantName: string;
  bookingId?: string;
  propertyId: string;
  roomNumber: string;
  bedNumber: string;
  checkInDate: string;
  leaseEnd: string;
  rent: number;
  depositPaid: number;
  idVerified: boolean;
  status: 'completed' | 'pending';
}

export interface CheckOut {
  id: string;
  code: string;
  tenantName: string;
  propertyId: string;
  roomNumber: string;
  bedNumber: string;
  checkOutDate: string;
  noticeDate: string;
  depositRefund: number;
  deductions: number;
  reason: string;
  status: 'notice_period' | 'completed' | 'pending';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  period: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  issueDate?: string;
  status: 'paid' | 'unpaid' | 'partial' | 'overdue';
  paymentMethod?: 'CASH' | 'RAZORPAY' | 'UPI' | 'BANK_TRANSFER';
  paymentReference?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  tenantName: string;
  propertyId: string;
  amount: number;
  method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque';
  status: 'success' | 'pending' | 'failed';
  date: string;
  collectedBy: string;
}

export interface Complaint {
  id: string;
  ticketNumber: string;
  tenantName: string;
  propertyId: string;
  roomNumber: string;
  category: 'electrical' | 'plumbing' | 'cleanliness' | 'noise' | 'security' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Maintenance {
  id: string;
  ticketNumber: string;
  asset: string;
  propertyId: string;
  type: 'preventive' | 'corrective' | 'emergency';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  cost: number;
  vendor?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt?: string;
}

export interface Visitor {
  id: string;
  visitorName: string;
  visitorPhone: string;
  tenantName: string;
  propertyId: string;
  purpose: 'meeting' | 'delivery' | 'maintenance' | 'other';
  checkInTime: string;
  checkOutTime?: string;
  status: 'checked_in' | 'checked_out';
  approvedBy: string;
}

export interface AuditLog {
  id: string;
  user: string;
  userRole: UserRole;
  action: string;
  module: string;
  entity: string;
  entityId: string;
  ipAddress: string;
  timestamp: string;
  details: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, string | undefined>;
}
