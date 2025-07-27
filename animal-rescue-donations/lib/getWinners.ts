import { createClient } from "@supabase/supabase-js";

export async function getWinners() {
  try {
    // Check if Supabase environment variables are available
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.log("Supabase environment variables not configured, returning empty winners list");
      return [];
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from("winners")
      .select("address, amount, timestamp")
      .order("timestamp", { ascending: false })
      .limit(10);

    if (error) {
      console.error("❌ Error fetching winners:", error);
      return [];
    }

    console.log("✅ Successfully fetched winners:", data?.length || 0);
    return data || [];
  } catch (err) {
    console.error("❌ Exception in getWinners:", err);
    return [];
  }
}