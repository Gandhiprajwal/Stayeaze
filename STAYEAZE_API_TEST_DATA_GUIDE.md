# StayEaze Master API Test Data & Payload Guide

This guide provides **ready-to-use sample JSON payloads, headers, query parameters, and cURL commands** for every API endpoint across all 18 modules in the [StayEaze Quality Assurance Sheet](file:///c:/Users/gandh/OneDrive/Desktop/StayEaze/STAYEAZE_COMPLETE_TEST_SHEET.md).

---

## 🔑 Common Authentication Headers
Unless marked as public (`/api/v1/public/*`), all endpoints require:
```http
Authorization: Bearer <YOUR_ACCESS_JWT_TOKEN>
Content-Type: application/json
```

---

## Module 1: Authentication & Session Management

### 1. Owner & Organization Self-Registration
* **Endpoint:** `POST /api/v1/auth/register`
* **Request JSON:**
```json
{
  "orgName": "Apex Living Residences",
  "ownerName": "Rajesh Sharma",
  "email": "rajesh.apex@example.com",
  "mobile": "9876543210",
  "password": "Password@123",
  "subdomain": "apex-living",
  "address": "Plot 42, Koramangala 4th Block, Bengaluru, Karnataka 560034"
}
```

### 2. Login
* **Endpoint:** `POST /api/v1/auth/login`
* **Request JSON:**
```json
{
  "email": "rajesh.apex@example.com",
  "password": "Password@123"
}
```

### 3. Verify 2FA OTP (if 2FA enabled)
* **Endpoint:** `POST /api/v1/auth/verify-2fa`
* **Request JSON:**
```json
{
  "email": "rajesh.apex@example.com",
  "otp": "123456"
}
```

### 4. Silent Token Refresh
* **Endpoint:** `POST /api/v1/auth/refresh`
* **Request JSON:**
```json
{
  "refreshToken": "8f3b2c1a-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
}
```

### 5. Forgot Password Request
* **Endpoint:** `POST /api/v1/auth/forgot-password`
* **Request JSON:**
```json
{
  "email": "rajesh.apex@example.com"
}
```

### 6. Reset Password Completion
* **Endpoint:** `POST /api/v1/auth/reset-password`
* **Request JSON:**
```json
{
  "token": "d98e7f6a5b4c3d2e1f0a",
  "newPassword": "NewStrongPassword@2026"
}
```

---

## Module 2: Roles, Permissions & RBAC

### 1. Create Custom Role
* **Endpoint:** `POST /api/v1/roles`
* **Request JSON:**
```json
{
  "name": "NIGHT_WARDEN",
  "description": "Manages night visitor curfews and emergency maintenance",
  "permissions": [
    "VIEW_TENANTS",
    "LOG_VISITORS",
    "LOG_PARCELS",
    "VIEW_INCIDENTS",
    "CREATE_INCIDENT"
  ]
}
```

### 2. Invite / Create Staff Member
* **Endpoint:** `POST /api/v1/users`
* **Request JSON:**
```json
{
  "firstName": "Suresh",
  "lastName": "Kumar",
  "email": "suresh.warden@example.com",
  "mobile": "9876500001",
  "role": "PROPERTY_MANAGER",
  "propertyIds": ["3fa85f64-5717-4562-b3fc-2c963f66afa6"]
}
```

---

## Module 3: Space Hierarchy & Batch Space Generator

### 1. Create Property
* **Endpoint:** `POST /api/v1/properties`
* **Request JSON:**
```json
{
  "name": "Green Valley Luxury PG",
  "address": "12th Cross, HSR Layout Sector 1, Bengaluru",
  "city": "Bengaluru",
  "state": "Karnataka",
  "pincode": "560102",
  "contactPhone": "9876512345",
  "contactEmail": "greenvalley@example.com",
  "amenities": ["High-Speed Wi-Fi", "Daily Housekeeping", "3 Times North/South Meals", "Air Conditioner", "Power Backup", "Washing Machine"],
  "rules": "Curfew: 10:30 PM. No smoking inside rooms."
}
```

### 2. Batch Space Generator (Atomically create Buildings, Floors, Rooms & Beds)
* **Endpoint:** `POST /api/v1/space-batch-generator/generate`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "buildingCount": 1,
  "buildingPrefix": "Block A",
  "floorsPerBuilding": 2,
  "roomsPerFloor": 4,
  "roomType": "DOUBLE_SHARING",
  "bedsPerRoom": 2,
  "baseRent": 8500.00,
  "securityDeposit": 15000.00,
  "isAc": true
}
```

---

## Module 4: Public Tenant Onboarding & Leads

### 1. Public Document Upload (KYC ID Proof)
* **Endpoint:** `POST /api/v1/public/tenants/upload-document`
* **Headers:** `Content-Type: multipart/form-data`
* **Form-Data Fields:**
  - `file`: `[Select File: aadhaar_card.pdf (Max 3MB)]`
  - `documentType`: `GOVT_ID`

### 2. Public Express Tenant Onboarding
* **Endpoint:** `POST /api/v1/public/tenants/onboard`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "firstName": "Prajwal",
  "lastName": "Gandhi",
  "email": "prajwal.tenant@example.com",
  "mobile": "9988776655",
  "gender": "MALE",
  "occupation": "Software Engineer",
  "idType": "AADHAAR",
  "idNumber": "9876-5432-1098",
  "idFileUrl": "http://localhost:8080/api/v1/public/files/aadhaar_proof_123.pdf",
  "roomNumber": "101",
  "bedNumber": "A",
  "paymentMethod": "CASH",
  "razorpayPaymentId": null
}
```

