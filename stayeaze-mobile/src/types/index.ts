// Domain types shared across the StayEaze Mobile Application

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OWNER' | 'PROPERTY_MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT' | 'SECURITY_GUARD' | 'STAFF' | 'TENANT';

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
  orgId?: string;
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
  landlordPan?: string;
  pgLicenseNo?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  upiVpa?: string;
  authorizedSignatory?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  hasRazorpaySecret?: boolean;
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
  buildingName?: string;
  propertyId?: string;
  propertyName?: string;
  name: string;
  number: number;
  floorNumber?: number;
  rooms: number;
  beds: number;
  occupied: number;
  status?: string;
}

export interface Room {
  id: string;
  floorId: string;
  floorNumber?: number;
  buildingId?: string;
  buildingName?: string;
  propertyId?: string;
  propertyName?: string;
  number: string;
  roomNumber?: string;
  type: string;
  sharingType?: string;
  sharing: number;
  beds: number;
  occupied: number;
  rent: number;
  baseRent?: number;
  status: 'available' | 'occupied' | 'partially_occupied' | 'maintenance' | 'reserved' | 'partially_reserved' | 'archived' | 'blocked';
  amenities: string[];
}

export interface Bed {
  id: string;
  roomId: string;
  roomNumber?: string;
  floorId?: string;
  floorNumber?: number;
  buildingId?: string;
  buildingName?: string;
  propertyId?: string;
  propertyName?: string;
  number: string;
  bedNumber?: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'archived' | 'blocked';
  tenantId?: string;
  tenantName?: string;
  tenantMobile?: string;
}

export interface Tenant {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  mobile?: string;
  alternatePhone?: string;
  gender: 'male' | 'female' | 'other';
  dob: string;
  occupation: string;
  idType: 'aadhaar' | 'pan' | 'passport' | 'driving_license';
  idNumber: string;
  idProofNumber?: string;
  emergencyContact: string;
  emergencyName: string;
  emergencyContactName?: string;
  emergencyContactMobile?: string;
  propertyId: string;
  buildingName?: string;
  roomNumber: string;
  bedNumber: string;
  rent: number;
  deposit: number;
  leaseStart: string;
  leaseEnd: string;
  status: 'active' | 'inactive' | 'notice_period' | 'checked_out' | 'pending_checkin';
  kycStatus?: 'PENDING' | 'VERIFIED' | 'REJECTED';
  photo?: string;
  createdAt?: string;
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

export interface SubscriptionDetails {
  id?: string;
  orgId?: string;
  orgName?: string;
  subdomain?: string;
  planName: string;
  planPrice: number;
  billingCycle: string;
  status: string;
  startDate?: string;
  endDate?: string;
  daysRemaining: number;
  paymentId?: string;
  orderId?: string;
  propertyCount: number;
  totalBeds: number;
  occupiedBeds: number;
  maxBeds: number;
  propertyLimitLabel: string;
  supportSla: string;
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

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
