import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, clearTokenCache } from '@/app/api/utils/tokenManager';
import { createClient } from '@supabase/supabase-js';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> | { dogId: string } }
) {
  // Handle both sync and async params properly
  const resolvedParams = await Promise.resolve(params);
  const { dogId } = resolvedParams;

  console.log(`[🐕 Dog Details] Fetching details for dogId: ${dogId}`);
  console.log(`[🐕 Dog Details] Type of dogId: ${typeof dogId}`);
  console.log(`[🐕 Dog Details] dogId is truthy: ${!!dogId}`);

  if (!dogId || dogId === 'undefined' || typeof dogId !== 'string') {
    console.error(`[❌ No dogId available]`);
    return NextResponse.json({ error: 'Dog ID is required' }, { status: 400 });
  }

  try {
    // First try database for full dog details
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`[📊 Database] Checking for dog ${dogId} in database first`);
    const { data: dbDog, error: dbError } = await supabase
      .from('dogs')
      .select('*')
      .eq('petfinder_id', dogId)
      .single();

    if (!dbError && dbDog) {
      console.log(`[✅ Database] Found dog ${dogId} in database`);
      
      const formattedDog = {
        id: dbDog.petfinder_id,
        name: dbDog.name,
        breeds: { 
          primary: dbDog.primary_breed, 
          secondary: dbDog.secondary_breed,
          mixed: dbDog.is_mixed 
        },
        age: dbDog.age,
        size: dbDog.size,
        gender: dbDog.gender,
        photos: (dbDog.photos && Array.isArray(dbDog.photos) && dbDog.photos.length > 0) 
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
        contact: { 
          address: { 
            city: dbDog.city || 'Unknown', 
            state: dbDog.state || 'Unknown'
          }
        },
        description: dbDog.description,
        attributes: {
          special_needs: dbDog.special_needs,
          spayed_neutered: dbDog.spayed_neutered,
          house_trained: dbDog.house_trained,
          shots_current: dbDog.shots_current
        },
        colors: {
          primary: dbDog.primary_color,
          secondary: dbDog.secondary_color,
          tertiary: dbDog.tertiary_color
        },
        environment: {
          children: dbDog.good_with_children,
          dogs: dbDog.good_with_dogs,
          cats: dbDog.good_with_cats
        },
        url: dbDog.url,
        organization_id: dbDog.organization_id,
        type: dbDog.type,
        species: dbDog.species,
        tags: Array.isArray(dbDog.tags) ? dbDog.tags : [],
        status: dbDog.status
      };

      // Calculate real visibility score using the actual algorithm
      formattedDog.visibilityScore = calculateVisibilityScore(formattedDog);
      
      return NextResponse.json({ animal: formattedDog });
    }

    // Fallback to Petfinder API if not in database
    console.log(`[📡 Petfinder] Dog ${dogId} not in database, fetching from Petfinder API`);
    
    let accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[❌ Token Error] Failed to get Petfinder access token');
      return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }

    const petfinderUrl = `https://api.petfinder.com/v2/animals/${dogId}`;
    console.log('[📡 Fetching from Petfinder]:', petfinderUrl);

    let response = await fetch(petfinderUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000)
    });

    // Retry once with new token if unauthorized
    if (response.status === 401) {
      console.log('[🔄 Retrying] Getting new access token...');
      clearTokenCache(); // Clear the cached token
      accessToken = await getAccessToken(true); // Force refresh
      if (!accessToken) {
        console.error('[❌ Token Retry Error] Failed to get new Petfinder access token');
        return NextResponse.json({ error: 'Authentication failed after retry' }, { status: 500 });
      }

      response = await fetch(petfinderUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000)
      });
    }

    if (!response.ok) {
      console.error('[❌ Petfinder API Error]', response.status, await response.text());
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    const data = await response.json();
    const dog = data.animal;

    if (!dog) {
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    // Calculate real visibility score using the actual algorithm
    dog.visibilityScore = calculateVisibilityScore(dog);

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