---

## Module 5: Bookings & Room Allocations

### 1. Create Advance Booking (Walk-in / Online)
* **Endpoint:** `POST /api/v1/bookings`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "roomNumber": "102",
  "bedNumber": "B",
  "guestName": "Ananya Verma",
  "guestEmail": "ananya.v@example.com",
  "guestMobile": "9811223344",
  "expectedMoveIn": "2026-09-10",
  "tokenAmount": 2000.00,
  "paymentMode": "UPI",
  "notes": "Prefers window bed"
}
```

---

## Module 6: Tenant Management & Document Vault

### 1. Internal Quick Add Tenant (Staff Desk)
* **Endpoint:** `POST /api/v1/tenants`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "firstName": "Vikram",
  "lastName": "Rathore",
  "email": "vikram.r@example.com",
  "mobile": "9822334455",
  "gender": "MALE",
  "roomNumber": "201",
  "bedNumber": "A",
  "rent": 9000.00,
  "deposit": 18000.00,
  "leaseStart": "2026-09-01",
  "emergencyContactName": "Kailash Rathore",
  "emergencyContactPhone": "9822000000"
}
```

### 2. Tenant Room/Bed Transfer
* **Endpoint:** `PUT /api/v1/tenants/{tenantId}/change-bed`
* **Request JSON:**
```json
{
  "newPropertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "newRoomNumber": "204",
  "newBedNumber": "A",
  "effectiveDate": "2026-09-05",
  "newRent": 9500.00,
  "reason": "Upgraded to Single AC Room"
}
```

---

## Module 7: Check-In & Check-Out Audits

### 1. Complete Desk Check-In (Keys & Asset Handover)
* **Endpoint:** `POST /api/v1/check-in/execute`
* **Request JSON:**
```json
{
  "tenantId": "649cea74-0333-47fd-a0c4-4d71e6089667",
  "assetChecklist": {
    "roomKeyGiven": true,
    "cupboardKeyGiven": true,
    "acRemoteHanded": true,
    "mattressCondition": "NEW",
    "meterReading": 124.5
  },
  "depositPaid": 18000.00,
  "firstMonthRentPaid": 9000.00,
  "paymentMode": "UPI",
  "remarks": "Check-in completed smoothly at front desk."
}
```

### 2. Finalize Check-Out & Security Deposit Settlement
* **Endpoint:** `POST /api/v1/check-out/finalize`
* **Request JSON:**
```json
{
  "tenantId": "649cea74-0333-47fd-a0c4-4d71e6089667",
  "moveOutDate": "2026-09-30",
  "totalDepositHeld": 18000.00,
  "unpaidDuesDeduction": 1500.00,
  "damagesDeduction": 800.00,
  "damageReason": "Wall paint touchup required in room 201",
  "netRefundAmount": 15700.00,
  "refundPaymentMode": "BANK_TRANSFER",
  "refundTransactionRef": "UPI/20260930/987654"
}
```

