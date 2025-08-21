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

// RescueGroups API functions - Volume-based approach
async function fetchDogsFromRescueGroups(diversityFilter = 'default', testMode = false, limit = 100, offset = 0) {
  await rateLimitedDelay('rescuegroups');

  console.log(`🦮 Fetching RescueGroups dogs with filter: ${diversityFilter} (limit: ${limit})`);

  const url = new URL('https://api.rescuegroups.org/v5/public/animals/search/available/dogs');
  const params = url.searchParams;

  // Core filters - FIXED: Use correct API v5 schema field names
  params.append('filter[animalSpecies]', 'Dog');
  params.append('filter[animalStatus]', 'Available');

  // Apply diversity filters to get different segments of dogs
  switch (diversityFilter) {
    case 'recent':
      // Recently updated (last month)
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      params.append('filter[animalUpdatedDate]', `>${oneMonthAgo.toISOString().split('T')[0]}`);
      break;

    case 'older':
      // Older listings (2-6 months ago) - these are often "invisible" dogs
      const sixMonthsAgo = new Date();
      const twoMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      params.append('filter[animalUpdatedDate]', `>${sixMonthsAgo.toISOString().split('T')[0]}`);
      params.append('filter[animalUpdatedDate]', `<${twoMonthsAgo.toISOString().split('T')[0]}`);
      break;

    case 'large_dogs':
      // Focus on large dogs (often harder to place)
      params.append('filter[animalSizes]', 'Large');
      break;

    case 'small_dogs':
      // Focus on small dogs
      params.append('filter[animalSizes]', 'Small');
      break;

    case 'seniors':
      // Senior dogs (often overlooked)
      params.append('filter[animalGeneralAge]', 'Senior');
      break;

    case 'special_needs':
      // Special needs dogs (invisible dogs priority)
      params.append('filter[animalSpecialneeds]', 'true');
      break;

    case 'very_old':
      // Very old listings (6+ months) - truly invisible dogs
      const twelveMonthsAgo = new Date();
      const olderSixMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      olderSixMonthsAgo.setMonth(olderSixMonthsAgo.getMonth() - 6);
      params.append('filter[animalUpdatedDate]', `>${twelveMonthsAgo.toISOString().split('T')[0]}`);
      params.append('filter[animalUpdatedDate]', `<${olderSixMonthsAgo.toISOString().split('T')[0]}`);
      break;

    case 'medium_dogs':
      params.append('filter[animalSizes]', 'Medium');
      break;

    case 'extra_large_dogs':
      params.append('filter[animalSizes]', 'Extra Large');
      break;

    case 'adults':
      params.append('filter[animalGeneralAge]', 'Adult');
      break;

    case 'young_adults':
      params.append('filter[animalGeneralAge]', 'Young Adult');
      break;

    case 'puppies':
      params.append('filter[animalGeneralAge]', 'Baby');
      break;

    case 'house_trained':
      params.append('filter[animalAttributes]', 'house_trained');
      break;

    case 'good_with_kids':
      params.append('filter[animalAttributes]', 'good_with_children');
      break;

    case 'good_with_dogs':
      params.append('filter[animalAttributes]', 'good_with_dogs');
      break;

    case 'good_with_cats':
      params.append('filter[animalAttributes]', 'good_with_cats');
      break;

    case 'mixed_breeds':
      params.append('filter[animalMixed]', 'true');
      break;

    case 'purebreds':
      params.append('filter[animalMixed]', 'false');
      break;

    case 'high_energy':
      // Filter for active dogs that may be harder to place
      params.append('filter[animalActivityLevel]', 'High');
      break;

    case 'low_energy':
      // Calmer dogs
      params.append('filter[animalActivityLevel]', 'Low');
      break;

    default:
      // Default: just recently updated in last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      params.append('filter[animalUpdatedDate]', `>${threeMonthsAgo.toISOString().split('T')[0]}`);
      break;
  }

  // Limit results to maximum allowed
  params.append('limit', Math.min(limit, 100).toString());

  // Add offset for pagination
  if (offset > 0) {
    params.append('start', offset.toString());
  }

  // Specify fields to return - FIXED: Use correct API v5 field names
  const fields = [
    'id', 'name', 'animalStatus', 'animalSpecies',
    'animalGeneralAge', 'animalSex', 'animalSizes', 'animalBreedPrimary', 'animalBreedSecondary',
    'animalMixed', 'animalDescription', 'animalSpecialneeds', 'animalAttributes',
    'animalPictures', 'animalThumbnailUrl', 'animalUrl', 'animalDistance', 'animalUpdatedDate', 'animalCreatedDate'
  ];
  params.append('fields[animals]', fields.join(','));

  // Include related data
  params.append('include', 'orgs,locations,breeds,pictures');

  console.log(`🔗 RescueGroups API URL: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': process.env.RESCUEGROUPS_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'BarkBase/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ RescueGroups API error ${response.status} for ${diversityFilter}:`, errorText);
      return { data: [], included: [] };
    }

    const result = await response.json();
    const animals = result.data || [];
    const included = result.included || [];

    console.log(`📋 Found ${animals.length} RescueGroups dogs with ${diversityFilter} filter (${included.length} included items)`);

    // Log first few animals for debugging
    if (animals.length > 0) {
      console.log(`🔍 First dog: ${animals[0].attributes?.name || 'Unknown'} (ID: ${animals[0].id})`);
      console.log(`🔍 Filter type: ${diversityFilter}`);
    }

    return { data: animals, included: included };
  } catch (error) {
    console.warn(`⚠️ RescueGroups error for ${diversityFilter}:`, error.message);
    return { data: [], included: [] };
  }
}

