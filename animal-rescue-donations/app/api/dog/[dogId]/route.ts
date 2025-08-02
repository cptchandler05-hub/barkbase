import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { dogId: string } }
) {
  try {
    const { dogId } = params;
    console.log('🔍 Fetching dog details for ID:', dogId);

    // First, try to get the dog from our database
    const { data: dbDog, error: dbError } = await supabase
      .from('dogs')
      .select('*')
      .eq('petfinder_id', dogId)
      .single();

    if (!dbError && dbDog) {
      console.log('✅ Found dog in database:', dbDog.name);

      // Transform database dog to match expected format with full contact info
      const transformedDog = {
        animal: {
          id: parseInt(dbDog.petfinder_id),
          organization_id: dbDog.organization_id,
          organization_animal_id: dbDog.organization_animal_id,
          url: dbDog.url,
          name: dbDog.name,
          breeds: {
            primary: dbDog.primary_breed,
            secondary: dbDog.secondary_breed,
            mixed: dbDog.is_mixed,
            unknown: dbDog.is_unknown_breed
          },
          age: dbDog.age,
          gender: dbDog.gender,
          size: dbDog.size,
          coat: dbDog.coat,
          colors: {
            primary: dbDog.primary_color,
            secondary: dbDog.secondary_color,
            tertiary: dbDog.tertiary_color
          },
          description: dbDog.description,
          photos: (dbDog.photos && Array.isArray(dbDog.photos)) ? dbDog.photos : [],
          primary_photo_cropped: dbDog.photos && dbDog.photos.length > 0 ? dbDog.photos[0] : null,
          attributes: {
            spayed_neutered: dbDog.spayed_neutered,
            house_trained: dbDog.house_trained,
            special_needs: dbDog.special_needs,
            shots_current: dbDog.shots_current,
            declawed: null
          },
          environment: {
            children: dbDog.good_with_children,
            dogs: dbDog.good_with_dogs,
            cats: dbDog.good_with_cats
          },
          tags: (dbDog.tags && Array.isArray(dbDog.tags)) ? dbDog.tags : [],
          contact: dbDog.contact_info && typeof dbDog.contact_info === 'object' ? dbDog.contact_info : {
            email: null,
            phone: null,
            address: {
              address1: null,
              address2: null,
              city: dbDog.city,
              state: dbDog.state,
              postcode: dbDog.postcode,
              country: 'US'
            }
          },
          published_at: dbDog.created_at,
          distance: null,
          visibility_score: dbDog.visibility_score || calculateVisibilityScore({
            name: dbDog.name,
            breeds: { primary: dbDog.primary_breed, secondary: dbDog.secondary_breed, mixed: dbDog.is_mixed },
            age: dbDog.age,
            size: dbDog.size,
            gender: dbDog.gender,
            photos: dbDog.photos,
            description: dbDog.description,
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
            colors: {
              primary: dbDog.primary_color,
              secondary: dbDog.secondary_color,
              tertiary: dbDog.tertiary_color
            },
            contact: {
              address: {
                city: dbDog.city,
                state: dbDog.state
              }
            }
          }),
          status: dbDog.status,
          _links: {
            self: { href: `/v2/animals/${dogId}` },
            type: { href: `/v2/types/dog` },
            organization: { href: `/v2/organizations/${dbDog.organization_id}` }
          }
        }
      };

      return NextResponse.json(transformedDog);
    }

    // If not in database, fetch from Petfinder API
    console.log('🌐 Dog not in database, fetching from Petfinder API...');

    let accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('❌ Failed to get access token');
      return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }

    let petfinderResponse = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // If we get 401 (unauthorized), try with fresh token
    if (petfinderResponse.status === 401) {
      console.log('🔄 Token expired, getting fresh token and retrying...');
      accessToken = await getAccessToken(true); // Force refresh
      petfinderResponse = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    }

    if (!petfinderResponse.ok) {
      const errorData = await petfinderResponse.json().catch(() => ({}));
      console.error(`❌ Petfinder API error: ${petfinderResponse.status}`, errorData);
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    const dogData = await petfinderResponse.json();
    console.log('✅ Successfully fetched dog details from Petfinder:', dogData.animal?.name);

    // Calculate and add visibility score for Petfinder dogs not in database
    if (dogData.animal) {
      dogData.animal.visibility_score = calculateVisibilityScore(dogData.animal);
    }

    return NextResponse.json(dogData);

  } catch (error) {
    console.error('❌ Error fetching dog details:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}