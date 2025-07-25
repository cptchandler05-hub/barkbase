import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function logWinner(address: string, amount: number) {
  const timestamp = new Date();

  if (isNaN(timestamp.getTime())) {
    console.error("❌ Invalid timestamp generated in logWinner!");
    return;
  }

  const iso = timestamp.toISOString();
  console.log("🎯 ATTEMPTING TO LOG WINNER:", {
    address,
    amount,
    timestamp: iso,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

  try {
    const { data, error } = await supabase.from("winners").insert([
      {
        address,
        amount,
        timestamp: iso,
      },
    ]);

    if (error) {
      console.error("❌ Supabase insert error:", error);
      console.error("❌ Error details:", JSON.stringify(error, null, 2));
    } else {
      console.log("✅ Winner successfully logged:", data);
      
      // Immediately try to fetch to verify
      const { data: fetchData, error: fetchError } = await supabase
        .from("winners")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1);
        
      if (fetchError) {
        console.error("❌ Error fetching after insert:", fetchError);
      } else {
        console.log("✅ Verification fetch successful:", fetchData);
      }
    }
  } catch (err) {
    console.error("❌ Exception in logWinner:", err);
  }
}
