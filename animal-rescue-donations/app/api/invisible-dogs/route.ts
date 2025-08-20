
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';

type Dog = {
  id: string | number;
  name?: string;
  breeds?: { primary?: string; secondary?: string; mixed?: boolean };
  age?: string;
  size?: string;
  photos?: { medium?: string }[];
  contact?: { address?: { city?: string; state?: string } };
  description?: string;
  url?: string;
  visibilityScore?: number;
};

async function fetchInvisibleDogs() {
  try {
    console.log('[🔍 Invisible Dogs API] Fetching most invisible dogs...');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[❌ Missing Supabase credentials]');
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Query database for dogs with highest visibility scores (most invisible)
    // Order by visibility_score DESC to get truly most invisible dogs
    const { data: dbDogs, error: dbError } = await supabase
      .from('dogs')
      .select('*')
      .eq('status', 'adoptable')
      .not('visibility_score', 'is', null)
      .order('visibility_score', { ascending: false }) // Highest scores first - get ALL dogs sorted
      .limit(100); // Get more dogs to ensure we have the truly highest scored ones

    if (dbError) {
      console.error('[❌ Invisible Dogs Database Error]', dbError);
      return NextResponse.json(
        { error: 'Database query failed', details: dbError.message },
        { status: 500 }
      );
    }

    if (!dbDogs || dbDogs.length === 0) {
      console.log('[⚠️ Invisible Dogs] No dogs found in database');
      return NextResponse.json({
        dogs: [],
        message: 'No dogs found in database. Database may still be syncing.'
      });
    }

    // Take the top 50 highest scoring dogs (truly most invisible)
    const finalDogs = dbDogs.slice(0, 50);

    console.log('[✅ Invisible Dogs] Found', finalDogs.length, 'invisible dogs from database');
    console.log('[📊 Score Range] Highest:', finalDogs[0]?.visibility_score, 'Lowest:', finalDogs[finalDogs.length - 1]?.visibility_score);

    // Format dogs for frontend consumption
    const formattedDogs = finalDogs
      .filter(dog => dog && (dog.petfinder_id || dog.rescuegroups_id)) // Must have valid ID
      .map((dog: any) => ({
        id: dog.petfinder_id || dog.rescuegroups_id || dog.id,
        name: dog.name || 'Unnamed',
        breeds: { 
          primary: dog.primary_breed || 'Mixed', 
          secondary: dog.secondary_breed,
          mixed: !!dog.secondary_breed
        },
        age: dog.age || 'Unknown',
        size: dog.size || 'Unknown',
        photos: dog.photos && dog.photos.length > 0 
          ? dog.photos 
          : [{ medium: '/images/barkr.png' }],
        contact: { 
          address: { 
            city: dog.city || 'Unknown', 
            state: dog.state || 'Unknown'
          }
        },
        description: dog.description,
        url: dog.url,
        visibilityScore: dog.visibility_score || calculateVisibilityScore(dog)
      }))
      .sort((a: Dog, b: Dog) => (b.visibilityScore || 0) - (a.visibilityScore || 0)); // Ensure proper sorting

    console.log('[✅ Final Result] Returning', formattedDogs.length, 'formatted invisible dogs');
    console.log('[📊 Final Scores] Top 3:', formattedDogs.slice(0, 3).map(d => `${d.name}: ${d.visibilityScore}`));

    return NextResponse.json({
      dogs: formattedDogs,
      total: formattedDogs.length,
      message: `Found ${formattedDogs.length} most invisible dogs (sorted by highest visibility scores)`
    });

  } catch (error) {
    console.error('[❌ Invisible Dogs API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch invisible dogs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return fetchInvisibleDogs();
}

export async function POST(req: Request) {
  return fetchInvisibleDogs();
}
