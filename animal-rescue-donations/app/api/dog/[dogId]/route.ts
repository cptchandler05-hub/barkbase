import { NextRequest, NextResponse } from 'next/server';
import { getDogById } from '@/lib/supabase';

export async function GET(request: Request, { params }: { params: { dogId: string } }) {
  const dogId = params?.dogId;

  console.log(`[🐕 /api/dog/${dogId}] Fetching dog details`);
  console.log('dogId type:', typeof dogId, 'value:', dogId);

  if (!dogId || dogId === 'undefined' || dogId === 'null') {
    console.error('Invalid or missing dogId:', dogId);
    return NextResponse.json({ error: 'Valid Dog ID is required' }, { status: 400 });
  }

  try {
    console.log('🐕 Checking database first for dog ID:', dogId);

    // First try to get dog from our database
    let dbDog;
    try {
      dbDog = await getDogById(dogId);
      console.log('Database query result:', dbDog ? 'Found' : 'Not found');
    } catch (dbError) {
      console.error('Database query error:', dbError);
      // Continue to Petfinder API if database fails
    }
    
    if (dbDog) {
      console.log('✅ Found dog in database:', dbDog.name);
      console.log('Description length:', dbDog.description?.length || 0);
      
      // Always return database dog if found, regardless of description length
      // Format the database dog to match Petfinder API response structure
      const formattedDog = {
        animal: {
          id: dbDog.petfinder_id,
          name: dbDog.name,
          type: dbDog.type,
          species: dbDog.species,
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
          description: dbDog.description,
          photos: dbDog.photos || [],
          tags: dbDog.tags || [],
          contact: dbDog.contact_info || {},
          status: dbDog.status,
          organization_id: dbDog.organization_id,
          organization_animal_id: dbDog.organization_animal_id,
          url: dbDog.url,
          visibility_score: dbDog.visibility_score
        }
      };
      
      return NextResponse.json(formattedDog);
    }

    // If no dog in database, fetch from Petfinder
    console.log('🔄 No dog found in database, fetching from Petfinder...');

    // Check if we have Petfinder credentials
    if (!process.env.PETFINDER_CLIENT_ID || !process.env.PETFINDER_CLIENT_SECRET) {
      console.error('❌ Missing Petfinder credentials');
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    // Get Petfinder access token
    console.log('🔑 Getting Petfinder access token...');
    const tokenResponse = await fetch('https://api.petfinder.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PETFINDER_CLIENT_ID!,
        client_secret: process.env.PETFINDER_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('❌ Failed to get Petfinder token:', tokenResponse.status, tokenError);
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Got Petfinder access token');

    // Fetch individual dog details from Petfinder for complete data including full description
    console.log(`🔍 Fetching dog ${dogId} from Petfinder API...`);
    const dogResponse = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!dogResponse.ok) {
      const dogError = await dogResponse.text();
      console.error('❌ Petfinder API error:', dogResponse.status, dogError);
      if (dogResponse.status === 404) {
        return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
    }

    const dogData = await dogResponse.json();
    console.log('✅ Successfully fetched dog details from Petfinder:', dogData.animal?.name);

    return NextResponse.json(dogData);

  } catch (error) {
    console.error('❌ Error fetching dog details:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Return 404 instead of 500 for missing dogs
    return NextResponse.json(
      { error: 'Dog not found' },
      { status: 404 }
    );
  }
}