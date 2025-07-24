import { NextResponse } from 'next/server';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { findBestBreedMatch } from '@/app/api/utils/fuzzyBreedMatch';
type Dog = { [key: string]: any };

export async function POST(req: Request) {
  try {
    console.log('[🐾 /api/petfinder/search hit]');
    
    let { location, breed } = await req.json();

    // 🧼 Trim and normalize user input
    location = typeof location === 'string' ? location.trim().toLowerCase() : '';
    breed = typeof breed === 'string' ? breed.trim().toLowerCase() : '';

    // 📍 Normalize 3+ word cities (e.g., "san luis obispo ca" → "san luis obispo, ca")
    // 📍 Normalize ZIP or 3+ word cities
    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(location)) {
      const locationParts = location.split(/\s+/);
      if (locationParts.length >= 3) {
        const state = locationParts.pop();
        const city = locationParts.join(' ');
        location = `${city}, ${state}`;
      }
      // If it's 1–2 words, leave as-is and fall through to 2-letter state logic below
    }

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

    if (location && location.toLowerCase() !== 'null') {
      // Normalize "city state" → "city, state" if applicable
      const locParts = location.trim().split(" ");
      if (
        locParts.length === 2 &&
        /^[a-z]{2}$/i.test(locParts[1])
      ) {
        location = `${locParts[0]}, ${locParts[1]}`;
      }

      // ✅ Final cleanup: remove accidental double commas, extra spaces
      location = location
        .replace(/\s{2,}/g, ' ')        // collapse multiple spaces
        .replace(/,+/g, ',')            // collapse multiple commas
        .replace(/\s*,\s*/g, ', ')      // normalize comma spacing
        .trim();

      params.append('location', location);
      params.append('distance', '100');
    }

    if (breed && breed.toLowerCase() !== 'null') {
      const normalizedBreed =
        breed.endsWith('s') && breed.length > 3
          ? breed.slice(0, -1)
          : breed;

      const bestMatch = await findBestBreedMatch(normalizedBreed);
      if (bestMatch) {
        const safeBreed = bestMatch;
        console.log(`[🐾 Fuzzy Breed Match] "${breed}" → "${bestMatch}"`);
        params.append('breed', safeBreed);
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

      const isBadLocation = errorText.includes('"path":"location"') || errorText.toLowerCase().includes('could not determine location');

      return NextResponse.json({
        error: 'Petfinder API error',
        details: errorText,
        invalidLocation: isBadLocation
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[✅ Petfinder Success] Found ${data.animals?.length || 0} dogs`);

    if (data.animals) {
      // First, add visibility scores and sort
      data.animals = data.animals.map((dog: Dog) => ({
        ...dog,
        visibilityScore: calculateVisibilityScore(dog),
      })).sort((a: Dog, b: Dog) => b.visibilityScore - a.visibilityScore);

      // For dogs with missing or truncated descriptions, fetch full details
      const dogsNeedingFullDetails = data.animals.filter((dog: Dog) => 
        !dog.description || 
        dog.description.length < 100 || 
        dog.description.includes('...') ||
        dog.description.includes('..') ||
        dog.description.trim().endsWith('...')
      );

      console.log(`[🔍 Full Details Needed] ${dogsNeedingFullDetails.length} dogs need full descriptions`);

      if (dogsNeedingFullDetails.length > 0) {
        // Reduce concurrent requests - only fetch details for first 5 dogs to avoid rate limits
        const dogsToUpdate = dogsNeedingFullDetails.slice(0, 5);
        console.log(`[🔍 Full Details] Processing ${dogsToUpdate.length} dogs sequentially`);
        
        let updatedCount = 0;
        
        // Process dogs sequentially to avoid rate limits
        for (let i = 0; i < dogsToUpdate.length; i++) {
          const dog = dogsToUpdate[i];
          
          try {
            // Add delay between each request
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            let detailResponse = await fetch(`https://api.petfinder.com/v2/animals/${dog.id}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            // Handle rate limit specifically
            if (detailResponse.status === 429) {
              console.warn(`[⚠️ Rate Limited] Skipping remaining detail fetches`);
              break;
            }
            
            // If we get 401, try once with fresh token
            if (detailResponse.status === 401) {
              console.log(`[🔄 Token Refresh] Retrying dog ${dog.id} with fresh token`);
              const freshToken = await getAccessToken(true);
              detailResponse = await fetch(`https://api.petfinder.com/v2/animals/${dog.id}`, {
                headers: {
                  Authorization: `Bearer ${freshToken}`,
                  'Content-Type': 'application/json',
                },
              });
            }
            
            if (detailResponse.ok) {
              const fullData = await detailResponse.json();
              const fullDescription = fullData.animal?.description;
              
              if (fullDescription && fullDescription.length > 50 && !fullDescription.includes('...')) {
                console.log(`[📝 Full Description Retrieved] ${dog.name}: ${fullDescription.length} chars`);
                
                // Update the dog directly in the array
                const dogIndex = data.animals.findIndex((d: Dog) => d.id === dog.id);
                if (dogIndex !== -1) {
                  data.animals[dogIndex].description = fullDescription;
                  updatedCount++;
                }
              }
            } else {
              console.warn(`[⚠️ Detail API Error] Dog ${dog.id}: ${detailResponse.status}`);
            }
          } catch (error) {
            console.warn(`[❌ Failed Detail Fetch] Dog ${dog.id}:`, error);
          }
        }
        
        console.log(`[✅ Descriptions Updated] ${updatedCount}/${dogsToUpdate.length} dogs got full descriptions`);
      }
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
