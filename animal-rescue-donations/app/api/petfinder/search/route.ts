
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '../../utils/tokenManager';
import { getBreeds } from '../../utils/getBreeds';
import { findBestMatchingBreed } from '../../utils/fuzzyBreedMatch';

// Simple rural zip code prefix match (can be expanded later)
const ruralZipPrefixes = ['59', '69', '73', '88', '04', '13']; // Example prefixes: MT, WY, WV, NH, etc.

function isRural(location: any): boolean {
  const zip = location?.postcode || '';
  return ruralZipPrefixes.some(prefix => zip.startsWith(prefix));
}

function scoreVisibility(dog: any): number {
  let score = 0;

  // 1. TIME LISTED - Add 1 point per day listed (your original logic)
  if (dog.published_at) {
    const daysListed = Math.floor((Date.now() - new Date(dog.published_at).getTime()) / (1000 * 60 * 60 * 24));
    score += daysListed; // 25 days = +25 points, 300 days = +300 points
    console.log(`📅 ${dog.name}: ${daysListed} days listed = +${daysListed} points`);
  }

  // 2. RURAL LOCATION - Higher priority for rural/remote areas (up to 50 points)
  const location = dog.contact?.address;
  if (isRural(location)) {
    score += 50;
    console.log(`🌾 ${dog.name}: Rural location = +50 points`);
  } else if (location?.city && /small|town|village|county|rural/i.test(location.city)) {
    score += 25;
    console.log(`🏘️ ${dog.name}: Small town = +25 points`);
  }

  // 3. PHOTO COUNT - Fewer photos = higher invisibility score (up to 40 points)
  const photoCount = dog.photos?.length || 0;
  if (photoCount === 0) {
    score += 40; // No photos = highest invisibility
    console.log(`📷 ${dog.name}: No photos = +40 points`);
  } else if (photoCount === 1) {
    score += 25;
    console.log(`📷 ${dog.name}: 1 photo = +25 points`);
  } else if (photoCount === 2) {
    score += 15;
    console.log(`📷 ${dog.name}: 2 photos = +15 points`);
  } else if (photoCount === 3) {
    score += 5;
    console.log(`📷 ${dog.name}: 3 photos = +5 points`);
  }
  // 4+ photos = 0 points (well-presented dogs)

  // 4. SPECIAL NEEDS - Higher priority for special needs dogs (up to 75 points)
  const description = (dog.description || '').toLowerCase();
  const attributes = (dog.attributes || {});
  
  if (attributes.special_needs) {
    score += 75;
    console.log(`🏥 ${dog.name}: Special needs = +75 points`);
  } else if (/special needs|medical|medication|disability|blind|deaf|three.?leg|amputee|wheelchair|paralyzed|diabetic|seizure|heart condition|kidney|liver|cancer/i.test(description)) {
    score += 60;
    console.log(`🏥 ${dog.name}: Medical needs mentioned = +60 points`);
  }

  // 5. AGE - Senior dogs get higher priority (up to 40 points)
  if (dog.age === 'Senior') {
    score += 40;
    console.log(`👴 ${dog.name}: Senior = +40 points`);
  } else if (dog.age === 'Adult') {
    score += 15;
    console.log(`🐕 ${dog.name}: Adult = +15 points`);
  }
  // Puppies get 0 points as they're usually adopted quickly

  // 6. SIZE - Larger dogs often overlooked (up to 35 points)
  if (dog.size === 'Extra Large') {
    score += 35;
    console.log(`🐋 ${dog.name}: Extra Large = +35 points`);
  } else if (dog.size === 'Large') {
    score += 25;
    console.log(`🐕‍🦺 ${dog.name}: Large = +25 points`);
  } else if (dog.size === 'Medium') {
    score += 10;
    console.log(`🐶 ${dog.name}: Medium = +10 points`);
  }
  // Small dogs get 0 points as they're usually in demand

  // 7. BREED BIAS - Pit bull types and "bully" breeds get higher scores (up to 50 points)
  const breed = (dog.breeds?.primary || '').toLowerCase();
  if (/pit bull|pitbull|staffordshire|american bully|bull terrier|bully/i.test(breed)) {
    score += 50;
    console.log(`💪 ${dog.name}: Bully breed = +50 points`);
  } else if (/rottweiler|doberman|german shepherd|chow|akita|mastiff|cane corso|presa canario/i.test(breed)) {
    score += 35;
    console.log(`🛡️ ${dog.name}: Guardian breed = +35 points`);
  } else if (/mixed|mix|mutt|unknown/i.test(breed)) {
    score += 20;
    console.log(`🎭 ${dog.name}: Mixed breed = +20 points`);
  }

  // 8. DESCRIPTION QUALITY - Poor descriptions indicate less visibility (up to 30 points)
  if (!dog.description || dog.description.length < 50) {
    score += 30; // Very short or no description
    console.log(`📝 ${dog.name}: Poor description = +30 points`);
  } else if (dog.description.length < 150) {
    score += 15; // Short description
    console.log(`📝 ${dog.name}: Short description = +15 points`);
  }

  // 9. BEHAVIORAL NOTES - Dogs with behavioral challenges (up to 60 points)
  if (/no cats|no children|no other dogs|only dog|single pet|behavioral|training needed|dog aggressive|cat aggressive|resource guard/i.test(description)) {
    score += 60;
    console.log(`🎯 ${dog.name}: Behavioral restrictions = +60 points`);
  } else if (/slow to warm|timid|nervous|anxious|shy|fearful|needs patience|withdrawn|scared|stressed/i.test(description)) {
    score += 40;
    console.log(`😰 ${dog.name}: Shy/anxious = +40 points`);
  } else if (/reactive|leash reactive|needs work|experienced owner|advanced training/i.test(description)) {
    score += 45;
    console.log(`⚡ ${dog.name}: Reactive/needs training = +45 points`);
  }

  // 10. ORGANIZATION SIZE - Smaller rescues get bonus (up to 25 points)
  const orgId = String(dog.organization_id || '');
  // Smaller org IDs often indicate smaller rescues (rough heuristic)
  if (orgId.length > 0 && orgId.length < 6) {
    score += 25;
    console.log(`🏠 ${dog.name}: Small rescue bonus = +25 points`);
  } else if (orgId.length >= 6 && orgId.length < 10) {
    score += 15;
    console.log(`🏢 ${dog.name}: Medium rescue = +15 points`);
  }

  // 11. COLOR BIAS - Black dogs and darker colors get bonus (up to 20 points)
  const colors = (dog.colors?.primary || '') + ' ' + (dog.colors?.secondary || '');
  if (/black/i.test(colors)) {
    score += 20;
    console.log(`⚫ ${dog.name}: Black dog syndrome = +20 points`);
  } else if (/brown|brindle|dark/i.test(colors)) {
    score += 10;
    console.log(`🤎 ${dog.name}: Dark coloring = +10 points`);
  }

  // 12. GENDER BIAS - Male dogs often overlooked (up to 10 points)
  if (dog.gender === 'Male') {
    score += 10;
    console.log(`♂️ ${dog.name}: Male = +10 points`);
  }

  // 13. SPAY/NEUTER STATUS - Unaltered dogs may be overlooked (up to 15 points)
  if (attributes.spayed_neutered === false) {
    score += 15;
    console.log(`🔬 ${dog.name}: Not spayed/neutered = +15 points`);
  }

  // 14. SHOTS STATUS - Dogs without current shots may be overlooked (up to 10 points)
  if (attributes.shots_current === false) {
    score += 10;
    console.log(`💉 ${dog.name}: Shots not current = +10 points`);
  }

  // 15. HOUSE TRAINED STATUS - Dogs not house trained may be overlooked (up to 20 points)
  if (attributes.house_trained === false) {
    score += 20;
    console.log(`🏠 ${dog.name}: Not house trained = +20 points`);
  }

  console.log(`🎯 ${dog.name}: Total visibility score = ${score}`);
  return Math.round(score * 10) / 10; // round to 1 decimal
}

