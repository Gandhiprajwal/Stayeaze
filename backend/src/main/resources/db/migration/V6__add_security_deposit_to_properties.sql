-- Migration V6: Add security_deposit column to properties and set default value
ALTER TABLE properties ADD COLUMN IF NOT EXISTS security_deposit NUMERIC(12, 2) DEFAULT 10000.00;
UPDATE properties SET security_deposit = 10000.00 WHERE security_deposit IS NULL OR security_deposit = 0;
