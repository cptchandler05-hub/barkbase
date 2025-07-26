
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
    
    // Check dog sync status with detailed visibility score analysis
    const { data: allDogs, error: dogError } = await supabase
      .from('dogs')
      .select('id, name, visibility_score, last_updated_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (dogError) {
      console.error('❌ Dogs query error:', dogError);
    } else {
      console.log('🐕 Total dogs in database:', allDogs?.length || 0);
      
      if (allDogs && allDogs.length > 0) {
        // Check if visibility scores are updated
        const scoresWithValues = allDogs.filter(d => d.visibility_score > 0);
        const scoresWithZero = allDogs.filter(d => d.visibility_score === 0);
        const scoresWithNull = allDogs.filter(d => d.visibility_score === null);
        
        console.log('📊 Dogs with visibility scores > 0:', scoresWithValues.length);
        console.log('📊 Dogs with visibility score = 0:', scoresWithZero.length);
        console.log('📊 Dogs with visibility score = null:', scoresWithNull.length);
        
        // Show sample of recent dogs
        console.log('📋 Recent dogs sample:');
        allDogs.slice(0, 5).forEach(dog => {
          console.log(`  - ${dog.name}: score=${dog.visibility_score}, updated=${dog.last_updated_at}`);
        });
        
        // Check if any dogs were updated in last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const recentlyUpdated = allDogs.filter(d => new Date(d.last_updated_at || d.created_at) > yesterday);
        console.log('⏰ Dogs updated in last 24 hours:', recentlyUpdated.length);
      }
    }
    
    // Check for any sync records
    const { data: syncRecords, error: syncError } = await supabase
      .from('dog_syncs')
      .select('*')
      .order('sync_date', { ascending: false })
      .limit(5);
      
    if (syncError) {
      console.error('❌ Sync records error:', syncError);
    } else {
      console.log('📝 Recent sync records:', syncRecords?.length || 0);
      if (syncRecords && syncRecords.length > 0) {
        syncRecords.forEach(record => {
          console.log(`  - ${record.sync_date}: ${record.dogs_added} added, ${record.dogs_updated} updated`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugCronJobs();
