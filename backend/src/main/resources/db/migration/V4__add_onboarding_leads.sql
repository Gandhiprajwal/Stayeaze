-- Flyway Migration V4: Add Onboarding Leads Table for Super Admin Tracking

CREATE TABLE IF NOT EXISTS onboarding_leads (
    id UUID PRIMARY KEY,
    owner_name VARCHAR(150) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    owner_phone VARCHAR(20),
    property_name VARCHAR(150) NOT NULL,
    property_code VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_PAYMENT',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'UNPAID',
    onboarding_fee NUMERIC(12, 2) DEFAULT 2999.00,
    error_message VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON onboarding_leads(created_at DESC);
