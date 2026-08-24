-- Flyway Migration V5: Add Sales Notes and Last Contacted Columns to Onboarding Leads

ALTER TABLE onboarding_leads ADD COLUMN IF NOT EXISTS sales_notes VARCHAR(2000);
ALTER TABLE onboarding_leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP WITH TIME ZONE;
