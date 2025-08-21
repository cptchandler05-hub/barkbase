
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

async function fetchDogsFromRescueGroups(diversityFilter = 'default', limit = 20) {
  console.log(`🦮 Testing RescueGroups filter: ${diversityFilter}`);

  const url = new URL('https://api.rescuegroups.org/v5/public/animals/search/available/dogs');
  const params = url.searchParams;

  // Core filters
  params.append('filter[species]', 'Dog');
  params.append('filter[status]', 'Available');

  // Apply diversity filters
  switch (diversityFilter) {
    case 'recent':
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      params.append('filter[updated]', `>${oneMonthAgo.toISOString().split('T')[0]}`);
      break;

    case 'large_dogs':
      params.append('filter[sizeGroup]', 'Large');
      break;

    case 'small_dogs':
      params.append('filter[sizeGroup]', 'Small');
      break;

    case 'seniors':
      params.append('filter[ageGroup]', 'Senior');
      break;

    case 'special_needs':
      params.append('filter[specialNeeds]', 'true');
      break;

    default:
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      params.append('filter[updated]', `>${threeMonthsAgo.toISOString().split('T')[0]}`);
      break;
  }

  params.append('limit', limit.toString());
  params.append('fields[animals]', 'id,name,sizeGroup,ageGroup,specialNeeds,updated,breedPrimary');
  params.append('include', 'orgs,locations');

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
      console.warn(`⚠️ RescueGroups API error ${response.status}:`, errorText);
      return [];
    }

    const result = await response.json();
    const animals = result.data || [];

    console.log(`📋 Filter "${diversityFilter}" returned ${animals.length} dogs`);
    
    // Show sample data to verify filter effectiveness
    if (animals.length > 0) {
      console.log(`🔍 Sample dogs from ${diversityFilter}:`);
      animals.slice(0, 3).forEach((animal, index) => {
        const attrs = animal.attributes || {};
        console.log(`   ${index + 1}. ${attrs.name || 'Unknown'} (ID: ${animal.id})`);
        console.log(`      Size: ${attrs.sizeGroup || 'Unknown'}, Age: ${attrs.ageGroup || 'Unknown'}`);
        console.log(`      Special Needs: ${attrs.specialNeeds || 'false'}, Updated: ${attrs.updated}`);
        console.log(`      Breed: ${attrs.breedPrimary || 'Unknown'}`);
      });
    }

    return animals;
  } catch (error) {
    console.warn(`⚠️ RescueGroups error for ${diversityFilter}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('🧪 TESTING RESCUEGROUPS DIVERSITY FILTERS');
  console.log('🎯 This will test if filters are actually returning different dogs\n');

  try {
    const filters = ['default', 'recent', 'large_dogs', 'small_dogs', 'seniors', 'special_needs'];
    const allResults = {};
    const allDogIds = [];

    for (const filter of filters) {
      try {
        const dogs = await fetchDogsFromRescueGroups(filter, 20);
        allResults[filter] = dogs;
        
        // Collect IDs for overlap analysis
        dogs.forEach(dog => allDogIds.push({ id: dog.id, filter }));

        console.log(`✅ Filter "${filter}": ${dogs.length} dogs\n`);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(`⚠️ Failed for filter ${filter}:`, error.message);
      }
    }

    // Analyze overlaps between filters
    console.log('📊 OVERLAP ANALYSIS:');
    
    const filterPairs = [
      ['recent', 'large_dogs'],
      ['large_dogs', 'small_dogs'],
      ['seniors', 'special_needs'],
      ['default', 'recent']
    ];

    for (const [filter1, filter2] of filterPairs) {
      const dogs1 = allResults[filter1] || [];
      const dogs2 = allResults[filter2] || [];
      const ids1 = new Set(dogs1.map(d => d.id));
      const ids2 = new Set(dogs2.map(d => d.id));
      const overlap = [...ids1].filter(id => ids2.has(id));
      
      console.log(`🔗 ${filter1} vs ${filter2}: ${overlap.length} overlapping dogs out of ${dogs1.length}/${dogs2.length}`);
    }

    // Check if we're getting the exact same dogs from all filters
    const uniqueIds = new Set(allDogIds.map(d => d.id));
    console.log(`\n🎯 SUMMARY:`);
    console.log(`   Total dog instances: ${allDogIds.length}`);
    console.log(`   Unique dogs: ${uniqueIds.size}`);
    console.log(`   Duplication rate: ${((allDogIds.length - uniqueIds.size) / allDogIds.length * 100).toFixed(1)}%`);

    if (uniqueIds.size < 10) {
      console.log('🚨 WARNING: Very few unique dogs found - filters may not be working!');
    } else if (allDogIds.length - uniqueIds.size > allDogIds.length * 0.8) {
      console.log('🚨 WARNING: Over 80% duplicates - filters may be returning same dogs!');
    } else {
      console.log('✅ Filters appear to be working - good diversity achieved');
    }

    // Show which filters are most/least effective
    console.log(`\n🏆 FILTER EFFECTIVENESS:`);
    for (const filter of filters) {
      const dogs = allResults[filter] || [];
      console.log(`   ${filter}: ${dogs.length} dogs`);
    }

  } catch (error) {
    console.error('❌ RescueGroups diversity test failed:', error.message);
  }
}

main().catch(console.error);
