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
    const dbDog = await getDogById(dogId);
    
    if (dbDog && dbDog.description && dbDog.description.trim().length > 100) {
      // We have a good description in the database, use it
      console.log('✅ Found complete dog details in database');
      
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

    // If no good description in database, fetch from Petfinder
    console.log('🔄 Database missing or has incomplete description, fetching from Petfinder...');

    // Get Petfinder access token
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
      console.error('❌ Failed to get Petfinder token:', tokenResponse.status);
      throw new Error('Failed to get Petfinder access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch individual dog details from Petfinder for complete data including full description
    const dogResponse = await fetch(`https://api.petfinder.com/v2/animals/${dogId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!dogResponse.ok) {
      console.error('❌ Petfinder API error:', dogResponse.status);
      if (dogResponse.status === 404) {
        return NextResponse.json({ error: 'Dog not found' }, { status: 404 });
      }
      throw new Error(`Petfinder API error: ${dogResponse.status}`);
    }

    const dogData = await dogResponse.json();
    console.log('✅ Successfully fetched dog details from Petfinder');

    return NextResponse.json(dogData);

  } catch (error) {
    console.error('❌ Error fetching dog details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dog details' },
      { status: 500 }
    );
  }
}