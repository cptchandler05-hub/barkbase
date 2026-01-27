-- Add unique constraint for rescuegroups_id to enable upsert operations
-- Run this in your Supabase SQL Editor

-- First, drop the index if it exists (we'll recreate it as unique)
DROP INDEX IF EXISTS idx_dogs_rescuegroups_id;

-- Add unique constraint on rescuegroups_id
ALTER TABLE dogs ADD CONSTRAINT dogs_rescuegroups_id_unique UNIQUE (rescuegroups_id);

-- Verify it was created
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'dogs' AND constraint_type = 'UNIQUE';