// Transform RescueGroups animal to database format
function transformRescueGroupsAnimal(animal, included = []) {
  const attrs = animal.attributes || {};

  // Parse location from included relationships
  let city = 'Unknown';
  let state = 'Unknown';
  let latitude = null;
  let longitude = null;

  if (animal.relationships?.locations?.data?.[0] && included.length > 0) {
    const locationData = included.find(item => 
      item.type === 'locations' && item.id === animal.relationships.locations.data[0].id
    );
    if (locationData?.attributes) {
      const locAttrs = locationData.attributes;
      city = locAttrs.city || locAttrs.name || locAttrs.citystate?.split(',')[0]?.trim() || 'Unknown';
      state = locAttrs.state || locAttrs.citystate?.split(',')[1]?.trim() || 'Unknown';
      latitude = locAttrs.lat || locAttrs.latitude || null;
      longitude = locAttrs.lon || locAttrs.lng || locAttrs.longitude || null;
    }
  }

  const photos = [];

  const mapBoolean = (value) => {
    if (!value) return null;
    const normalized = value.toString().toLowerCase();
    if (normalized === 'yes' || normalized === '1' || normalized === 'true') return true;
    if (normalized === 'no' || normalized === '0' || normalized === 'false') return false;
    return null;
  };

  // Get organization contact info from included data
  let orgContactInfo = { email: null, phone: null };
  if (animal.relationships?.orgs?.data?.[0] && included.length > 0) {
    const orgData = included.find((item) =>
      item.type === 'orgs' && item.id === animal.relationships.orgs.data[0].id
    );
    if (orgData?.attributes) {
      orgContactInfo = {
        email: orgData.attributes.email || orgData.attributes.publicEmail || orgData.attributes.contactEmail || null,
        phone: orgData.attributes.phone || orgData.attributes.phoneNumber || orgData.attributes.contactPhone || null
      };
    }
  }

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
    spayed_neutered: null,
    house_trained: mapBoolean(attrs.houseTrained),
    special_needs: mapBoolean(attrs.specialNeeds),
    good_with_children: mapBoolean(attrs.goodWithChildren),
    good_with_dogs: mapBoolean(attrs.goodWithDogs),
    good_with_cats: mapBoolean(attrs.goodWithCats),
    description: attrs.descriptionText || null,
    photos: photos,
    tags: [],
    contact_info: orgContactInfo,
    city: city,
    state: state,
    postcode: null,
    latitude: latitude,
    longitude: longitude,
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
}

// Petfinder functions
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
    console.warn(`⚠️ Petfinder API error for ${location}: ${response.status}`);
    return [];
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
    api_source_priority: 2,
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