export async function GET(req: NextRequest) {
  return handleSearch(req);
}

export async function POST(req: NextRequest) {
  return handleSearch(req);
}

async function handleSearch(req: NextRequest) {

  let location, breed, size, age, gender;

  if (req.method === 'POST') {
    const body = await req.json();
    console.log('📦 Incoming request body:', body);
    location = body.location?.trim();
    breed = body.breed;
    size = body.size;
    age = body.age;
    gender = body.gender;
  } else {
    const url = new URL(req.url);
    location = url.searchParams.get('location')?.trim();
    breed = url.searchParams.get('breed');
    size = url.searchParams.get('size');
    age = url.searchParams.get('age');
    gender = url.searchParams.get('gender');
  }

  const fallbackLocation = "New York, NY";

  if (!location || location.trim() === "") {
    console.warn(`⚠️ No location provided. Falling back to default: ${fallbackLocation}`);
    location = fallbackLocation;
  }

  try {
    console.log('🔑 Attempting to get Petfinder access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token retrieved successfully');
    let matchedBreed = breed;

    if (breed && breed.toLowerCase() !== 'other') {
      const breedList = await getBreeds();
      matchedBreed = findBestMatchingBreed(breed, breedList);
      console.log(`🐕 Resolved breed '${breed}' to Petfinder breed: '${matchedBreed}'`);
    }

    const queryParams = new URLSearchParams({
      type: 'dog',
      status: 'adoptable',
      sort: 'distance',
      limit: '100', // Get more dogs for better scoring/caching
      location,
      distance: '100',
      ...(matchedBreed ? { breed: matchedBreed } : {}),
      ...(size ? { size } : {}),
      ...(age ? { age } : {}),
      ...(gender ? { gender } : {}),
    });

    console.log('🐾 Petfinder query:', queryParams.toString());

    console.log('📡 Making request to Petfinder API...');
    const res = await fetch(`https://api.petfinder.com/v2/animals?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log(`📊 Petfinder API response status: ${res.status}`);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Petfinder API error details:');
      console.error('   Status:', res.status);
      console.error('   Status Text:', res.statusText);
      console.error('   Response:', errorText);
      console.error('   Query:', queryParams.toString());
      return NextResponse.json({ animals: [] }, { status: res.status });
    }

    const data = await res.json();

    const animalsWithScores = (data.animals || [])
    .filter(animal => animal.type?.toLowerCase() === 'dog')
    .map((dog: any) => ({
      ...dog,
      visibilityScore: scoreVisibility(dog),
    }))
    .sort((a, b) => b.visibilityScore - a.visibilityScore); // Sort by visibility score DESC (most invisible first)

    console.log(`🐶 Found ${animalsWithScores.length} dogs from Petfinder`);
    console.log(`🎯 Top 5 invisibility scores:`, animalsWithScores.slice(0, 5).map(d => ({ name: d.name, score: d.visibilityScore })));
    return NextResponse.json({ animals: animalsWithScores });
  } catch (err) {
    console.error('❌ Error in search route:', err);
    return NextResponse.json({ animals: [] }, { status: 500 });
  }
}
