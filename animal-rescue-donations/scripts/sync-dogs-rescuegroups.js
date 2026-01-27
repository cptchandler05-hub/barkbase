const { createClient } = require('@supabase/supabase-js');
const { getRandomRuralZip } = require('../lib/utils.js');
const { calculateVisibilityScore } = require('../lib/scoreVisibility.js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

let lastRescueGroupsRequest = 0;
const RESCUEGROUPS_MIN_INTERVAL = 100;

async function rateLimitedDelay() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRescueGroupsRequest;
  if (timeSinceLastRequest < RESCUEGROUPS_MIN_INTERVAL) {
    const waitTime = RESCUEGROUPS_MIN_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRescueGroupsRequest = Date.now();
}

async function fetchDogsFromRescueGroups(diversityFilter = 'default', page = 1, limit = 100) {
  await rateLimitedDelay();
  
  const url = new URL('https://api.rescuegroups.org/v5/public/animals/search/available/dogs');
  const params = url.searchParams;
  
  params.append('filter[species]', 'Dog');
  params.append('filter[status]', 'Available');

  switch (diversityFilter) {
    case 'recent':
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      params.append('filter[animalUpdatedDate]', `>${oneMonthAgo.toISOString().split('T')[0]}`);
      break;

    case 'older':
      const sixMonthsAgo = new Date();
      const twoMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      params.append('filter[animalUpdatedDate]', `>${sixMonthsAgo.toISOString().split('T')[0]}`);
      params.append('filter[animalUpdatedDate]', `<${twoMonthsAgo.toISOString().split('T')[0]}`);
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

    case 'very_old':
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

    case 'puppies':
      params.append('filter[animalGeneralAge]', 'Baby');
      break;

    default:
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      params.append('filter[animalUpdatedDate]', `>${threeMonthsAgo.toISOString().split('T')[0]}`);
      break;
  }

  params.append('limit', Math.min(limit, 250).toString());
  params.append('page', page.toString());

  const fields = [
    'id', 'name', 'status', 'species',
    'ageGroup', 'sex', 'sizeGroup', 'breedPrimary', 'breedSecondary',
    'isBreedMixed', 'descriptionHtml', 'descriptionText', 'specialNeeds',
    'isHousetrained', 'goodWithChildren', 'goodWithDogs', 'goodWithCats',
    'updatedDate', 'createdDate'
  ];
  params.append('fields[animals]', fields.join(','));
  // Don't specify fields[pictures] - let API return default nested structure (original.url, large.url, small.url)
  params.append('include', 'orgs,locations,breeds,pictures');

  console.log(`🔗 RescueGroups API: ${diversityFilter} filter, page ${page}`);

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

    console.log(`📋 Found ${animals.length} dogs with ${diversityFilter} filter`);
    return { data: animals, included: included };
  } catch (error) {
    console.warn(`⚠️ RescueGroups error for ${diversityFilter}:`, error.message);
    return { data: [], included: [] };
  }
}

function getPicturesForAnimal(animal, included) {
  const pictureRefs = animal.relationships?.pictures?.data || [];
  if (!pictureRefs.length) return [];
  
  const pictureIds = pictureRefs.map(ref => ref.id);
  return included
    .filter(item => item.type === 'pictures' && pictureIds.includes(item.id))
    .sort((a, b) => (a.attributes?.order || 99) - (b.attributes?.order || 99))
    .map(pic => {
      const attrs = pic.attributes || {};
      // RescueGroups uses nested structure: attrs.original.url, attrs.large.url, attrs.small.url
      const originalUrl = attrs.original?.url || null;
      const largeUrl = attrs.large?.url || null;
      const smallUrl = attrs.small?.url || null;
      
      // Return the best available URL (prefer large for quality)
      return largeUrl || originalUrl || smallUrl || null;
    })
    .filter(url => url !== null);
}

