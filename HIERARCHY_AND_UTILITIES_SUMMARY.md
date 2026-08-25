# StayEaze Hierarchy & Sub-Meter Billing Engine Documentation

## 1. Overview & Structural Hierarchy
To eliminate duplicate room ambiguities (e.g. *Block A - Room 101* vs *Block B - Room 101*) and ensure clean, segregated operations across multi-building properties, the StayEaze system enforces a strict relational hierarchy:

$$\text{Property} \longrightarrow \text{Building} \longrightarrow \text{Floor} \longrightarrow \text{Room} \longrightarrow \text{Bed}$$

```
StayEaze Grand Residency (Property)
 ├── Block A - North Wing (Building)
 │    ├── 1st Floor (Floor)
 │    │    ├── Room 101 (Room, 2-sharing, ₹8,000/mo)
 │    │    │    ├── Bed B1 [Occupied - Rahul Sharma]
 │    │    │    └── Bed B2 [Available]
 │    │    └── Room 102
 │    └── 2nd Floor
 └── Block B - South Wing (Building)
      └── 1st Floor (Floor)
           └── Room 101 (Room, 3-sharing, ₹6,500/mo)
                ├── Bed B1 [Available]
                ├── Bed B2 [Available]
                └── Bed B3 [Available]
```

---

## 2. Automated Backend Test Suite
- **Test File**: `HierarchyAllocationServiceTest.java`
- **Execution Command**: `mvn test -Dtest=HierarchyAllocationServiceTest`
- **Result**: `BUILD SUCCESS (4/4 Scenarios Passed)`

| # | Test Scenario | Verified Behavior |
|---|---|---|
| 1 | `testRoomDtoHierarchyResolution` | `RoomDTO` accurately resolves and serializes `buildingId`, `buildingName`, `floorId`, `floorNumber`, `propertyName`. |
| 2 | `testBedDtoHierarchyResolution` | `BedDTO` resolves the complete `Property -> Building -> Floor -> Room -> Bed` path. |
| 3 | `testCrossBuildingIsolation` | Occupying Bed B1 in **Block A - Room 101** does not alter or conflict with Bed B1 in **Block B - Room 101**. |
| 4 | `testMeterSheetHierarchyMapping` | Sub-meter reading items retain building and floor identity. |

---

## 3. Centralized Hierarchical Selector: `RoomSelect.tsx`
The primary selector component (`stayeaze-web/src/components/common/RoomSelect.tsx`) was upgraded:

- **Hierarchical Section Headers**: Rooms are grouped under headers formatted as `[Building Name • Floor Name]` (e.g. `Block A - North Wing • Floor 1`).
- **Global Search**: Type any building name, floor number, room number, or sharing type.
- **Selected Trigger Chip**: Shows `[Block A • Floor 1] Room 101 (Double) • Bed: B1`.
- **Live Bed Availability Matrix**: Displays interactive chips for every bed with real-time occupancy status (`Available` in green, `Occupied` with tenant name in red).

---

## 4. Master Data & Operations Form Upgrades

### A. Rooms Management (`RoomsPage.tsx`)
- **Table**: Added **Building / Tower** column alongside Floor and Sharing.
- **Filters**: Added **Building** filter dropdown to isolate rooms by block.
- **Add / Edit Modal**: Cascades `Building -> Floor` selection.

### B. Beds Management (`BedsPage.tsx`)
- **Table**: Displays **Building & Floor** breadcrumbs (`Block A • Floor 1`).
- **Modal**: Uses hierarchical `RoomSelect` (`Building -> Floor -> Room -> Bed`).

### C. Bookings (`BookingsPage.tsx`) & Check-Ins (`CheckInsPage.tsx`)
- Replaced flat dropdowns with hierarchical `<RoomSelect>` preventing cross-building duplicate allocations.

---

## 5. Sub-Meter Utilities & Automated Invoicing Engine

### A. Free Allowance Units
- **Property-Level Default**: Set in the top filter bar (`🎁 Free Allowance (U)`), e.g. `10` free units/month.
- **Per-Room Custom Override**: Editable `Free U` input in each table row.
- **Formula**:
  $$\text{Net Units} = \max\Big(0, (\text{Current Reading} - \text{Previous Reading}) - \text{Free Allowance}\Big)$$

