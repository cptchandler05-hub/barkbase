
const { createClient } = require('@supabase/supabase-js');
const { getRandomRuralZip } = require('../lib/utils.js');
const { calculateVisibilityScore } = require('../lib/scoreVisibility.js');
const { RescueGroupsAPI } = require('../lib/rescuegroups.ts');

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
async function fetchDogsFromRescueGroups(location) {
  await rateLimitedDelay('rescuegroups');

  console.log(`🦮 Fetching RescueGroups dogs from: ${location}`);

  const searchData = {
    apikey: process.env.RESCUEGROUPS_API_KEY,
    objectType: 'animals',
    objectAction: 'publicSearch',
    search: {
      resultStart: 0,
      resultLimit: 100,
      resultSort: 'animalID',
      resultOrder: 'asc',
      filters: [
        {
          fieldName: 'animalSpecies',
          operation: 'equals',
          criteria: 'Dog'
        },
        {
          fieldName: 'animalStatus',
          operation: 'equals',
          criteria: 'Available'
        },
        {
          fieldName: 'animalLocationZipcode',
          operation: 'radius',
          criteria: location,
          radius: 100
        }
      ],
      fields: [
        'animalID', 'animalOrgID', 'animalName', 'animalGeneralAge',
        'animalSex', 'animalGeneralSizePotential', 'animalBreed',
        'animalSecondaryBreed', 'animalMixedBreed', 'animalDescription',
        'animalStatus', 'animalSpecialneeds', 'animalHousetrained',
        'animalGoodWithKids', 'animalGoodWithCats', 'animalGoodWithDogs',
        'animalSpayedNeutered', 'animalPictures', 'animalLocation',
        'animalLocationCitystate', 'animalLocationZipcode', 'animalUrl'
      ]
    }
  };

  try {
    const rescueGroupsAPI = new RescueGroupsAPI();
    const animals = await rescueGroupsAPI.searchAnimals({
      location: location,
      limit: 100,
      radius: 100
    });
    
    console.log(`📋 Found ${animals.length} RescueGroups dogs from ${location}`);
    return animals;
  } catch (error) {
    console.warn(`⚠️ RescueGroups error for ${location}:`, error.message);
    return [];
  }
}

// Transform RescueGroups animal to database format
function transformRescueGroupsAnimal(animal) {
  const locationParts = animal.animalLocationCitystate?.split(',') || [];
  const city = locationParts[0]?.trim() || 'Unknown';
  const state = locationParts[1]?.trim() || 'Unknown';

  const photos = Array.isArray(animal.animalPictures) 
    ? animal.animalPictures.map(pic => pic.large || pic.original || pic.small).filter(Boolean)
    : [];

  const mapBoolean = (value) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized === 'yes' || normalized === '1' || normalized === 'true') return true;
    if (normalized === 'no' || normalized === '0' || normalized === 'false') return false;
    return null;
  };

  return {
    rescuegroups_id: animal.animalID,
    api_source: 'rescuegroups',
    api_source_priority: 1, // Higher priority
    organization_id: animal.animalOrgID || '',
    url: animal.animalUrl || '',
    name: animal.animalName || 'Unknown',
    type: 'Dog',
    species: 'Dog',
    primary_breed: animal.animalBreed || 'Mixed Breed',
    secondary_breed: animal.animalSecondaryBreed || null,
    is_mixed: mapBoolean(animal.animalMixedBreed) || false,
    is_unknown_breed: false,
    age: animal.animalGeneralAge || 'Unknown',
    gender: animal.animalSex || 'Unknown',
    size: animal.animalGeneralSizePotential || 'Unknown',
    status: 'adoptable',
    spayed_neutered: mapBoolean(animal.animalSpayedNeutered),
    house_trained: mapBoolean(animal.animalHousetrained),
    special_needs: mapBoolean(animal.animalSpecialneeds),
    good_with_children: mapBoolean(animal.animalGoodWithKids),
    good_with_dogs: mapBoolean(animal.animalGoodWithDogs),
    good_with_cats: mapBoolean(animal.animalGoodWithCats),
    description: animal.animalDescription || null,
    photos: photos,
    tags: [],
    contact_info: {},
    city: city,
    state: state,
    postcode: animal.animalLocationZipcode || null,
    latitude: null,
    longitude: null,
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
}

