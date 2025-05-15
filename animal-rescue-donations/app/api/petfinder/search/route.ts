import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '../../utils/tokenManager';
import { getBreeds } from '../../utils/getBreeds';
import { findBestMatchingBreed } from '../../utils/fuzzyBreedMatch';

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
    console.log(`🐶 Found ${data.animals?.length || 0} dogs from Petfinder`);
    return NextResponse.json(data);
  } catch (err) {
    console.error('❌ Error in search route:', err);
    return NextResponse.json({ animals: [] }, { status: 500 });
  }
}
