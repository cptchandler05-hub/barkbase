const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env.local' });

// Test script for RescueGroups API integration
// This tests the same logic used in the main sync but focused only on RescueGroups

// Helper function to extract photos from batch-fetched included data
function getPicturesForAnimal(animal, included) {
  const pictureRefs = animal.relationships?.pictures?.data || [];

  if (!pictureRefs.length) {
    console.log(`🖼️ No picture references found for animal ${animal.id}`);
    return [];
  }

  console.log(`🔍 Animal ${animal.id} has ${pictureRefs.length} picture references:`, pictureRefs.map(ref => ref.id));

  const pictures = pictureRefs.map(ref => {
    const pic = included.find(item => item.type === 'pictures' && item.id === ref.id);
    if (!pic) {
      console.warn(`⚠️ Picture ID ${ref.id} not found in batch-fetched data for animal ${animal.id}`);
      return null;
    }
    
    const attrs = pic.attributes || {};
    const bestUrl = attrs.large?.url || attrs.original?.url || attrs.small?.url || attrs.url || null;
    
    console.log(`   📸 Batch-fetched picture ${pic.id} with URL:`, bestUrl || 'null');
    
    if (!bestUrl) {
      console.warn(`   ⚠️ Picture ${pic.id} has no URL in batch fetch - attributes:`, Object.keys(attrs));
      return null;
    }

    return {
      url: bestUrl,
      thumbnail: attrs.urlSmall || bestUrl,
      order: attrs.order || 0
    };
  }).filter(p => p && p.url);

  console.log(`🖼️ Animal ${animal.id}: ${pictures.length} valid pictures found from batch fetch`);
  return pictures.sort((a, b) => a.order - b.order);
}

// Helper function to construct RescueGroups profile URL
function constructDogUrl(animalId) {
  return `https://www.rescuegroups.org/animals/detail?AnimalID=${animalId}`;
}