async function main() {
  console.log('🐕 Starting enhanced dog sync with RescueGroups + Petfinder...');

  const testMode = process.env.TEST_MODE === 'true';

  if (testMode) {
    console.log('🧪 RUNNING IN TEST MODE - Limited API calls');
  }

  try {
    // Generate location lists (only needed for Petfinder now)
    let petfinderLocations = [];

    if (testMode) {
      // Test Mode: Just 1 urban location for Petfinder
      petfinderLocations.push('Austin, TX');

      console.log(`🦮 RescueGroups will use volume-based diversity filters (no location calls)`);
      console.log(`🔍 Petfinder will search: ${petfinderLocations[0]} (urban)`);
    } else {
      // Production mode
      console.log('🏙️ Generating urban locations for Petfinder...');
      petfinderLocations = generateUrbanZipCodes(30);

      // Coverage validation
      console.log(`📍 Geographic Distribution:`);
      console.log(`   RescueGroups: Volume-based approach with diversity filters (no location limits)`);
      console.log(`   Petfinder: ${petfinderLocations.length} metropolitan areas (urban supplement)`);

      const urbanStates = new Set(petfinderLocations.map(loc => loc.slice(0, 2)));
      console.log(`   Petfinder State Coverage: ${urbanStates.size} urban states`);
    }

    // Phase 1: RescueGroups Sync (Volume-Based Approach)
    console.log('🦮 Phase 1: RescueGroups Sync (High-Volume Diverse Dog Rescue)');
    let allRescueGroupsDogs = [];

    // Define diversity filters to maximize different types of dogs
    const diversityFilters = testMode ? 
      ['recent', 'large_dogs'] : // Test with 2 filters
      [
        'default', 'recent', 'older', 'very_old',
        'large_dogs', 'small_dogs', 'medium_dogs', 'extra_large_dogs',
        'seniors', 'adults', 'young_adults', 'puppies',
        'special_needs', 'house_trained', 'good_with_kids', 'good_with_dogs', 'good_with_cats',
        'mixed_breeds', 'purebreds', 'high_energy', 'low_energy'
      ]; // Production with 20+ filters

    const maxPerRequest = 100; // RescueGroups max per request
    const pagesPerFilter = testMode ? 1 : 5; // Multiple pages per filter for volume
    const maxPerFilter = maxPerRequest * pagesPerFilter; // 500 dogs per filter in production

    for (const filter of diversityFilters) {
      try {
        console.log(`🎯 Fetching ${filter} dogs from RescueGroups (${maxPerFilter} target)...`);
        let filterDogs = [];
        let filterIncluded = [];

        // Paginate through multiple requests per filter
        for (let page = 0; page < pagesPerFilter; page++) {
          const offset = page * maxPerRequest;
          const result = await fetchDogsFromRescueGroups(filter, testMode, maxPerRequest, offset);
          const dogs = result.data || [];
          const included = result.included || [];

          if (dogs.length === 0) {
            console.log(`📄 No more ${filter} dogs at page ${page + 1}, stopping pagination`);
            break; // No more results for this filter
          }

          filterDogs = filterDogs.concat(dogs);
          filterIncluded = filterIncluded.concat(included);

          console.log(`📄 Page ${page + 1}: Got ${dogs.length} ${filter} dogs (total: ${filterDogs.length})`);

          // Respect rate limit (10 req/sec = 100ms between requests)
          await new Promise(resolve => setTimeout(resolve, 120));
        }

        const transformedDogs = filterDogs.map(dog => transformRescueGroupsAnimal(dog, filterIncluded));
        allRescueGroupsDogs = allRescueGroupsDogs.concat(transformedDogs);

        console.log(`✅ Total ${filter} dogs: ${filterDogs.length}`);
      } catch (error) {
        console.warn(`⚠️ RescueGroups failed for ${filter} filter:`, error.message);
      }
    }

    // Remove duplicates from RescueGroups
    const uniqueRescueGroupsDogs = allRescueGroupsDogs.filter((dog, index, self) => 
      index === self.findIndex(d => d.rescuegroups_id === dog.rescuegroups_id)
    );

    console.log(`📊 RescueGroups Volume Results:`);
    console.log(`   Raw dogs fetched: ${allRescueGroupsDogs.length}`);
    console.log(`   Filters used: ${diversityFilters.length}`);
    console.log(`   Avg dogs per filter: ${Math.round(allRescueGroupsDogs.length / diversityFilters.length)}`);
    console.log(`🔍 Duplication analysis: ${allRescueGroupsDogs.length - uniqueRescueGroupsDogs.length} dogs appeared multiple times`);
    console.log(`🎯 Final unique RescueGroups dogs: ${uniqueRescueGroupsDogs.length}`);

    if (uniqueRescueGroupsDogs.length > 0) {
      await syncDogsToDatabase(uniqueRescueGroupsDogs, 'rescuegroups');
    }

    // Phase 2: Petfinder Sync
    console.log('🔍 Phase 2: Petfinder Sync (Metropolitan Urban Rescue)');
    const accessToken = await getAccessToken();
    let allPetfinderDogs = [];

    for (const location of petfinderLocations) {
      try {
        const dogs = await fetchDogsFromPetfinder(location, accessToken, testMode);
        const transformedDogs = dogs.map(transformPetfinderAnimal);
        allPetfinderDogs = allPetfinderDogs.concat(transformedDogs);

        // Longer delay for Petfinder
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`⚠️ Petfinder failed for ${location}:`, error.message);
      }
    }

    // Remove duplicates from Petfinder
    const uniquePetfinderDogs = allPetfinderDogs.filter((dog, index, self) => 
      index === self.findIndex(d => d.petfinder_id === dog.petfinder_id)
    );

    // Cross-API deduplication
    const deduplicatedPetfinderDogs = [];

    for (const pfDog of uniquePetfinderDogs) {
      const isDuplicate = uniqueRescueGroupsDogs.some(rgDog => {
        const nameMatch = rgDog.name.toLowerCase().trim() === pfDog.name.toLowerCase().trim();
        const stateMatch = rgDog.state === pfDog.state;
        const breedMatch = rgDog.primary_breed === pfDog.primary_breed;
        const ageMatch = rgDog.age === pfDog.age;
        const genderMatch = rgDog.gender === pfDog.gender;

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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: removedResult } = await supabase
      .from('dogs')
      .update({ status: 'removed' })
      .lt('last_updated_at', thirtyDaysAgo.toISOString())
      .eq('status', 'adoptable')
      .select();

    console.log(`🧹 Marked ${removedResult?.length || 0} old dogs as removed`);
    console.log('✅ Enhanced dog sync completed successfully!');

  } catch (error) {
    console.error('❌ Enhanced dog sync failed:', error);
    process.exit(1);
  }
}

main();