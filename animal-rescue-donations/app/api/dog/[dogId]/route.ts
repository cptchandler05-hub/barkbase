import { NextResponse } from 'next/server';
import { getDogById } from '@/lib/supabase';
import { RescueGroupsAPI } from '@/lib/rescuegroups';
import { DogFormatter } from '@/lib/dogFormatter';

// Petfinder token management
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5-minute buffer

  if (cachedToken && now < (tokenExpiresAt - buffer)) {
    return cachedToken;
  }

  // Ensure environment variables are available
  if (!process.env.PETFINDER_CLIENT_ID || !process.env.PETFINDER_CLIENT_SECRET) {
    console.error('[❌ Petfinder Auth] PETFINDER_CLIENT_ID or PETFINDER_CLIENT_SECRET not set.');
    throw new Error('Petfinder authentication credentials not configured.');
  }

  const res = await fetch('https://api.petfinder.com/v2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.PETFINDER_CLIENT_ID,
      client_secret: process.env.PETFINDER_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`[❌ Petfinder Auth] Failed to get Petfinder token: ${res.status} - ${errorBody}`);
    throw new Error(`Failed to get Petfinder token: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in * 1000);

  return cachedToken;
}

async function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

export async function GET(request: Request, { params }: { params: { dogId: string } }) {
  try {
    const { dogId } = params;
    console.log(`[🔍 Dog Lookup] Starting search for dogId: ${dogId}`);

    if (!dogId || dogId === 'undefined' || dogId === 'null') {
      console.error('[❌ Invalid ID] Invalid dogId provided:', dogId);
      return NextResponse.json({ error: 'Invalid dog ID' }, { status: 400 });
    }

    // 🏆 PHASE 1: Database Search
    let dbDogData = null;
    let source = 'database';

    try {
      console.log('[💾 Database] Searching database first...');

      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        // Try searching by our fallback ID patterns or direct database ID
        const { data: directDbData, error: directDbError } = await supabase
          .from('dogs')
          .select('*')
          .or(`id.eq.${dogId},petfinder_id.eq.${dogId},rescuegroups_id.eq.${dogId}`)
          .single();

        if (!directDbError && directDbData) {
          console.log('[✅ Database Hit] Found dog by direct ID search:', directDbData.name);
          dbDogData = directDbData;
        } else {
          console.log('[💾 Database] Not found by direct ID, trying legacy petfinder_id and rescuegroups_id...');
          let legacyDbDog = await getDogById(dogId); // Assumes getDogById handles petfinder_id (string/number)

          if (legacyDbDog) {
            dbDogData = legacyDbDog;
            console.log('[✅ Database Hit] Found by legacy lookup:', legacyDbDog.name);
          } else {
             // If not found by legacy lookup, try direct query for rescuegroups_id and petfinder_id again,
             // but this time more broadly, and prioritize adoptable status for petfinder_id.
            let { data: rgData, error: rgError } = await supabase
              .from('dogs')
              .select('*')
              .eq('rescuegroups_id', dogId)
              .single();

            if (rgData) {
              dbDogData = rgData;
              console.log('[✅ Database Hit] Found by rescuegroups_id:', rgData.name);
            } else {
              // Attempt to find by petfinder_id, checking both number and string representations
              const numericDogId = parseInt(dogId, 10);
              const isNumericString = !isNaN(numericDogId) && String(numericDogId) === dogId;

              const searchConditions = [
                isNumericString ? { eq: 'petfinder_id', value: numericDogId } : null,
                { eq: 'petfinder_id', value: dogId.toString() }, // Ensure it's treated as string if not numeric
              ].filter(Boolean); // Filter out nulls

              for (const condition of searchConditions) {
                if (condition) {
                  const { data: pfData, error: pfError } = await supabase
                    .from('dogs')
                    .select('*')
                    .eq('petfinder_id', condition.value)
                    .eq('status', 'adoptable') // Prioritize adoptable dogs
                    .single();
                  if (pfData) {
                    dbDogData = pfData;
                    console.log(`[✅ Database Hit] Found by petfinder_id (${condition.value}):`, pfData.name);
                    break; // Stop searching if found
                  }
                }
              }
            }
          }
        }
      } else {
        console.warn('[⚠️ Database Warning] Supabase environment variables not set. Skipping database lookup.');
      }
    } catch (dbError) {
      console.warn('[⚠️ Database Warning] Database lookup failed:', dbError);
      // Continue to external APIs if database lookup fails
    }

    if (dbDogData) {
      console.log('[✅ Database Hit] Found dog in database:', dbDogData.name);
      const formattedDog = {
        id: dbDogData.petfinder_id || dbDogData.rescuegroups_id || dbDogData.id,
        name: dbDogData.name,
        breeds: {
          primary: dbDogData.primary_breed,
          secondary: dbDogData.secondary_breed,
          mixed: dbDogData.is_mixed
        },
        age: dbDogData.age,
        size: dbDogData.size,
        gender: dbDogData.gender,
        photos: dbDogData.photos && Array.isArray(dbDogData.photos) && dbDogData.photos.length > 0
          ? dbDogData.photos.map((photo: any) => {
              if (typeof photo === 'string') {
                return { medium: photo, large: photo, small: photo };
              } else if (photo && typeof photo === 'object') {
                return {
                  medium: photo.medium || photo.large || photo.small || '/images/barkr.png',
                  large: photo.large || photo.medium || photo.small || '/images/barkr.png',
                  small: photo.small || photo.medium || photo.large || '/images/barkr.png'
                };
              }
              return { medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' };
            })
          : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' }],
        contact: {
          address: {
            address1: dbDogData.address1 || null,
            city: dbDogData.city || 'Unknown',
            state: dbDogData.state || 'Unknown',
            postcode: dbDogData.postcode || dbDogData.zip || null,
            country: dbDogData.country || 'US'
          },
          phone: dbDogData.phone || null,
          email: dbDogData.email || null
        },
        description: dbDogData.description || dbDogData.full_description || '', // Use full description if available
        url: dbDogData.url,
        attributes: {
          special_needs: dbDogData.special_needs,
          spayed_neutered: dbDogData.spayed_neutered,
          house_trained: dbDogData.house_trained,
          shots_current: dbDogData.shots_current
        },
        environment: {
          children: dbDogData.good_with_children,
          dogs: dbDogData.good_with_dogs,
          cats: dbDogData.good_with_cats
        },
        organization_id: dbDogData.organization_id,
        published_at: dbDogData.published_at,
        visibilityScore: dbDogData.visibility_score || 0
      };

      console.log('[📞 Contact Debug] Formatted dog contact info:', formattedDog.contact);
      return NextResponse.json({
        animal: formattedDog,
        source: source
      });
    }

    // 🦮 PHASE 2: Petfinder API Search (if not found in DB)
    try {
      console.log('[🐾 Petfinder] Searching Petfinder API...');
      let accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error('Failed to get Petfinder access token');
      }

      let response = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // If we get 401, try refreshing the token once
      if (response.status === 401) {
        console.log('[🔄 Petfinder] Token expired, refreshing...');
        await clearTokenCache(); // Clear cache to force re-fetch
        accessToken = await getAccessToken();
        if (accessToken) {
          response = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });
        }
      }

      if (response.ok) {
        const freshApiData = await response.json();
        console.log('[✅ Petfinder Success] Found dog via Petfinder API');
        source = 'petfinder';

        if (freshApiData.animal) {
          // Attempt to format with data from the fresh API call
          const formattedDogFromApi = DogFormatter.formatPetfinderAnimal(freshApiData.animal);
          console.log('[📞 Contact Debug] Petfinder contact info:', formattedDogFromApi.contact);
          return NextResponse.json({ animal: formattedDogFromApi, source: source });
        }
      } else if (response.status === 404) {
        console.log('[❌ Not Found] Dog not found in Petfinder');
      } else {
        console.warn('[⚠️ Petfinder API Error]', response.status, await response.text());
      }
    } catch (pfError) {
      console.warn('[⚠️ Petfinder Warning] Petfinder lookup failed:', pfError);
    }

    // 😢 NOT FOUND: Dog not found in any source
    console.log(`[❌ Not Found] Dog with ID ${dogId} not found in any source`);
    return NextResponse.json({
      error: 'Dog not found',
      details: `Dog with ID ${dogId} was not found in database or Petfinder`,
      searchedSources: ['database', 'petfinder']
    }, { status: 404 });

  } catch (error) {
    console.error('[❌ Lookup Error]', error);
    // Typo fix: visibilityScore should be teVisibilityScore (assuming this was a past typo, keeping original structure)
    if (error instanceof Error && error.message.includes('visibilityScore')) {
        console.error('[❌ Lookup Error] Potentially a typo in visibilityScore, check teVisibilityScore.');
    }
    return NextResponse.json({
      error: 'Dog lookup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}