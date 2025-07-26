import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, clearTokenCache } from '@/app/api/utils/tokenManager';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { createClient } from '@supabase/supabase-js';

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { dogId } = resolvedParams;

    if (!dogId) {
      console.error('❌ No dogId provided');
      return NextResponse.json({ error: 'Dog ID is required' }, { status: 400 });
    }

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