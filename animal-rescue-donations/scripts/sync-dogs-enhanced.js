const { createClient } = require('@supabase/supabase-js');
const { getRandomRuralZip } = require('../lib/utils.js');
const { calculateVisibilityScore } = require('../lib/scoreVisibility.js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting for both APIs
let lastRescueGroupsRequest = 0;
let lastPetfinderRequest = 0;
const RESCUEGROUPS_MIN_INTERVAL = 100; // 10 requests per second max
const PETFINDER_MIN_INTERVAL = 1000; // 1 second between requests

// Petfinder token management
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  const buffer = 5 * 60 * 1000;

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

async function rateLimitedDelay(apiType = 'petfinder') {
  const now = Date.now();

  if (apiType === 'rescuegroups') {
    const timeSinceLastRequest = now - lastRescueGroupsRequest;
    if (timeSinceLastRequest < RESCUEGROUPS_MIN_INTERVAL) {
      const waitTime = RESCUEGROUPS_MIN_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRescueGroupsRequest = Date.now();
  } else {
    const timeSinceLastRequest = now - lastPetfinderRequest;
    if (timeSinceLastRequest < PETFINDER_MIN_INTERVAL) {
      const waitTime = PETFINDER_MIN_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastPetfinderRequest = Date.now();
  }
}

// RescueGroups API functions
async function fetchDogsFromRescueGroups(location, isTestMode = false) {
  await rateLimitedDelay('rescuegroups');

  const limit = isTestMode ? 5 : 100;
  console.log(`🦮 Fetching RescueGroups dogs from: ${location} (limit: ${limit})`);

  // Use GET request with query parameters (RescueGroups v5 API)
  const url = new URL('https://api.rescuegroups.org/v5/public/animals/search/available/dogs');
  const params = url.searchParams;

  // Location filter - try multiple parameter formats since RescueGroups API docs may be inconsistent
  params.append('filter[locationAddress]', location);
  params.append('filter[locationDistance]', '100'); // 100 mile radius
  
  // Also try alternative location parameter names
  params.append('filter[location]', location);
  params.append('filter[distance]', '100');

  // Limit results
  params.append('limit', limit.toString());

  // Note: RescueGroups v5 API has limited sort options, so we'll use default sorting

  // Specify fields to return
  const fields = [
    'id', 'name', 'status', 'species', 'organizations',
    'ageGroup', 'sex', 'sizeGroup', 'breedPrimary', 'breedSecondary',
    'breedMixed', 'descriptionText', 'specialNeeds', 'houseTrained',
    'goodWithChildren', 'goodWithCats', 'goodWithDogs',
    'pictures', 'url', 'distance', 'location'
  ];
  params.append('fields[animals]', fields.join(','));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': process.env.RESCUEGROUPS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ RescueGroups API error ${response.status} for ${location}:`, errorText);
      return [];
    }

    const result = await response.json();
    const animals = result.data || [];

    console.log(`📋 Found ${animals.length} RescueGroups dogs from ${location} (API limit may be 25)`);

    // Log first few animals for debugging
    if (animals.length > 0) {
      console.log(`🔍 First dog: ${animals[0].attributes?.name || 'Unknown'} (ID: ${animals[0].id})`);
      console.log(`🔍 First dog details:`, JSON.stringify(animals[0], null, 2));
      
      if (animals.length > 1) {
        console.log(`🔍 Second dog: ${animals[1].attributes?.name || 'Unknown'} (ID: ${animals[1].id})`);
      }
    }

    return animals;
  } catch (error) {
    console.warn(`⚠️ RescueGroups error for ${location}:`, error.message);
    return [];
  }
}

// Transform RescueGroups animal to database format
function transformRescueGroupsAnimal(animal) {
  // RescueGroups v5 API uses attributes object
  const attrs = animal.attributes || {};

  // Parse location from included relationships if available
  let city = 'Unknown';
  let state = 'Unknown';
  
  // Try to get location from relationships if included data is available
  // For now use defaults - location can be enhanced later with included data parsing
  city = 'Unknown';
  state = 'Unknown';

  // Parse photos from relationships - this needs to be handled differently in v5
  const photos = [];
  // Photos are in relationships, not directly in attributes
  // For now, we'll handle this in the main sync function with included data
  
  const mapBoolean = (value) => {
    if (!value) return null;
    const normalized = value.toString().toLowerCase();
    if (normalized === 'yes' || normalized === '1' || normalized === 'true') return true;
    if (normalized === 'no' || normalized === '0' || normalized === 'false') return false;
    return null;
  };

  return {
    rescuegroups_id: animal.id,
    api_source: 'rescuegroups',
    api_source_priority: 1, // Higher priority than Petfinder
    organization_id: animal.relationships?.orgs?.data?.[0]?.id || '',
    url: attrs.url || '',
    name: attrs.name || 'Unknown',
    type: 'Dog',
    species: 'Dog',
    primary_breed: attrs.breedPrimary || 'Mixed Breed',
    secondary_breed: attrs.breedSecondary || null,
    is_mixed: !!attrs.breedSecondary,
    is_unknown_breed: false,
    age: attrs.ageGroup || 'Unknown',
    gender: attrs.sex || 'Unknown',
    size: attrs.sizeGroup || 'Unknown',
    status: 'adoptable',
    spayed_neutered: null, // Not available in v5 API
    house_trained: mapBoolean(attrs.houseTrained),
    special_needs: mapBoolean(attrs.specialNeeds),
    good_with_children: mapBoolean(attrs.goodWithChildren),
    good_with_dogs: mapBoolean(attrs.goodWithDogs),
    good_with_cats: mapBoolean(attrs.goodWithCats),
    description: attrs.descriptionText || null,
    photos: photos, // Will be populated with included data
    tags: [],
    contact_info: {},
    city: city,
    state: state,
    postcode: null,
    latitude: null,
    longitude: null,
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
}

// Existing Petfinder functions (keep as fallback)
async function fetchDogsFromPetfinder(location, accessToken, isTestMode = false) {
  await rateLimitedDelay('petfinder');

  const limit = isTestMode ? 5 : 100;
  console.log(`🔍 Fetching Petfinder dogs from: ${location} (limit: ${limit})`);

  const params = new URLSearchParams({
    type: 'dog',
    status: 'adoptable',
    limit: limit.toString(),
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
      console.warn(`⚠️ Petfinder rate limited for location: ${location}`);
      return [];
    }
    throw new Error(`Petfinder API error for ${location}: ${response.status}`);
  }

  const data = await response.json();
  const dogs = data.animals || [];
  console.log(`📋 Found ${dogs.length} Petfinder dogs from ${location}`);
  return dogs;
}

function transformPetfinderAnimal(dog) {
  return {
    petfinder_id: dog.id.toString(),
    api_source: 'petfinder',
    api_source_priority: 2, // Lower priority
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
    organization_animal_id: dog.organization_animal_id || null,
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
}

async function syncDogsToDatabase(dogs, source) {
  console.log(`📝 Syncing ${dogs.length} ${source} dogs to database...`);

  let addedCount = 0;
  let updatedCount = 0;

  for (const dogRecord of dogs) {
    try {
      // Calculate visibility score
      dogRecord.visibility_score = await calculateVisibilityScore(dogRecord);

      // Check if dog already exists by source-specific ID
      let existingDog = null;

      if (source === 'rescuegroups') {
        const { data } = await supabase
          .from('dogs')
          .select('id')
          .eq('rescuegroups_id', dogRecord.rescuegroups_id)
          .single();
        existingDog = data;
      } else {
        const { data } = await supabase
          .from('dogs')
          .select('id')
          .eq('petfinder_id', dogRecord.petfinder_id)
          .single();
        existingDog = data;
      }

      if (existingDog) {
        // Update existing dog
        const { error } = await supabase
          .from('dogs')
          .update(dogRecord)
          .eq('id', existingDog.id);

        if (error) {
          console.warn(`⚠️ Failed to update ${dogRecord.name}:`, error);
        } else {
          updatedCount++;
        }
      } else {
        // Insert new dog
        const { error } = await supabase
          .from('dogs')
          .insert([dogRecord]);

        if (error) {
          console.warn(`⚠️ Failed to insert ${dogRecord.name}:`, error);
        } else {
          addedCount++;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error processing ${dogRecord.name}:`, error);
    }
  }

  console.log(`✅ ${source} sync completed: ${addedCount} added, ${updatedCount} updated`);
  return { addedCount, updatedCount };
}

async function main() {
  console.log('🐕 Starting enhanced dog sync with RescueGroups + Petfinder...');

  const testMode = process.env.TEST_MODE === 'true';

  if (testMode) {
    console.log('🧪 RUNNING IN TEST MODE - Limited API calls');
  }

  try {
    // 🎯 SEPARATE LOCATION STRATEGIES - No Overlap!
    let rescueGroupsLocations = [];
    let petfinderLocations = [];

    if (testMode) {
      // Test Mode: 1 rural + 1 urban (no overlap)
      rescueGroupsLocations.push(getRandomRuralZip());
      petfinderLocations.push('Austin, TX');

      console.log(`🦮 RescueGroups will search: ${rescueGroupsLocations[0]} (rural)`);
      console.log(`🔍 Petfinder will search: ${petfinderLocations[0]} (urban)`);
    } else {
      // 🏞️ RescueGroups: AGGRESSIVE rural coverage (120 rural ZIPs)
      // Generate location lists with enhanced geographic strategy
      console.log('🏞️ Generating rural locations for RescueGroups (invisible dog rescue priority)...');
      const rescueGroupsLocations = generateRuralZipCodes(testMode ? 3 : 150); // Increased coverage

      console.log('🏙️ Generating urban locations for Petfinder...');
      const petfinderLocations = generateUrbanZipCodes(testMode ? 2 : 30); // Better urban coverage

      // Enhanced coverage validation
      console.log(`📍 Geographic Distribution:`);
      console.log(`   RescueGroups: ${rescueGroupsLocations.length} rural areas (prioritizing invisible dogs)`);
      console.log(`   Petfinder: ${petfinderLocations.length} metropolitan areas (urban supplement)`);

      // Check for regional balance
      const ruralStates = new Set(rescueGroupsLocations.map(loc => loc.slice(0, 2)));
      const urbanStates = new Set(petfinderLocations.map(loc => loc.slice(0, 2)));
      console.log(`   State Coverage: ${ruralStates.size} rural states, ${urbanStates.size} urban states`);
    }

    // Phase 1: RescueGroups Sync (Rural Focus - Invisible Dogs Priority)
    console.log('🦮 Phase 1: RescueGroups Sync (Rural Invisible Dog Rescue)');
    let allRescueGroupsDogs = [];

    for (const location of rescueGroupsLocations) {
      try {
        const dogs = await fetchDogsFromRescueGroups(location, testMode);
        const transformedDogs = dogs.map(transformRescueGroupsAnimal);
        allRescueGroupsDogs = allRescueGroupsDogs.concat(transformedDogs);

        // Minimal delay for RescueGroups (they can handle 10 req/sec)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`⚠️ RescueGroups failed for ${location}:`, error.message);
      }
    }

    // Remove duplicates from RescueGroups and track duplication patterns
    console.log(`📊 RescueGroups raw results: ${allRescueGroupsDogs.length} total dogs fetched`);

    // Track duplication patterns
    const duplicateCount = {};
    allRescueGroupsDogs.forEach(dog => {
      const id = dog.rescuegroups_id;
      duplicateCount[id] = (duplicateCount[id] || 0) + 1;
    });

    const duplicatedIds = Object.entries(duplicateCount).filter(([id, count]) => count > 1);
    console.log(`📋 Duplication analysis: ${duplicatedIds.length} dogs appeared multiple times`);

    if (duplicatedIds.length > 0) {
      console.log(`🔍 Most duplicated dogs:`);
      duplicatedIds.slice(0, 5).forEach(([id, count]) => {
        const dog = allRescueGroupsDogs.find(d => d.rescuegroups_id === id);
        console.log(`   - ${dog?.name || 'Unknown'} (ID: ${id}): appeared ${count} times`);
      });
    }

    const uniqueRescueGroupsDogs = allRescueGroupsDogs.filter((dog, index, self) => 
      index === self.findIndex(d => d.rescuegroups_id === dog.rescuegroups_id)
    );

    console.log(`🎯 Found ${uniqueRescueGroupsDogs.length} unique RescueGroups dogs (${allRescueGroupsDogs.length - uniqueRescueGroupsDogs.length} duplicates removed)`);

    if (uniqueRescueGroupsDogs.length > 0) {
      await syncDogsToDatabase(uniqueRescueGroupsDogs, 'rescuegroups');
    }

    // Phase 2: Petfinder Sync (Metropolitan Focus - Urban Coverage) 
    console.log('🔍 Phase 2: Petfinder Sync (Metropolitan Urban Rescue)');
    const accessToken = await getAccessToken();
    let allPetfinderDogs = [];

    for (const location of petfinderLocations) {
      try {
        const dogs = await fetchDogsFromPetfinder(location, accessToken, testMode);
        const transformedDogs = dogs.map(transformPetfinderAnimal);
        allPetfinderDogs = allPetfinderDogs.concat(transformedDogs);

        // Longer delay for Petfinder (stricter rate limits)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`⚠️ Petfinder failed for ${location}:`, error.message);
      }
    }

    // Remove duplicates from Petfinder
    const uniquePetfinderDogs = allPetfinderDogs.filter((dog, index, self) => 
      index === self.findIndex(d => d.petfinder_id === dog.petfinder_id)
    );

    // 🎯 CROSS-API DEDUPLICATION: Remove Petfinder dogs that might be duplicates of RescueGroups dogs
    // Check for potential duplicates by name + approximate location
    const deduplicatedPetfinderDogs = [];

    for (const pfDog of uniquePetfinderDogs) {
      const isDuplicate = uniqueRescueGroupsDogs.some(rgDog => {
        // Match by exact name (case insensitive)
        const nameMatch = rgDog.name.toLowerCase().trim() === pfDog.name.toLowerCase().trim();

        // Match by location (same state)
        const stateMatch = rgDog.state === pfDog.state;

        // Match by basic characteristics
        const breedMatch = rgDog.primary_breed === pfDog.primary_breed;
        const ageMatch = rgDog.age === pfDog.age;
        const genderMatch = rgDog.gender === pfDog.gender;

        // Consider it a duplicate if name + state match, OR if name + 2 other characteristics match
        return (nameMatch && stateMatch) || (nameMatch && breedMatch && (ageMatch || genderMatch));
      });

      if (!isDuplicate) {
        deduplicatedPetfinderDogs.push(pfDog);
      } else {
        console.log(`🔄 Skipping Petfinder duplicate: ${pfDog.name} (RescueGroups has priority)`);
      }
    }

    console.log(`🎯 Found ${uniquePetfinderDogs.length} unique Petfinder dogs`);
    console.log(`✅ After cross-API deduplication: ${deduplicatedPetfinderDogs.length} Petfinder dogs (${uniquePetfinderDogs.length - deduplicatedPetfinderDogs.length} duplicates removed)`);

    if (deduplicatedPetfinderDogs.length > 0) {
      await syncDogsToDatabase(deduplicatedPetfinderDogs, 'petfinder');
    }

    // Mark old dogs as removed
    console.log('🧹 Marking old dogs as removed...');
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await supabase
      .from('dogs')
      .update({ status: 'removed' })
      .lt('last_updated_at', threeDaysAgo.toISOString())
      .eq('status', 'adoptable');

    console.log('✅ Enhanced dog sync completed successfully!');

  } catch (error) {
    console.error('❌ Enhanced dog sync failed:', error);
    process.exit(1);
  }
}

main();

function generateRuralZipCodes(count) {
  const zipCodes = [];
  for (let i = 0; i < count; i++) {
    zipCodes.push(getRandomRuralZip());
  }
  return zipCodes;
}

function generateUrbanZipCodes(count) {
  const majorMetros = [
    'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
    'Philadelphia, PA', 'Phoenix, AZ', 'San Antonio, TX', 'San Diego, CA',
    'Dallas, TX', 'San Jose, CA', 'Austin, TX', 'Jacksonville, FL',
    'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC', 'San Francisco, CA',
    'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
    'Boston, MA', 'Nashville, TN', 'Baltimore, MD', 'Louisville, KY'
  ];

  const shuffledMetros = majorMetros.sort(() => Math.random() - 0.5);
  return shuffledMetros.slice(0, count);
}