-- BarkBase Supabase Database Schema
-- Run this SQL in your new Supabase project's SQL Editor

-- Dogs table - main table for dog data from Petfinder/RescueGroups
CREATE TABLE IF NOT EXISTS dogs (
  id SERIAL PRIMARY KEY,
  petfinder_id TEXT UNIQUE,
  rescuegroups_id TEXT UNIQUE,
  api_source TEXT NOT NULL DEFAULT 'petfinder',
  api_source_priority INTEGER DEFAULT 1,
  organization_id TEXT,
  organization_animal_id TEXT,
  url TEXT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Dog',
  species TEXT DEFAULT 'Dog',
  primary_breed TEXT,
  secondary_breed TEXT,
  is_mixed BOOLEAN DEFAULT false,
  is_unknown_breed BOOLEAN DEFAULT false,
  age TEXT,
  gender TEXT,
  size TEXT,
  coat TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  tertiary_color TEXT,
  status TEXT DEFAULT 'adoptable',
  spayed_neutered BOOLEAN,
  house_trained BOOLEAN,
  special_needs BOOLEAN DEFAULT false,
  good_with_children BOOLEAN,
  good_with_dogs BOOLEAN,
  good_with_cats BOOLEAN,
  description TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  contact_info JSONB DEFAULT '{}'::jsonb,
  city TEXT,
  state TEXT,
  postcode TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  visibility_score INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dog syncs table - tracks sync operations
CREATE TABLE IF NOT EXISTS dog_syncs (
  id SERIAL PRIMARY KEY,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  dogs_added INTEGER DEFAULT 0,
  dogs_updated INTEGER DEFAULT 0,
  dogs_removed INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dogs_petfinder_id ON dogs(petfinder_id);
CREATE INDEX IF NOT EXISTS idx_dogs_rescuegroups_id ON dogs(rescuegroups_id);
CREATE INDEX IF NOT EXISTS idx_dogs_visibility_score ON dogs(visibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_dogs_status ON dogs(status);
CREATE INDEX IF NOT EXISTS idx_dogs_api_source ON dogs(api_source);
CREATE INDEX IF NOT EXISTS idx_dogs_state ON dogs(state);
CREATE INDEX IF NOT EXISTS idx_dogs_city ON dogs(city);
CREATE INDEX IF NOT EXISTS idx_dogs_created_at ON dogs(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dog_syncs ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on dogs" ON dogs
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on dog_syncs" ON dog_syncs
  FOR SELECT USING (true);

-- Allow service role to do everything
CREATE POLICY "Allow service role full access on dogs" ON dogs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access on dog_syncs" ON dog_syncs
  FOR ALL USING (auth.role() = 'service_role');

-- Grant anon access to select
GRANT SELECT ON dogs TO anon;
GRANT SELECT ON dog_syncs TO anon;

-- Grant service_role full access
GRANT ALL ON dogs TO service_role;
GRANT ALL ON dog_syncs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE dogs_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE dog_syncs_id_seq TO service_role;