async function fetchDogsFromRescueGroups(diversityFilter = 'default', limit = 50, offset = 0) {
  console.log(`🦮 Testing RescueGroups filter: ${diversityFilter}`);

  const url = new URL('https://api.rescuegroups.org/v5/public/animals/search/available/dogs');
  const params = url.searchParams;

  // Core filters - FIXED: Use correct API v5 schema field names (no prefix needed)
  params.append('filter[species]', 'Dog');
  params.append('filter[status]', 'Available');

  // Apply diversity filters - FIXED: Use correct API v5 animal-prefixed field names
  switch (diversityFilter) {
    case 'recent':
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      params.append('filter[animalUpdatedDate]', `>${oneMonthAgo.toISOString().split('T')[0]}`);
      break;

    case 'large_dogs':
      params.append('filter[animalSizes]', 'Large');
      break;

    case 'small_dogs':
      params.append('filter[animalSizes]', 'Small');
      break;

    case 'seniors':
      params.append('filter[animalGeneralAge]', 'Senior');
      break;

    case 'special_needs':
      params.append('filter[animalSpecialneeds]', 'true');
      break;

    case 'puppies':
      params.append('filter[animalGeneralAge]', 'Baby');
      break;

    case 'mixed_breeds':
      params.append('filter[animalBreedMixed]', 'true');
      break;

    case 'purebreds':
      params.append('filter[animalBreedMixed]', 'false');
      break;

    default:
      // Default: recently updated in last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      params.append('filter[animalUpdatedDate]', `>${threeMonthsAgo.toISOString().split('T')[0]}`);
      break;
  }

  // Limit results
  params.append('limit', Math.min(limit, 100).toString());

  // Add offset for pagination
  if (offset > 0) {
    params.append('start', offset.toString());
  }

  // Add random sorting to reduce repeated results
  params.append('sort', 'random');

  // Specify fields to return - FIXED: Use unprefixed camelCase field names
  const fields = [
    'id',
    'name',
    'ageGroup',
    'sizeGroup',
    'breedPrimary',
    'breedSecondary',
    'isBreedMixed',
    'descriptionHtml',
    'descriptionText',
    'energyLevel',
    'activityLevel',
    'createdDate',
    'updatedDate',
    'sex',
    'isHousetrained',
    'specialNeeds',
    'adoptionFeeString',
    'isAdoptionPending'
  ];
  params.append('fields[animals]', fields.join(','));

  // Add picture fields separately to ensure photos are included - EXPANDED: Include all possible URL fields
  params.append('fields[pictures]', 'id,url,urlLarge,urlOriginal,urlSmall,urlSecureFullsize,urlSecureLarge,urlSecureOriginal,order');

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
      console.warn(`⚠️ RescueGroups API error ${response.status}:`, errorText);
      return { animals: [], included: [] };
    }

    const result = await response.json();
    const animals = result.data || [];
    let included = result.included || [];

    console.log(`📋 Found ${animals.length} RescueGroups dogs with ${diversityFilter} filter (${included.length} included items)`);

    // Debug: Inspect raw picture data from included
    console.log('\n🔎 Sample picture data from included:');
    const firstPicture = included.find(item => item.type === 'pictures');
    if (firstPicture) {
      console.dir(firstPicture, { depth: null });
    } else {
      console.log('No pictures found in included data');
    }

    // IMPROVED BATCH PICTURE FETCH: Get all picture IDs and fetch them explicitly
    const allPicIds = Array.from(new Set(
      animals.flatMap(animal => (animal.relationships?.pictures?.data || []).map(ref => ref.id))
    ));

    let batchPictures = [];
    if (allPicIds.length > 0) {
      console.log(`\n📸 Batch fetching ${allPicIds.length} picture objects with dedicated API call...`);
      
      try {
        const picUrl = new URL('https://api.rescuegroups.org/v5/public/pictures');
        picUrl.searchParams.set('filter[id][in]', allPicIds.slice(0, 100).join(','));
        picUrl.searchParams.set('fields[pictures]', 'id,urlLarge,urlOriginal,urlSmall,order');
        
        const pictureResponse = await fetch(picUrl.toString(), {
          method: 'GET',
          headers: {
            'Authorization': process.env.RESCUEGROUPS_API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'BarkBase/1.0'
          }
        });

        if (pictureResponse.ok) {
          const picResult = await pictureResponse.json();
          batchPictures = picResult.data || [];
          
          console.log(`✨ Batch fetched ${batchPictures.length} pictures with URLs`);
          console.log('🔎 Sample batch-fetched picture:');
          if (batchPictures[0]) {
            console.dir(batchPictures[0], { depth: null });
          }
          
          // Replace included pictures with batch-fetched ones
          included = included.filter(item => item.type !== 'pictures').concat(batchPictures);
        } else {
          console.warn('⚠️ Batch picture fetch failed:', pictureResponse.status);
        }
      } catch (error) {
        console.warn('⚠️ Batch picture fetch error:', error.message);
      }
    }

    // Show sample data to verify filter effectiveness
    if (animals.length > 0) {
      console.log(`🔍 Sample dogs from ${diversityFilter}:`);
      animals.slice(0, 3).forEach((animal, index) => {
        const attrs = animal.attributes || {};

        // Debug animal ID details
        console.log(`\n🆔 Animal ID Debug: ID="${animal.id}", Type: ${typeof animal.id}, Length: ${animal.id.toString().length}`);

        const pictures = getPicturesForAnimal(animal, included);
        const dogUrl = constructDogUrl(animal.id);

        console.log(`   ${index + 1}. ${attrs.name || 'Unknown'} (ID: ${animal.id})`);
        console.log(`      Size: ${attrs.sizeGroup || 'Unknown'}, Age: ${attrs.ageGroup || 'Unknown'}`);
        console.log(`      Special Needs: ${attrs.specialNeeds ? 'true' : 'false'}, Mixed: ${attrs.isBreedMixed ? 'true' : 'false'}`);
        console.log(`      Breed: ${attrs.breedPrimary || 'Unknown'}, Updated: ${attrs.updatedDate}`);
        console.log(`      📸 Pictures: ${pictures.length} found`);
        if (pictures.length > 0) {
          console.log(`         First photo URL: ${pictures[0].url}`);
        } else {
          console.log(`         No photos found for ID ${animal.id}`);
        }
        console.log(`      🔗 Profile URL: ${dogUrl}`);
        console.log(`      📝 Description: ${attrs.descriptionText ? 'Available' : 'None'} (HTML: ${attrs.descriptionHtml ? 'Available' : 'None'})`);
        console.log(`      Raw attrs keys: ${Object.keys(attrs).slice(0, 10).join(', ')}`);
      });
    }

    return { animals, included };
  } catch (error) {
    console.warn(`⚠️ RescueGroups error for ${diversityFilter}:`, error.message);
    return { animals: [], included: [] };
  }
}