// Existing Petfinder functions (keep as fallback)
async function fetchDogsFromPetfinder(location, accessToken) {
  await rateLimitedDelay('petfinder');

  console.log(`🔍 Fetching Petfinder dogs from: ${location}`);

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
      console.log('🏞️ Generating rural locations for RescueGroups (invisible dog rescue priority)...');
      for (let i = 0; i < 120; i++) {
        rescueGroupsLocations.push(getRandomRuralZip());
      }
      
      // 🏙️ Petfinder: Major metropolitan areas (24 cities)
      console.log('🏙️ Generating urban locations for Petfinder...');
      const majorMetros = [
        // Tier 1 Cities (Population 1M+)
        'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
        'Philadelphia, PA', 'Phoenix, AZ', 'San Antonio, TX', 'San Diego, CA',
        'Dallas, TX', 'San Jose, CA', 'Austin, TX', 'Jacksonville, FL',
        
        // Tier 2 Cities (Population 500K+)
        'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC', 'San Francisco, CA',
        'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
        'Boston, MA', 'Nashville, TN', 'Baltimore, MD', 'Louisville, KY'
      ];
      
      // Shuffle and take all 24 to maximize urban coverage
      const shuffledMetros = majorMetros.sort(() => Math.random() - 0.5);
      petfinderLocations = shuffledMetros.slice(0, 24);
      
      console.log(`🎯 RescueGroups targeting ${rescueGroupsLocations.length} rural areas`);
      console.log(`🎯 Petfinder targeting ${petfinderLocations.length} metropolitan areas`);
      console.log(`✅ Zero location overlap - maximized coverage strategy`);
    }

    // Phase 1: RescueGroups Sync (Rural Focus - Invisible Dogs Priority)
    console.log('🦮 Phase 1: RescueGroups Sync (Rural Invisible Dog Rescue)');
    let allRescueGroupsDogs = [];
    
    for (const location of rescueGroupsLocations) {
      try {
        const dogs = await fetchDogsFromRescueGroups(location);
        const transformedDogs = dogs.map(transformRescueGroupsAnimal);
        allRescueGroupsDogs = allRescueGroupsDogs.concat(transformedDogs);
        
        // Minimal delay for RescueGroups (they can handle 10 req/sec)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`⚠️ RescueGroups failed for ${location}:`, error.message);
      }
    }

    // Remove duplicates from RescueGroups
    const uniqueRescueGroupsDogs = allRescueGroupsDogs.filter((dog, index, self) => 
      index === self.findIndex(d => d.rescuegroups_id === dog.rescuegroups_id)
    );

    console.log(`🎯 Found ${uniqueRescueGroupsDogs.length} unique RescueGroups dogs`);

    if (uniqueRescueGroupsDogs.length > 0) {
      await syncDogsToDatabase(uniqueRescueGroupsDogs, 'rescuegroups');
    }

    // Phase 2: Petfinder Sync (Metropolitan Focus - Urban Coverage) 
    console.log('🔍 Phase 2: Petfinder Sync (Metropolitan Urban Rescue)');
    const accessToken = await getAccessToken();
    let allPetfinderDogs = [];

    for (const location of petfinderLocations) {
      try {
        const dogs = await fetchDogsFromPetfinder(location, accessToken);
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

    console.log(`🎯 Found ${uniquePetfinderDogs.length} unique Petfinder dogs`);

    if (uniquePetfinderDogs.length > 0) {
      await syncDogsToDatabase(uniquePetfinderDogs, 'petfinder');
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
