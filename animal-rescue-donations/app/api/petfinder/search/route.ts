import { NextResponse } from 'next/server';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { searchDogs, getAllDogs } from '@/lib/supabase';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { findBestBreedMatch } from '@/app/api/utils/fuzzyBreedMatch';
type Dog = { [key: string]: any };

// Rate limiting state
let lastRequestTime = 0;
let requestCount = 0;
let rateLimitResetTime = 0;
const MAX_REQUESTS_PER_MINUTE = 50;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

export async function POST(req: Request) {
  console.log('[🔍 /api/petfinder/search] Starting search request');

  try {
    // Parse request body only once
    const requestBody = await req.json();
    const { location: rawLocation, breed: rawBreed } = requestBody;
    console.log('[📋 Raw Input]', { location: rawLocation, breed: rawBreed });

    // 🔥 Try database first if we have a valid location/breed
    if (rawLocation && rawLocation.trim() && rawLocation !== 'null') {
      try {
        console.log('[💾 Database] Trying database search first...');
        const dbDogs = await searchDogs(rawLocation.trim(), rawBreed?.trim());

        if (dbDogs && dbDogs.length > 0) {
          console.log(`[✅ Database Hit] Found ${dbDogs.length} dogs in database`);

          // Transform database dogs to API format
          const formattedDogs = dbDogs.map(dog => ({
            id: parseInt(dog.petfinder_id),
            organization_id: dog.organization_id,
            name: dog.name,
            breeds: {
              primary: dog.breed_primary,
              secondary: dog.breed_secondary,
              mixed: dog.breed_secondary ? true : false
            },
            age: dog.age,
            gender: dog.gender,
            size: dog.size,
            description: dog.description,
            photos: dog.photos.map(url => ({ large: url, medium: url, small: url })),
            contact: { address: { city: dog.location.split(',')[0], state: dog.location.split(',')[1] } },
            visibilityScore: dog.visibility_score
          }));

          return NextResponse.json({
            animals: formattedDogs,
            source: 'database',
            total: formattedDogs.length
          });
        }
      } catch (dbError) {
        console.warn('[⚠️ Database Fallback] Database search failed, using live API:', dbError);
      }
    }

    // 🌐 Fall back to live Petfinder API
    console.log('[🐾 /api/petfinder/search hit]');

    // Check rate limiting
    const now = Date.now();
    if (now > rateLimitResetTime) {
      requestCount = 0;
      rateLimitResetTime = now + RATE_LIMIT_WINDOW;
    }

    if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
      console.warn('[⚠️ Internal Rate Limit] Too many requests, backing off');
      return NextResponse.json({
        error: 'Too many requests, please try again in a moment',
        retryAfter: Math.ceil((rateLimitResetTime - now) / 1000)
      }, { status: 429 });
    }

    // Ensure minimum time between requests
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < 1000) { // 1 second minimum between requests
      const waitTime = 1000 - timeSinceLastRequest;
      console.log(`[⏳ Rate Limiting] Waiting ${waitTime}ms before request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    requestCount++;
    lastRequestTime = Date.now();

    // Use the already parsed request body
    let { location, breed } = requestBody;

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

      // Handle rate limit specifically
      if (response.status === 429) {
        console.error('[❌ Rate Limit Hit] Petfinder API rate limit exceeded');
        return NextResponse.json({
          error: 'API rate limit exceeded',
          details: 'Please try again in a few minutes',
          retryAfter: 300 // 5 minutes
        }, { status: 429 });
      }

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
        // Further reduce concurrent requests - only fetch details for first 3 dogs to avoid rate limits
        const dogsToUpdate = dogsNeedingFullDetails.slice(0, 3);
        console.log(`[🔍 Full Details] Processing ${dogsToUpdate.length} dogs sequentially`);

        let updatedCount = 0;

        // Process dogs sequentially with longer delays to avoid rate limits
        for (let i = 0; i < dogsToUpdate.length; i++) {
          const dog = dogsToUpdate[i];

          try {
            // Add longer delay between each request
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // Increased to 1 second
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
              await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retry
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
              // If we hit rate limit on detail requests, stop trying
              if (detailResponse.status === 429) {
                console.warn(`[⚠️ Rate Limited on Details] Stopping detail fetches`);
                break;
              }
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