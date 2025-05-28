
import { NextResponse } from 'next/server';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log("🧪 Testing Supabase connection...");
    
    // Test 1: Insert a test record
    const testRecord = {
      address: "0xTEST123456789",
      amount: 0.001,
      timestamp: new Date().toISOString()
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from("winners")
      .insert([testRecord]);
      
    if (insertError) {
      console.error("❌ Insert test failed:", insertError);
      return NextResponse.json({ 
        success: false, 
        error: insertError,
        step: "insert" 
      });
    }
    
    // Test 2: Fetch all records
    const { data: fetchData, error: fetchError } = await supabase
      .from("winners")
      .select("*")
      .order("timestamp", { ascending: false });
      
    if (fetchError) {
      console.error("❌ Fetch test failed:", fetchError);
      return NextResponse.json({ 
        success: false, 
        error: fetchError,
        step: "fetch" 
      });
    }
    
    console.log("✅ Supabase test successful!");
    return NextResponse.json({ 
      success: true, 
      insertedRecord: testRecord,
      allRecords: fetchData,
      totalRecords: fetchData?.length || 0
    });
    
  } catch (error) {
    console.error("❌ Supabase test exception:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error",
      step: "exception" 
    });
  }
}
