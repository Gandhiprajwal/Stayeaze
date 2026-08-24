-- Add refund account columns to tenants table for tenant self-service deposit payouts
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS refund_upi VARCHAR(100),
ADD COLUMN IF NOT EXISTS refund_account_name VARCHAR(150),
ADD COLUMN IF NOT EXISTS refund_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS refund_ifsc VARCHAR(30),
ADD COLUMN IF NOT EXISTS refund_bank_name VARCHAR(100);
