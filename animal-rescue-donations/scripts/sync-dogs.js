const { createClient } = require('@supabase/supabase-js');
const { getRandomRuralZip } = require('../lib/utils.js');

// Initialize Supabase client with service key for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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

  // Test connection first
  console.log('🔗 Testing Supabase connection...');
  const { data: connectionData, error: connectionError } = await supabase
    .from('dogs')
    .select('count', { count: 'exact', head: true });

  if (connectionError) {
    console.error('❌ Supabase connection failed:', connectionError);
    return;
  }

  console.log(`✅ Connected to Supabase! Current dogs in DB: ${connectionData || 0}`);

  const syncRecord = {
    sync_date: new Date().toISOString(),
    dogs_added: 0,
    dogs_updated: 0,
    dogs_removed: 0,
    source: source,
    status: 'in_progress'
  };

  // Skip sync record for now - focus on dog insertion
  console.log('⚠️ Skipping sync record creation - testing direct dog insertion');
  const syncData = { id: 'test-sync' };

  let addedCount = 0;
  let updatedCount = 0;

  // Test with first dog only to verify database structure
  console.log('🧪 Testing database insertion with first dog...');
  
  if (dogs.length === 0) {
    console.log('⚠️ No dogs to sync');
    return;
  }
  
  const testDog = dogs[0];

  const testRecord = {
    api_source: 'petfinder',
    organization_id: testDog.organization_id || '',
    url: testDog.url || '',
    name: testDog.name || 'Test Dog',
    type: testDog.type || 'Dog',
    species: testDog.species || 'Dog',
    primary_breed: testDog.breeds?.primary || 'Mixed Breed',
    secondary_breed: testDog.breeds?.secondary || null,
    is_mixed: testDog.breeds?.mixed || false,
    is_unknown_breed: testDog.breeds?.unknown || false,
    age: testDog.age || 'Unknown',
    gender: testDog.gender || 'Unknown',
    size: testDog.size || 'Unknown',
    coat: testDog.coat || null,
    primary_color: testDog.colors?.primary || null,
    secondary_color: testDog.colors?.secondary || null,
    tertiary_color: testDog.colors?.tertiary || null,
    status: 'adoptable',
    spayed_neutered: testDog.attributes?.spayed_neutered || null,
    house_trained: testDog.attributes?.house_trained || null,
    special_needs: testDog.attributes?.special_needs || null,
    shots_current: testDog.attributes?.shots_current || null,
    good_with_children: testDog.environment?.children || null,
    good_with_dogs: testDog.environment?.dogs || null,
    good_with_cats: testDog.environment?.cats || null,
    description: testDog.description || null,
    photos: testDog.photos || [],
    tags: testDog.tags || [],
    contact_info: testDog.contact || {},
    city: testDog.contact?.address?.city || 'Unknown',
    state: testDog.contact?.address?.state || 'Unknown',
    postcode: testDog.contact?.address?.postcode || null,
    latitude: testDog.contact?.address?.latitude || null,
    longitude: testDog.contact?.address?.longitude || null,
    visibility_score: calculateVisibilityScore(testDog),
    organization_animal_id: testDog.organization_animal_id || null,
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  console.log('🧪 Test record structure:', JSON.stringify(testRecord, null, 2));

  const { data: testData, error: testError } = await supabase
    .from('dogs')
    .insert([testRecord])
    .select();

  if (testError) {
    console.error('❌ DATABASE TEST FAILED:', testError);
    console.error('❌ Error details:', JSON.stringify(testError, null, 2));
    console.error('❌ Cannot proceed with sync - database structure issue');
    console.error('❌ STOPPING IMMEDIATELY TO PRESERVE API QUOTA');
    throw new Error('Database test failed: ' + testError.message);
  } else {
    console.log('✅ Database test successful! Proceeding with full sync...');
    addedCount = 1; // Count the test dog
  }

  for (const dog of dogs.slice(1)) { // Skip first dog since we already tested it
    try {
      const dogRecord = {
        api_source: 'petfinder',
        organization_id: dog.organization_id || '',
        url: dog.url || '',
        name: dog.name || 'Unknown',
        type: dog.type || 'Dog',
        species: dog.species || 'Dog',
        primary_breed: dog.breeds?.primary || 'Mixed Breed',
        secondary_breed: dog.breeds?.secondary || null,
        is_mixed: dog.breeds?.mixed || false,
        is_unknown_breed: dog.breeds?.unknown || false,
        age: dog.age || 'Unknown',
        gender: dog.gender || 'Unknown',
        size: dog.size || 'Unknown',
        coat: dog.coat || null,
        primary_color: dog.colors?.primary || null,
        secondary_color: dog.colors?.secondary || null,
        tertiary_color: dog.colors?.tertiary || null,
        status: 'adoptable',
        spayed_neutered: dog.attributes?.spayed_neutered || null,
        house_trained: dog.attributes?.house_trained || null,
        special_needs: dog.attributes?.special_needs || null,
        shots_current: dog.attributes?.shots_current || null,
        good_with_children: dog.environment?.children || null,
        good_with_dogs: dog.environment?.dogs || null,
        good_with_cats: dog.environment?.cats || null,
        description: dog.description || null,
        photos: dog.photos || [],
        tags: dog.tags || [],
        contact_info: dog.contact || {},
        city: dog.contact?.address?.city || 'Unknown',
        state: dog.contact?.address?.state || 'Unknown',
        postcode: dog.contact?.address?.postcode || null,
        latitude: dog.contact?.address?.latitude || null,
        longitude: dog.contact?.address?.longitude || null,
        visibility_score: calculateVisibilityScore(dog),
        organization_animal_id: dog.organization_animal_id || null,
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      // Check if dog already exists - need to match on organization_id + organization_animal_id or other unique field
      const { data: existingDog, error: checkError } = await supabase
        .from('dogs')
        .select('id, last_updated_at')
        .eq('organization_id', dogRecord.organization_id)
        .eq('organization_animal_id', dogRecord.organization_animal_id || dog.id.toString())
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
          if (updatedCount === 0) console.error('❌ First update error details:', updateError);
        } else {
          updatedCount++;
          if (updatedCount === 1) console.log('✅ First dog updated successfully');
        }
      } else {
        // Insert new dog
        const { error: insertError } = await supabase
          .from('dogs')
          .insert([dogRecord]);

        if (insertError) {
          console.warn(`⚠️ Failed to insert dog ${dogRecord.name}:`, insertError);
          if (addedCount === 0) {
            console.error('❌ CRITICAL: First insert failed!');
            console.error('❌ Error code:', insertError.code);
            console.error('❌ Error message:', insertError.message);
            console.error('❌ Error details:', insertError.details);
            console.error('❌ Sample dog record:', JSON.stringify({
              petfinder_id: dogRecord.petfinder_id,
              name: dogRecord.name,
              primary_breed: dogRecord.primary_breed,
              age: dogRecord.age,
              gender: dogRecord.gender,
              size: dogRecord.size,
              city: dogRecord.city,
              state: dogRecord.state,
              photos_length: dogRecord.photos.length,
              description_length: dogRecord.description?.length || 0
            }, null, 2));

            // Stop processing on first error to avoid wasting API quota
            console.error('❌ Stopping sync due to database error');
            return;
          }
        } else {
          addedCount++;
          if (addedCount === 1) console.log('✅ First dog inserted successfully');
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

async function validateEnvironment() {
  console.log('🔍 Validating environment variables...');
  
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'PETFINDER_CLIENT_ID',
    'PETFINDER_CLIENT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ All environment variables present');
}

async function testDatabaseConnection() {
  console.log('🔗 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase
      .from('dogs')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Supabase connection failed:', error);
      throw new Error('Database connection failed: ' + error.message);
    }

    console.log(`✅ Database connected! Current dogs: ${data || 0}`);
    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🐕 Starting dog data sync...');
  
  // Check for test mode environment variable
  const testMode = process.env.TEST_MODE === 'true';
  
  if (testMode) {
    console.log('🧪 RUNNING IN TEST MODE - Limited API calls');
  }

  try {
    // Validate environment before making any API calls
    await validateEnvironment();
    
    // Test database connection before fetching from Petfinder
    await testDatabaseConnection();
    
    const accessToken = await getAccessToken();

    // Use expanded rural ZIP coverage for comprehensive invisible dog discovery
    const locations = [];

    if (testMode) {
      // Test mode: only use 2 locations to minimize API usage
      locations.push(getRandomRuralZip());
      locations.push('Austin, TX'); // One rural, one city
      console.log('🧪 Test mode: Using only 2 locations to preserve API quota');
    } else {
      // Full mode: 75 random rural ZIPs + major cities
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