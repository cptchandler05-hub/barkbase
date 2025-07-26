
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCronJobs() {
  console.log('🔍 Debugging Cron Jobs...');
  
  try {
    // Check last raffle execution
    const { data: raffleConfig, error: raffleError } = await supabase
      .from('raffle_config')
      .select('*')
      .eq('id', 1)
      .single();
      
    if (raffleError) {
      console.error('❌ Raffle config error:', raffleError);
    } else {
      console.log('🎲 Raffle Config:', raffleConfig);
    }
    
    // Check recent winners
    const { data: recentWinners, error: winnersError } = await supabase
      .from('raffle_winners')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (winnersError) {
      console.error('❌ Winners error:', winnersError);
    } else {
      console.log('🏆 Recent Winners:', recentWinners);
    }
    
    // Check dog sync status
    const { data: dogCount, error: dogError } = await supabase
      .from('dogs')
      .select('visibility_score', { count: 'exact' });
      
    if (dogError) {
      console.error('❌ Dogs count error:', dogError);
    } else {
      console.log('🐕 Total dogs in database:', dogCount?.length || 0);
      
      // Check if visibility scores are updated
      const scoresWithValues = dogCount?.filter(d => d.visibility_score > 0) || [];
      console.log('📊 Dogs with visibility scores:', scoresWithValues.length);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugCronJobs();
