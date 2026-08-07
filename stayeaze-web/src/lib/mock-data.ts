import type {
  AuditLog,
  Bed,
  Booking,
  Building,
  CheckIn,
  CheckOut,
  Complaint,
  Floor,
  Invoice,
  Maintenance,
  Payment,
  Property,
  Role,
  Room,
  Tenant,
  User,
  Visitor,
} from './types';

// Deterministic-ish mock data store. Generated once per page load.

const cities = ['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Chennai', 'Delhi', 'Gurugram'];
const states: Record<string, string> = {
  Bengaluru: 'Karnataka',
  Hyderabad: 'Telangana',
  Pune: 'Maharashtra',
  Mumbai: 'Maharashtra',
  Chennai: 'Tamil Nadu',
  Delhi: 'Delhi',
  Gurugram: 'Haryana',
};
const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Priya', 'Kiara', 'Myra', 'Anika', 'Neha', 'Pooja'];
const lastNames = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Singh', 'Kumar', 'Mehta', 'Joshi', 'Rao', 'Pillai', 'Das'];
const occupations = ['Software Engineer', 'Student', 'Marketing Analyst', 'Designer', 'Consultant', 'Data Analyst', 'Banker', 'Teacher'];
const idTypes = ['aadhaar', 'pan', 'passport', 'driving_license'] as const;
const amenities = ['AC', 'WiFi', 'Geyser', 'Wardrobe', 'Study Table', 'Balcony', 'Attached Bath', 'TV'];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pad(n: number, len = 3): string {
  return String(n).padStart(len, '0');
}
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function dateTimeOffset(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

// ---- Users & Roles ----
export const roles: Role[] = [
  {
    id: 'role-1',
    name: 'Super Admin',
    description: 'Full system access across all properties and tenants.',
    permissions: ['*'],
    userCount: 1,
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-2',
    name: 'Admin (Property Owner)',
    description: 'Owns and manages properties, buildings, tenants and staff.',
    permissions: ['property.*', 'tenant.*', 'booking.*', 'billing.*', 'reporting.*', 'user.read', 'audit.read'],
    userCount: 4,
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-3',
    name: 'Property Manager',
    description: 'Day-to-day operations for assigned properties.',
    permissions: ['property.read', 'tenant.*', 'booking.*', 'complaint.*', 'maintenance.*', 'visitor.*', 'reporting.read'],
    userCount: 8,
    isSystem: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Arjun Mehta',
    email: 'superadmin@stayeaze.in',
    phone: '+91 98100 11223',
    role: 'SUPER_ADMIN',
    status: 'active',
    propertyIds: [],
    lastActive: dateTimeOffset(0, -1),
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Priya Reddy',
    email: 'admin@stayeaze.in',
    phone: '+91 98200 33445',
    role: 'ADMIN',
    status: 'active',
    propertyIds: ['prop-1', 'prop-2'],
    lastActive: dateTimeOffset(0, -2),
    createdAt: '2024-01-12T00:00:00Z',
  },
  {
    id: 'user-3',
    name: 'Sai Nair',
    email: 'manager@stayeaze.in',
    phone: '+91 98300 55667',
    role: 'PROPERTY_MANAGER',
    status: 'active',
    propertyIds: ['prop-1'],
    lastActive: dateTimeOffset(0, -3),
    createdAt: '2024-02-02T00:00:00Z',
  },
  {
    id: 'user-4',
    name: 'Neha Sharma',
    email: 'neha.admin@stayeaze.in',
    phone: '+91 98400 77889',
    role: 'ADMIN',
    status: 'active',
    propertyIds: ['prop-3'],
    lastActive: dateTimeOffset(-1, 0),
    createdAt: '2024-03-09T00:00:00Z',
  },
  {
    id: 'user-5',
    name: 'Rohan Kumar',
    email: 'rohan.pm@stayeaze.in',
    phone: '+91 98500 99001',
    role: 'PROPERTY_MANAGER',
    status: 'inactive',
    propertyIds: ['prop-2'],
    lastActive: dateTimeOffset(-6, 0),
    createdAt: '2024-04-18T00:00:00Z',
  },
];

// ---- Properties ----
export const properties: Property[] = [
  {
    id: 'prop-1', name: 'StayEaze Koramangala', code: 'SE-KRM', type: 'CO_LIVING',
    address: '5th Block, Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560095',
    totalBuildings: 2, totalRooms: 48, totalBeds: 96, occupiedBeds: 82, status: 'active',
    manager: 'Sai Nair', phone: '+91 98300 55667', email: 'koramangala@stayeaze.in', createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'prop-2', name: 'StayEaze HSR Layout', code: 'SE-HSR', type: 'PG',
    address: 'Sector 2, HSR Layout', city: 'Bengaluru', state: 'Karnataka', pincode: '560102',
    totalBuildings: 1, totalRooms: 32, totalBeds: 64, occupiedBeds: 58, status: 'active',
    manager: 'Rohan Kumar', phone: '+91 98500 99001', email: 'hsr@stayeaze.in', createdAt: '2024-02-10T00:00:00Z',
  },
  {
    id: 'prop-3', name: 'StayEaze Madhapur', code: 'SE-MDH', type: 'HOSTEL',
    address: 'Madhapur, Hi-Tech City', city: 'Hyderabad', state: 'Telangana', pincode: '500081',
    totalBuildings: 3, totalRooms: 72, totalBeds: 144, occupiedBeds: 119, status: 'active',
    manager: 'Priya Reddy', phone: '+91 98200 33445', email: 'madhapur@stayeaze.in', createdAt: '2024-03-01T00:00:00Z',
  },
  {
    id: 'prop-4', name: 'StayEaze Hinjewadi', code: 'SE-HJW', type: 'CO_LIVING',
    address: 'Phase 1, Hinjewadi', city: 'Pune', state: 'Maharashtra', pincode: '411057',
    totalBuildings: 2, totalRooms: 56, totalBeds: 112, occupiedBeds: 41, status: 'maintenance',
    manager: 'Neha Sharma', phone: '+91 98400 77889', email: 'hinjewadi@stayeaze.in', createdAt: '2024-04-22T00:00:00Z',
  },
];

// ---- Buildings / Floors / Rooms / Beds ----
export const buildings: Building[] = [];
export const floors: Floor[] = [];
export const rooms: Room[] = [];
export const beds: Bed[] = [];

let bedCounter = 0;
properties.forEach((p) => {
  for (let b = 1; b <= p.totalBuildings; b++) {
    const bId = `${p.id}-b${b}`;
    const roomCount = Math.floor(p.totalRooms / p.totalBuildings);
    const bedCount = Math.floor(p.totalBeds / p.totalBuildings);
    buildings.push({
      id: bId, propertyId: p.id, name: `Block ${String.fromCharCode(64 + b)}`, code: `${p.code}-B${b}`,
      floors: 4, rooms: roomCount, beds: bedCount, occupied: Math.floor(bedCount * 0.82),
      status: p.status === 'maintenance' ? 'inactive' : 'active',
    });
    for (let f = 1; f <= 4; f++) {
      const fId = `${bId}-f${f}`;
      const fRooms = Math.floor(roomCount / 4);
      const fBeds = Math.floor(bedCount / 4);
      floors.push({
        id: fId, buildingId: bId, name: `Floor ${f}`, number: f,
        rooms: fRooms, beds: fBeds, occupied: Math.floor(fBeds * 0.8),
      });
      for (let r = 1; r <= fRooms; r++) {
        const rId = `${fId}-r${r}`;
        const sharing = rand([1, 2, 2, 3, 3, 4]);
        const occupied = Math.random() < 0.78 ? sharing : randInt(0, sharing - 1);
        const status: Room['status'] =
          occupied === sharing ? 'occupied' : occupied === 0 ? (Math.random() < 0.1 ? 'maintenance' : 'available') : 'partially_occupied';
        rooms.push({
          id: rId, floorId: fId, buildingId: bId, propertyId: p.id,
          number: `${f}${pad(r, 2)}`, type: sharing === 1 ? 'single' : sharing === 2 ? 'double' : sharing === 3 ? 'triple' : 'dorm',
          sharing, beds: sharing, occupied, rent: 6000 + sharing * 2500 + randInt(0, 3) * 500,
          status, amenities: amenities.filter(() => Math.random() < 0.5),
        });
        for (let bd = 1; bd <= sharing; bd++) {
          bedCounter++;
          const bStatus: Bed['status'] =
            bd <= occupied ? 'occupied' : status === 'maintenance' ? 'maintenance' : Math.random() < 0.05 ? 'reserved' : 'available';
          beds.push({
            id: `${rId}-bed${bd}`, roomId: rId, number: `B${bd}`,
            status: bStatus, tenantId: bStatus === 'occupied' ? `tenant-${bedCounter}` : undefined,
          });
        }
      }
    }
  }
});

// ---- Tenants ----
export const tenants: Tenant[] = [];
for (let i = 1; i <= 60; i++) {
  const name = `${rand(firstNames)} ${rand(lastNames)}`;
  const prop = rand(properties);
  const leaseStart = dateOffset(-randInt(10, 300));
  const status: Tenant['status'] = Math.random() < 0.12 ? 'notice_period' : Math.random() < 0.08 ? 'checked_out' : 'active';
  tenants.push({
    id: `tenant-${i}`, name, email: `${name.toLowerCase().replace(/\s/g, '.')}@mail.com`,
    phone: `+91 9${randInt(600000000, 999999999)}`, alternatePhone: `+91 9${randInt(600000000, 999999999)}`,
    gender: rand(['male', 'female', 'other']), dob: `199${randInt(0, 9)}-0${randInt(1, 9)}-1${randInt(0, 9)}`,
    occupation: rand(occupations), idType: rand(idTypes), idNumber: `${randInt(1000, 9999)}${randInt(1000, 9999)}`,
    emergencyContact: `+91 9${randInt(600000000, 999999999)}`, emergencyName: `${rand(firstNames)} ${rand(lastNames)}`,
    propertyId: prop.id, buildingName: 'Block A', roomNumber: `${randInt(1, 4)}${pad(randInt(1, 12), 2)}`,
    bedNumber: `B${randInt(1, 3)}`, rent: 8000 + randInt(0, 8) * 1000, deposit: 16000 + randInt(0, 8) * 1000,
    leaseStart, leaseEnd: dateOffset(randInt(30, 330)), status, createdAt: leaseStart,
  });
}

// ---- Bookings ----
export const bookings: Booking[] = [];
for (let i = 1; i <= 40; i++) {
  const name = `${rand(firstNames)} ${rand(lastNames)}`;
  const prop = rand(properties);
  const rent = 8000 + randInt(0, 8) * 1000;
  bookings.push({
    id: `booking-${i}`, bookingCode: `BK-${pad(i, 4)}`, tenantName: name,
    tenantEmail: `${name.toLowerCase().replace(/\s/g, '.')}@mail.com`, tenantPhone: `+91 9${randInt(600000000, 999999999)}`,
    propertyId: prop.id, roomNumber: `${randInt(1, 4)}${pad(randInt(1, 12), 2)}`, bedNumber: `B${randInt(1, 3)}`,
    checkInDate: dateOffset(randInt(-20, 30)), durationMonths: rand([3, 6, 11]),
    rent, deposit: rent * 2,
    status: rand(['pending', 'confirmed', 'cancelled', 'expired', 'checked_in']),
    source: rand(['direct', 'website', 'agent', 'referral']), createdAt: dateOffset(-randInt(1, 40)),
  });
}

// ---- Check-ins / Check-outs ----
export const checkIns: CheckIn[] = [];
for (let i = 1; i <= 25; i++) {
  const name = `${rand(firstNames)} ${rand(lastNames)}`;
  const prop = rand(properties);
  const rent = 8000 + randInt(0, 8) * 1000;
  checkIns.push({
    id: `ci-${i}`, code: `CI-${pad(i, 4)}`, tenantName: name, bookingId: Math.random() < 0.7 ? `booking-${randInt(1, 40)}` : undefined,
    propertyId: prop.id, roomNumber: `${randInt(1, 4)}${pad(randInt(1, 12), 2)}`, bedNumber: `B${randInt(1, 3)}`,
    checkInDate: dateOffset(-randInt(0, 60)), leaseEnd: dateOffset(randInt(60, 330)), rent, depositPaid: rent * 2,
    idVerified: Math.random() < 0.9, status: rand(['completed', 'completed', 'pending']),
  });
}

export const checkOuts: CheckOut[] = [];
for (let i = 1; i <= 18; i++) {
  const name = `${rand(firstNames)} ${rand(lastNames)}`;
  const prop = rand(properties);
  const deposit = 16000 + randInt(0, 8) * 1000;
  const deductions = randInt(0, 5) * 500;
  checkOuts.push({
    id: `co-${i}`, code: `CO-${pad(i, 4)}`, tenantName: name, propertyId: prop.id,
    roomNumber: `${randInt(1, 4)}${pad(randInt(1, 12), 2)}`, bedNumber: `B${randInt(1, 3)}`,
    checkOutDate: dateOffset(randInt(-10, 20)), noticeDate: dateOffset(randInt(-40, -10)),
    depositRefund: Math.max(0, deposit - deductions), deductions, reason: rand(['Relocating', 'Lease ended', 'Personal', 'Job change']),
    status: rand(['notice_period', 'completed', 'pending']),
  });
}

// ---- Invoices & Payments ----
export const invoices: Invoice[] = [];
export const payments: Payment[] = [];
for (let i = 1; i <= 80; i++) {
  const t = rand(tenants);
  const amount = t.rent;
  const status: Invoice['status'] = rand(['paid', 'paid', 'unpaid', 'partial', 'overdue']);
  const paidAmount = status === 'paid' ? amount : status === 'partial' ? Math.floor(amount / 2) : 0;
  const invDate = dateOffset(-randInt(0, 90));
  invoices.push({
    id: `inv-${i}`, invoiceNumber: `INV-${pad(i, 4)}`, tenantId: t.id, tenantName: t.name, propertyId: t.propertyId,
    period: invDate.slice(0, 7), amount, paidAmount, dueDate: dateOffset(randInt(-5, 15)), status, createdAt: invDate,
  });
  if (paidAmount > 0) {
    payments.push({
      id: `pay-${i}`, receiptNumber: `RCPT-${pad(i, 4)}`, invoiceId: `inv-${i}`, tenantName: t.name, propertyId: t.propertyId,
      amount: paidAmount, method: rand(['cash', 'upi', 'card', 'bank_transfer', 'cheque']),
      status: rand(['success', 'success', 'pending', 'failed']), date: invDate, collectedBy: rand(users).name,
    });
  }
}

// ---- Complaints & Maintenance ----
export const complaints: Complaint[] = [];
for (let i = 1; i <= 30; i++) {
  const t = rand(tenants);
  const status = rand(['open', 'in_progress', 'resolved', 'closed'] as const);
  complaints.push({
    id: `cmp-${i}`, ticketNumber: `CMP-${pad(i, 4)}`, tenantName: t.name, propertyId: t.propertyId,
    roomNumber: t.roomNumber, category: rand(['electrical', 'plumbing', 'cleanliness', 'noise', 'security', 'other'] as const),
    priority: rand(['low', 'medium', 'high', 'critical'] as const),
    description: rand(['Tap leaking in bathroom', 'AC not cooling', 'WiFi not working', 'Noisy neighbours at night', 'Broken study table', 'Lock jammed']),
    status, assignedTo: status !== 'open' ? rand(users).name : undefined,
    createdAt: dateOffset(-randInt(1, 40)), resolvedAt: status === 'resolved' || status === 'closed' ? dateOffset(randInt(-10, 0)) : undefined,
  });
}

export const maintenance: Maintenance[] = [];
for (let i = 1; i <= 24; i++) {
  const prop = rand(properties);
  const status = rand(['open', 'in_progress', 'completed', 'cancelled'] as const);
  maintenance.push({
    id: `mnt-${i}`, ticketNumber: `MNT-${pad(i, 4)}`, asset: rand(['AC Unit', 'Water Heater', 'Geyser', 'Main Door', 'Elevator', 'Generator', 'CCTV']),
    propertyId: prop.id, type: rand(['preventive', 'corrective', 'emergency'] as const), priority: rand(['low', 'medium', 'high', 'critical'] as const),
    description: rand(['Scheduled service', 'Replacement needed', 'Not functioning', 'Routine inspection']),
    cost: randInt(500, 8000), vendor: rand(['QuickFix Services', 'UrbanClap', 'HouseJoy', 'Local Vendor']),
    status, createdAt: dateOffset(-randInt(1, 50)), completedAt: status === 'completed' ? dateOffset(randInt(-10, 0)) : undefined,
  });
}

// ---- Visitors ----
export const visitors: Visitor[] = [];
for (let i = 1; i <= 35; i++) {
  const t = rand(tenants);
  const checkedOut = Math.random() < 0.6;
  visitors.push({
    id: `vis-${i}`, visitorName: `${rand(firstNames)} ${rand(lastNames)}`, visitorPhone: `+91 9${randInt(600000000, 999999999)}`,
    tenantName: t.name, propertyId: t.propertyId, purpose: rand(['meeting', 'delivery', 'maintenance', 'other']),
    checkInTime: dateTimeOffset(-randInt(0, 5), -randInt(0, 6)), checkOutTime: checkedOut ? dateTimeOffset(-randInt(0, 4), 0) : undefined,
    status: checkedOut ? 'checked_out' : 'checked_in', approvedBy: rand(users).name,
  });
}

// ---- Audit Logs ----
export const auditLogs: AuditLog[] = [];
const actions = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'STATUS_CHANGE', 'LOGIN_FAILED'];
const modules = ['auth', 'property', 'tenant', 'booking', 'billing', 'payment', 'complaint', 'maintenance', 'user', 'role'];
for (let i = 1; i <= 50; i++) {
  const u = rand(users);
  const action = rand(actions);
  const mod = rand(modules);
  auditLogs.push({
    id: `log-${i}`, user: u.name, userRole: u.role, action, module: mod, entity: mod, entityId: `${mod}-${randInt(1, 40)}`,
    ipAddress: `103.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`, timestamp: dateTimeOffset(-randInt(0, 14), -randInt(0, 23)),
    details: `${action} on ${mod} record`,
  });
}
