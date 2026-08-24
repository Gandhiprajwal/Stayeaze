-- Add name column to floors table so user-specified floor names are persisted
ALTER TABLE floors ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Backfill existing rows
UPDATE floors SET name = 'Floor ' || floor_number WHERE name IS NULL OR name = '';
