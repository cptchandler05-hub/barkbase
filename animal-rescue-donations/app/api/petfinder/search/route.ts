import { NextResponse } from 'next/server';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { findBestBreedMatch } from '@/app/api/utils/fuzzyBreedMatch';

function calculateVisibilityScore(dog: any): number {
  let score = 0;

  // Days listed
  if (dog.published_at) {
    const daysListed = Math.floor((Date.now() - new Date(dog.published_at).getTime()) / (1000 * 60 * 60 * 24));
    score += daysListed;
  }

  // Photo penalty
  const photoCount = dog.photos?.length || 0;
  if (photoCount === 0) score += 50;
  else if (photoCount === 1) score += 25;
  else if (photoCount === 2) score += 10;

  // Description length
  const description = dog.description || '';
  if (description.length < 100) score += 30;
  else if (description.length < 200) score += 15;

  // Age bonus
  if (dog.age === 'Senior') score += 20;
  else if (dog.age === 'Adult') score += 10;

  // Size penalty
  if (dog.size === 'Large' || dog.size === 'Extra Large') score += 15;

  // Mixed breed bonus
  if (dog.breeds?.mixed) score += 10;

  // Special needs bonus
  if (dog.attributes?.special_needs) score += 25;

  return score;
}

export async function POST(req: Request) {
  try {
    const { location, breed } = await req.json();
    console.log('[🔍 Petfinder Search] Input:', { location, breed });

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[❌ Token Error] Failed to get Petfinder access token');
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
    }

    const baseUrl = 'https://api.petfinder.com/v2/animals';
    const params = new URLSearchParams({
      type: 'dog',
      status: 'adoptable',
      limit: '100',
    });

    if (location && location !== 'null') {
      params.append('location', location);
      params.append('distance', '100');
    }

    if (breed && breed !== 'null') {
      const bestMatch = await findBestBreedMatch(breed);
      if (bestMatch) {
        console.log(`[🐾 Fuzzy Breed Match] "${breed}" → "${bestMatch}"`);
        params.append('breed', bestMatch);
      }
    }

    const searchUrl = `${baseUrl}?${params.toString()}`;
    console.log('[📡 Fetching]:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ API Error]', response.status, errorText);
      return NextResponse.json({ error: 'Petfinder API error', details: errorText }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[✅ Petfinder Success] Found ${data.animals?.length || 0} dogs`);

    if (data.animals) {
      data.animals = data.animals.map(dog => ({
        ...dog,
        visibilityScore: calculateVisibilityScore(dog),
      })).sort((a, b) => b.visibilityScore - a.visibilityScore);
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[❌ Internal Error]', err);
    return NextResponse.json({
      error: 'Unexpected server error',
      details: err instanceof Error ? err.message : 'Unknown failure',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'GET method not supported. Use POST with body: { location, breed }' },
    { status: 405 }
  );
}
