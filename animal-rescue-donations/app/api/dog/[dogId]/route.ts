import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, clearTokenCache } from '@/app/api/utils/tokenManager';
import { createClient } from '@supabase/supabase-js';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  request: Request,
  { params }: { params: { dogId: string } }
) {
  try {
    const { dogId } = params;
    console.log('Fetching dog details for dogId:', dogId);
    console.log('Type of dogId:', typeof dogId);
    console.log('dogId is truthy:', !!dogId);

    if (!dogId) {
      console.log('No dogId available');
      return NextResponse.json({ error: 'Dog ID is required' }, { status: 400 });
    }

    // First check database
    console.log('Checking database for dog...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: dbDog, error: dbError } = await supabase
      .from('dogs')
      .select('*')
      .eq('petfinder_id', dogId)
      .single();

    if (dbError && dbError.code !== 'PGRST116') {
      console.log('Database error:', dbError);
    }

    if (dbDog) {
      console.log('Found dog in database:', dbDog.name);

      // Get full description from Petfinder if database description is truncated or missing
      let fullDescription = dbDog.description;
      if (!fullDescription || fullDescription.length < 100) {
        try {
          console.log('Getting full description from Petfinder...');
          const token = await getAccessToken();
          const pfResponse = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (pfResponse.ok) {
            const pfData = await pfResponse.json();
            if (pfData.animal?.description) {
              fullDescription = pfData.animal.description;
            }
          }
        } catch (pfError) {
          console.log('Could not fetch full description from Petfinder:', pfError);
        }
      }

      // Format database dog to match expected structure
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
                return { medium: photo, large: photo };
              } else if (photo && typeof photo === 'object') {
                return { 
                  medium: photo.medium || photo.large || photo.small || '/images/barkr.png',
                  large: photo.large || photo.medium || photo.small || '/images/barkr.png'
                };
              }
              return { medium: '/images/barkr.png', large: '/images/barkr.png' };
            })
          : [{ medium: '/images/barkr.png', large: '/images/barkr.png' }],
        contact: { 
          address: { 
            city: dbDog.city || 'Unknown', 
            state: dbDog.state || 'Unknown'
          }
        },
        description: fullDescription,
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
        colors: {
          primary: dbDog.primary_color,
          secondary: dbDog.secondary_color,
          tertiary: dbDog.tertiary_color
        },
        visibilityScore: dbDog.visibility_score || calculateVisibilityScore(dbDog)
      };

      return NextResponse.json(formattedDog);
    }

    // If not in database, try Petfinder
    console.log('Dog not found in database, checking Petfinder...');
    const token = await getAccessToken();

    const response = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('Petfinder API error:', response.status);
      return NextResponse.json(
        { error: 'Dog not found' }, 
        { status: 404 }
      );
    }

    const data = await response.json();
    const dog = data.animal;

    if (!dog) {
      return NextResponse.json(
        { error: 'Dog not found' }, 
        { status: 404 }
      );
    }

    // Calculate visibility score for Petfinder dog
    dog.visibilityScore = calculateVisibilityScore(dog);

    return NextResponse.json(dog);

  } catch (error) {
    console.error('Error fetching dog details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dog details' }, 
      { status: 500 }
    );
  }
}