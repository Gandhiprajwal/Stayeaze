-- =============================================================================
-- StayEaze PG/Hostel Management SaaS Platform - Full PostgreSQL DDL Schema Script
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations (Multi-tenant SaaS Subscriber Accounts)
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. SaaS Subscription Plans (Starter, Growth, Enterprise Tiers)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code VARCHAR(50) UNIQUE NOT NULL CHECK (plan_code IN ('STARTER', 'GROWTH', 'ENTERPRISE')),
    name VARCHAR(100) NOT NULL,
    price_monthly NUMERIC(10, 2) NOT NULL,
    price_yearly NUMERIC(10, 2) NOT NULL,
    max_beds INT NOT NULL DEFAULT 50,
    max_properties INT NOT NULL DEFAULT 1,
    features JSONB NOT NULL DEFAULT '[]',
    is_popular BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tenant Organization Active Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED', 'EXPIRED')),
    billing_cycle VARCHAR(20) DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL,
    auto_renew BOOLEAN DEFAULT TRUE,
    payment_status VARCHAR(50) DEFAULT 'PAID' CHECK (payment_status IN ('PAID', 'PENDING', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Organization Legal & Tax Billing Profiles
CREATE TABLE IF NOT EXISTS organization_billing_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    legal_name VARCHAR(200) NOT NULL,
    gstin VARCHAR(20),
    pan_number VARCHAR(15),
    billing_address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'DEACTIVATED')),
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    is_two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_otp VARCHAR(10),
    two_factor_otp_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL CHECK (name IN ('SUPER_ADMIN', 'OWNER', 'PROPERTY_MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'SECURITY_GUARD', 'STAFF', 'TENANT')),
    permissions JSONB NOT NULL
);

-- 7. User Roles Mapping
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 8. Properties
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    amenities VARCHAR(100)[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    currency VARCHAR(10) DEFAULT 'INR',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    security_deposit NUMERIC(12, 2) DEFAULT 10000.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Buildings
CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT unique_building_code_per_property UNIQUE(property_id, code)
);

-- 10. Floors
CREATE TABLE IF NOT EXISTS floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INT NOT NULL,
    name VARCHAR(50),
    CONSTRAINT unique_floor_per_building UNIQUE(building_id, floor_number)
);

-- 11. Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    sharing_type VARCHAR(50) NOT NULL CHECK (sharing_type IN ('SINGLE', 'DOUBLE', 'TRIPLE', 'FOUR_SHARING', 'DORMITORY')),
    room_type VARCHAR(50) DEFAULT 'AC' CHECK (room_type IN ('AC', 'NON_AC')),
    base_rent NUMERIC(10, 2) NOT NULL,
    has_attached_washroom BOOLEAN DEFAULT TRUE,
    has_balcony BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE', 'RESERVED')),
    CONSTRAINT unique_room_per_floor UNIQUE(floor_id, room_number)
);

-- 12. Beds
CREATE TABLE IF NOT EXISTS beds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'VACANT' CHECK (status IN ('VACANT', 'OCCUPIED', 'RESERVED', 'UNDER_MAINTENANCE')),
    monthly_rent NUMERIC(10, 2),
    qr_code VARCHAR(255) UNIQUE,
    CONSTRAINT unique_bed_per_room UNIQUE(room_id, bed_number)
);

-- 13. Tenants
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(20),
    permanent_address TEXT,
    kyc_status VARCHAR(50) DEFAULT 'PENDING' CHECK (kyc_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING_CHECKIN', 'NOTICE_PERIOD', 'CHECKED_OUT', 'SUSPENDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for High-Speed Performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions (org_id);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_org ON organization_billing_profiles (org_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users (org_id);
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties (org_id);
CREATE INDEX IF NOT EXISTS idx_buildings_property ON buildings (property_id);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors (building_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms (floor_id);
CREATE INDEX IF NOT EXISTS idx_beds_room ON beds (room_id);
CREATE INDEX IF NOT EXISTS idx_tenants_org ON tenants (org_id);

-- Composite Indexes for High-Frequency Filtering
CREATE INDEX IF NOT EXISTS idx_tenants_org_status ON tenants (org_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_org_status ON properties (org_id, status);
CREATE INDEX IF NOT EXISTS idx_rooms_floor_status ON rooms (floor_id, status);
CREATE INDEX IF NOT EXISTS idx_beds_room_status ON beds (room_id, status);

-- 14. Operational Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50),
    vendor_name VARCHAR(150),
    reference_number VARCHAR(100),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expense_org_date ON expenses(org_id, expense_date);
