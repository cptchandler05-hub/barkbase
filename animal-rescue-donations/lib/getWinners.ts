import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if both URL and key are defined
const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Conditionally create the Supabase client
const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

// Helper function to check Supabase availability
export const isSupabaseAvailable = () => isSupabaseConfigured;

export async function getWinners() {
  try {
    // Return empty array if Supabase is not configured
    if (!isSupabaseAvailable() || !supabase) {
      console.log('Supabase not available, returning empty winners list');
      return [];
    }

    const { data, error } = await supabase
      .from('winners')
      .select('address, amount, timestamp') // Selecting the correct columns
      .order('timestamp', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching winners from Supabase:', error);
      return [];
    }

    return data?.map(winner => ({
      address: winner.address,
      amount: winner.amount?.toString() || '0', // Ensure amount is a string
      timestamp: winner.timestamp
    })) || [];
  } catch (error) {
    console.error('Error in getWinners:', error);
    return [];
  }
}