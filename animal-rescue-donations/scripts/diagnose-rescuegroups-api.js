
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRescueGroupsAPI() {
  console.log('🔍 DIAGNOSING RESCUEGROUPS API LOCATION FILTERING ISSUES\n');

  const baseURL = 'https://api.rescuegroups.org/v5/public/animals/search/available/dogs';
  const headers = {
    'Authorization': process.env.RESCUEGROUPS_API_KEY,
    'Content-Type': 'application/json',
    'User-Agent': 'BarkBase/1.0'
  };

  // Test 1: Basic request with no location filters
  console.log('🧪 TEST 1: Basic request (no location filters)');
  try {
    const url1 = new URL(baseURL);
    url1.searchParams.append('filter[species]', 'Dog');
    url1.searchParams.append('filter[status]', 'Available');
    url1.searchParams.append('limit', '5');
    url1.searchParams.append('fields[animals]', 'id,name,breedPrimary');

    console.log(`🔗 URL: ${url1.toString()}`);
    
    const response1 = await fetch(url1.toString(), { headers });
    if (response1.ok) {
      const result1 = await response1.json();
      console.log(`✅ Found ${result1.data?.length || 0} dogs`);
      if (result1.data?.[0]) {
        console.log(`🔍 First dog: ${result1.data[0].attributes?.name} (ID: ${result1.data[0].id})`);
      }
    } else {
      console.log(`❌ Error: ${response1.status}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Try different location parameter formats
  console.log('🧪 TEST 2: Different location parameter formats');
  
  const locationTests = [
    // Format 1: What we've been using
    {
      name: 'Current format (filter[location.latitude])',
      params: {
        'filter[location.latitude]': '35.2828',
        'filter[location.longitude]': '-106.6614',
        'filter[location.distance]': '50'
      }
    },
    // Format 2: Alternative format
    {
      name: 'Alternative format (filter[latitude])',
      params: {
        'filter[latitude]': '35.2828',
        'filter[longitude]': '-106.6614',
        'filter[distance]': '50'
      }
    },
    // Format 3: Try location as a string
    {
      name: 'Location string format',
      params: {
        'filter[location]': '87002'
      }
    },
    // Format 4: Try postal code
    {
      name: 'Postal code format',
      params: {
        'filter[postalcode]': '87002'
      }
    },
    // Format 5: Try city/state
    {
      name: 'City/State format',
      params: {
        'filter[city]': 'Belen',
        'filter[state]': 'NM'
      }
    }
  ];

  for (const test of locationTests) {
    console.log(`\n🔍 Testing: ${test.name}`);
    try {
      const url = new URL(baseURL);
      url.searchParams.append('filter[species]', 'Dog');
      url.searchParams.append('filter[status]', 'Available');
      url.searchParams.append('limit', '3');
      url.searchParams.append('fields[animals]', 'id,name,breedPrimary');

      // Add location parameters
      Object.entries(test.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.log(`🔗 URL: ${url.toString()}`);
      
      const response = await fetch(url.toString(), { headers });
      if (response.ok) {
        const result = await response.json();
        console.log(`📊 Found ${result.data?.length || 0} dogs`);
        if (result.data?.[0]) {
          console.log(`🔍 First dog: ${result.data[0].attributes?.name} (ID: ${result.data[0].id})`);
        }
      } else {
        const errorText = await response.text();
        console.log(`❌ Error ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Check API documentation endpoint
  console.log('🧪 TEST 3: Check if API has location documentation');
  try {
    const docUrl = 'https://api.rescuegroups.org/v5/public/animals/search/available/dogs?help=true';
    console.log(`🔗 Checking: ${docUrl}`);
    
    const response = await fetch(docUrl, { headers });
    if (response.ok) {
      const result = await response.json();
      console.log('📖 API Documentation Response:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ Documentation not available: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Documentation check failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 4: Try the general search endpoint instead of dogs-specific
  console.log('🧪 TEST 4: Try general animals search endpoint');
  try {
    const generalURL = 'https://api.rescuegroups.org/v5/public/animals/search';
    const url = new URL(generalURL);
    url.searchParams.append('filter[species]', 'Dog');
    url.searchParams.append('filter[status]', 'Available');
    url.searchParams.append('filter[location.latitude]', '35.2828');
    url.searchParams.append('filter[location.longitude]', '-106.6614');
    url.searchParams.append('filter[location.distance]', '50');
    url.searchParams.append('limit', '3');
    url.searchParams.append('fields[animals]', 'id,name,breedPrimary');

    console.log(`🔗 URL: ${url.toString()}`);
    
    const response = await fetch(url.toString(), { headers });
    if (response.ok) {
      const result = await response.json();
      console.log(`📊 Found ${result.data?.length || 0} dogs`);
      if (result.data?.[0]) {
        console.log(`🔍 First dog: ${result.data[0].attributes?.name} (ID: ${result.data[0].id})`);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Error ${response.status}: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }

  console.log('\n🎯 DIAGNOSIS COMPLETE');
  console.log('📋 Next steps:');
  console.log('   1. Review which parameter format (if any) returned different results');
  console.log('   2. Check if RescueGroups v5 API actually supports location filtering');
  console.log('   3. Consider if we need to use a different endpoint or API version');
}

testRescueGroupsAPI().catch(console.error);
