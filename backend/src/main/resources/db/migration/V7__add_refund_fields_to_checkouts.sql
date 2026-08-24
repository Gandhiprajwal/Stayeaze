-- Migration V7: Add refund settlement columns to check_outs
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'NOT_ELIGIBLE';
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS refund_approved_by VARCHAR(150);
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS refund_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS refund_payment_mode VARCHAR(50);
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS refund_transaction_ref VARCHAR(100);
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS refund_notes TEXT;
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS net_refund_amount NUMERIC(12, 2);
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS beneficiary_upi VARCHAR(100);
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS beneficiary_bank VARCHAR(100);
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS beneficiary_account VARCHAR(50);
ALTER TABLE check_outs ADD COLUMN IF NOT EXISTS beneficiary_ifsc VARCHAR(30);

-- Update completed checkouts to PENDING_APPROVAL if not refunded yet
UPDATE check_outs SET refund_status = 'PENDING_APPROVAL' WHERE status = 'completed' AND (refund_status IS NULL OR refund_status = 'NOT_ELIGIBLE');
