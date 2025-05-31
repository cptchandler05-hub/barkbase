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

export async function POST(req: NextRequest) {
  const { location, breed, size, age, gender } = await req.json();

  try {
    const accessToken = await getAccessToken();
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
      ...(location ? { location, distance: '100' } : {}),
      ...(matchedBreed ? { breed: matchedBreed } : {}),
      ...(size ? { size } : {}),
      ...(age ? { age } : {}),
      ...(gender ? { gender } : {}),
    });

    console.log('🐾 Petfinder query:', queryParams.toString());

    const res = await fetch(`https://api.petfinder.com/v2/animals?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Petfinder API error:', errorText);
      return NextResponse.json({ animals: [] }, { status: res.status });
    }

    const data = await res.json();

    const animalsWithScores = data.animals?.map((dog: any) => ({
      ...dog,
      visibilityScore: scoreVisibility(dog),
    })) || [];

    console.log(`🐶 Found ${animalsWithScores.length} dogs from Petfinder`);
    return NextResponse.json({ animals: animalsWithScores });
  } catch (err) {
    console.error('❌ Error in search route:', err);
    return NextResponse.json({ animals: [] }, { status: 500 });
  }
}