### B. Physical Meter Photo Upload & Proof
- **Camera Capture**: Click the `<Camera />` button in any row to snap or upload a photo of the physical meter dial.
- **Verification Thumbnail**: Uploaded photos display with a green verification ring.
- **Inspection Modal**: Clicking the thumbnail or **Eye (Inspect)** opens a high-resolution preview of the meter reading proof alongside tenant breakdown proportions.

### C. Automated Rent Invoice Integration Logic
When the manager clicks **"1-Click Apply to Rent Invoices"**:

- **Scenario A (Rent invoice exists & is UNPAID)**: Appends line item `"Electricity (X units @ ₹Y/unit, Room Z)"` directly into the existing rent invoice. Updated total = Room Rent + Utility. Tenant pays both in 1 single transaction.
- **Scenario B (Rent invoice is ALREADY PAID or does not exist)**: Automatically generates a dedicated utility invoice (`UTIL-202608-XXXX`) so the tenant can clear the balance separately without modifying their finalized rent receipt.

### D. WhatsApp Share
Instant 1-click sharing generates formatted resident statements:
```text
⚡ StayEaze Sub-Meter Bill - Block A • Room 101 (First Floor)
📅 Billing Cycle: 8/2026
🔢 Meter Reading: 1200 ➔ 1290 (90 net units @ ₹10/unit)
🎁 Free Allowance Deducted: 10 units
💰 Room Total: ₹800.00

Per Tenant Share:
• Rahul Sharma: ₹400 (40 units)
• Amit Kumar: ₹400 (40 units)

Please clear the balance on your StayEaze portal.
```

---

## 6. Tenant Portal Experience
1. **Tenant Dashboard** (`TenantDashboardPage.tsx`):
   - Hero banner and Outstanding Balance widget reflect total consolidated dues.
   - Quick **"Pay Rent & Bills"** button launches Razorpay / UPI gateway.
2. **Billing & Receipts** (`TenantBillingPage.tsx`):
   - Lists all invoices with itemized table breakdown:
     - `Room Rent`: `₹8,000.00`
     - `Electricity / Sub-Meter`: `₹450.00`
     - `Net Total`: `₹8,450.00`
   - Official Printable Tax Receipt with HRA declaration and verification QR code.

---

## 7. Advance Rent & Prepaid Credit System
In StayEaze, **Advance Rent** is tracked and handled distinctly from refundable **Security Deposits**:

| Feature | Security Deposit | Advance Rent (Prepaid Credit) |
|---|---|---|
| **Purpose** | Held as collateral against property damages. | Pre-payment toward future monthly rent. |
| **Refund Policy** | Refunded/settled at checkout. | Automatically deducted/credited against upcoming rent invoices. |
| **Portal Status** | Marked as `Fully Deposited & Secure`. | Displayed with dedicated `PREPAID CREDIT` badge & banner. |
| **Impact on Outstanding** | Does not increase or decrease current rent dues. | Reduces outstanding balance ($\text{Due} - \text{Paid}$). |

### Key UI Touchpoints:
1. **Tenant Billing Portal** (`TenantBillingPage.tsx`):
   - 4-card metric grid: `Monthly Rent`, `Security Deposit`, `Advance Rent Credit`, `Outstanding Due`.
   - Dedicated **Prepaid Credit Banner** explaining auto-coverage for upcoming monthly invoices.
2. **Tenant Dashboard** (`TenantDashboardPage.tsx`):
   - Living Space & Financial card with active **Advance Rent Credit** line item.
3. **Manager 360° Drawer** (`Tenant360Drawer.tsx`):
   - Displays real-time `Advance Balance` alongside monthly rent and security deposit.

---

## 8. Verification & Build Status
- **Backend (Maven / JUnit 5)**: `mvn test -Dtest=HierarchyAllocationServiceTest` $\to$ **`BUILD SUCCESS`**
- **Frontend (Vite / TypeScript)**: `npm run build` $\to$ **`✓ built in 13.70s (0 errors)`**

