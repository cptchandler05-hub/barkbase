import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function logWinner(address: string, amount: number) {
  const timestamp = new Date();

  if (isNaN(timestamp.getTime())) {
    console.error("❌ Invalid timestamp generated in logWinner!");
    return;
  }

  const iso = timestamp.toISOString();
  console.log("Logging winner to Supabase:", {
    address,
    amount,
    timestamp: iso,
  });

  const { data, error } = await supabase.from("winners").insert([
    {
      address,
      amount,
      timestamp: iso,
    },
  ]);

  if (error) {
    console.error("❌ Supabase insert error:", error);
  } else {
    console.log("✅ Winner successfully logged:", data);
  }
}
