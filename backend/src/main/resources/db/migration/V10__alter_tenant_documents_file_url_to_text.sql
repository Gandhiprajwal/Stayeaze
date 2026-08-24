-- Alter tenant_documents file_url column from VARCHAR(255) to TEXT to support data URIs and full document payloads
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tenant_documents' AND column_name = 'file_url'
    ) THEN
        ALTER TABLE tenant_documents ALTER COLUMN file_url TYPE TEXT;
    END IF;
END $$;
