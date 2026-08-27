-- V15: High-Performance Multi-Tenant Composite Database Indexes
-- Optimizes high-throughput filtering, sorting, and reporting across multi-tenant datasets.

-- 1. Invoices composite index for organization, status, and due date
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_due
ON invoices (organization_id, status, due_date);

-- 2. Invoices composite index for tenant and status
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status
ON invoices (tenant_id, status);

-- 3. Beds composite index for room and occupancy status
CREATE INDEX IF NOT EXISTS idx_beds_room_status
ON beds (room_id, status);

-- 4. Bookings composite index for organization and status
CREATE INDEX IF NOT EXISTS idx_bookings_org_status
ON bookings (organization_id, status);

-- 5. Tenants composite index for organization and status
CREATE INDEX IF NOT EXISTS idx_tenants_org_status
ON tenants (organization_id, status);

-- 6. Users composite index for organization, status, and role lookups
CREATE INDEX IF NOT EXISTS idx_users_org_status
ON users (organization_id, status);
