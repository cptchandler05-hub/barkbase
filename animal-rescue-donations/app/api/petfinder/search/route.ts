import { NextResponse } from 'next/server';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { findBestBreedMatch } from '@/app/api/utils/fuzzyBreedMatch';
type Dog = { [key: string]: any };

export async function POST(req: Request) {
  try {
    console.log('[🐾 /api/petfinder/search hit]');
    
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
      data.animals = data.animals.map((dog: Dog) => ({
        ...dog,
        visibilityScore: calculateVisibilityScore(dog),
        })).sort((a: Dog, b: Dog) => b.visibilityScore - a.visibilityScore);
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
