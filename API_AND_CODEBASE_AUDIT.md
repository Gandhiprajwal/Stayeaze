# 📊 StayEaze — Codebase & API Integration Audit Report

This report documents all backend APIs, controller endpoints, and frontend files that are currently **unconnected to the UI**, **unused**, or **dormant**.

---

## 1. 🌐 Backend Feature APIs with No Frontend UI Page (10 Modules)

These modules are fully implemented in Spring Boot (with PostgreSQL tables, JPA entities, repositories, and REST controllers), but do not have dedicated pages or routes in the React frontend:

| # | Feature / Controller | Backend Route Prefix | Database Tables | Description & Purpose |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Parcel & Courier Tracking**<br>`ParcelController.java` | `/api/v1/parcels` | `parcels` | Guard/Reception logs incoming courier deliveries for residents. Generates pickup OTP and marks collected. |
| 2 | **Utility Sub-Meter Readings**<br>`MeterReadingController.java` | `/api/v1/meter-readings` | `meter_readings` | Monthly electricity & water meter units consumed per room or floor. Auto-computes per-unit surcharges. |
| 3 | **Safety & Security Incidents**<br>`SafetyIncidentController.java` | `/api/v1/safety-incidents` | `safety_incidents` | Night guard incident logging (unauthorized visitors, property damage, noise complaints, emergencies). |
| 4 | **Digital Rental Agreements**<br>`AgreementController.java` | `/api/v1/agreements` | `agreements` | Agreement generation with customized terms, clauses, and e-signature tracking between owner and tenant. |
| 5 | **Move-In Checklist & Inspection**<br>`CheckinChecklistController.java` | `/api/v1/checkin-checklists` | `checkin_checklists` | Item-by-item handover checklist (keys, mattress, AC remote, cupboards) verified during check-in. |
| 6 | **Move-Out Audit & Asset Inspection**<br>`CheckoutAuditController.java` | `/api/v1/checkout-audits` | `checkout_audits` | Inspection audit of room conditions and deductions before finalizing deposit refund. |
| 7 | **Penalties & Discounts Config**<br>`PenaltyDiscountController.java` | `/api/v1/penalties-discounts` | `penalties_discounts` | Configurable rules for daily late payment fees or early-bird rent payment discounts. |
| 8 | **Notification Logs & Audit**<br>`NotificationLogController.java` | `/api/v1/notification-logs` | `notification_logs` | Audit trail of all automated SMS, emails, and WhatsApp alerts sent by the system with delivery status. |
| 9 | **Walk-in Lead / Inquiry CRM**<br>`InquiryController.java` | `/api/v1/inquiries` | `inquiries` | Receptionist walk-in inquiry tracker with follow-up dates, room preferences, and conversion to booking. |
| 10 | **Custom PG Billing Plans**<br>`BillingPlanController.java` | `/api/v1/billing-plans` | `billing_plans` | Pre-defined packaged plans (e.g. "Triple Sharing with 3 Meals", "Single Deluxe AC") with fixed line items. |

---

## 2. 🔌 Unused / Bypassed Controller Endpoints

These endpoints exist in active backend controllers, but the frontend uses alternative endpoints:

| Controller | Method & Route | Why It Is Unused |
| :--- | :--- | :--- |
| `TenantController.java` | `GET /api/v1/tenants/search` | Frontend calls `GET /api/v1/tenants?search=...` directly via the standard paginated `DataTable` component instead. |
| `InvoiceController.java` | `POST /api/v1/invoices/generate-monthly-batch` | Auto-billing runs as an automated background `@Scheduled` cron job in `AutoBillingService.java`, making the manual HTTP trigger redundant. |
| `PropertyController.java` | `GET /api/v1/properties/{id}/occupancy-detailed` | The frontend computes detailed floor/room breakdowns from room queries rather than this endpoint. |
| `SuperAdminBackupController.java` | `POST /api/v1/super-admin/backups/restore-file` | Backups are restored using existing snapshot paths rather than raw multipart uploads. |

---

## 3. 📂 Dormant / Legacy Code in Frontend

| File Path | Description | Status |
| :--- | :--- | :--- |
| `stayeaze-web/src/lib/mock-adapter.ts` | In-memory mock API adapter built for early design mockup tests. | **Dormant** (commented out in `api.ts`). |
| `stayeaze-web/src/lib/mock-db.ts` | Hardcoded initial in-memory JSON data used by mock adapter. | **Dormant** (replaced by real PostgreSQL database). |
| `stayeaze-web/src/lib/services/auth.ts` (`demoAccounts`) | Hardcoded demo fallback credential map. | **Legacy** (real users authenticate against PostgreSQL via Spring Security). |

---

## 4. 📈 Statistics Summary

- **Total Backend Controllers**: 51
- **Controllers Active & Connected to UI**: 41 (80%)
- **Controllers Active in Backend Only**: 10 (20%)
- **Total Frontend Feature Pages**: 45
- **Dormant Mock/Legacy Files**: 2 (`mock-adapter.ts`, `mock-db.ts`)

---

## 💡 Recommended Next Implementation Priorities

1. **Parcel & Courier Management UI** (for receptionists & security guards)
2. **Utility Meter Readings UI** (for room-level electricity & water bill computation)
3. **Move-in Checklists & Move-out Asset Audit UI** (for check-in / check-out inspections)
