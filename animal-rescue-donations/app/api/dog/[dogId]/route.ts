import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/api/utils/tokenManager';

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  request: Request,
  { params }: { params: { dogId: string } }
) {
  try {
    console.log(`[🔍 API] Getting dog details for ID: ${params.dogId}`);

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

    // Determine which API to use based on database info
    let apiSource = 'petfinder'; // default
    if (dbDog?.api_source) {
      apiSource = dbDog.api_source;
      console.log(`[📡 API] Using API source: ${apiSource}`);
    }

    let dog = null;

    if (apiSource === 'petfinder') {
      // Fetch from Petfinder for complete details
      const accessToken = await getAccessToken();

      const response = await fetch(`https://api.petfinder.com/v2/animals/${params.dogId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
        }
        if (response.status === 401) {
          console.log(`[🔄 Auth] Token expired, clearing cache`);
          const { clearTokenCache } = await import('@/app/api/utils/tokenManager');
          await clearTokenCache();
          return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
        }
        throw new Error(`Petfinder API error: ${response.status}`);
      }

      const data = await response.json();
      dog = data.animal;
    } else if (apiSource === 'rescuegroups') {
      // TODO: Implement RescueGroups API call
      console.log(`[🚧 TODO] RescueGroups API not yet implemented`);
      return NextResponse.json({ error: 'RescueGroups API not yet implemented' }, { status: 501 });
    }

    if (!dog) {
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    // Merge database data with API data for enhanced information
    if (dbDog) {
      dog.visibilityScore = dbDog.visibility_score;
      dog.dbLastUpdated = dbDog.last_updated_at;
      dog.dbCity = dbDog.city;
      dog.dbState = dbDog.state;
      console.log(`[✅ Merge] Added database info: visibility score ${dog.visibilityScore}`);
    } else {
      // Calculate visibility score if not in database
      const { calculateVisibilityScore } = await import('@/app/api/utils/visibilityScore');
      dog.visibilityScore = calculateVisibilityScore(dog);
      console.log(`[📊 Calc] Calculated visibility score: ${dog.visibilityScore}`);
    }

    console.log(`[✅ Success] Returning dog: ${dog.name} from ${apiSource}`);
    return NextResponse.json({ animal: dog });

  } catch (error) {
    console.error('[❌ Error] Failed to fetch dog:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch dog details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}