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
    console.log('[🔍 Invisible Dogs API] Fetching highest scoring dogs from entire database...');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[❌ Missing Supabase credentials]');
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Query database for top 100 dogs by visibility score (highest first)
    // Include all dogs with visibility scores regardless of status
    const { data: databaseDogs, error: databaseError, count } = await supabase
      .from('dogs')
      .select('*', { count: 'exact' })
      .not('visibility_score', 'is', null)  // Must have visibility score
      .order('visibility_score', { ascending: false })
      .limit(100); // Get top 100 most invisible dogs from entire database

    console.log('[📊 Query Result] Total dogs with scores in DB:', count);
    console.log('[📊 Query Result] Returned dogs:', databaseDogs?.length || 0);

    if (databaseError) {
      console.error('[❌ Invisible Dogs Database Error]', databaseError);
      return NextResponse.json(
        { error: 'Database query failed', details: databaseError.message },
        { status: 500 }
      );
    }

    if (!databaseDogs || databaseDogs.length === 0) {
      console.log('[⚠️ Invisible Dogs] No dogs found in database');
      return NextResponse.json({
        dogs: [],
        message: 'No dogs found in database. Database may still be syncing.'
      });
    }

    console.log('[✅ Invisible Dogs] Found', databaseDogs.length, 'dogs from database');
    console.log('[📊 Score Range] Highest:', databaseDogs[0]?.visibility_score, 'Lowest:', databaseDogs[databaseDogs.length - 1]?.visibility_score);

    // Log the top 10 scores to verify we're getting the highest ones
    console.log('[📊 Top 10 Scores]', databaseDogs.slice(0, 10).map(d => `${d.name}: ${d.visibility_score}`));

    // Format dogs for frontend consumption
    const formattedDogs = databaseDogs
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
    console.log('[📊 Final Top 10 Scores]', formattedDogs.slice(0, 10).map(d => `${d.name}: ${d.visibilityScore}`));
    console.log('[📊 Score Range] Returning dogs with scores from', formattedDogs[0]?.visibilityScore, 'to', formattedDogs[formattedDogs.length - 1]?.visibilityScore);

    return NextResponse.json({
      dogs: formattedDogs,
      total: formattedDogs.length,
      message: `Found ${formattedDogs.length} most invisible dogs from entire database (sorted by highest visibility scores)`,
      debug: {
        databaseCount: databaseDogs.length,
        formattedCount: formattedDogs.length,
        scoreRange: {
          highest: formattedDogs[0]?.visibilityScore,
          lowest: formattedDogs[formattedDogs.length - 1]?.visibilityScore
        }
      }
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