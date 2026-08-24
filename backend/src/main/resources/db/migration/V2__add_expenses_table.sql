-- Flyway Migration V2: Add Expenses Table for Property Accountant Portal

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50),
    vendor_name VARCHAR(150),
    reference_number VARCHAR(100),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expense_org_date ON expenses(org_id, expense_date);
