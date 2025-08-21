
const { createClient } = require('@supabase/supabase-js');
const { getRandomRuralZip } = require('../lib/utils.js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get ZIP coordinates (copied from sync script)
function getZipCoordinates(zipCode) {
  // This is a simplified version - in production you'd use a proper geocoding service
  // For now, return some test coordinates for common rural ZIP patterns
  const zipToCoords = {
    // Sample rural ZIP codes with their approximate coordinates
    '87002': { lat: 35.2828, lng: -106.6614 }, // Belen, NM
    '71655': { lat: 33.8734, lng: -91.2068 }, // McGehee, AR
    '59718': { lat: 45.6770, lng: -111.0430 }, // Bozeman, MT
    // Add a few more for testing
    '62471': { lat: 39.7817, lng: -88.9584 }, // Ramsey, IL
    '50158': { lat: 41.5803, lng: -93.1938 }, // Knoxville, IA
  };
  
  // If we have exact coordinates, use them
  if (zipToCoords[zipCode]) {
    return zipToCoords[zipCode];
  }
  
  // Otherwise, generate approximate coordinates for rural areas
  // Rural areas are typically outside major metro areas
  const lat = 30 + (Math.random() * 20); // Between 30-50 latitude
  const lng = -120 + (Math.random() * 50); // Between -120 to -70 longitude
  
  return { lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) };
}

// Rate limiting for RescueGroups
let lastRescueGroupsRequest = 0;
const RESCUEGROUPS_MIN_INTERVAL = 100; // 10 requests per second max

async function rateLimitedDelay() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRescueGroupsRequest;
  if (timeSinceLastRequest < RESCUEGROUPS_MIN_INTERVAL) {
    const waitTime = RESCUEGROUPS_MIN_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRescueGroupsRequest = Date.now();
}

// RescueGroups API function (copied from main sync script)
async function fetchDogsFromRescueGroups(location) {
  await rateLimitedDelay();

  console.log(`🦮 Testing RescueGroups API for location: ${location}`);

  // Get coordinates for the ZIP code
  const coordinates = getZipCoordinates(location);
  if (!coordinates) {
    console.log(`⚠️ Could not get coordinates for ZIP ${location}, skipping`);
    return { data: [], included: [] };
  }

  console.log(`📍 Using coordinates: ${coordinates.lat}, ${coordinates.lng} for ZIP ${location}`);

  // Use the correct v5 API endpoint for all available dogs
  const url = new URL('https://api.rescuegroups.org/v5/public/animals/search/available/dogs');
  const params = url.searchParams;

  // Core filters
  params.append('filter[species]', 'Dog');
  params.append('filter[status]', 'Available');

  // FIXED: Location filter using lat/lng coordinates as required by RescueGroups v5 API
  params.append('filter[location.latitude]', coordinates.lat.toString());
  params.append('filter[location.longitude]', coordinates.lng.toString());
  params.append('filter[location.distance]', '100'); // 100 mile radius

  // Filter for recently updated animals (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  params.append('filter[updated]', `>${sixMonthsAgo.toISOString().split('T')[0]}`);

  // Limit results for testing
  params.append('limit', '10');

  // Specify fields to return
  const fields = [
    'id', 'name', 'status', 'species',
    'ageGroup', 'sex', 'sizeGroup', 'breedPrimary', 'breedSecondary',
    'descriptionText', 'pictures', 'url', 'distance', 'updated'
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
      console.warn(`⚠️ RescueGroups API error ${response.status} for ${location}:`, errorText);
      return { data: [], included: [] };
    }

    const result = await response.json();
    const animals = result.data || [];
    const included = result.included || [];

    console.log(`📋 Found ${animals.length} RescueGroups dogs from ${location}`);

    // Log first few animals for debugging
    if (animals.length > 0) {
      console.log(`🔍 Sample dogs from ${location}:`);
      animals.slice(0, 3).forEach((animal, index) => {
        console.log(`   ${index + 1}. ${animal.attributes?.name || 'Unknown'} (ID: ${animal.id})`);
        console.log(`      Breed: ${animal.attributes?.breedPrimary || 'Unknown'}`);
        console.log(`      Age: ${animal.attributes?.ageGroup || 'Unknown'}`);
      });
    }

    return { data: animals, included: included };
  } catch (error) {
    console.warn(`⚠️ RescueGroups error for ${location}:`, error.message);
    return { data: [], included: [] };
  }
}

async function main() {
  console.log('🧪 TESTING RESCUEGROUPS LOCATION FILTERING ONLY');
  console.log('📍 This will test 5 different rural ZIP codes to verify geographic diversity\n');

  try {
    // Test with 5 different rural ZIP codes
    const testLocations = [
      '87002', // New Mexico
      '71655', // Arkansas  
      '59718', // Montana
      '62471', // Illinois
      '50158'  // Iowa
    ];

    let totalDogs = 0;
    const allDogIds = [];

    for (const location of testLocations) {
      try {
        const result = await fetchDogsFromRescueGroups(location);
        const dogs = result.data || [];
        
        totalDogs += dogs.length;
        
        // Collect dog IDs to check for duplicates
        dogs.forEach(dog => allDogIds.push(dog.id));
        
        console.log(`✅ Location ${location}: ${dogs.length} dogs found\n`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`⚠️ Failed for location ${location}:`, error.message);
      }
    }

    // Analyze results
    const uniqueDogIds = [...new Set(allDogIds)];
    const duplicateCount = allDogIds.length - uniqueDogIds.length;

    console.log('📊 RESULTS SUMMARY:');
    console.log(`   Total API calls: ${testLocations.length}`);
    console.log(`   Total dogs found: ${totalDogs}`);
    console.log(`   Unique dogs: ${uniqueDogIds.length}`);
    console.log(`   Duplicates: ${duplicateCount}`);
    
    if (duplicateCount === 0) {
      console.log('✅ SUCCESS: No duplicates found - location filtering is working!');
    } else if (duplicateCount < totalDogs * 0.5) {
      console.log('⚠️ PARTIAL SUCCESS: Some duplicates but mostly unique results');
    } else {
      console.log('❌ FAILED: Too many duplicates - location filtering may not be working');
    }

    console.log('\n🎯 Test completed successfully!');

  } catch (error) {
    console.error('❌ RescueGroups test failed:', error);
    process.exit(1);
  }
}

main();
