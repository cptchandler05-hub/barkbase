
-- Add RescueGroups ID tracking to dogs table
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS rescuegroups_id TEXT;

-- Add index for RescueGroups ID lookups
CREATE INDEX IF NOT EXISTS idx_dogs_rescuegroups_id ON dogs(rescuegroups_id);

-- Update dog_syncs table to support both sources
ALTER TABLE dog_syncs MODIFY COLUMN source TEXT;

-- Add source priority for API waterfall
ALTER TABLE dogs ADD COLUMN IF NOT EXISTS api_source_priority INTEGER DEFAULT 1;