function transformRescueGroupsAnimal(animal, included = []) {
  const attrs = animal.attributes || {};

  let city = 'Unknown';
  let state = 'Unknown';
  let postcode = '';

  const locationRefs = animal.relationships?.locations?.data || [];
  if (locationRefs.length > 0) {
    const locationId = locationRefs[0].id;
    const location = included.find(item => item.type === 'locations' && item.id === locationId);
    if (location) {
      const locAttrs = location.attributes || {};
      city = locAttrs.city || locAttrs.citystate?.split(',')[0]?.trim() || 'Unknown';
      state = locAttrs.state || locAttrs.citystate?.split(',')[1]?.trim() || 'Unknown';
      postcode = locAttrs.postalcode || '';
    }
  }

  let orgId = '';
  let orgUrl = '';
  let orgName = 'Unknown Organization';
  let orgEmail = null;
  let orgPhone = null;
  const orgRefs = animal.relationships?.orgs?.data || [];
  if (orgRefs.length > 0) {
    const orgRefId = orgRefs[0].id;
    const org = included.find(item => item.type === 'orgs' && item.id === orgRefId);
    if (org) {
      const orgAttrs = org.attributes || {};
      orgId = org.id;
      orgUrl = orgAttrs.url || '';
      orgName = orgAttrs.name || orgAttrs.orgName || 'Unknown Organization';
      orgEmail = orgAttrs.email || orgAttrs.emailAddress || orgAttrs.publicEmail || orgAttrs.contactEmail || null;
      orgPhone = orgAttrs.phone || orgAttrs.phoneNumber || orgAttrs.contactPhone || null;
      console.log(`  📍 Org: ${orgName} | Email: ${orgEmail} | Phone: ${orgPhone}`);
    }
  }

  const photos = getPicturesForAnimal(animal, included);

  // Clean description - remove HTML tags, tracking pixels, and odd characters
  let rawDescription = attrs.descriptionText || attrs.descriptionHtml || '';
  const description = rawDescription
    .replace(/<img[^>]*>/gi, '') // Remove img tags (tracking pixels)
    .replace(/<[^>]+>/g, ' ') // Remove other HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const visibilityScore = calculateVisibilityScore({
    daysListed: attrs.createdDate ? Math.floor((Date.now() - new Date(attrs.createdDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    isRural: true,
    skipCount: 0,
    specialNeeds: attrs.specialNeeds || false,
    age: attrs.ageGroup || 'Adult',
    size: attrs.sizeGroup || 'Medium',
    photoCount: photos.length
  });

  return {
    rescuegroups_id: animal.id,
    petfinder_id: null,
    api_source: 'rescuegroups',
    api_source_priority: 1,
    organization_id: orgId,
    organization_animal_id: animal.id,
    url: attrs.url || orgUrl || `https://www.rescuegroups.org/animals/${animal.id}`,
    name: attrs.name || 'Unknown',
    type: 'Dog',
    species: 'Dog',
    primary_breed: attrs.breedPrimary || 'Mixed Breed',
    secondary_breed: attrs.breedSecondary || null,
    is_mixed: attrs.isBreedMixed !== false,
    is_unknown_breed: !attrs.breedPrimary,
    age: attrs.ageGroup || 'Adult',
    gender: attrs.sex || 'Unknown',
    size: attrs.sizeGroup || 'Medium',
    coat: null,
    primary_color: null,
    secondary_color: null,
    tertiary_color: null,
    status: 'adoptable',
    spayed_neutered: null,
    house_trained: attrs.isHousetrained || false,
    special_needs: attrs.specialNeeds || false,
    good_with_children: attrs.goodWithChildren || null,
    good_with_dogs: attrs.goodWithDogs || null,
    good_with_cats: attrs.goodWithCats || null,
    description: description,
    photos: JSON.stringify(photos.map(url => ({ small: url, medium: url, large: url, full: url }))),
    tags: JSON.stringify([]),
    contact_info: JSON.stringify({ email: orgEmail, phone: orgPhone, organizationName: orgName }),
    city: city,
    state: state,
    postcode: postcode,
    latitude: null,
    longitude: null,
    visibility_score: visibilityScore,
    last_updated_at: new Date().toISOString(),
    created_at: attrs.createdDate || new Date().toISOString()
  };
}

async function syncDogsToDatabase(dogs) {
  console.log(`💾 Syncing ${dogs.length} dogs to database...`);
  
  let upsertedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < dogs.length; i += 50) {
    const batch = dogs.slice(i, i + 50);
    
    try {
      const { error } = await supabase
        .from('dogs')
        .upsert(batch, {
          onConflict: 'rescuegroups_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Batch upsert error:`, error.message);
        errorCount += batch.length;
      } else {
        upsertedCount += batch.length;
        console.log(`✅ Synced batch ${Math.floor(i/50) + 1}: ${batch.length} dogs`);
      }
    } catch (err) {
      console.error(`❌ Exception during batch upsert:`, err.message);
      errorCount += batch.length;
    }
  }

  console.log(`📊 Sync complete: ${upsertedCount} upserted, ${errorCount} errors`);
}

async function main() {
  console.log('🐕 Starting RescueGroups-only dog sync...');
  console.log('📅 Note: Petfinder API was discontinued December 2, 2025');
  console.log('🔄 Using RescueGroups as the sole data source\n');

  if (!process.env.RESCUEGROUPS_API_KEY) {
    console.error('❌ RESCUEGROUPS_API_KEY is not set');
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Supabase credentials are not set');
    process.exit(1);
  }

  try {
    console.log('🔗 Testing Supabase connection...');
    const { count, error } = await supabase
      .from('dogs')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`✅ Database connected! Current dogs: ${count || 0}\n`);

    const diversityFilters = [
      'default',
      'seniors',
      'special_needs',
      'large_dogs',
      'small_dogs',
      'medium_dogs',
      'older',
      'very_old',
      'adults',
      'puppies'
    ];

    let allDogs = [];
    let combinedIncluded = [];

    console.log('🔍 Phase 1: Bulk pagination (pages 1-20) - Expanding nationwide coverage');
    for (let page = 1; page <= 20; page++) {
      const { data, included } = await fetchDogsFromRescueGroups('default', page, 250);
      if (data.length === 0) {
        console.log(`📄 Page ${page}: No more dogs, stopping pagination`);
        break;
      }
      
      allDogs = allDogs.concat(data.map(animal => transformRescueGroupsAnimal(animal, included)));
      combinedIncluded = combinedIncluded.concat(included);
      console.log(`📄 Page ${page}: Added ${data.length} dogs (Total: ${allDogs.length})`);
      
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log(`\n🔍 Phase 2: Diversity filters for invisible dogs (2 pages each)`);
    for (const filter of diversityFilters) {
      for (let page = 1; page <= 2; page++) {
        const { data, included } = await fetchDogsFromRescueGroups(filter, page, 250);
        if (data.length > 0) {
          allDogs = allDogs.concat(data.map(animal => transformRescueGroupsAnimal(animal, included)));
          combinedIncluded = combinedIncluded.concat(included);
          console.log(`  ${filter} page ${page}: Added ${data.length} dogs`);
        } else {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    const uniqueDogs = allDogs.filter((dog, index, self) =>
      index === self.findIndex(d => d.rescuegroups_id === dog.rescuegroups_id)
    );

    console.log(`\n📊 RescueGroups Sync Results:`);
    console.log(`   Total dogs fetched: ${allDogs.length}`);
    console.log(`   Duplicates removed: ${allDogs.length - uniqueDogs.length}`);
    console.log(`   Final unique dogs: ${uniqueDogs.length}`);

    if (uniqueDogs.length > 0) {
      await syncDogsToDatabase(uniqueDogs);
    }

    console.log('\n🧹 Marking stale dogs as removed...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: removedResult } = await supabase
      .from('dogs')
      .update({ status: 'removed' })
      .lt('last_updated_at', thirtyDaysAgo.toISOString())
      .eq('status', 'adoptable')
      .select();

    console.log(`🧹 Marked ${removedResult?.length || 0} stale dogs as removed`);
    console.log('\n✅ RescueGroups dog sync completed successfully!');

  } catch (error) {
    console.error('❌ Dog sync failed:', error);
    process.exit(1);
  }
}

main();
