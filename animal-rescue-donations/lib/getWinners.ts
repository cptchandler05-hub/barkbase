import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getWinners() {
  const { data, error } = await supabase
    .from("winners")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error) {
    console.error("Error fetching winners:", error);
    return [];
  }

  return data;
}
