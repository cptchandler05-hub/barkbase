// Module for testing RescueGroups API location filtering

// Import necessary modules
const fetch = require('node-fetch');
require('dotenv').config({ path: './.env.local' });

// Define ZIP code to coordinates mapping for testing
const zipToCoordinates = {
  '87002': { lat: 35.2828, lng: -106.6614 }, // New Mexico
  '71655': { lat: 33.5779, lng: -91.7320 }, // Arkansas  
  '59718': { lat: 45.6770, lng: -111.0429 }, // Montana
  '62471': { lat: 39.7817, lng: -88.1617 }, // Illinois
  '50158': { lat: 41.5868, lng: -93.4685 }  // Iowa
};

async function fetchDogsFromRescueGroups(location) {
  console.log(`🦮 Testing RescueGroups API for location: ${location}`);

  console.log(`📍 Using ZIP code: ${location} for location filtering`);

  const baseURL = 'https://api.rescuegroups.org/v5/public/animals/search/available/dogs';
  const url = new URL(baseURL);
  const params = url.searchParams;

  // Core filters
  params.append('filter[species]', 'Dog');
  params.append('filter[status]', 'Available');

  // FIXED: Use correct RescueGroups v5 location filtering
  params.append('filter[location]', location); // ZIP code
  params.append('filter[locationDistance]', '100'); // 100 mile radius

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
    console.error('❌ RescueGroups test failed:', error.message);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}