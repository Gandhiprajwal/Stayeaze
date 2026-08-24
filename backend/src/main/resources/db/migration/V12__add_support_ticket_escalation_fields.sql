-- =============================================================================
-- StayEaze Flyway V12: Add Support Ticket Escalation & Super Admin Action Fields
-- =============================================================================

ALTER TABLE support_tickets
    ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS escalated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS escalation_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS escalation_notes TEXT,
    ADD COLUMN IF NOT EXISTS super_admin_action_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_is_escalated ON support_tickets(is_escalated);
CREATE INDEX IF NOT EXISTS idx_support_tickets_escalated_by ON support_tickets(escalated_by_user_id);
