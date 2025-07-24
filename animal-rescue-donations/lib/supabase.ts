
import { createClient } from '@supabase/supabase-js';
import { Dog, DogSync } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database helper functions
export async function getAllDogs(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('status', 'available')
    .order('visibility_score', { ascending: false })
    .range(offset, offset + limit - 1);
    
  if (error) throw error;
  return data as Dog[];
}

export async function searchDogs(location?: string, breed?: string, limit = 100) {
  let query = supabase
    .from('dogs')
    .select('*')
    .eq('status', 'available')
    .order('visibility_score', { ascending: false });
    
  if (location) {
    query = query.ilike('location', `%${location}%`);
  }
  
  if (breed) {
    query = query.or(`breed_primary.ilike.%${breed}%,breed_secondary.ilike.%${breed}%`);
  }
  
  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data as Dog[];
}

export async function getDogById(id: string) {
  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('petfinder_id', id)
    .single();
    
  if (error) throw error;
  return data as Dog;
}
