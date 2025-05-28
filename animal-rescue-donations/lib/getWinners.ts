import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getWinners() {
  try {
    const { data, error } = await supabase
      .from("winners")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("Error fetching winners:", error);
      return [];
    }

    console.log("Raw Supabase data:", data); // Debug log
    
    // Ensure data is in the expected format
    return data?.map(winner => ({
      address: winner.address,
      amount: winner.amount?.toString() || '0',
      timestamp: winner.timestamp
    })) || [];
  } catch (error) {
    console.error("Exception in getWinners:", error);
    return [];
  }
}
