
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearDogsTable() {
  console.log('🗑️ Wiping dogs table...');
  
  try {
    const { error } = await supabase
      .from('dogs')
      .delete()
      .gte('id', 0);
    
    if (error) {
      console.error('❌ Error wiping dogs table:', error);
    } else {
      console.log('✅ Dogs table wiped successfully');
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }
}

clearDogsTable();
