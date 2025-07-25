
const { createClient } = require('@supabase/supabase-js');
const { getRandomRuralZip } = require('../lib/utils.js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

// Token management
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5-minute buffer
  
  if (cachedToken && now < (tokenExpiresAt - buffer)) {
    console.log('🔄 Using cached Petfinder token');
    return cachedToken;
  }

  console.log('🔑 Fetching new Petfinder access token...');
  
  const res = await fetch('https://api.petfinder.com/v2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.PETFINDER_CLIENT_ID,
      client_secret: process.env.PETFINDER_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get token: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in * 1000);
  
  console.log('✅ Got new Petfinder token');
  return cachedToken;
}

async function rateLimitedDelay() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

function calculateVisibilityScore(dog) {
  let score = 0;
  
  // Photo scoring (0-40 points)
  const photoCount = dog.photos?.length || 0;
  if (photoCount === 0) score += 0;
  else if (photoCount === 1) score += 10;
  else if (photoCount === 2) score += 20;
  else if (photoCount >= 3) score += 40;
  
  // Description scoring (0-30 points)
  const description = dog.description || '';
  if (description.length === 0) score += 0;
  else if (description.length < 50) score += 5;
  else if (description.length < 150) score += 15;
  else score += 30;
  
  // Age scoring (0-20 points) - puppies get lower scores to balance visibility
  switch (dog.age?.toLowerCase()) {
    case 'baby':
    case 'young': score += 5; break;
    case 'adult': score += 20; break;
    case 'senior': score += 15; break;
    default: score += 10;
  }
  
  // Size scoring (0-10 points) - larger dogs often overlooked
  switch (dog.size?.toLowerCase()) {
    case 'small': score += 5; break;
    case 'medium': score += 7; break;
    case 'large':
    case 'extra large': score += 10; break;
    default: score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

async function fetchDogsFromLocation(location, accessToken) {
  await rateLimitedDelay();
  
  console.log(`🔍 Fetching dogs from: ${location}`);
  
  const params = new URLSearchParams({
    type: 'dog',
    status: 'adoptable',
    limit: '100',
    location: location,
    distance: '100'
  });

  const response = await fetch(`https://api.petfinder.com/v2/animals?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`⚠️ Rate limited for location: ${location}`);
      return [];
    }
    throw new Error(`API error for ${location}: ${response.status}`);
  }

  const data = await response.json();
  return data.animals || [];
}

async function syncDogsToDatabase(dogs, source = 'petfinder') {
  console.log(`📝 Syncing ${dogs.length} dogs to database...`);
  
  const syncRecord = {
    sync_date: new Date().toISOString(),
    dogs_added: 0,
    dogs_updated: 0,
    dogs_removed: 0,
    source: source,
    status: 'in_progress'
  };

  // Insert sync record
  const { data: syncData, error: syncError } = await supabase
    .from('dog_syncs')
    .insert([syncRecord])
    .select()
    .single();

  if (syncError) {
    console.error('❌ Failed to create sync record:', syncError);
    return;
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const dog of dogs) {
    try {
      const dogRecord = {
        petfinder_id: dog.id.toString(),
        name: dog.name || 'Unknown',
        breed_primary: dog.breeds?.primary || 'Mixed Breed',
        breed_secondary: dog.breeds?.secondary || null,
        age: dog.age || 'Unknown',
        gender: dog.gender || 'Unknown',
        size: dog.size || 'Unknown',
        location: `${dog.contact?.address?.city || ''}, ${dog.contact?.address?.state || ''}`.trim(),
        organization_id: dog.organization_id || '',
        description: dog.description || null,
        photos: dog.photos?.map(photo => photo.large || photo.medium || photo.small) || [],
        status: 'available',
        visibility_score: calculateVisibilityScore(dog),
        last_updated_at: new Date().toISOString(),
        source: source,
        raw_data: dog
      };

      // Check if dog already exists
      const { data: existingDog, error: checkError } = await supabase
        .from('dogs')
        .select('id, last_updated_at')
        .eq('petfinder_id', dogRecord.petfinder_id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.warn(`⚠️ Error checking dog ${dogRecord.name}:`, checkError);
        continue;
      }

      if (existingDog) {
        // Update existing dog
        const { error: updateError } = await supabase
          .from('dogs')
          .update(dogRecord)
          .eq('id', existingDog.id);

        if (updateError) {
          console.warn(`⚠️ Failed to update dog ${dogRecord.name}:`, updateError);
        } else {
          updatedCount++;
        }
      } else {
        // Insert new dog
        const { error: insertError } = await supabase
          .from('dogs')
          .insert([dogRecord]);

        if (insertError) {
          console.warn(`⚠️ Failed to insert dog ${dogRecord.name}:`, insertError);
        } else {
          addedCount++;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error processing dog ${dog.name}:`, error);
    }
  }

  // Update sync record
  await supabase
    .from('dog_syncs')
    .update({
      dogs_added: addedCount,
      dogs_updated: updatedCount,
      status: 'completed'
    })
    .eq('id', syncData.id);

  console.log(`✅ Sync completed: ${addedCount} added, ${updatedCount} updated`);
}

async function markRemovedDogs() {
  console.log('🧹 Marking old dogs as removed...');
  
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { error } = await supabase
    .from('dogs')
    .update({ status: 'removed' })
    .lt('last_updated_at', threeDaysAgo.toISOString())
    .eq('status', 'available');

  if (error) {
    console.error('❌ Error marking old dogs as removed:', error);
  } else {
    console.log('✅ Marked old dogs as removed');
  }
}

async function main() {
  console.log('🐕 Starting dog data sync...');
  
  try {
    const accessToken = await getAccessToken();
    
    // Use expanded rural ZIP coverage for comprehensive invisible dog discovery
    const locations = [];
    
    // Add 75 random rural ZIPs each run for comprehensive coverage
    for (let i = 0; i < 75; i++) {
      locations.push(getRandomRuralZip());
    }
    
    // Add major cities for comparison/balance (~10% of searches)
    const majorCities = [
      'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
      'Denver, CO', 'Atlanta, GA', 'Miami, FL', 'Seattle, WA',
      'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'Dallas, TX'
    ];
    
    // Add 8 random major cities
    for (let i = 0; i < 8; i++) {
      const randomCity = majorCities[Math.floor(Math.random() * majorCities.length)];
      if (!locations.includes(randomCity)) {
        locations.push(randomCity);
      }
    }

    let allDogs = [];
    
    for (const location of locations) {
      try {
        const dogs = await fetchDogsFromLocation(location, accessToken);
        allDogs = allDogs.concat(dogs);
        console.log(`📍 Found ${dogs.length} dogs in ${location}`);
        
        // Add delay between locations to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.warn(`⚠️ Failed to fetch from ${location}:`, error.message);
      }
    }

    // Remove duplicates (same dog from multiple searches)
    const uniqueDogs = allDogs.filter((dog, index, self) => 
      index === self.findIndex(d => d.id === dog.id)
    );

    console.log(`🎯 Found ${uniqueDogs.length} unique dogs total`);

    if (uniqueDogs.length > 0) {
      await syncDogsToDatabase(uniqueDogs);
      await markRemovedDogs();
    }

    console.log('✅ Dog sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Dog sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
main();
