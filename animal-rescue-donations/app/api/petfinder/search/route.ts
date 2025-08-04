import { NextResponse } from 'next/server';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { searchDogs } from '@/lib/supabase';
import { RescueGroupsAPI } from '@/lib/rescuegroups';
import { SearchNormalizer } from '@/lib/searchNormalizer';
import { DogFormatter, UnifiedDog } from '@/lib/dogFormatter';
import { findBestBreedMatch } from '@/app/api/utils/fuzzyBreedMatch';

// Rate limiting state
let lastRequestTime = 0;
let requestCount = 0;
let rateLimitResetTime = 0;
const MAX_REQUESTS_PER_MINUTE = 50;
const RATE_LIMIT_WINDOW = 60 * 1000;

export async function POST(req: Request) {
  console.log('[🔍 Enhanced Search] Starting priority waterfall search');

  let allDogs: UnifiedDog[] = [];
  let sources: string[] = [];
  let normalizedParams: any = {};

  try {
    const requestBody = await req.json();
    console.log('[📋 Raw Input]', requestBody);

    // Normalize search parameters
    normalizedParams = SearchNormalizer.normalizeSearchParams(requestBody);
    console.log('[🧼 Normalized Params]', normalizedParams);

    // 🏆 PHASE 1: Database Search (Highest Priority)
    if (normalizedParams.location) {
      try {
        console.log('[💾 Database] Searching database first...');
        const dbDogs = await searchDogs(
          normalizedParams.location,
          normalizedParams.breed,
          50, // Limit database results to leave room for API results
          normalizedParams.size,
          normalizedParams.age
        );

        if (dbDogs && dbDogs.length > 0) {
          console.log(`[✅ Database Hit] Found ${dbDogs.length} dogs in database`);
          const formattedDbDogs = dbDogs.map(DogFormatter.formatDatabaseDog);
          allDogs = allDogs.concat(formattedDbDogs);
          sources.push('database');
        }
      } catch (dbError) {
        console.warn('[⚠️ Database Warning] Database search failed:', dbError);
      }
    }

    // 🦮 PHASE 2: RescueGroups Search (Second Priority)
    if (allDogs.length < normalizedParams.limit!) {
      try {
        console.log('[🦮 RescueGroups] Searching RescueGroups...');
        const rescueGroups = new RescueGroupsAPI();

        const rgParams = {
          location: normalizedParams.location,
          breed: normalizedParams.breed,
          age: normalizedParams.age,
          size: normalizedParams.size,
          gender: normalizedParams.gender,
          limit: Math.min(50, normalizedParams.limit! - allDogs.length),
          radius: normalizedParams.radius
        };

        const rgResult = await rescueGroups.searchAnimals(rgParams);

        if (rgResult && rgResult.animals && rgResult.animals.length > 0) {
          console.log(`[✅ RescueGroups Hit] Found ${rgResult.animals.length} dogs from RescueGroups`);
          console.log(`[🔍 RG Included] Processing with ${rgResult.included?.length || 0} included items`);
          const formattedRgDogs = rgResult.animals.map(dog => 
            DogFormatter.formatRescueGroupsDog(dog, rgResult.included || [])Result.included)
          );

          // Minimal filtering since RescueGroups API should already return correctly filtered results
          const filteredRgDogs = formattedRgDogs.filter(rgDog => {
            // Only filter out obvious cats that somehow got through (should not happen with proper API filtering)
            const primaryBreed = (rgDog.breeds.primary || '').toLowerCase().trim();
            const catBreeds = ['domestic short hair', 'domestic long hair', 'tabby', 'tuxedo', 'tortoiseshell', 'calico', 'siamese', 'persian', 'maine coon'];
            
            if (catBreeds.some(catBreed => primaryBreed.includes(catBreed))) {
              console.log(`[🚫 Species Filter] Excluding ${rgDog.name} - ${rgDog.breeds.primary} appears to be a cat`);
              return false;
            }

            // Trust the API filtering - if RescueGroups returned it, it should match our criteria
            console.log(`[✅ API Trusted] Including ${rgDog.name} - ${rgDog.breeds.primary} (trusting API filters)`);
            return true;
          });

          // Deduplicate against existing dogs (by name + basic characteristics)
          const newRgDogs = filteredRgDogs.filter(rgDog => {
            return !allDogs.some(existingDog => {
              const nameMatch = existingDog.name.toLowerCase().trim() === rgDog.name.toLowerCase().trim();
              const breedMatch = existingDog.breeds.primary === rgDog.breeds.primary;
              const ageMatch = existingDog.age === rgDog.age;
              return nameMatch && (breedMatch || ageMatch);
            });
          });

          console.log(`[🔄 Deduplication] ${formattedRgDogs.length - newRgDogs.length} duplicates removed from RescueGroups`);
          allDogs = allDogs.concat(newRgDogs);
          sources.push('rescuegroups');
        }
      } catch (rgError) {
        console.warn('[⚠️ RescueGroups Fallback] RescueGroups search failed:', rgError);
      }
    }

    // 🐾 PHASE 3: Petfinder Search (Fallback)
    if (allDogs.length < normalizedParams.limit! && normalizedParams.location) {
      try {
        console.log('[🐾 Petfinder] Falling back to Petfinder API...');
        console.log(`[📊 Current Results] ${allDogs.length} dogs found so far, need ${normalizedParams.limit! - allDogs.length} more`);

        // Rate limiting check with enhanced logging
        const now = Date.now();
        if (now > rateLimitResetTime) {
          requestCount = 0;
          rateLimitResetTime = now + RATE_LIMIT_WINDOW;
          console.log('[🔄 Rate Limit] Reset rate limit window');
        }

        if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
          console.warn('[⚠️ Internal Rate Limit] Petfinder rate limit reached, returning partial results');
          // Still return what we have instead of failing completely
        } else {
          // Ensure minimum time between requests
          const timeSinceLastRequest = now - lastRequestTime;
          if (timeSinceLastRequest < 1000) {
            const waitTime = 1000 - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }

          requestCount++;
          lastRequestTime = Date.now();

          const accessToken = await getAccessToken();
          if (!accessToken) {
            throw new Error('Failed to get Petfinder access token');
          }

          const baseUrl = 'https://api.petfinder.com/v2/animals';
          const params = new URLSearchParams({
            type: 'dog',
            status: 'adoptable',
            limit: Math.min(100, normalizedParams.limit! - allDogs.length).toString(),
          });

          if (normalizedParams.location) {
            params.append('location', normalizedParams.location);
            params.append('distance', normalizedParams.radius!.toString());
          }

          if (normalizedParams.breed) {
            const bestMatch = await findBestBreedMatch(normalizedParams.breed);
            if (bestMatch) {
              params.append('breed', bestMatch);
            }
          }

          if (normalizedParams.age) {
            params.append('age', normalizedParams.age);
          }

          if (normalizedParams.size) {
            params.append('size', normalizedParams.size);
          }

          if (normalizedParams.gender) {
            params.append('gender', normalizedParams.gender);
          }

          const searchUrl = `${baseUrl}?${params.toString()}`;
          console.log('[📡 Petfinder] Fetching:', searchUrl);

          const response = await fetch(searchUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();

            if (data.animals && data.animals.length > 0) {
              console.log(`[✅ Petfinder Hit] Found ${data.animals.length} dogs from Petfinder`);
              const formattedPfDogs = data.animals.map(DogFormatter.formatPetfinderDog);

              // Deduplicate against existing dogs
              const newPfDogs = formattedPfDogs.filter(pfDog => {
                return !allDogs.some(existingDog => {
                  const nameMatch = existingDog.name.toLowerCase().trim() === pfDog.name.toLowerCase().trim();
                  const breedMatch = existingDog.breeds.primary === pfDog.breeds.primary;
                  return nameMatch && breedMatch;
                });
              });

              console.log(`[🔄 Deduplication] ${formattedPfDogs.length - newPfDogs.length} duplicates removed from Petfinder`);
              allDogs = allDogs.concat(newPfDogs);
              sources.push('petfinder');
            }
          } else {
            const errorText = await response.text().catch(() => 'Unable to read error response');
            console.warn('[⚠️ Petfinder] API response failed:', {
              status: response.status,
              statusText: response.statusText,
              error: errorText.substring(0, 200) // First 200 chars of error
            });

            // Check if it's a rate limiting error
            if (response.status === 429) {
              console.warn('[🚫 Petfinder Rate Limited] External API rate limit hit');
            }
          }
        }
      } catch (pfError) {
        console.warn('[⚠️ Petfinder Fallback] Petfinder search failed:', pfError);
      }
    }

    // 🏆 FINAL PROCESSING: Sort by visibility score and format response
    const sortedDogs = DogFormatter.sortByVisibilityScore(allDogs.slice(0, normalizedParams.limit));
    const legacyFormattedDogs = sortedDogs.map(DogFormatter.toLegacyFormat);

    console.log(`[✅ Search Complete] Found ${sortedDogs.length} total dogs from sources: ${sources.join(', ')}`);
    console.log(`[📊 Source Breakdown] ${sources.map(source => {
      const count = sortedDogs.filter(dog => dog.source === source).length;
      return `${source}: ${count}`;
    }).join(', ')}`);

    return NextResponse.json({
      animals: legacyFormattedDogs,
      sources: sources,
      total: sortedDogs.length,
      searchStrategy: 'priority-waterfall',
      sourceBreakdown: sources.reduce((acc, source) => {
        const count = sortedDogs.filter(dog => dog.source === source).length;
        acc[source] = count;
        return acc;
      }, {} as Record<string, number>)
    });

  } catch (err) {
    console.error('[❌ Search Error]', err);

    // Return partial results if we have any, even with errors
    if (allDogs && allDogs.length > 0) {
      console.log(`[⚠️ Partial Success] Returning ${allDogs.length} dogs despite errors`);
      const sortedDogs = DogFormatter.sortByVisibilityScore(allDogs.slice(0, normalizedParams.limit || 50));
      const legacyFormattedDogs = sortedDogs.map(DogFormatter.toLegacyFormat);

      return NextResponse.json({
        animals: legacyFormattedDogs,
        sources: sources,
        total: sortedDogs.length,
        searchStrategy: 'priority-waterfall-partial',
        warning: 'Some sources failed but returning available results',
        error: err instanceof Error ? err.message : 'Partial failure'
      });
    }

    return NextResponse.json({
      error: 'Search failed completely',
      details: err instanceof Error ? err.message : 'Unknown error',
      searchedSources: sources.length > 0 ? sources : ['none'],
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'GET method not supported. Use POST with body: { location, breed, age, size, gender }' },
    { status: 405 }
  );
}