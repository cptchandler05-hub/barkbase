import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { dogId: string } }) {
  const dogId = params?.dogId;

  console.log(`[🐕 /api/dog/${dogId}] Fetching dog details`);
  console.log('dogId type:', typeof dogId, 'value:', dogId);

  if (!dogId || dogId === 'undefined' || dogId === 'null') {
    console.error('Invalid or missing dogId:', dogId);
    return NextResponse.json({ error: 'Valid Dog ID is required' }, { status: 400 });
  }

  try {
    console.log('🐕 Fetching dog details for ID:', dogId);

    // Get Petfinder access token
    const tokenResponse = await fetch('https://api.petfinder.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PETFINDER_API_KEY!,
        client_secret: process.env.PETFINDER_SECRET!,
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