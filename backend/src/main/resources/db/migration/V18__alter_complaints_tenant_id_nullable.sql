-- Alter complaints table to make tenant_id nullable for general facility & property complaints
ALTER TABLE complaints ALTER COLUMN tenant_id DROP NOT NULL;
