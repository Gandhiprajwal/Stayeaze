-- Flyway Migration V13: Add password_hash to onboarding_leads to preserve user credentials across conversion

ALTER TABLE onboarding_leads ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
