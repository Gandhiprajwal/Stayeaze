-- V15: High-Performance Multi-Tenant Composite Database Indexes
-- Optimizes high-throughput filtering, sorting, and reporting across multi-tenant datasets.

-- 1. Invoices composite index for tenant, status, and due date
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status_due
ON invoices (tenant_id, status, due_date);

-- 2. Invoices composite index for tenant and status
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status
ON invoices (tenant_id, status);

-- 3. Beds composite index for room and occupancy status
CREATE INDEX IF NOT EXISTS idx_beds_room_status
ON beds (room_id, status);

-- 4. Bookings composite index for tenant and status
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status
ON bookings (tenant_id, status);

-- 5. Bookings composite index for bed and status
CREATE INDEX IF NOT EXISTS idx_bookings_bed_status
ON bookings (bed_id, status);

-- 6. Tenants composite index for organization and status
CREATE INDEX IF NOT EXISTS idx_tenants_org_status
ON tenants (org_id, status);

-- 7. Users composite index for organization, status, and mobile lookups
CREATE INDEX IF NOT EXISTS idx_users_org_status
ON users (org_id, status);
