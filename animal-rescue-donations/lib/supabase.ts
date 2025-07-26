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

export async function searchDogs(location: string, breed?: string, limit = 100) {
  if (!isSupabaseAvailable()) {
    console.warn('Supabase is not available. Returning an empty array.');
    return [];
  }

  try {
    let query = supabase
      .from('dogs')
      .select('*')
      .eq('status', 'adoptable');

    // Parse location for city and state
    const locationParts = location.split(',').map(part => part.trim());

    if (locationParts.length >= 2) {
      // Format: "City, State"
      const city = locationParts[0];
      const state = locationParts[1];

      // Fix the query syntax - use proper PostgreSQL format
      query = query.or(`city.ilike.*${city}*,state.ilike.*${state}*`);
    } else {
      // Single location - check both city and state
      query = query.or(`city.ilike.*${location}*,state.ilike.*${location}*`);
    }

    if (breed) {
      query = query.or(`primary_breed.ilike.%${breed}%,secondary_breed.ilike.%${breed}%`);
    }

    query = query
      .order('visibility_score', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Supabase search error:', error);
      throw error;
    }

    return data as Dog[];
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

export async function getDogById(petfinderId: string): Promise<Dog | null> {
  if (!isSupabaseAvailable()) {
    console.warn('Supabase is not available. Returning null.');
    return null;
  }

  if (!petfinderId || petfinderId === 'undefined' || petfinderId === 'null') {
    console.error('Invalid petfinderId provided:', petfinderId);
    return null;
  }

  try {
    console.log('Searching for dog with petfinder_id:', petfinderId);

    const { data, error } = await supabase
      .from('dogs')
      .select('*')
      .eq('petfinder_id', petfinderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        console.log(`No dog found with petfinder_id: ${petfinderId}`);
        return null;
      }
      console.error('Supabase error getting dog by ID:', error);
      throw error;
    }

    console.log('Found dog in database:', data?.name);
    return data as Dog;
  } catch (error) {
    console.error('Error getting dog by ID:', error);
    throw error;
  }
}