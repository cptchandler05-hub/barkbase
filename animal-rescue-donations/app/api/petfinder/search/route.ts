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

  // 1. TIME LISTED - Older dogs get higher scores (up to 8 points)
  if (dog.published_at) {
    const daysListed = (Date.now() - new Date(dog.published_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysListed > 365) score += 8; // Over a year = max points
    else if (daysListed > 180) score += 6; // 6+ months
    else if (daysListed > 90) score += 4; // 3+ months  
    else if (daysListed > 30) score += 2; // 1+ month
    else if (daysListed > 7) score += 1; // 1+ week
  }

  // 2. RURAL LOCATION - Higher priority for rural/remote areas (up to 6 points)
  const location = dog.contact?.address;
  if (isRural(location)) {
    score += 6;
  } else if (location?.city && /small|town|village|county|rural/i.test(location.city)) {
    score += 3;
  }

  // 3. PHOTO COUNT - Fewer photos = higher invisibility score (up to 5 points)
  const photoCount = dog.photos?.length || 0;
  if (photoCount === 0) score += 5; // No photos = highest invisibility
  else if (photoCount === 1) score += 3;
  else if (photoCount === 2) score += 1;
  // 3+ photos = 0 points (well-presented dogs)

  // 4. SPECIAL NEEDS - Higher priority for special needs dogs (up to 7 points)
  const description = (dog.description || '').toLowerCase();
  const attributes = (dog.attributes || {});
  
  if (attributes.special_needs) score += 7;
  else if (/special needs|medical|medication|disability|blind|deaf|three.?leg|amputee/i.test(description)) {
    score += 5;
  }

  // 5. AGE - Senior dogs get higher priority (up to 4 points)
  if (dog.age === 'Senior') score += 4;
  else if (dog.age === 'Adult') score += 2;

  // 6. SIZE - Larger dogs often overlooked (up to 3 points)
  if (dog.size === 'Extra Large') score += 3;
  else if (dog.size === 'Large') score += 2;

  // 7. BREED BIAS - Pit bull types and "bully" breeds get higher scores (up to 4 points)
  const breed = (dog.breeds?.primary || '').toLowerCase();
  if (/pit bull|pitbull|staffordshire|american bully|bull terrier/i.test(breed)) {
    score += 4;
  } else if (/rottweiler|doberman|german shepherd|chow|akita/i.test(breed)) {
    score += 2;
  }

  // 8. DESCRIPTION QUALITY - Poor descriptions indicate less visibility (up to 3 points)
  if (!dog.description || dog.description.length < 50) {
    score += 3; // Very short or no description
  } else if (dog.description.length < 150) {
    score += 1; // Short description
  }

  // 9. BEHAVIORAL NOTES - Dogs with behavioral challenges (up to 5 points)
  if (/no cats|no children|no other dogs|only dog|behavioral|training needed|shy|fearful|reactive/i.test(description)) {
    score += 5;
  } else if (/slow to warm|timid|nervous|anxious/i.test(description)) {
    score += 3;
  }

  // 10. ORGANIZATION SIZE - Smaller rescues get bonus (up to 2 points)
  const orgName = dog.organization_id || '';
  // This is a rough heuristic - smaller org IDs often indicate smaller rescues
  if (orgName.length < 10) score += 2;

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
