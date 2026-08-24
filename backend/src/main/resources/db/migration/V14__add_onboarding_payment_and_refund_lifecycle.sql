-- V14: Add End-to-End Onboarding Payment & Refund Lifecycle Tracking

ALTER TABLE organization_billing_profiles
    ADD COLUMN IF NOT EXISTS refund_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS refund_arn VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_speed VARCHAR(50),
    ADD COLUMN IF NOT EXISTS refund_error_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_error_description TEXT,
    ADD COLUMN IF NOT EXISTS refund_created_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS refund_settled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE onboarding_leads
    ADD COLUMN IF NOT EXISTS payment_failure_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS payment_failure_description TEXT,
    ADD COLUMN IF NOT EXISTS recovery_checkout_url TEXT,
    ADD COLUMN IF NOT EXISTS refund_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS refund_arn VARCHAR(100),
    ADD COLUMN IF NOT EXISTS refund_settled_at TIMESTAMP WITH TIME ZONE;
