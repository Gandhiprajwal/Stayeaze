const API_BASE_URL = 'http://localhost:8080/api/v1';

const getHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  login: async (email, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  register: async (orgName, ownerName, email, mobile, password) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgName, ownerName, email, mobile, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
  },

  // Properties & Buildings
  getProperties: async (token) => {
    const res = await fetch(`${API_BASE_URL}/properties`, { headers: getHeaders(token) });
    return res.json();
  },

  createProperty: async (token, name, address) => {
    const res = await fetch(`${API_BASE_URL}/properties`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ name, address })
    });
    return res.json();
  },

  getBuildings: async (token, propertyId) => {
    const res = await fetch(`${API_BASE_URL}/properties/${propertyId}/buildings`, { headers: getHeaders(token) });
    return res.json();
  },

  createBuilding: async (token, propertyId, name, code) => {
    const res = await fetch(`${API_BASE_URL}/properties/${propertyId}/buildings`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ name, code })
    });
    return res.json();
  },

  // Floors
  getFloors: async (token, propertyId, buildingId) => {
    const res = await fetch(`${API_BASE_URL}/properties/${propertyId}/buildings/${buildingId}/floors`, { headers: getHeaders(token) });
    return res.json();
  },

  createFloor: async (token, propertyId, buildingId, floorNumber, name) => {
    const res = await fetch(`${API_BASE_URL}/properties/${propertyId}/buildings/${buildingId}/floors`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ floorNumber, name })
    });
    return res.json();
  },

  // Rooms
  getRooms: async (token, propertyId, buildingId, floorId) => {
    const res = await fetch(`${API_BASE_URL}/properties/${propertyId}/buildings/${buildingId}/floors/${floorId}/rooms`, { headers: getHeaders(token) });
    return res.json();
  },

  createRoom: async (token, propertyId, buildingId, floorId, roomNumber, sharingType, baseRent) => {
    const res = await fetch(`${API_BASE_URL}/properties/${propertyId}/buildings/${buildingId}/floors/${floorId}/rooms`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ roomNumber, sharingType, baseRent })
    });
    return res.json();
  },

  // Beds
  getBeds: async (token, roomId) => {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/beds`, { headers: getHeaders(token) });
    return res.json();
  },

  getAllBedsFlat: async (token, page = 1, pageSize = 500) => {
    const res = await fetch(`${API_BASE_URL}/beds?page=${page}&pageSize=${pageSize}`, { headers: getHeaders(token) });
    return res.json();
  },

  getAllRoomsFlat: async (token, page = 1, pageSize = 500) => {
    const res = await fetch(`${API_BASE_URL}/rooms?page=${page}&pageSize=${pageSize}`, { headers: getHeaders(token) });
    return res.json();
  },

  getAllFloorsFlat: async (token, page = 1, pageSize = 500) => {
    const res = await fetch(`${API_BASE_URL}/floors?page=${page}&pageSize=${pageSize}`, { headers: getHeaders(token) });
    return res.json();
  },

  createBed: async (token, roomId, bedNumber, status, qrCode) => {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/beds`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ bedNumber, status, qrCode })
    });
    return res.json();
  },

  // Tenants & Bookings
  getTenants: async (token) => {
    const res = await fetch(`${API_BASE_URL}/tenants`, { headers: getHeaders(token) });
    return res.json();
  },

  createTenant: async (token, firstName, lastName, mobile) => {
    const res = await fetch(`${API_BASE_URL}/tenants`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ firstName, lastName, mobile })
    });
    return res.json();
  },

  getBookings: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/bookings`, { headers: getHeaders(token) });
    return res.json();
  },

  createBooking: async (token, tenantId, bedId, checkinDate, rentAgreed, depositAgreed) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/bookings`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ bedId, checkinDate, rentAgreed, depositAgreed })
    });
    return res.json();
  },

  // KYC
  getDocuments: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/documents`, { headers: getHeaders(token) });
    return res.json();
  },

  createDocument: async (token, tenantId, documentType, documentNumber, fileUrl) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/documents`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ documentType, documentNumber, fileUrl })
    });
    return res.json();
  },

  verifyDocument: async (token, tenantId, docId, status) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/documents/${docId}/verify?status=${status}`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Rent Agreements
  getAgreements: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/agreements`, { headers: getHeaders(token) });
    return res.json();
  },

  createAgreement: async (token, tenantId, terms, startDate, endDate) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/agreements`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ terms, startDate, endDate })
    });
    return res.json();
  },

  signAgreement: async (token, tenantId, agreementId, signatureUrl) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/agreements/${agreementId}/sign?signatureUrl=${encodeURIComponent(signatureUrl)}`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Audits Move-in/out
  getCheckinChecklist: async (token, bookingId) => {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/checkin-checklist`, { headers: getHeaders(token) });
    return res.json();
  },

  createCheckinChecklist: async (token, bookingId, keysHandedOver, amenitiesHandedOver, subMeterReading, notes) => {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/checkin-checklist`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ keysHandedOver, amenitiesHandedOver, subMeterReading, notes })
    });
    return res.json();
  },

  getCheckoutAudit: async (token, bookingId) => {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/checkout-audit`, { headers: getHeaders(token) });
    return res.json();
  },

  createCheckoutAudit: async (token, bookingId, damagesChecked, damageCharges, keysReturned, refundAmount, notes) => {
    const res = await fetch(`${API_BASE_URL}/bookings/${bookingId}/checkout-audit`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ damagesChecked, damageCharges, keysReturned, refundAmount, notes })
    });
    return res.json();
  },

  // Inquiries
  getInquiries: async (token) => {
    const res = await fetch(`${API_BASE_URL}/inquiries`, { headers: getHeaders(token) });
    return res.json();
  },

  createInquiry: async (token, guestName, email, mobile) => {
    const res = await fetch(`${API_BASE_URL}/inquiries`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ guestName, email, mobile })
    });
    return res.json();
  },

  convertInquiry: async (token, id) => {
    const res = await fetch(`${API_BASE_URL}/inquiries/${id}/status?status=CONVERTED`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Billing Plans
  getBillingPlans: async (token) => {
    const res = await fetch(`${API_BASE_URL}/billing-plans`, { headers: getHeaders(token) });
    return res.json();
  },

  createBillingPlan: async (token, name, baseRent, foodCharges, otherCharges, billingCycle) => {
    const res = await fetch(`${API_BASE_URL}/billing-plans`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ name, baseRent, foodCharges, otherCharges, billingCycle })
    });
    return res.json();
  },

  // Invoices & Payments
  getTenantInvoices: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/invoices`, { headers: getHeaders(token) });
    return res.json();
  },

  createInvoice: async (token, tenantId, dueDate, issueDate, amountDue, items) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/invoices`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ dueDate, issueDate, amountDue, items })
    });
    return res.json();
  },

  updateInvoiceStatus: async (token, tenantId, invId, status) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/invoices/${invId}/status?status=${status}`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  getInvoicePayments: async (token, tenantId, invoiceId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/invoices/${invoiceId}/payments`, { headers: getHeaders(token) });
    return res.json();
  },

  createPayment: async (token, tenantId, invoiceId, amount, paymentMethod, transactionReference) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ amount, paymentMethod, transactionReference })
    });
    return res.json();
  },

  // Submeter readings
  getMeterReadings: async (token, roomId) => {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/meter-readings`, { headers: getHeaders(token) });
    return res.json();
  },

  createMeterReading: async (token, roomId, readingDate, readingValue, unitRate) => {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/meter-readings`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ readingDate, readingValue, unitRate })
    });
    return res.json();
  },

  // Penalties
  getAdjustments: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/penalties-discounts`, { headers: getHeaders(token) });
    return res.json();
  },

  createAdjustment: async (token, tenantId, type, amount, description) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/penalties-discounts`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ type, amount, description })
    });
    return res.json();
  },

  reverseAdjustment: async (token, tenantId, id) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/penalties-discounts/${id}/reverse`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Support
  getComplaints: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/complaints`, { headers: getHeaders(token) });
    return res.json();
  },

  createComplaint: async (token, tenantId, category, description, roomId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/complaints`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ category, description, roomId })
    });
    return res.json();
  },

  updateComplaintStatus: async (token, tenantId, compId, status, staff) => {
    let queryStr = `status=${status}`;
    if (staff) queryStr += `&staff=${encodeURIComponent(staff)}`;
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/complaints/${compId}/status?${queryStr}`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  submitFeedback: async (token, tenantId, compId, feedbackRating, feedbackNotes) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/complaints/${compId}/feedback`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({ feedbackRating, feedbackNotes })
    });
    return res.json();
  },

  // Visitors
  getVisitors: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/visitors`, { headers: getHeaders(token) });
    return res.json();
  },

  createVisitor: async (token, tenantId, visitorName, mobileNumber, purpose) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/visitors`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ visitorName, mobileNumber, purpose })
    });
    return res.json();
  },

  updateVisitorStatus: async (token, tenantId, id, checkpoint) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/visitors/${id}/${checkpoint}`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Parcels
  getParcels: async (token, tenantId) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/parcels`, { headers: getHeaders(token) });
    return res.json();
  },

  createParcel: async (token, tenantId, courierCompany, trackingNumber) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/parcels`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ courierCompany, trackingNumber })
    });
    return res.json();
  },

  handoverParcel: async (token, tenantId, id, signature) => {
    const res = await fetch(`${API_BASE_URL}/tenants/${tenantId}/parcels/${id}/handover?signature=${encodeURIComponent(signature)}`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Safety
  getIncidents: async (token) => {
    const res = await fetch(`${API_BASE_URL}/safety-incidents`, { headers: getHeaders(token) });
    return res.json();
  },

  createIncident: async (token, reportedBy, description, severity) => {
    const res = await fetch(`${API_BASE_URL}/safety-incidents`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ reportedBy, description, severity })
    });
    return res.json();
  },

  updateIncidentStatus: async (token, id, status) => {
    const res = await fetch(`${API_BASE_URL}/safety-incidents/${id}/status?status=${status}`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // System Setup
  getSystemConfig: async (token) => {
    const res = await fetch(`${API_BASE_URL}/system-configs`, { headers: getHeaders(token) });
    return res.json();
  },

  updateSystemConfig: async (token, smsProvider, emailProvider, allowSelfRegistration, maintenanceMode) => {
    const res = await fetch(`${API_BASE_URL}/system-configs`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({ smsProvider, emailProvider, allowSelfRegistration, maintenanceMode })
    });
    return res.json();
  },

  // Notifications
  getNotificationLogs: async (token) => {
    const res = await fetch(`${API_BASE_URL}/notification-logs`, { headers: getHeaders(token) });
    return res.json();
  },

  createNotification: async (token, recipient, type, messageContent) => {
    const res = await fetch(`${API_BASE_URL}/notification-logs`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ recipient, type, messageContent })
    });
    return res.json();
  },

  retryNotification: async (token, id) => {
    const res = await fetch(`${API_BASE_URL}/notification-logs/${id}/retry`, {
      method: 'PUT',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Audit Log
  getAuditLogs: async (token) => {
    const res = await fetch(`${API_BASE_URL}/audit-logs`, { headers: getHeaders(token) });
    return res.json();
  },

  writeAuditLog: async (token, action) => {
    const res = await fetch(`${API_BASE_URL}/audit-logs?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    return res.json();
  },

  // Organizations
  getOrganizations: async (token) => {
    const res = await fetch(`${API_BASE_URL}/organizations`, { headers: getHeaders(token) });
    return res.json();
  },

  createOrganization: async (token, name, subdomain) => {
    const res = await fetch(`${API_BASE_URL}/organizations`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ name, subdomain })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create organization');
    return data;
  }
};
