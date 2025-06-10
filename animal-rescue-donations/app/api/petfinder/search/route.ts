import { NextResponse } from 'next/server';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { findBestBreedMatch } from '@/app/api/utils/fuzzyBreedMatch';

// Scoring system for dog visibility
function calculateVisibilityScore(dog: any): number {
  let score = 0;

  // Days listed scoring (higher = more overlooked)
  if (dog.published_at) {
    const publishedDate = new Date(dog.published_at);
    const now = new Date();
    const daysListed = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
    score += daysListed; // Add 1 point per day listed
  }

  // Photo penalty (fewer photos = more overlooked)
  const photoCount = dog.photos?.length || 0;
  if (photoCount === 0) score += 50;
  else if (photoCount === 1) score += 25;
  else if (photoCount === 2) score += 10;

  // Description penalty (shorter description = less attention)
  const description = dog.description || '';
  if (description.length < 100) score += 30;
  else if (description.length < 200) score += 15;

  // Age bonus (seniors often overlooked)
  if (dog.age === 'Senior') score += 20;
  else if (dog.age === 'Adult') score += 10;

  // Size penalty (large dogs often overlooked)
  if (dog.size === 'Large' || dog.size === 'Extra Large') score += 15;

  // Mixed breed bonus (often overlooked vs pure breeds)
  if (dog.breeds?.mixed) score += 10;

  // Special needs bonus
  if (dog.attributes?.special_needs) score += 25;

  return score;
}

export async function POST(req: Request) {
  try {
    const { location, breed } = await req.json();

    console.log('[🔍 Petfinder Search] Starting search:', { location, breed });

    // Get access token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[❌ Petfinder Search] Failed to get access token');
      return NextResponse.json({ error: 'Failed to authenticate with Petfinder' }, { status: 500 });
    }

    // Build search URL
    const baseUrl = 'https://api.petfinder.com/v2/animals';
    const params = new URLSearchParams({
      type: 'dog',
      status: 'adoptable',
      limit: '100', // Get more results for better sorting
    });

    // Add location if provided
    if (location && location !== 'null') {
      params.append('location', location);
      params.append('distance', '100'); // Search within 100 miles
    }

    // Handle breed search with fuzzy matching
    if (breed && breed !== 'null') {
      const breedMatch = await findBestBreedMatch(breed);
      if (breedMatch) {
        console.log(`[🐕 Breed Match] "${breed}" → "${breedMatch}"`);
        params.append('breed', breedMatch);
      }
    }

    const searchUrl = `${baseUrl}?${params.toString()}`;
    console.log('[📡 API Call] Fetching:', searchUrl);

    // Make API request
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ Petfinder API Error]:', response.status, errorText);
      return NextResponse.json({ 
        error: 'Failed to search Petfinder',
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[✅ API Success] Found ${data.animals?.length || 0} dogs`);

    // Calculate visibility scores and sort by most overlooked
    if (data.animals) {
      data.animals = data.animals.map(dog => ({
        ...dog,
        visibilityScore: calculateVisibilityScore(dog)
      })).sort((a, b) => b.visibilityScore - a.visibilityScore);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('[❌ Petfinder Search Error]:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}