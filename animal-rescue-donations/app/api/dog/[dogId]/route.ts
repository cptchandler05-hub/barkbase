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

      // If not found by petfinder_id, try by rescuegroups_id
      if (!dbDog) {
        console.log('[💾 Database] Not found by petfinder_id, trying rescuegroups_id...');
        // Note: You might need to add a new function getDogByRescueGroupsId to supabase.ts
        // For now, we'll implement a basic query here
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          );

          const { data, error } = await supabase
            .from('dogs')
            .select('*')
            .eq('rescuegroups_id', dogId)
            .single();

          if (!error && data) {
            dbDog = data;
            console.log('[✅ Database Hit] Found by rescuegroups_id:', data.name);
          }
        }
      }

      if (dbDog) {
        console.log('[✅ Database Hit] Found dog in database:', dbDog.name);
        const formattedDog = DogFormatter.formatDatabaseDog(dbDog);
        return NextResponse.json({
          animal: DogFormatter.toLegacyFormat(formattedDog, false),
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
      const rgDog = await rescueGroups.getAnimalDetails(dogId);

      if (rgDog) {
        console.log('[✅ RescueGroups Hit] Found dog in RescueGroups:', rgDog.name);
        const formattedDog = DogFormatter.formatRescueGroupsDog(rgDog);
        return NextResponse.json({
          animal: DogFormatter.toLegacyFormat(formattedDog, false),
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