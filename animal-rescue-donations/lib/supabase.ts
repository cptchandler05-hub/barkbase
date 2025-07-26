import { createClient } from '@supabase/supabase-js';
import { Dog, DogSync } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Only create client if both URL and key are available
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Helper function to check if Supabase is available
export const isSupabaseAvailable = () => {
  return supabase !== null;
};

// Database helper functions
export async function getAllDogs(limit = 100, offset = 0) {
  if (!isSupabaseAvailable()) {
    console.warn('Supabase is not available.  Returning an empty array.');
    return [];
  }

  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('status', 'adoptable')
    .order('visibility_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data as Dog[];
}

export async function searchDogs(location?: string, breed?: string, limit = 100) {
  if (!isSupabaseAvailable()) {
    console.warn('Supabase is not available.  Returning an empty array.');
    return [];
  }

  let query = supabase
    .from('dogs')
    .select('*')
    .eq('status', 'adoptable')
    .order('visibility_score', { ascending: false });

  // Add location filter (search both city and state)
  if (location) {
    query = query.or(`city.ilike.*${location}*,state.ilike.*${location}*`);
  }

  if (breed) {
    query = query.or(`primary_breed.ilike.%${breed}%,secondary_breed.ilike.%${breed}%`);
  }

  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data as Dog[];
}

export async function getDogById(id: string) {
  if (!isSupabaseAvailable()) {
    console.warn('Supabase is not available.  Returning null.');
    return null;
  }

  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('petfinder_id', id)
    .single();

  if (error) throw error;
  return data as Dog;
}