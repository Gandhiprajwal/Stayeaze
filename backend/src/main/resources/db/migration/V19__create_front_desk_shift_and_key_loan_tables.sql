-- V19: Front-Desk Shift Handovers, Key Loans, and Lost & Found Tables

CREATE TABLE IF NOT EXISTS front_desk_shift_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    receptionist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    receptionist_name VARCHAR(255) NOT NULL,
    shift_type VARCHAR(50) NOT NULL DEFAULT 'MORNING', -- MORNING, EVENING, NIGHT
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    cash_collected NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    token_advances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    key_deposits NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    guest_meal_tokens NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_VERIFICATION', -- PENDING_VERIFICATION, VERIFIED_DEPOSITED, DISCREPANCY
    verified_by_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_by_manager_name VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    incoming_staff_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_front_desk_shifts_org ON front_desk_shift_handovers(organization_id);
CREATE INDEX IF NOT EXISTS idx_front_desk_shifts_prop ON front_desk_shift_handovers(property_id);
CREATE INDEX IF NOT EXISTS idx_front_desk_shifts_status ON front_desk_shift_handovers(status);

CREATE TABLE IF NOT EXISTS key_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    room_number VARCHAR(100) NOT NULL,
    bed_number VARCHAR(50),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_name VARCHAR(255) NOT NULL,
    tenant_phone VARCHAR(50),
    loan_reason VARCHAR(255) NOT NULL, -- LOCKED_OUT, ROOM_INSPECTION, MAINTENANCE, SPARE_BORROW
    loan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_return_time TIMESTAMP WITH TIME ZONE,
    actual_return_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE_LOAN', -- ACTIVE_LOAN, RETURNED, LOST_REPLACED
    issued_by_name VARCHAR(255),
    replacement_fee NUMERIC(10, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_loans_org ON key_loans(organization_id);
CREATE INDEX IF NOT EXISTS idx_key_loans_prop ON key_loans(property_id);
CREATE INDEX IF NOT EXISTS idx_key_loans_status ON key_loans(status);

CREATE TABLE IF NOT EXISTS lost_and_found_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'ELECTRONICS', -- ELECTRONICS, KEYS, WALLET, CLOTHING, OTHER
    found_location VARCHAR(255) NOT NULL,
    found_date DATE NOT NULL DEFAULT CURRENT_DATE,
    photo_url TEXT,
    found_by_name VARCHAR(255),
    storage_rack VARCHAR(100) DEFAULT 'Front Desk Cabinet',
    status VARCHAR(50) NOT NULL DEFAULT 'UNCLAIMED', -- UNCLAIMED, CLAIMED, DISPOSED
    claimed_by_name VARCHAR(255),
    claimed_by_phone VARCHAR(50),
    claimed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lost_found_org ON lost_and_found_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_lost_found_prop ON lost_and_found_items(property_id);
CREATE INDEX IF NOT EXISTS idx_lost_found_status ON lost_and_found_items(status);
