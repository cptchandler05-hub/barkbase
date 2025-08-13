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

    // 🏆 PHASE 1: Database Search (Check both Petfinder and RescueGroups IDs)
    try {
      console.log('[💾 Database] Searching database first...');

      // Try by petfinder_id first (legacy)
      let dbDog = await getDogById(dogId);

      // If not found by petfinder_id, try by rescuegroups_id and also try as string/number conversion
      if (!dbDog) {
        console.log('[💾 Database] Not found by petfinder_id, trying rescuegroups_id and alternative formats...');

        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          );

          // Try rescuegroups_id
          let { data, error } = await supabase
            .from('dogs')
            .select('*')
            .eq('rescuegroups_id', dogId)
            .single();

          if (!data && !isNaN(Number(dogId))) {
            // Try petfinder_id as number if dogId is numeric
            console.log('[💾 Database] Trying petfinder_id as number...');
            const result = await supabase
              .from('dogs')
              .select('*')
              .eq('petfinder_id', Number(dogId))
              .single();

            data = result.data;
            error = result.error;
          }

          if (!data) {
            // Try petfinder_id as string
            console.log('[💾 Database] Trying petfinder_id as string...');
            const result = await supabase
              .from('dogs')
              .select('*')
              .eq('petfinder_id', dogId.toString())
              .single();

            data = result.data;
            error = result.error;
          }

          if (!error && data) {
            dbDog = data;
            console.log('[✅ Database Hit] Found by alternative ID lookup:', data.name);
          }
        }
      }

      if (dbDog) {
        console.log('[✅ Database Hit] Found dog in database:', dbDog.name);
        const formattedDog = DogFormatter.formatDatabaseDog(dbDog);
        // Return formatted response
        return NextResponse.json({
          animal: {
            id: dbDog.petfinder_id,
            organization_id: dbDog.organization_id,
            name: dbDog.name,
            breeds: {
              primary: dbDog.primary_breed,
              secondary: dbDog.secondary_breed,
              mixed: dbDog.is_mixed
            },
            age: dbDog.age,
            gender: dbDog.gender,
            size: dbDog.size,
            description: dbDog.description,
            photos: dbDog.photos || [],
            contact: {
              email: dbDog.contact_email,
              phone: dbDog.contact_phone,
              address: {
                address1: dbDog.contact_address1,
                address2: dbDog.contact_address2,
                city: dbDog.city,
                state: dbDog.state,
                postcode: dbDog.postcode,
                country: dbDog.contact_country
              }
            },
            organization: {
              name: dbDog.organization_name
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
            url: dbDog.url,
            visibilityScore: dbDog.visibility_score,
            source: 'database',
            verificationBadge: 'In BarkBase Database'
          },
          source: 'database'
        });
      }
    } catch (dbError) {
      console.warn('[⚠️ Database Warning] Database lookup failed:', dbError);
    }

    // 🦮 PHASE 2: RescueGroups Search
    try {
      console.log('[🦮 RescueGroups] Searching RescueGroups...');
      const rescueGroups = new RescueGroupsAPI();
      const rgResult = await rescueGroups.getAnimalDetails(dogId);

      if (rgResult) {
        console.log('[✅ RescueGroups Hit] Found dog in RescueGroups');
        console.log('[🔍 Debug] RescueGroups raw data:', JSON.stringify(rgResult, null, 2));
        // For single dog details, handle both single animal and search results
        const animalData = rgResult.data ? rgResult.data[0] : rgResult;
        const includedData = rgResult.included || [];
        const formattedDog = DogFormatter.formatRescueGroupsDog(animalData, includedData);
        console.log('[🔍 Debug] Formatted contact data:', JSON.stringify(formattedDog.contact, null, 2));
        return NextResponse.json({
          animal: DogFormatter.toLegacyFormat(formattedDog, false), // false = don't truncate description
          source: 'rescuegroups'
        });
      }
    } catch (rgError) {
      console.warn('[⚠️ RescueGroups Warning] RescueGroups lookup failed:', rgError);
    }

    // 🐾 PHASE 3: Petfinder Fallback
    try {
      console.log('[🐾 Petfinder] Falling back to Petfinder API...');
      const accessToken = await getAccessToken();

      if (!accessToken) {
        throw new Error('Failed to get Petfinder access token');
      }

      const response = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.animal) {
          console.log('[✅ Petfinder Hit] Found dog in Petfinder:', data.animal.name);
          const formattedDog = DogFormatter.formatPetfinderDog(data.animal);
        return NextResponse.json({
          animal: DogFormatter.toLegacyFormat(formattedDog, false), // Don't truncate for individual dog pages
          source: 'petfinder'
        });
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
      details: `Dog with ID ${dogId} was not found in database, RescueGroups, or Petfinder`,
      searchedSources: ['database', 'rescuegroups', 'petfinder']
    }, { status: 404 });

  } catch (error) {
    console.error('[❌ Lookup Error]', error);
    return NextResponse.json({
      error: 'Dog lookup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}