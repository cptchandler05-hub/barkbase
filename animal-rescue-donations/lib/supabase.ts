import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { DogFormatter } from '@/lib/dogFormatter';

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
export async function getAllDogs(limit: number = 100): Promise<any[]> {
  try {
    console.log(`Fetching ${limit} dogs from database, ordered by visibility_score desc`);

    const { data, error } = await supabase
      .from('dogs')
      .select('*')
      .eq('status', 'adoptable')
      .not('petfinder_id', 'is', null) // Ensure we have valid IDs
      .order('visibility_score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching dogs from database:', error);
      return [];
    }

    console.log(`Fetched ${data?.length || 0} dogs from database, ordered by visibility_score desc`);

    // Format the dogs properly using DogFormatter
    const formattedDogs = (data || [])
      .map(dog => {
        // Use the DogFormatter to ensure consistent formatting
        const formatted = DogFormatter.formatDatabaseDog(dog);

        // Convert back to legacy format for the adopt page
        return DogFormatter.toLegacyFormat(formatted, false); // Don't truncate descriptions
      })
      .filter(dog => {
        // Filter out null dogs (those with invalid IDs) and dogs with null/invalid IDs
        return dog && dog.id && dog.id !== 'null' && dog.id !== 'undefined' && dog.id !== null;
      });

    return formattedDogs;
  } catch (error) {
    console.error('Error in getAllDogs:', error);
    return [];
  }
}

export async function searchDogs(location: string, breed?: string, limit: number = 100): Promise<any[]> {
  try {
    console.log(`Searching for dogs with location: ${location}, breed: ${breed}, limit: ${limit}`);

    let query = supabase
      .from('dogs')
      .select('*')
      .eq('status', 'adoptable')
      .not('petfinder_id', 'is', null); // Ensure we have valid IDs

    // Add location-based filtering if provided
    if (location && location.trim()) {
      const normalizedLocation = location.trim().toLowerCase();

      // Try different location matching strategies
      query = query.or(
        `city.ilike.%${normalizedLocation}%,state.ilike.%${normalizedLocation}%,zip.ilike.%${normalizedLocation}%`
      );
    }

    // Add breed filtering if provided
    if (breed && breed.trim()) {
      const normalizedBreed = breed.trim().toLowerCase();
      query = query.or(
        `primary_breed.ilike.%${normalizedBreed}%,secondary_breed.ilike.%${normalizedBreed}%`
      );
    }

    // Order by visibility score and limit results
    query = query
      .order('visibility_score', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error searching dogs:', error);
      return [];
    }

    console.log(`Found ${data?.length || 0} dogs matching search criteria`);

    // Format the dogs properly using DogFormatter
    const formattedDogs = (data || [])
      .map(dog => {
        // Use the DogFormatter to ensure consistent formatting
        const formatted = DogFormatter.formatDatabaseDog(dog);

        // Convert back to legacy format for the adopt page
        return DogFormatter.toLegacyFormat(formatted, false); // Don't truncate descriptions
      })
      .filter(dog => {
        // Filter out null dogs (those with invalid IDs) and dogs with null/invalid IDs
        return dog && dog.id && dog.id !== 'null' && dog.id !== 'undefined' && dog.id !== null;
      });

    return formattedDogs;
  } catch (error) {
    console.error('Error in searchDogs:', error);
    return [];
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
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      // Don't throw, return null to allow fallback to Petfinder
      return null;
    }

    console.log('Found dog in database:', data?.name);
    // Ensure contact info is formatted correctly for clickability
    const formattedDog = DogFormatter.formatDatabaseDog(data as Dog);
    return formattedDog;
  } catch (error) {
    console.error('Error getting dog by ID:', error);
    console.error('Unexpected error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't throw, return null to allow fallback to Petfinder
    return null;
  }
}

export async function getDogByRescueGroupsId(rescueGroupsId: string): Promise<Dog | null> {
  if (!isSupabaseAvailable()) {
    console.warn('Supabase is not available. Returning null.');
    return null;
  }

  if (!rescueGroupsId || rescueGroupsId === 'undefined' || rescueGroupsId === 'null') {
    console.error('Invalid rescueGroupsId provided:', rescueGroupsId);
    return null;
  }

  try {
    console.log('Searching for dog with rescuegroups_id:', rescueGroupsId);

    const { data, error } = await supabase
      .from('dogs')
      .select('*')
      .eq('rescuegroups_id', rescueGroupsId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        console.log(`No dog found with rescuegroups_id: ${rescueGroupsId}`);
        return null;
      }
      console.error('Supabase error getting dog by RescueGroups ID:', error);
      // Don't throw, return null to allow fallback
      return null;
    }

    console.log('Found dog in database by RescueGroups ID:', data?.name);
    // Ensure contact info is formatted correctly for clickability
    const formattedDog = DogFormatter.formatDatabaseDog(data as Dog);
    return formattedDog;
  } catch (error) {
    console.error('Error getting dog by RescueGroups ID:', error);
    // Don't throw, return null to allow fallback
    return null;
  }
}