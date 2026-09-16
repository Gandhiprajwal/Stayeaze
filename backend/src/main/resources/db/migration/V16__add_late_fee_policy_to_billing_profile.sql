-- V16: Add configurable late fee policy columns to organization_billing_profiles
-- Allows owners/admins to configure grace period (days) and fee percentage via Settings UI

ALTER TABLE organization_billing_profiles
    ADD COLUMN IF NOT EXISTS late_fee_grace_period_days INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS late_fee_percentage        NUMERIC(5, 2) NOT NULL DEFAULT 5.00;

COMMENT ON COLUMN organization_billing_profiles.late_fee_grace_period_days IS 'Days after invoice due date before late fee surcharge is applied (default: 5)';
COMMENT ON COLUMN organization_billing_profiles.late_fee_percentage         IS 'Percentage of overdue amount charged as late fee surcharge (default: 5.00%)';
