import { NextResponse } from 'next/server';
import { getDogById } from '@/lib/supabase';
import { RescueGroupsAPI } from '@/lib/rescuegroups';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { DogFormatter } from '@/lib/dogFormatter';

export async function GET(request: Request, { params }: { params: { dogId: string } }) {
  try {
    const { dogId } = params;
    console.log(`[🔍 Dog Lookup] Starting search for dogId: ${dogId}`);

    if (!dogId || dogId === 'undefined' || dogId === 'null') {
      console.error('[❌ Invalid ID] Invalid dogId provided:', dogId);
      return NextResponse.json({ error: 'Invalid dog ID' }, { status: 400 });
    }

    // 🏆 PHASE 1: Database Search
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
          const formattedDog = DogFormatter.formatDatabaseDog(directDbData);
          return NextResponse.json({
            animal: DogFormatter.toLegacyFormat(formattedDog, false), // Don't truncate for individual dog pages
            source: 'database'
          });
        }

        // Legacy checks if direct search fails
        let dbDog = await getDogById(dogId); // Assumes getDogById handles petfinder_id (string/number)

        if (!dbDog) {
          console.log('[💾 Database] Not found by direct or legacy petfinder_id, trying rescuegroups_id...');
          let { data, error } = await supabase
            .from('dogs')
            .select('*')
            .eq('rescuegroups_id', dogId)
            .single();

          if (!data && !isNaN(Number(dogId))) {
            console.log('[💾 Database] Trying petfinder_id as number...');
            const result = await supabase
              .from('dogs')
              .select(`
                *,
                phone,
                email,
                address1,
                address2,
                city,
                state,
                postcode,
                country
              `)
              .eq('petfinder_id', Number(dogId))
              .eq('status', 'adoptable')
              .single();
            data = result.data;
            error = result.error;
          }

          if (!data && !isNaN(parseInt(dogId, 10)) && String(parseInt(dogId, 10)) === dogId) { // Check if dogId is a valid integer string
            console.log('[💾 Database] Trying petfinder_id as integer string...');
            const result = await supabase
              .from('dogs')
              .select(`
                *,
                phone,
                email,
                address1,
                address2,
                city,
                state,
                postcode,
                country
              `)
              .eq('petfinder_id', parseInt(dogId, 10))
              .eq('status', 'adoptable')
              .single();
            data = result.data;
            error = result.error;
          } else if (!data) { // If not an integer string, try as a plain string for petfinder_id
            console.log('[💾 Database] Trying petfinder_id as string...');
            const result = await supabase
              .from('dogs')
              .select(`
                *,
                phone,
                email,
                address1,
                address2,
                city,
                state,
                postcode,
                country
              `)
              .eq('petfinder_id', dogId.toString())
              .eq('status', 'adoptable')
              .single();
            data = result.data;
            error = result.error;
          }

          if (!error && data) {
            dbDog = data;
            console.log('[✅ Database Hit] Found by alternative ID lookup:', data.name);
          }
        }

        if (dbDog) {
          console.log('[✅ Database Hit] Found dog in database:', dbDog.name);
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
          photos: dbDog.photos && Array.isArray(dbDog.photos) && dbDog.photos.length > 0
            ? dbDog.photos.map((photo: any) => {
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
              address1: dbDog.address1 || '',
              city: dbDog.city || 'Unknown',
              state: dbDog.state || 'Unknown',
              postcode: dbDog.postcode || '',
              country: dbDog.country || 'US'
            },
            phone: dbDog.phone || null,
            email: dbDog.email || null
          },
          description: dbDog.description,
          url: dbDog.url,
          attributes: {
            special_needs: dbDog.special_needs,
            spayed_neutered: dbDog.spayed_neutered,
            house_trained: dbDog.house_trained,
            shots_current: dbDog.shots_current
          },
          environment: {
            children: dbDog.good_with_children,
            dogs: dbDog.good_with_dogs,
            cats: dbDog.good_with_cats
          },
          organization_id: dbDog.organization_id,
          published_at: dbDog.published_at,
          visibilityScore: dbDog.visibility_score || 0
        };

        console.log('[📞 Contact Debug] Formatted dog contact info:', formattedDog.contact);
          return NextResponse.json({
            animal: DogFormatter.toLegacyFormat(formattedDog, false), // Don't truncate for individual dog pages
            source: 'database'
          });
        }
      } else {
        console.warn('[⚠️ Database Warning] Supabase environment variables not set. Skipping database lookup.');
      }
    } catch (dbError) {
      console.warn('[⚠️ Database Warning] Database lookup failed:', dbError);
      // Continue to external APIs
    }

    // 🦮 PHASE 2: Petfinder API Search (RescueGroups API is only for sync)
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
        // Force token refresh by clearing cache
        const { clearTokenCache } = await import('@/app/api/utils/tokenManager');
        await clearTokenCache();
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
        const data = await response.json();
        console.log('[✅ Petfinder Success] Found dog via Petfinder API');
        console.log('[📞 Contact Debug] Petfinder contact info:', data.animal?.contact);

        if (data.animal) {
          return NextResponse.json({ animal: data.animal });
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
    // Typo fix: visibilityScore should be teVisibilityScore
    if (error instanceof Error && error.message.includes('visibilityScore')) {
        console.error('[❌ Lookup Error] Potentially a typo in visibilityScore, check teVisibilityScore.');
    }
    return NextResponse.json({
      error: 'Dog lookup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}