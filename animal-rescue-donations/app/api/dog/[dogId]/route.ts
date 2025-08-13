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

      // Try by petfinder_id, rescuegroups_id, and internal ID
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
              .select('*')
              .eq('petfinder_id', Number(dogId))
              .single();
            data = result.data;
            error = result.error;
          }

          if (!data) {
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

        if (dbDog) {
          console.log('[✅ Database Hit] Found dog in database:', dbDog.name);
          return NextResponse.json({
            animal: DogFormatter.toLegacyFormat(dbDog, false), // Don't truncate for individual dog pages
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

    // 🦮 PHASE 2: RescueGroups API Search
    try {
      console.log('[🦮 RescueGroups] Searching RescueGroups API...');
      const rescueGroupsAPI = new RescueGroupsAPI();
      const rgDog = await rescueGroupsAPI.getDogById(dogId); // Assuming getDogById exists and works for RescueGroups

      if (rgDog) {
        console.log('[✅ RescueGroups Hit] Found dog in RescueGroups:', rgDog.name);
        return NextResponse.json({
          animal: DogFormatter.toLegacyFormat(rgDog, false), // Don't truncate for individual dog pages
          source: 'rescuegroups'
        });
      }
    } catch (rgError) {
      console.warn('[⚠️ RescueGroups Warning] RescueGroups lookup failed:', rgError);
    }

    // 🐾 PHASE 3: Petfinder API Search
    try {
      console.log('[🐾 Petfinder] Searching Petfinder API...');
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