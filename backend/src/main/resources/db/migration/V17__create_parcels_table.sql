-- V17: Create parcels table for full courier & parcel desk management lifecycle
CREATE TABLE IF NOT EXISTS parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    courier_company VARCHAR(100) NOT NULL,
    tracking_number VARCHAR(150),
    parcel_type VARCHAR(50) DEFAULT 'BOX',
    locker_location VARCHAR(100),
    pickup_otp VARCHAR(10),
    qr_code_token VARCHAR(100),
    status VARCHAR(50) DEFAULT 'RECEIVED',
    handover_method VARCHAR(50),
    handed_over_by VARCHAR(150),
    recipient_signature TEXT,
    delegate_name VARCHAR(150),
    delegate_phone VARCHAR(30),
    photo_url TEXT,
    notes TEXT,
    reminder_count INTEGER DEFAULT 0,
    last_reminded_at TIMESTAMP WITH TIME ZONE,
    received_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    handed_over_date TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_parcels_org_id ON parcels(org_id);
CREATE INDEX IF NOT EXISTS idx_parcels_tenant_id ON parcels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_pickup_otp ON parcels(pickup_otp);