---

## Module 8: Invoices, Billing & Bulk Rent Generation

### 1. Generate Manual Invoice
* **Endpoint:** `POST /api/v1/invoices`
* **Request JSON:**
```json
{
  "tenantId": "649cea74-0333-47fd-a0c4-4d71e6089667",
  "dueDate": "2026-09-05",
  "billingPeriod": "September 2026",
  "items": [
    {
      "description": "Monthly Room Rent (Sep 2026)",
      "amount": 9000.00
    },
    {
      "description": "High-Speed Wi-Fi Addon",
      "amount": 350.00
    }
  ]
}
```

### 2. Trigger Automated Monthly Bulk Rent Run
* **Endpoint:** `POST /api/v1/bulk-rent-run/execute`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "billingMonth": 9,
  "billingYear": 2026,
  "dueDate": "2026-09-05",
  "applyLateFeeRule": true
}
```

---

## Module 9: Payments & Razorpay Integration

### 1. Record Offline Payment (Cash / UPI / Cheque)
* **Endpoint:** `POST /api/v1/payments`
* **Request JSON:**
```json
{
  "invoiceId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "amount": 9350.00,
  "paymentMethod": "UPI",
  "transactionReference": "UPI/ICICI/987654321",
  "paymentDate": "2026-09-02T10:30:00Z",
  "notes": "Paid via Google Pay to property manager"
}
```

### 2. Create Razorpay Payment Order
* **Endpoint:** `POST /api/v1/razorpay/create-order`
* **Request JSON:**
```json
{
  "invoiceId": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "amount": 9350.00
}
```

---

## Module 10: Penalties, Metered Utilities & Discounts

### 1. Apply Penalty / Late Fee
* **Endpoint:** `POST /api/v1/penalties`
* **Request JSON:**
```json
{
  "tenantId": "649cea74-0333-47fd-a0c4-4d71e6089667",
  "penaltyType": "LATE_PAYMENT_FEE",
  "amount": 250.00,
  "reason": "Rent delayed beyond 5th of the month"
}
```

### 2. Record Sub-Meter Electricity Reading
* **Endpoint:** `POST /api/v1/utilities/readings`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "roomNumber": "101",
  "utilityType": "ELECTRICITY",
  "previousReading": 124.5,
  "currentReading": 184.5,
  "ratePerUnit": 11.50,
  "readingDate": "2026-09-01"
}
```

---

## Module 11: Complaints, Support & Maintenance

### 1. Raise Support Ticket / Complaint (Tenant / Staff)
* **Endpoint:** `POST /api/v1/tickets`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "category": "PLUMBING",
  "priority": "HIGH",
  "title": "Bathroom tap leakage in Room 201",
  "description": "Continuous water leaking under the sink. Needs washer replacement."
}
```

---

## Module 12: Front Desk, Visitors & Parcels

### 1. Log Visitor Entry
* **Endpoint:** `POST /api/v1/visitors`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "visitorName": "Amit Roy",
  "visitorPhone": "9845012345",
  "tenantId": "649cea74-0333-47fd-a0c4-4d71e6089667",
  "purpose": "Friend visit",
  "idProofType": "DRIVING_LICENSE",
  "idProofNumber": "KA01-20220004567"
}
```

### 2. Log Delivery Parcel Arrival
* **Endpoint:** `POST /api/v1/parcels`
* **Request JSON:**
```json
{
  "propertyId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tenantId": "649cea74-0333-47fd-a0c4-4d71e6089667",
  "courierService": "AMAZON",
  "trackingNumber": "AMZ-IN-889977",
  "shelfLocation": "Locker #4"
}
```

---

## Module 18: Organization Branding & Settings

### 1. Update White-Label Organization Branding
* **Endpoint:** `PUT /api/v1/branding`
* **Request JSON:**
```json
{
  "brandName": "Apex Living Luxury Stays",
  "brandColor": "#4f46e5",
  "accentColor": "#06b6d4",
  "logoUrl": "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00",
  "gstin": "29ABCDE1234F1Z5",
  "pan": "ABCDE1234F",
  "bankName": "HDFC Bank",
  "bankAccountNumber": "50100987654321",
  "bankIfsc": "HDFC0001234",
  "upiId": "apexresidences@hdfcbank"
}
```