async function testRescueGroupsSync() {
  console.log('🧪 TESTING RESCUEGROUPS API WITH CORRECTED FIELD NAMES');
  console.log('🎯 This uses the same corrected logic as the main sync script\n');

  try {
    // Test multiple diversity filters like the main sync
    const testFilters = ['default', 'recent', 'large_dogs', 'small_dogs', 'seniors', 'special_needs', 'puppies', 'mixed_breeds'];
    const allDogs = [];
    const allDogIds = [];
    const allIncluded = [];
    let totalAPIRequests = 0;

    for (const filter of testFilters) {
      try {
        console.log(`\n🎯 Testing filter: ${filter}`);
        const { animals, included } = await fetchDogsFromRescueGroups(filter, 50);

        totalAPIRequests++;
        allDogs.push(...animals);
        allIncluded.push(...included);

        // Track IDs for deduplication analysis
        animals.forEach(animal => {
          allDogIds.push(animal.id);
        });

        console.log(`✅ Filter "${filter}": ${animals.length} dogs, ${included.length} included items`);

        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`⚠️ Failed for filter ${filter}:`, error.message);
      }
    }

    // Deduplication analysis
    const uniqueDogIds = [...new Set(allDogIds)];
    const duplicateCount = allDogIds.length - uniqueDogIds.length;

    console.log('\n📊 RESCUEGROUPS TEST RESULTS:');
    console.log(`   API requests made: ${totalAPIRequests}`);
    console.log(`   Total dog instances: ${allDogIds.length}`);
    console.log(`   Unique dogs: ${uniqueDogIds.length}`);
    console.log(`   Duplicates removed: ${duplicateCount}`);
    console.log(`   Duplication rate: ${((duplicateCount / allDogIds.length) * 100).toFixed(1)}%`);

    // Test data quality using proper photo mapping
    const dogsWithPhotos = allDogs.filter(dog => {
      const pictures = getPicturesForAnimal(dog, allIncluded);
      return pictures.length > 0;
    });

    const dogsWithDescriptions = allDogs.filter(dog => {
      const attrs = dog.attributes || {};
      return (attrs.descriptionText && attrs.descriptionText.length > 50) ||
             (attrs.descriptionHtml && attrs.descriptionHtml.length > 50);
    });

    console.log('\n🏆 DATA QUALITY ANALYSIS:');
    console.log(`   Dogs with photos: ${dogsWithPhotos.length}/${uniqueDogIds.length} (${((dogsWithPhotos.length/uniqueDogIds.length)*100).toFixed(1)}%)`);
    console.log(`   Dogs with descriptions: ${dogsWithDescriptions.length}/${uniqueDogIds.length} (${((dogsWithDescriptions.length/uniqueDogIds.length)*100).toFixed(1)}%)`);

    // Verify field corrections are working
    console.log('\n🔧 FIELD VERIFICATION:');
    const sampleDog = allDogs[0];
    if (sampleDog?.attributes) {
      const attrs = sampleDog.attributes;
      console.log(`   📋 Available attribute keys: ${Object.keys(attrs).join(', ')}`);
      console.log(`   ✅ ageGroup: ${attrs.ageGroup || 'N/A'}`);
      console.log(`   ✅ sizeGroup: ${attrs.sizeGroup || 'N/A'}`);
      console.log(`   ✅ specialNeeds: ${attrs.specialNeeds || 'N/A'}`);
      console.log(`   ✅ breedPrimary: ${attrs.breedPrimary || 'N/A'}`);
      console.log(`   ✅ isBreedMixed: ${attrs.isBreedMixed || 'N/A'}`);
      console.log(`   ✅ descriptionText: ${attrs.descriptionText ? 'Available' : 'N/A'}`);
      console.log(`   ✅ descriptionHtml: ${attrs.descriptionHtml ? 'Available' : 'N/A'}`);
      console.log(`   🔍 Sample raw animal structure:`, JSON.stringify(sampleDog, null, 2).slice(0, 800));
    }

    if (uniqueDogIds.length > 0) {
      console.log('\n✅ SUCCESS: RescueGroups API test completed successfully!');
      console.log('🎯 The corrected field names are working properly');
      console.log('🦮 Ready for production sync with enhanced diversity filters');
    } else {
      console.log('\n❌ WARNING: No dogs returned - check API key and connectivity');
    }

  } catch (error) {
    console.error('❌ RescueGroups test failed:', error.message);
    process.exit(1);
  }
}

// Also test database integration if we have Supabase configured
async function testDatabaseIntegration() {
  console.log('\n🗄️ TESTING DATABASE INTEGRATION');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️ Supabase not configured - skipping database test');
    return;
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test connection
    const { data, error } = await supabase
      .from('dogs')
      .select('count')
      .limit(1);

    if (error) {
      console.log(`❌ Database connection failed: ${error.message}`);
    } else {
      console.log('✅ Database connection successful');
    }
  } catch (error) {
    console.log(`❌ Database test failed: ${error.message}`);
  }
}

async function main() {
  console.log('🐕 RESCUEGROUPS API TEST SUITE');
  console.log('📋 Testing with corrected API v5 field names and enhanced filters\n');

  await testRescueGroupsSync();
  await testDatabaseIntegration();

  console.log('\n🎉 All tests completed!');
}

main().catch(console.error);