
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, clearTokenCache } from '@/app/api/utils/tokenManager';

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  request: Request,
  { params }: { params: { dogId: string } }
) {
  try {
    console.log(`[🔍 API] Getting dog details for ID: ${params.dogId}`);

    if (!params.dogId) {
      console.error(`[❌ API] No dogId provided`);
      return NextResponse.json({ error: 'Dog ID is required' }, { status: 400 });
    }

    // First check database for basic info and visibility score
    let dbDog = null;
    try {
      const { getDogById, isSupabaseAvailable } = await import('@/lib/supabase');

      if (isSupabaseAvailable()) {
        dbDog = await getDogById(params.dogId);
        console.log(`[📊 DB] Database lookup: ${dbDog ? 'found' : 'not found'}`);
      }
    } catch (dbError) {
      console.warn(`[⚠️ DB] Database error:`, dbError);
    }

    let dog = null;

    // Try to fetch from Petfinder with token retry logic
    let accessToken = await getAccessToken();
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[🔄 API] Attempt ${attempts}/${maxAttempts} for dog ${params.dogId}`);

      try {
        const response = await fetch(`${PETFINDER_API_URL}/animals/${params.dogId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'BarkBase/1.0'
          },
          // Add timeout
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (response.ok) {
          const data = await response.json();
          dog = data.animal;
          console.log(`[✅ API Success] Got dog: ${dog.name}`);
          break;
        }

        if (response.status === 404) {
          console.log(`[❌ API] Dog ${params.dogId} not found in Petfinder`);
          
          // If we have database data, use that instead
          if (dbDog) {
            console.log(`[📊 Fallback] Using database data for dog ${params.dogId}`);
            dog = formatDatabaseDog(dbDog);
            break;
          }
          
          return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
        }

        if (response.status === 401 && attempts < maxAttempts) {
          console.log(`[🔄 Auth] Token expired, getting fresh token (attempt ${attempts})`);
          await clearTokenCache();
          accessToken = await getAccessToken(true); // Force refresh
          continue;
        }

        // Log other errors but try to continue
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[❌ API] Error ${response.status}: ${errorText}`);
        
        if (attempts === maxAttempts) {
          // Last attempt failed, try database fallback
          if (dbDog) {
            console.log(`[📊 Final Fallback] Using database data after API failure`);
            dog = formatDatabaseDog(dbDog);
            break;
          }
          throw new Error(`Petfinder API error: ${response.status}`);
        }

      } catch (fetchError) {
        console.error(`[❌ Fetch] Request failed:`, fetchError);
        
        if (attempts === maxAttempts) {
          // Last attempt failed, try database fallback
          if (dbDog) {
            console.log(`[📊 Final Fallback] Using database data after fetch error`);
            dog = formatDatabaseDog(dbDog);
            break;
          }
          throw fetchError;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    if (!dog) {
      console.log(`[❌ No Data] No dog data found for ${params.dogId}`);
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    // Enhance with database visibility score if available
    if (dbDog?.visibility_score !== undefined) {
      dog.visibilityScore = dbDog.visibility_score;
    } else {
      // Calculate visibility score if not in database
      const { calculateVisibilityScore } = await import('@/lib/scoreVisibility');
      dog.visibilityScore = calculateVisibilityScore(dog);
    }

    // Ensure photos are properly formatted
    if (dog.photos && Array.isArray(dog.photos)) {
      dog.photos = dog.photos.filter(photo => photo && (photo.medium || photo.large || photo.small));
      
      // If no valid photos, add placeholder
      if (dog.photos.length === 0) {
        dog.photos = [{
          small: '/images/barkr.png',
          medium: '/images/barkr.png',
          large: '/images/barkr.png',
          full: '/images/barkr.png'
        }];
      }
    } else {
      // No photos array, add placeholder
      dog.photos = [{
        small: '/images/barkr.png',
        medium: '/images/barkr.png',
        large: '/images/barkr.png',
        full: '/images/barkr.png'
      }];
    }

    console.log(`[✅ Success] Returning dog: ${dog.name} with ${dog.photos.length} photos`);
    return NextResponse.json({ animal: dog });

  } catch (error) {
    console.error('[❌ Error] Failed to fetch dog:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch dog details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper function to format database dog data
function formatDatabaseDog(dbDog: any) {
  return {
    id: parseInt(dbDog.petfinder_id),
    name: dbDog.name,
    breeds: {
      primary: dbDog.primary_breed,
      secondary: dbDog.secondary_breed,
      mixed: dbDog.is_mixed
    },
    age: dbDog.age,
    size: dbDog.size,
    gender: dbDog.gender,
    photos: Array.isArray(dbDog.photos) && dbDog.photos.length > 0 
      ? dbDog.photos.map(photo => {
          if (typeof photo === 'string') {
            return { medium: photo, large: photo, small: photo, full: photo };
          } else if (photo && typeof photo === 'object') {
            return {
              medium: photo.medium || photo.large || photo.small || '/images/barkr.png',
              large: photo.large || photo.medium || photo.small || '/images/barkr.png',
              small: photo.small || photo.medium || photo.large || '/images/barkr.png',
              full: photo.full || photo.large || photo.medium || '/images/barkr.png'
            };
          }
          return { medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png', full: '/images/barkr.png' };
        })
      : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png', full: '/images/barkr.png' }],
    contact: (typeof dbDog.contact_info === 'object' && dbDog.contact_info) ? dbDog.contact_info : {
      address: {
        city: dbDog.city,
        state: dbDog.state,
        postcode: dbDog.postcode
      }
    },
    description: dbDog.description,
    url: dbDog.url,
    visibilityScore: dbDog.visibility_score || 50,
    organization_id: dbDog.organization_id,
    type: dbDog.type,
    species: dbDog.species,
    colors: {
      primary: dbDog.primary_color,
      secondary: dbDog.secondary_color,
      tertiary: dbDog.tertiary_color
    },
    attributes: {
      spayed_neutered: dbDog.spayed_neutered,
      house_trained: dbDog.house_trained,
      special_needs: dbDog.special_needs,
      shots_current: dbDog.shots_current
    },
    environment: {
      children: dbDog.good_with_children,
      dogs: dbDog.good_with_dogs,
      cats: dbDog.good_with_cats
    },
    tags: Array.isArray(dbDog.tags) ? dbDog.tags : [],
    status: dbDog.status
  };
}
