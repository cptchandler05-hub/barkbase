import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/api/utils/tokenManager';

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> | { dogId: string } }
) {
  let dogId: string;

  try {
    // Handle both Promise and direct params
    const resolvedParams = await params;
    dogId = resolvedParams.dogId;

    console.log(`[🐕 Dog Details] Fetching details for dogId: ${dogId}`);

    if (!dogId) {
      console.error("No dogId provided after resolution");
      return NextResponse.json({ error: "Dog ID is required" }, { status: 400 });
    }

    // Validate that dogId is numeric (Petfinder expects numeric IDs)
    const numericDogId = parseInt(dogId);
    if (isNaN(numericDogId)) {
      console.error(`[❌ Invalid Dog ID] ${dogId} is not a valid numeric ID`);
      return NextResponse.json({ error: "Dog ID must be numeric" }, { status: 400 });
    }

    console.log(`[🐕 Dog Details] Validated numeric dogId: ${numericDogId}`);

    // Get access token
    let accessToken;
    try {
      accessToken = await getAccessToken();
      console.log(`[🔑 Token Check] Got token for dog ${numericDogId}`);
    } catch (tokenError) {
      console.error(`[❌ Token Error] Failed to get access token:`, tokenError);
      return NextResponse.json({ 
        error: "Authentication failed",
        details: "Could not obtain API access token"
      }, { status: 500 });
    }

    if (!accessToken) {
      console.error(`[❌ Token Error] No access token available`);
      return NextResponse.json({ 
        error: "Authentication failed",
        details: "No access token available"
      }, { status: 500 });
    }

    const apiUrl = `${PETFINDER_API_URL}/animals/${numericDogId}`;
    console.log(`[📡 API Request] ${apiUrl}`);

    // Make the API request
    let response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[📡 Response] Status: ${response.status} for dog ${numericDogId}`);

    // Handle rate limit specifically
    if (response.status === 429) {
      console.log("Rate limit exceeded for dog details");
      return NextResponse.json({ 
        error: "Rate limit exceeded - please try again later",
        retryAfter: 300
      }, { status: 429 });
    }

    // If we get 401, retry ONCE with a fresh token
    if (response.status === 401) {
      console.log(`[🔄 Auth Retry] Got 401 for dog ${numericDogId}, trying with fresh token...`);

      try {
        accessToken = await getAccessToken(true); // Force refresh

        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 300));

        response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`[🔄 Retry Response] Status: ${response.status} for dog ${numericDogId}`);
      } catch (retryError) {
        console.error(`[❌ Retry Failed] Error during retry for dog ${numericDogId}:`, retryError);
        return NextResponse.json({ 
          error: "Authentication failed after retry",
          details: "Unable to authenticate with Petfinder API"
        }, { status: 401 });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[❌ API Error] ${response.status} for dog ${numericDogId}:`, errorText);

      // Handle specific error cases
      if (response.status === 404) {
        console.error(`[❌ Dog Not Found] Dog ID ${numericDogId} does not exist in Petfinder`);
        return NextResponse.json({ 
          error: "Dog not found",
          details: `Dog with ID ${numericDogId} was not found in Petfinder. The dog may have been adopted or the listing removed.`
        }, { status: 404 });
      }

      if (response.status === 401) {
        console.error(`[❌ Auth Failed] Still getting 401 after retry for dog ${numericDogId}`);
        return NextResponse.json({ 
          error: "Authentication failed",
          details: "Unable to authenticate with Petfinder API even after retry"
        }, { status: 401 });
      }

      // For other errors
      return NextResponse.json({ 
        error: "Failed to fetch dog details",
        details: `Petfinder API error: ${response.status}`,
        dogId: numericDogId
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[✅ Dog Details Success] Retrieved data for: ${data.animal?.name || dogId}`);

    return NextResponse.json(data);

  } catch (error) {
    console.error(`[❌ Dog Details Error] ${dogId || 'unknown'}:`, error);

    return NextResponse.json(
      { 
        error: "Failed to fetch dog details",
        details: error instanceof Error ? error.message : String(error),
        dogId: dogId || 'unknown'
      },
      { status: 500 }
    );
  }
}