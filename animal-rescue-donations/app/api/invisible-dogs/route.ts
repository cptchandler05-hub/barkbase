
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

export async function GET(req: Request) {
  try {
    console.log('[🔍 Invisible Dogs API] Fetching most invisible dogs...');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Query database for dogs with highest visibility scores (most invisible)
    const { data: dbDogs, error: dbError } = await supabase
      .from('dogs')
      .select('*')
      .eq('status', 'adoptable')
      .order('visibility_score', { ascending: false })
      .limit(100);

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

    console.log('[✅ Invisible Dogs] Found', dbDogs.length, 'dogs from database');

    // Format dogs for consistent API response
    const formattedDogs: Dog[] = dbDogs.map(dog => ({
      id: dog.petfinder_id,
      name: dog.name,
      breeds: { 
        primary: dog.primary_breed, 
        secondary: dog.secondary_breed,
        mixed: dog.is_mixed 
      },
      age: dog.age,
      size: dog.size,
      photos: (dog.photos && Array.isArray(dog.photos) && dog.photos.length > 0) 
        ? dog.photos.map((photo: any) => {
            // Handle string URLs (RescueGroups format)
            if (typeof photo === 'string') {
              return { medium: photo };
            } 
            // Handle object format (Petfinder format)
            else if (photo && typeof photo === 'object') {
              // For RescueGroups objects: {small: "url", medium: "url", large: "url"}
              if (photo.medium || photo.large || photo.small) {
                return { medium: photo.medium || photo.large || photo.small };
              }
              // For nested Petfinder objects: {medium: {url: "..."}}
              else if (photo.medium && typeof photo.medium === 'object' && photo.medium.url) {
                return { medium: photo.medium.url };
              }
              // Direct Petfinder format: already correct
              else if (typeof photo.medium === 'string') {
                return { medium: photo.medium };
              }
            }
            return { medium: '/images/barkr.png' };
          })
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
    }));

    // Sort by visibility score (highest first) to ensure proper ordering
    formattedDogs.sort((a: Dog, b: Dog) => (b.visibilityScore || 0) - (a.visibilityScore || 0));

    return NextResponse.json({
      dogs: formattedDogs,
      total: formattedDogs.length,
      message: `Found ${formattedDogs.length} invisible dogs with highest visibility scores`
    });

  } catch (error) {
    console.error('[❌ Invisible Dogs API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch invisible dogs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
