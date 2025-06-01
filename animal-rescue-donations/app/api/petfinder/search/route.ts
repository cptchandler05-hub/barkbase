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

  // Time listed: older listings get more points (up to 5)
  if (dog.published_at) {
    const daysListed = (Date.now() - new Date(dog.published_at).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.min(daysListed / 10, 5);
  }

  // Photo count: up to 3 points
  if (dog.photos?.length) {
    score += Math.min(dog.photos.length, 3);
  }

  // Description: 2 points for long descriptions
  if (dog.description && dog.description.length > 150) {
    score += 2;
  }

  // Rural location bonus: 2 points
  if (isRural(dog.contact?.address)) {
    score += 2;
  }

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
      limit: '20',
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
    }));

    console.log(`🐶 Found ${animalsWithScores.length} dogs from Petfinder`);
    return NextResponse.json({ animals: animalsWithScores });
  } catch (err) {
    console.error('❌ Error in search route:', err);
    return NextResponse.json({ animals: [] }, { status: 500 });
  }
}
