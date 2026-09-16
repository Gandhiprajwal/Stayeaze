# StayEaze Master Quality Assurance & API Testing Sheet

This document is the master test matrix for the entire **StayEaze PG & Hostel Management Platform**. It covers all **Frontend User Interface Features**, **Backend API Endpoints (CRUD & Special Actions)**, **Test Scenarios (Positive, Negative & Edge Cases)**, **Step-by-Step Testing Guides**, and **Tracking Status Columns** (`[ ] PENDING`, `[x] PASS`, `[!] FAIL`, `[-] BLOCKED`).

> 🚀 **Ready-to-use API Payloads & cURL commands:** Refer to the companion [**StayEaze API Test Data Guide (STAYEAZE_API_TEST_DATA_GUIDE.md)**](file:///c:/Users/gandh/OneDrive/Desktop/StayEaze/STAYEAZE_API_TEST_DATA_GUIDE.md) for copy-pasteable JSON request bodies for every endpoint.

---

## 📋 Status Legend & Tracking Conventions

| Status Code | Icon / Tag | Meaning |
|---|---|---|
| `[ ] PENDING` | ⏳ Pending | Not yet tested |
| `[x] PASS` | ✅ Pass | Functionality works as expected with no issues |
| `[!] FAIL` | ❌ Fail | Feature / API failed or returned unexpected error |
| `[-] BLOCKED` | ⚠️ Blocked | Cannot test due to dependency failure or missing prerequisites |

---

## 📑 Test Suite Index

1. [Module 1: Authentication, Authorization & Session Management](#module-1-authentication-authorization--session-management)
2. [Module 2: Roles, Permissions & RBAC](#module-2-roles-permissions--rbac)
3. [Module 3: Property & Space Hierarchy Management](#module-3-property--space-hierarchy-management)
4. [Module 4: Public Leads & Tenant Onboarding Flow](#module-4-public-leads--tenant-onboarding-flow)
5. [Module 5: Bookings & Allocations](#module-5-bookings--allocations)
6. [Module 6: Tenant Management & Document Vault](#module-6-tenant-management--document-vault)
7. [Module 7: Check-In & Check-Out Audits](#module-7-check-in--check-out-audits)
8. [Module 8: Invoices, Billing Plans & Bulk Rent Runs](#module-8-invoices-billing-plans--bulk-rent-runs)
9. [Module 9: Payments, Gateways & Razorpay Webhooks](#module-9-payments-gateways--razorpay-webhooks)
10. [Module 10: Penalties, Discounts & Utility Billing](#module-10-penalties-discounts--utility-billing)
11. [Module 11: Complaints, Support & Real-Time Chat](#module-11-complaints-support--real-time-chat)
12. [Module 12: Front Desk Operations, Visitors & Parcels](#module-12-front-desk-operations-visitors--parcels)
13. [Module 13: Maintenance & Safety Incidents](#module-13-maintenance--safety-incidents)
14. [Module 14: Tenant Self-Service Portal](#module-14-tenant-self-service-portal)
15. [Module 15: Accountant Portal & Financial Controls](#module-15-accountant-portal--financial-controls)
16. [Module 16: Super Admin SaaS Management & Billing](#module-16-super-admin-saas-management--billing)
17. [Module 17: System Health, Metrics, Backup & Auditing](#module-17-system-health-metrics-backup--auditing)
18. [Module 18: Organization Branding & Settings](#module-18-organization-branding--settings)

---

## Module 1: Authentication, Authorization & Session Management

### APIs Covered
- `POST /api/auth/register` — User & Org Self-Registration
- `POST /api/auth/login` — Email/Password Login
- `POST /api/auth/refresh-token` — Refresh JWT
- `POST /api/auth/logout` — Revoke Token/Session
- `POST /api/auth/forgot-password` — Request Reset Link/OTP
- `POST /api/auth/reset-password` — Set New Password with Token
- `GET /api/auth/me` — Current User Profile & Permissions

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `AUTH-01` | `POST /api/auth/register` | Successful Owner & Org Registration | Unique email, strong password, org details | 1. Open `/register`<br>2. Fill Org Name, Admin Name, Email, Password<br>3. Submit form | Returns `201 Created` or `200 OK` with JWT token, creates Organization & Owner role. Redirects to `/dashboard`. | `[ ] PENDING` | |
| `AUTH-02` | `POST /api/auth/register` | Duplicate Email Registration (Negative) | Existing registered email | 1. Attempt registering with an already existing email | Returns `400 Bad Request` or `409 Conflict` with error message "Email already registered". | `[ ] PENDING` | |
| `AUTH-03` | `POST /api/auth/login` | Valid Login with Credentials | Correct email and password | 1. Navigate to `/login`<br>2. Enter valid email & password<br>3. Click "Sign In" | Returns `200 OK`, JWT access & refresh tokens set in storage/cookies, user redirected to role-specific dashboard. | `[ ] PENDING` | |
| `AUTH-04` | `POST /api/auth/login` | Invalid Password (Negative) | Valid email, wrong password | 1. Navigate to `/login`<br>2. Enter valid email & invalid password<br>3. Click "Sign In" | Returns `401 Unauthorized` with "Invalid email or password". Error toast displayed on UI. | `[ ] PENDING` | |
| `AUTH-05` | `POST /api/auth/login` | Locked / Deactivated User (Edge) | Deactivated user account | 1. Deactivate a user via Admin panel<br>2. Try to log in with that user | Returns `403 Forbidden` / `401 Unauthorized` with "Account is deactivated. Contact administrator". | `[ ] PENDING` | |
| `AUTH-06` | `POST /api/auth/refresh-token` | Silent Token Refresh | Valid refresh token | 1. Send refresh token to endpoint or wait for frontend interceptor trigger | Returns `200 OK` with new access token without requiring re-login. | `[ ] PENDING` | |
| `AUTH-07` | `POST /api/auth/logout` | Session Revocation | Logged-in session | 1. Click user avatar -> "Logout"<br>2. Verify tokens cleared in localStorage/cookies | Returns `200 OK`. Subsequent calls with previous token return `401 Unauthorized`. | `[ ] PENDING` | |
| `AUTH-08` | `POST /api/auth/forgot-password` | Password Reset Request | Registered user email | 1. Go to `/forgot-password`<br>2. Enter email and submit | Returns `200 OK` with "Reset instructions sent to email". Email/notification logged. | `[ ] PENDING` | |
| `AUTH-09` | `POST /api/auth/reset-password` | Password Reset Completion | Valid reset token, new password | 1. Open reset link with token<br>2. Enter new matching password & submit | Returns `200 OK`. User can now log in with the new password; old password fails. | `[ ] PENDING` | |
| `AUTH-10` | `GET /api/auth/me` | Fetch Current Authenticated Context | Valid JWT in Authorization header | 1. Call `GET /api/auth/me` with Bearer token | Returns `200 OK` with user id, name, email, role, permissions, organizationId, assigned properties. | `[ ] PENDING` | |
| `AUTH-11` | Multiple Endpoints | Multi-Tenancy Data Isolation (Org A vs Org B) | Active accounts in Org A and Org B | 1. Log in as Org A staff<br>2. Try querying or updating properties, rooms, beds, invoices, or tenants belonging to Org B | Returns `404 Not Found` / empty result. Hibernate `@TenantId` automatically appends `WHERE org_id = ?` at SQL level. | `[ ] PENDING` | |
| `AUTH-12` | `POST /api/auth/logout` | Token Revocation & Post-Logout Replay Prevention | Logged-in session | 1. Log out via `/logout`<br>2. Inspect browser cookies (verify `stayeaze_refresh_token` Max-Age=0 cleared)<br>3. Attempt calling `/refresh` or protected endpoints with old tokens | Returns `401 Unauthorized`. Refresh token is deleted from DB and access token is blacklisted. | `[ ] PENDING` | |

---

## Module 2: Roles, Permissions & RBAC

### APIs Covered
- `GET /api/roles` — List All Custom & System Roles
- `POST /api/roles` — Create Custom Role
- `GET /api/roles/{id}` — Get Role Details & Permissions
- `PUT /api/roles/{id}` — Update Role Permissions
- `DELETE /api/roles/{id}` — Delete Custom Role
- `POST /api/users` — Invite / Create Staff with Role
- `PUT /api/users/{id}/roles` — Assign Role to User

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `RBAC-01` | `GET /api/roles` | View All System & Custom Roles | Admin / Owner role | 1. Navigate to `/settings/roles`<br>2. Verify role list displays (Super Admin, Owner, Manager, Receptionist, Accountant, Tenant) | Returns `200 OK` with role list and assigned permission bitmasks/sets. | `[ ] PENDING` | |
| `RBAC-02` | `POST /api/roles` | Create New Custom Role | Valid role name & permission checkboxes | 1. Click "Create Role"<br>2. Name: "Night Warden", select permissions (VIEW_TENANTS, LOG_VISITORS)<br>3. Save | Returns `201 Created`. New role appears in table and role dropdowns. | `[ ] PENDING` | |
| `RBAC-03` | `PUT /api/roles/{id}` | Update Role Permissions | Existing custom role | 1. Select custom role, modify permissions (add CREATE_INVOICE)<br>2. Save changes | Returns `200 OK`. Assigned users immediately inherit updated permissions. | `[ ] PENDING` | |
| `RBAC-04` | `DELETE /api/roles/{id}` | Delete In-Use Role (Negative) | Role currently assigned to active staff | 1. Try deleting role assigned to a user | Returns `400 Bad Request` or `409 Conflict` ("Cannot delete role assigned to active users"). | `[ ] PENDING` | |
| `RBAC-05` | `PUT /api/users/{id}/roles` | Assign Restricted Property Scope to Manager | Manager user | 1. Assign Manager to Property A only<br>2. Log in as Manager<br>3. Try accessing Property B via API & UI | Manager cannot see or edit Property B (`403 Forbidden` on Property B endpoints). | `[ ] PENDING` | |

---

## Module 3: Property & Space Hierarchy Management

### APIs Covered
- `GET /api/properties` — List Properties (with pagination, filters, search)
- `POST /api/properties` — Create Property (Name, Address, Amenities, GSTIN, Rules)
- `GET /api/properties/{id}` — Get Property Details
- `PUT /api/properties/{id}` — Update Property Details
- `DELETE /api/properties/{id}` — Soft Delete / Deactivate Property
- `GET /api/buildings`, `POST /api/buildings`, `PUT /api/buildings/{id}`, `DELETE /api/buildings/{id}` — Building CRUD
- `GET /api/floors`, `POST /api/floors`, `PUT /api/floors/{id}`, `DELETE /api/floors/{id}` — Floor CRUD
- `GET /api/rooms`, `POST /api/rooms`, `PUT /api/rooms/{id}`, `DELETE /api/rooms/{id}` — Room CRUD (AC/Non-AC, Sharing Type)
- `GET /api/beds`, `POST /api/beds`, `PUT /api/beds/{id}`, `DELETE /api/beds/{id}` — Bed CRUD (Bed No, Base Rent, Status)
- `POST /api/space-batch-generator/generate` — Batch Generation of Buildings, Floors, Rooms & Beds

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `PROP-01` | `POST /api/properties` | Create New Property | Valid property details | 1. Go to `/properties` -> "Add Property"<br>2. Enter Name, Address, Contact, Amenities<br>3. Submit | Returns `201 Created`. Property card appears in UI list. | `[ ] PENDING` | |
| `PROP-02` | `POST /api/space-batch-generator/generate` | Batch Create Hierarchy (Building -> Floor -> Room -> Bed) | Property exists | 1. Open Property -> "Batch Space Generator"<br>2. Set 2 Buildings, 3 Floors each, 4 Rooms/floor (Double Sharing), 2 Beds/room<br>3. Generate | Returns `200 OK`. 2 Buildings, 6 Floors, 24 Rooms, 48 Beds created atomically with correct parent IDs. | `[ ] PENDING` | |
| `PROP-03` | `GET /api/properties/{id}/occupancy` | Real-Time Space Hierarchy & Bed Matrix | Property with occupied & vacant beds | 1. Open Property Space Matrix view (`/properties/:id/spaces`)<br>2. Inspect bed color indicators (Green: Vacant, Red: Occupied, Yellow: Reserved, Blue: Maintenance) | Beds display accurate status matching database occupancy records. | `[ ] PENDING` | |
| `PROP-04` | `PUT /api/beds/{id}` | Update Bed Base Rent & Attributes | Existing vacant bed | 1. Select Bed -> Edit -> Change Monthly Rent from 8000 to 8500<br>2. Save | Returns `200 OK`. New base rent reflects on booking forms. | `[ ] PENDING` | |
| `PROP-05` | `DELETE /api/beds/{id}` | Delete Occupied Bed (Negative) | Bed currently occupied by active tenant | 1. Attempt to delete occupied bed | Returns `400 Bad Request` ("Cannot delete occupied bed. Please check out or transfer tenant first"). | `[ ] PENDING` | |

---

## Module 4: Public Leads & Tenant Onboarding Flow

### APIs Covered
- `POST /api/public/leads` — Public Website Inquiry / Lead Submission
- `GET /api/leads` — Internal Admin List Leads
- `PUT /api/leads/{id}/status` — Update Lead Status (NEW, CONTACTED, VISITED, CONVERTED, DROPPED)
- `POST /api/public/tenant-onboarding/initiate` — Public Self-Onboarding Initiation
- `POST /api/public/tenant-onboarding/verify-otp` — Verify Phone / Email OTP
- `POST /api/public/tenant-onboarding/submit-details` — Tenant Self-KYC & Document Upload
- `GET /api/public/tenant-onboarding/status/{token}` — Check Onboarding Approval Status

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `ONBD-01` | `POST /api/public/leads` | Submit Public Lead from Landing Page | Name, Phone, Email, Preferred Room Type | 1. Go to public website homepage/contact<br>2. Submit inquiry form | Returns `201 Created`. Lead notification triggered; appears on Admin Leads Dashboard. | `[ ] PENDING` | |
| `ONBD-02` | `POST /api/public/tenant-onboarding/initiate` | Self-Onboarding Link Generation & OTP Send | Property configured with public onboarding | 1. Open `/onboarding/:propertySlug`<br>2. Enter Phone Number & Email<br>3. Click "Send OTP" | Returns `200 OK`. SMS/Email OTP generated and dispatched. | `[ ] PENDING` | |
| `ONBD-03` | `POST /api/public/tenant-onboarding/verify-otp` | Verify OTP | Valid active OTP | 1. Enter received 6-digit OTP<br>2. Submit | Returns `200 OK` with onboarding session token. Step unlocks personal info step. | `[ ] PENDING` | |
| `ONBD-04` | `POST /api/public/tenant-onboarding/submit-details` | Complete KYC & Document Upload | Aadhaar/Govt ID files, selfie, emergency contact | 1. Fill personal details, upload Aadhaar front/back and selfie<br>2. Accept house rules and submit | Returns `200 OK`. Tenant record created in `ONBOARDING_PENDING_APPROVAL` status. | `[ ] PENDING` | |
| `ONBD-05` | `PUT /api/tenants/{id}/approve-onboarding` | Admin Approves Self-Onboarded Tenant | Admin credentials, pending KYC record | 1. Navigate to `/tenants/onboarding-requests`<br>2. Review uploaded KYC documents<br>3. Click "Approve & Allocate Bed" | Bed allocated, Welcome SMS/Email sent with Tenant Portal login credentials. | `[ ] PENDING` | |
| `ONBD-06` | `POST /api/public/tenants/upload-document` | Mandatory KYC Upload & 3MB Limit Enforcement | PDF/Image file | 1. Open public express onboarding page<br>2. Try submitting without uploading document proof (observe mandatory validation error)<br>3. Try uploading file >3MB (observe inline red error)<br>4. Upload valid file <=3MB | Document is uploaded, file URL saved, and `TenantDocument` record automatically created upon registration. | `[ ] PENDING` | |
| `ONBD-07` | `POST /api/public/tenants/onboard` | Secure Credential Dispatch (No Plaintext Password in Response) | Public onboarding payload | 1. Complete public onboarding form and submit<br>2. Inspect HTTP JSON response body and Network tab | Response contains confirmation message and `tempPassword` is omitted from JSON. Credentials dispatched securely via Email/SMS. | `[ ] PENDING` | |
| `ONBD-08` | `POST /api/public/tenants/onboard` | Cross-Organization Movement & Login Account Linking | Tenant checked out from Org A, now onboarding in Org B | 1. Resident with existing email/mobile onboards at Org B<br>2. Check Org A records (intact, untouched)<br>3. Check Org B records (fresh tenancy profile)<br>4. Log into Tenant Portal | Org A history is preserved, Org B receives new tenancy, and existing portal login continues to work with existing password. | `[ ] PENDING` | |

---

## Module 5: Bookings & Allocations

### APIs Covered
- `GET /api/bookings` — List Bookings (Filters: Status, Property, Date Range)
- `POST /api/bookings` — Create New Booking (Walk-in or Advance)
- `GET /api/bookings/{id}` — Get Booking Details
- `PUT /api/bookings/{id}/confirm` — Confirm Advance Booking (Mark Token Paid)
- `PUT /api/bookings/{id}/cancel` — Cancel Booking & Process Refund
- `POST /api/bookings/{id}/convert-to-checkin` — Convert Booking directly to Active Check-In

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `BOOK-01` | `POST /api/bookings` | Create Advance Booking with Token Amount | Vacant bed, guest details, token amount | 1. Go to `/bookings` -> "New Booking"<br>2. Select Property, Room, Bed, Expected Move-in Date, Token Advance: ₹2,000<br>3. Save | Returns `201 Created`. Bed status changes to `RESERVED`. Booking receipt generated. | `[ ] PENDING` | |
| `BOOK-02` | `POST /api/bookings` | Double Booking Prevention (Negative) | Bed already reserved or occupied | 1. Try booking the same Bed ID for overlapping dates | Returns `400 Bad Request` or `409 Conflict` ("Selected bed is already booked or occupied"). | `[ ] PENDING` | |
| `BOOK-03` | `PUT /api/bookings/{id}/cancel` | Cancel Booking with Forfeit/Refund | Existing reserved booking | 1. Select Booking -> "Cancel Booking"<br>2. Choose "Full Refund" or "Forfeit Token"<br>3. Submit | Returns `200 OK`. Booking status set to `CANCELLED`. Bed released back to `VACANT`. | `[ ] PENDING` | |
| `BOOK-04` | `POST /api/bookings/{id}/convert-to-checkin` | Seamless Check-In Conversion | Confirmed booking on move-in date | 1. Open Booking -> Click "Proceed to Check-In"<br>2. Verify pre-filled tenant and bed info | Redirects to Check-In wizard with token payment pre-deducted from security deposit. | `[ ] PENDING` | |

---

## Module 6: Tenant Management & Document Vault

### APIs Covered
- `GET /api/tenants` — List Tenants (Filter by Property, Room, Status: ACTIVE, NOTICE, CHECKED_OUT)
- `POST /api/tenants` — Direct Tenant Creation & Bed Assignment
- `GET /api/tenants/{id}` — Tenant 360 Profile (Personal, Stay, Invoices, Payments, Tickets, Documents)
- `PUT /api/tenants/{id}` — Update Tenant Information
- `POST /api/tenants/{id}/documents` — Upload Document (Aadhaar, Passport, Police Verification, Agreement)
- `GET /api/tenants/{id}/documents/{docId}` — Download / Preview Secure Document
- `DELETE /api/tenants/{id}/documents/{docId}` — Delete Document
- `PUT /api/tenants/{id}/change-bed` — Room/Bed Transfer with Pro-Rata Adjustment

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `TNT-01` | `GET /api/tenants` | Tenant Directory Search & Filtering | Active database records | 1. Go to `/tenants`<br>2. Filter by Property: "Green Villa", Status: "ACTIVE"<br>3. Search by Name / Phone | Returns `200 OK`. Table updates instantly with matching active tenants. | `[ ] PENDING` | |
| `TNT-02` | `POST /api/tenants/{id}/documents` | Secure Document Upload (PDF/Image) | Multipart file, Document Type: `GOVT_ID` | 1. Open Tenant 360 View -> Documents tab<br>2. Upload `aadhaar.pdf`<br>3. Save | Returns `200 OK`. File stored securely; thumbnail and verification badge appear. | `[ ] PENDING` | |
| `TNT-03` | `PUT /api/tenants/{id}/change-bed` | Tenant Bed Transfer (Upgrade / Downgrade) | Active tenant, target vacant bed | 1. Open Tenant -> "Transfer Bed"<br>2. Select Bed 201-B (₹9,000/mo) from 101-A (₹8,000/mo)<br>3. Confirm date | Old bed becomes `VACANT`, new bed becomes `OCCUPIED`. Rent adjusted pro-rata. | `[ ] PENDING` | |
| `TNT-04` | `POST /api/tenants/{id}/notice` | Put Tenant on Move-Out Notice | Active tenant | 1. Open Tenant -> "Initiate Notice"<br>2. Set Notice Date & Expected Move-out Date (e.g. 30 days ahead) | Status changes to `NOTICE_PERIOD`. Bed scheduled for vacancy on move-out date. | `[ ] PENDING` | |

---

## Module 7: Check-In & Check-Out Audits

### APIs Covered
- `POST /api/check-in/execute` — Execute Check-In (Agreement signing, Key handover, Initial invoice)
- `GET /api/checkin-checklist` — Get Standard Asset Checklist (Keys, Mattress, AC Remote, Cupboard)
- `POST /api/check-out/initiate` — Initiate Move-Out & Clearance Process
- `POST /api/checkout-audit/inspect` — Record Asset Damage & Deduction Checklist
- `POST /api/check-out/finalize` — Finalize Settlement (Deduct Dues/Damages, Refund Deposit)

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `CHK-01` | `POST /api/check-in/execute` | Complete Desk Check-In Workflow | Tenant in `READY_FOR_CHECKIN` status | 1. Go to `/receptionist` or `/check-in`<br>2. Select Tenant with status `READY_FOR_CHECKIN`<br>3. Complete asset checklist (Key, Remote handed over)<br>4. Collect/verify deposit & rent<br>5. Click Complete Desk Check-In | Returns `200 OK`. Tenant status set to `ACTIVE`, bed set to `OCCUPIED`, Check-In record logged. | `[ ] PENDING` | |
| `CHK-02` | `POST /api/checkout-audit/inspect` | Record Room Damage during Check-Out | Tenant in notice period | 1. Go to `/check-out` -> Select Tenant<br>2. Mark "Wall Damage: ₹1,500", "Lost Key: ₹500"<br>3. Upload damage photos & save | Returns `200 OK`. Deductions added to Final Settlement Statement. | `[ ] PENDING` | |
| `CHK-03` | `POST /api/check-out/finalize` | Final Deposit Refund & Bed Release | Completed audit | 1. Review Settlement: Deposit ₹10,000 - Unpaid Rent ₹3,000 - Damage ₹2,000 = Refund ₹5,000<br>2. Record Refund Payment mode & confirm | Tenant status set to `CHECKED_OUT`, bed released to `VACANT`, final settlement receipt generated. | `[ ] PENDING` | |

---

## Module 8: Invoices, Billing Plans & Bulk Rent Runs

### APIs Covered
- `GET /api/invoices` — List Invoices (Status: PAID, PENDING, OVERDUE, PARTIAL)
- `POST /api/invoices` — Create One-Off Manual Invoice
- `GET /api/invoices/{id}` — Get Invoice Breakdown & PDF Download
- `POST /api/bulk-rent-run/execute` — Trigger Monthly Rent Invoicing Batch
- `POST /api/bulk-rent-run/preview` — Preview upcoming batch run count & amounts
- `GET /api/billing-plans`, `POST /api/billing-plans` — Custom Billing Cycles & Rent Rules

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `INV-01` | `POST /api/bulk-rent-run/preview` | Preview Monthly Bulk Invoicing | Active tenants across properties | 1. Navigate to `/billing/bulk-rent-run`<br>2. Select Billing Month: "September 2026"<br>3. Click "Generate Preview" | Returns `200 OK` with list of eligible tenants, pro-rata calculations, and total expected billing sum. | `[ ] PENDING` | |
| `INV-02` | `POST /api/bulk-rent-run/execute` | Execute Bulk Rent Run | Verified preview | 1. Click "Run Batch Invoicing"<br>2. Confirm modal | Returns `200 OK`. Invoices generated for all active tenants; automated SMS/WhatsApp payment links sent. | `[ ] PENDING` | |
| `INV-03` | `POST /api/invoices` | Create Custom Manual Invoice | Tenant ID, Line Items (e.g. "Deep Cleaning ₹800") | 1. Go to `/billing/invoices` -> "Create Invoice"<br>2. Add custom line items, tax, due date<br>3. Save | Returns `201 Created`. Invoice appears in tenant's pending dues. | `[ ] PENDING` | |
| `INV-04` | `GET /api/invoices/{id}/pdf` | Download Branded GST Invoice PDF | Existing invoice | 1. Click "Download PDF" on any invoice | Returns `200 OK` with `application/pdf` containing Org logo, GSTIN, tenant details, QR code for payment. | `[ ] PENDING` | |

---

## Module 9: Payments, Gateways & Razorpay Webhooks

### APIs Covered
- `GET /api/payments` — Payment Transactions List (Online, Cash, UPI, Bank Transfer)
- `POST /api/payments/record-offline` — Record Cash/Bank Transfer Payment
- `POST /api/payments/razorpay/create-order` — Create Razorpay Payment Order
- `POST /api/payments/razorpay/verify` — Verify Payment Signature & Settle Invoice
- `POST /api/webhooks/razorpay` — Razorpay Asynchronous Webhook Handler
- `GET /api/payments/{id}/receipt` — Download Official Payment Receipt

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `PAY-01` | `POST /api/payments/record-offline` | Record Offline Cash/UPI Payment | Unpaid invoice, Admin/Accountant | 1. Go to Invoice -> Click "Collect Payment"<br>2. Select "Cash" or "Direct Bank Transfer", enter Ref #, Amount<br>3. Submit | Returns `200 OK`. Invoice marked as `PAID` (or `PARTIAL`), payment receipt generated immediately. | `[ ] PENDING` | |
| `PAY-02` | `POST /api/payments/razorpay/create-order` | Online Payment Order Creation | Tenant paying invoice via portal | 1. Tenant clicks "Pay Now ₹8,500" in Tenant Portal | Returns `200 OK` with Razorpay `order_id`, amount in paise, currency `INR`. | `[ ] PENDING` | |
| `PAY-03` | `POST /api/payments/razorpay/verify` | Razorpay Payment Signature Verification | Valid signature from Razorpay checkout modal | 1. Complete test card payment on Razorpay modal<br>2. Frontend posts `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` | Returns `200 OK`. Signature verified cryptographically via HMAC-SHA256, invoice marked `PAID`. | `[ ] PENDING` | |
| `PAY-04` | `POST /api/webhooks/razorpay` | Razorpay Webhook Event Handling (Idempotency) | Valid webhook signature header `X-Razorpay-Signature` | 1. Simulate `payment.captured` webhook from Razorpay | Returns `200 OK`. Payment recorded; duplicate webhook calls do not create duplicate ledger entries. | `[ ] PENDING` | |
| `PAY-05` | `POST /api/payments/razorpay/verify` | Tampered Signature Rejection (Negative) | Forged `razorpay_signature` | 1. Send invalid signature to verify endpoint | Returns `400 Bad Request` ("Invalid payment signature"). Invoice remains `UNPAID`. | `[ ] PENDING` | |

---

## Module 10: Penalties, Discounts & Utility Billing

### APIs Covered
- `POST /api/penalties/apply` — Apply Late Payment Fee / Rule
- `POST /api/discounts/apply` — Apply Promotional or Discretionary Discount
- `GET /api/meter-readings`, `POST /api/meter-readings` — Room/Floor Electricity Sub-Meter Readings
- `POST /api/utility-billing/calculate` — Generate Utility Invoices from Unit Consumption (Units * Rate/Unit)

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `UTIL-01` | `POST /api/meter-readings` | Submit Monthly Sub-Meter Readings | Previous reading exists (e.g. 1200 units), new reading: 1350 units | 1. Go to `/utilities/meter-readings`<br>2. Select Room 102, enter Current Reading: 1350<br>3. Save | Returns `201 Created`. System calculates 150 units consumed. | `[ ] PENDING` | |
| `UTIL-02` | `POST /api/utility-billing/calculate` | Generate Shared Electricity Utility Invoices | Rate: ₹10/unit, 2 sharing occupants | 1. Click "Generate Electricity Bills"<br>2. Confirm calculation | Returns `200 OK`. Utility invoice of ₹750 generated for each occupant in the room. | `[ ] PENDING` | |
| `UTIL-03` | `POST /api/penalties/apply` | Automated / Manual Late Fee Application | Overdue invoice past grace period | 1. Check overdue invoice > 5 days past due<br>2. Run daily late fee job or apply manually (₹100/day) | Late fee line item added to invoice total. | `[ ] PENDING` | |
| `UTIL-04` | `POST /api/discounts/apply` | Apply Owner Discount to Invoice | Unpaid invoice | 1. Open Invoice -> "Add Discount"<br>2. Enter ₹500, Reason: "Early Bird Discount"<br>3. Save | Invoice total reduced by ₹500; discount audit trail recorded. | `[ ] PENDING` | |

---

## Module 11: Complaints, Support & Real-Time Chat

### APIs Covered
- `GET /api/complaints` — List Complaints (Filters: Category, Priority, Status: OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- `POST /api/complaints` — Raise Complaint (Plumbing, Wi-Fi, Electrical, Housekeeping, Noise)
- `PUT /api/complaints/{id}/assign` — Assign Staff / Vendor
- `PUT /api/complaints/{id}/status` — Update Ticket Status
- `GET /api/complaints/{id}/chat` — Fetch Ticket Discussion Messages
- `POST /api/complaints/{id}/chat` — Post Message / Photo in Ticket Thread
- `POST /api/support-tickets` — Internal Support & Escalation Tickets

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `CMP-01` | `POST /api/complaints` | Tenant Raises Complaint with Photo | Tenant authenticated | 1. In Tenant App, go to "New Complaint"<br>2. Category: "Plumbing", Priority: "HIGH", upload leak photo<br>3. Submit | Returns `201 Created`. Property Manager receives instant push/SMS alert. | `[ ] PENDING` | |
| `CMP-02` | `PUT /api/complaints/{id}/assign` | Assign Complaint to Maintenance Staff | Open complaint | 1. Admin/Manager opens complaint<br>2. Selects assigned staff: "Ramesh (Plumber)"<br>3. Save | Returns `200 OK`. Staff notified, status updates to `IN_PROGRESS`. | `[ ] PENDING` | |
| `CMP-03` | `POST /api/complaints/{id}/chat` | Two-Way Real-Time Ticket Chat | Assigned staff and tenant | 1. Staff types "Reaching at 4 PM" in chat<br>2. Tenant replies "Okay, I will be in room" | Returns `201 Created`. Messages appear chronologically in thread with timestamps. | `[ ] PENDING` | |
| `CMP-04` | `PUT /api/complaints/{id}/status` | Resolve Complaint with OTP / Tenant Verification | In-progress ticket | 1. Staff marks resolved with resolution note<br>2. Tenant receives prompt to verify and rate 1-5 stars | Returns `200 OK`. Status transitions to `RESOLVED` -> `CLOSED`. | `[ ] PENDING` | |

---

## Module 12: Front Desk Operations, Visitors & Parcels

### APIs Covered
- `GET /api/front-desk-shift/current`, `POST /api/front-desk-shift/start`, `POST /api/front-desk-shift/end` — Receptionist Shift Handover & Cash Register
- `GET /api/visitors`, `POST /api/visitors/check-in`, `PUT /api/visitors/{id}/check-out` — Visitor Log & Tenant Approval
- `GET /api/parcels`, `POST /api/parcels/log-delivery`, `PUT /api/parcels/{id}/collect` — Delivery / Courier Tracking & Handover OTP

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `FD-01` | `POST /api/front-desk-shift/start` | Receptionist Starts Shift & Opens Cash Drawer | Receptionist login | 1. Navigate to `/receptionist/dashboard`<br>2. Enter Opening Cash: ₹3,500<br>3. Click "Start Shift" | Returns `200 OK`. Shift timer starts; all transactions in shift tagged to active session. | `[ ] PENDING` | |
| `FD-02` | `POST /api/visitors/check-in` | Visitor Entry with Host Tenant Confirmation | Visitor at gate | 1. Reception logs Visitor Name, Phone, Visiting Tenant: Room 204<br>2. Submit entry | Returns `201 Created`. Notification sent to Tenant; Visitor badge generated. | `[ ] PENDING` | |
| `FD-03` | `PUT /api/visitors/{id}/check-out` | Visitor Departure Log | Active checked-in visitor | 1. Visitor leaves gate -> Reception clicks "Check Out" | Returns `200 OK`. Exit timestamp recorded; duration calculated. | `[ ] PENDING` | |
| `FD-04` | `POST /api/parcels/log-delivery` | Log Courier / Amazon Parcel Arrival | Courier name, Tenant name, Room # | 1. Go to `/parcels` -> "Log Parcel"<br>2. Select Tenant, Courier: "Amazon", tracking code<br>3. Save | Returns `201 Created`. Tenant receives SMS/Push with 4-digit Collection OTP. | `[ ] PENDING` | |
| `FD-05` | `PUT /api/parcels/{id}/collect` | Parcel Handover via OTP Verification | Unclaimed parcel | 1. Tenant comes to desk, provides OTP<br>2. Receptionist enters OTP to verify | Returns `200 OK`. Parcel status marked `COLLECTED` with timestamp and receiver signature. | `[ ] PENDING` | |
| `FD-06` | `POST /api/front-desk-shift/end` | Shift End & Cash Reconcile | Active shift with cash collected | 1. Click "End Shift"<br>2. Enter physical cash counted vs system calculated cash<br>3. Close Shift | Shift report generated with over/short variance recorded in audit logs. | `[ ] PENDING` | |

---

## Module 13: Maintenance & Safety Incidents

### APIs Covered
- `GET /api/maintenance`, `POST /api/maintenance/schedule` — Preventive Maintenance Tasks (Water Tank Cleaning, AC Servicing, Pest Control)
- `GET /api/safety-incidents`, `POST /api/safety-incidents/report` — Log Safety/Security Incident (Theft, Fire Alarm, Medical)

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `MNT-01` | `POST /api/maintenance/schedule` | Schedule Recurring Preventive Task | Property selected | 1. Go to `/maintenance` -> "Schedule Task"<br>2. Title: "Quarterly Water Purifier Filter Change", Frequency: "Every 90 Days"<br>3. Save | Returns `201 Created`. Task schedules next due date automatically. | `[ ] PENDING` | |
| `MNT-02` | `POST /api/safety-incidents/report` | Log High Severity Safety Incident | Incident details | 1. Go to `/security/incidents` -> "Report Incident"<br>2. Type: "Medical Emergency", Severity: "CRITICAL", Action Taken: "Ambulance called"<br>3. Submit | Returns `201 Created`. Incident broadcasted immediately to Owner and emergency contacts. | `[ ] PENDING` | |

---

## Module 14: Tenant Self-Service Portal

### Features Covered
- Tenant Mobile-Responsive Dashboard
- View My Stay, Room & Bed Details
- View Invoices & Payment History
- Instant UPI / Card Rent Payment
- Raise & Track Complaints
- View Visitors & Parcels
- Digital Rental Agreement Download
- Submit Move-Out Notice

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `TP-01` | `GET /api/tenant-portal/summary` | Tenant Home Summary Dashboard | Active tenant credentials | 1. Log in at `/tenant/login`<br>2. View Dashboard summary | Returns `200 OK`. Displays current rent due, upcoming due date, active complaints, and parcel alerts. | `[ ] PENDING` | |
| `TP-02` | `GET /api/tenant-portal/agreement` | View & Download Digital Agreement | Signed agreement available | 1. Go to "My Agreement" -> "Download PDF" | Returns `200 OK`. PDF renders with tenant and owner terms, signatures, and date. | `[ ] PENDING` | |
| `TP-03` | `POST /api/tenant-portal/vacate-notice` | Submit Vacate Notice from Portal | Active tenant | 1. Go to "Leave PG" -> Select Move-out Date (30 days ahead)<br>2. Provide reason & submit | Returns `200 OK`. Notice submitted to Manager for approval; timeline displayed on tenant app. | `[ ] PENDING` | |

---

## Module 15: Accountant Portal & Financial Controls

### APIs Covered
- `GET /api/accountant/overview` — Financial KPI Cards (Gross Revenue, Overdue Collections, Expenses, Net Cashflow)
- `GET /api/accountant/transactions` — Master Financial Journal & Ledger
- `GET /api/accountant/reports/tax` — GST / Tax Summary Report
- `POST /api/accountant/reconcile` — Bank Statement Reconciliation

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `ACC-01` | `GET /api/accountant/overview` | Accountant Financial Overview | Accountant / Owner role | 1. Navigate to `/accountant/dashboard`<br>2. Check Revenue, Outstanding Dues, Collections by Property | Returns `200 OK`. Calculations match individual invoice and payment tables accurately. | `[ ] PENDING` | |
| `ACC-02` | `GET /api/accountant/reports/tax` | Export GST / Tax Report (Excel / CSV) | Date range specified | 1. Select Month: "August 2026"<br>2. Click "Export GST Report" | Returns `200 OK` with CSV/XLSX detailing CGST, SGST, IGST, B2B invoices, and GSTIN breakdown. | `[ ] PENDING` | |
| `ACC-03` | `POST /api/accountant/reconcile` | Bank Reconciliation Match | Upload bank statement CSV | 1. Upload bank statement -> Match system payments with bank lines<br>2. Confirm | Reconciled payments flagged as verified; variance report generated. | `[ ] PENDING` | |

---

## Module 16: Super Admin SaaS Management & Billing

### APIs Covered
- `GET /api/super-admin/subscribers` — List All Customer Organizations & Tenants
- `PUT /api/super-admin/subscribers/{id}/status` — Suspend / Activate Organization
- `GET /api/super-admin/plans`, `POST /api/super-admin/plans` — SaaS Plan Tier Management (Starter, Pro, Enterprise)
- `GET /api/super-admin/api-metrics` — Platform-wide API Call Volume & Latencies
- `GET /api/super-admin/leads` — SaaS B2B Enterprise Leads
- `GET /api/super-admin/user-tracking` — Active Users & Geo-Distribution

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `SADM-01` | `GET /api/super-admin/subscribers` | View All Subscribed PG Businesses | Super Admin authenticated | 1. Log in as Super Admin -> Go to `/super-admin/subscribers` | Returns `200 OK` with list of all businesses, bed counts, active plan, MRR, and renewal dates. | `[ ] PENDING` | |
| `SADM-02` | `PUT /api/super-admin/subscribers/{id}/status` | Suspend Delinquent SaaS Tenant | Org in non-payment | 1. Click "Suspend Organization"<br>2. Confirm modal | Org status set to `SUSPENDED`. Organization users receive suspension screen upon login. | `[ ] PENDING` | |
| `SADM-03` | `POST /api/super-admin/plans` | Create New SaaS Pricing Tier | Plan details, Bed limits, Feature flags | 1. Go to "SaaS Plans" -> "Create Plan"<br>2. Name: "Growth 100", Bed Limit: 100, Price: ₹2,499/mo<br>3. Save | Returns `201 Created`. Plan appears on public pricing page and upgrade modal. | `[ ] PENDING` | |

---

## Module 17: System Health, Metrics, Backup & Auditing

### APIs Covered
- `GET /api/system/metrics` — CPU, RAM, JVM Heap, Active DB Connections
- `GET /api/system/metrics/stream` — SSE (Server-Sent Events) Live Metric Stream
- `POST /api/super-admin/backups/create` — Trigger On-Demand Database Backup
- `GET /api/super-admin/backups` — List Database Snapshots & Download
- `GET /api/audit-logs` — Organization-wide Immutable Audit Trail

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `SYS-01` | `GET /api/system/metrics` | System Resource Health Check | Admin / Super Admin | 1. Go to `/admin/system-health`<br>2. Check JVM memory, DB pool, uptime | Returns `200 OK` with valid system statistics and green status indicators. | `[ ] PENDING` | |
| `SYS-02` | `POST /api/super-admin/backups/create` | Trigger Automated DB Backup | Super Admin | 1. Go to `/super-admin/backups` -> Click "Create Snapshot Now" | Returns `202 Accepted` / `200 OK`. Backup archive generated and stored securely in cloud/disk. | `[ ] PENDING` | |
| `SYS-03` | `GET /api/audit-logs` | Verify Action Auditing Integrity | Trigger any critical write action (e.g. Delete Room) | 1. Delete Room 104<br>2. Open `/audit-logs`<br>3. Filter by action: `DELETE_ROOM` | Audit record displays Actor, Timestamp, IP Address, Previous State, and New State. | `[ ] PENDING` | |

---

## Module 18: Organization Branding & Settings

### APIs Covered
- `GET /api/branding`, `PUT /api/branding` — Custom Logo, Favicon, Brand Colors, Domain
- `GET /api/organization/financial-settings`, `PUT /api/organization/financial-settings` — Default Due Day, Grace Period, Late Fee Rules, GSTIN
- `GET /api/notification-logs` — Outbound SMS, Email & WhatsApp Logs

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `SET-01` | `PUT /api/branding` | Update White-Label Logo & Theme Colors | PNG/SVG Logo, Hex Color `#4F46E5` | 1. Go to `/settings/branding`<br>2. Upload Logo & choose Primary Color<br>3. Save | Returns `200 OK`. Topbar, Login Page, and Invoice PDFs immediately reflect new branding. | `[ ] PENDING` | |
| `SET-02` | `PUT /api/organization/financial-settings` | Configure Rent Due Day & Grace Period | Due Day: 5th, Grace Period: 3 Days, Late Fee: ₹50/day | 1. Go to `/settings/billing`<br>2. Set rules and save | Returns `200 OK`. Next bulk rent run inherits the updated schedule parameters. | `[ ] PENDING` | |
| `SET-03` | `GET /api/notification-logs` | Verify Outbound Dispatch Logs | SMS / Email sent from previous actions | 1. Open `/settings/notifications/logs` | Returns `200 OK` with delivery status (`DELIVERED`, `FAILED`, `PENDING`), recipient phone, and template ID. | `[ ] PENDING` | |

---

## Module 19: Global Search, File Security & Real-Time Streams

### APIs Covered
- `GET /api/search` — Global Omni-Search (Tenants, Rooms, Invoices, Visitors, Bookings)
- `POST /api/upload` — Secure File & Document Storage
- `GET /api/dashboard/stream` — SSE Real-Time Dashboard & Occupancy Stream

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `SRCH-01` | `GET /api/search?q=Rahul` | Global Topbar Omni-Search | Multi-entity records exist | 1. Press `Ctrl + K` or click search bar<br>2. Type "Rahul"<br>3. Inspect categorized dropdown | Returns grouped results: Tenants (2 matches), Bookings (1 match), Invoices (3 matches). Clicking navigates directly. | `[ ] PENDING` | |
| `SRCH-02` | `GET /api/search?q=9876543210` | Exact Phone Number Search | Tenant phone in DB | 1. Search full or partial 10-digit mobile number | Returns instant direct match to tenant profile with zero lag. | `[ ] PENDING` | |
| `FILE-01` | `POST /api/upload` | File Type & Size Validation (Security) | `.exe` or >15MB file | 1. Attempt uploading an unsupported executable or oversized file | Returns `400 Bad Request` ("Invalid file format. Only PDF, JPG, PNG allowed up to 10MB"). | `[ ] PENDING` | |
| `STRM-01` | `GET /api/dashboard/stream` | Real-Time SSE Live Counter Updates | Active dashboard open in 2 tabs | 1. Open Dashboard in Tab A<br>2. Check in a tenant in Tab B<br>3. Observe Tab A without refreshing | Occupancy counter and revenue metric update automatically via Server-Sent Events (SSE). | `[ ] PENDING` | |

---

## Module 20: SaaS Subscription Quotas & Paywall Enforcement

### APIs Covered
- `GET /api/subscription/current` — Current Org Subscription Plan, Quotas & Bed Usage
- `POST /api/subscription/upgrade` — Upgrade Subscription Tier

### Test Scenarios & Checklist

| Test ID | Method & Endpoint | Feature / Scenario | Preconditions / Payload | Step-by-Step Testing Procedure | Expected Result | Status | Notes / Actual |
|---|---|---|---|---|---|---|---|
| `SUB-01` | `POST /api/beds` | Bed Quota Limit Enforcement | Org on Starter Plan (Max 30 beds), currently at 30 beds | 1. Attempt to create 31st Bed | Creation blocked with `403 Forbidden` / `402 Payment Required` and UI banner "Bed limit reached. Upgrade plan". | `[ ] PENDING` | |
| `SUB-02` | `POST /api/subscription/upgrade` | Instant Quota Increase on Upgrade | Razorpay subscription checkout | 1. Choose "Pro Plan (100 Beds)" -> Complete payment<br>2. Re-attempt creating Bed | Returns `200 OK`. Quota immediately bumped to 100 beds; bed creation succeeds. | `[ ] PENDING` | |
| `SUB-03` | `GET /api/subscription/current` | Expired Plan Grace Period Handling | Subscription past renewal date | 1. Mock expired subscription status<br>2. Log in as Owner | System shows "Subscription Overdue" warning modal with 3-day grace period before read-only lock. | `[ ] PENDING` | |

---

## 🚀 How to Execute & Track This Test Plan

### Step 1: Clone / Pull Latest Code & Start Local Stack
1. **Backend**: Run Spring Boot backend on `http://localhost:8080` (or configured port).
2. **Frontend**: Run Vite React frontend on `http://localhost:5173`.
3. **Database**: Ensure PostgreSQL / MySQL is seeded with baseline test data.

### Step 2: Testing Order of Operations
1. **Phase 1: Foundation**: Run `AUTH` and `RBAC` tests first to confirm credentials and role permissions.
2. **Phase 2: Property Setup**: Run `PROP` space hierarchy generation to have buildings, rooms, and beds ready.
3. **Phase 3: Core Operations**: Run `ONBD` -> `BOOK` -> `CHK` -> `TNT` for the full lifecycle of a tenant.
4. **Phase 4: Finance**: Run `INV` -> `PAY` -> `UTIL` to verify billing runs and Razorpay webhooks.
5. **Phase 5: Daily Ops & Portals**: Run `CMP` -> `FD` -> `TP` -> `ACC`.
6. **Phase 6: Platform & System**: Run `SADM` -> `SYS` -> `SET` -> `SRCH` -> `SUB`.

### Step 3: Updating Status & Logging Bugs
- Change `[ ] PENDING` to `[x] PASS` when a test case passes.
- Change to `[!] FAIL` and document the exact error message in the **Notes / Actual** column.
- For blocking bugs, mark `[-] BLOCKED` and note the blocking Test ID.

