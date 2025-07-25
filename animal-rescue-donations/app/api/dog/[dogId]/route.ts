
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/app/api/utils/tokenManager';

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

// Rate limiting for individual dog requests
let lastDogRequestTime = 0;
const MIN_DOG_REQUEST_INTERVAL = 500; // 500ms between dog detail requests

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dogId: string }> | { dogId: string } }
) {
  try {
    // Handle both Promise and direct params
    const resolvedParams = await params;
    const dogId = resolvedParams.dogId;
    
    console.log(`[🐕 Dog Details] Fetching details for dogId: ${dogId}`);
    console.log(`[🐕 Dog Details] Type of dogId: ${typeof dogId}`);
    console.log(`[🐕 Dog Details] dogId is truthy: ${!!dogId}`);

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

    // Rate limiting for dog detail requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastDogRequestTime;
    if (timeSinceLastRequest < MIN_DOG_REQUEST_INTERVAL) {
      const waitTime = MIN_DOG_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[⏳ Dog Detail Rate Limiting] Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastDogRequestTime = Date.now();

    // Get cached token first, same as search endpoint
    let accessToken = await getAccessToken();
    console.log(`[🔑 Token Check] Token length: ${accessToken ? accessToken.length : 'null'}`);
    console.log(`[🔑 Token Check] Token starts with: ${accessToken ? accessToken.substring(0, 10) + '...' : 'null'}`);

    // Check if we have the required environment variables
    const hasClientId = !!process.env.PETFINDER_CLIENT_ID;
    const hasClientSecret = !!process.env.PETFINDER_CLIENT_SECRET;
    console.log(`[🔧 Env Check] Has CLIENT_ID: ${hasClientId}, Has CLIENT_SECRET: ${hasClientSecret}`);

    const apiUrl = `${PETFINDER_API_URL}/animals/${numericDogId}`;
    console.log(`[📡 API Request] ${apiUrl}`);
    console.log(`[📡 Headers] Authorization: Bearer ${accessToken ? accessToken.substring(0, 20) + '...' : 'null'}`);

    let response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log("API response status:", response.status);
    console.log("API response headers:", Object.fromEntries(response.headers.entries()));

    // Handle rate limit specifically
    if (response.status === 429) {
      console.log("Rate limit exceeded for dog details");
      return NextResponse.json({ 
        error: "Rate limit exceeded - please try again later",
        retryAfter: 300 // 5 minutes
      }, { status: 429 });
    }

    // If we get 401, retry once with a fresh token
    if (response.status === 401) {
      console.log("Got 401, trying with fresh token...");
      accessToken = await getAccessToken(true);
      
      // Wait a bit before retrying to avoid rapid successive calls
      await new Promise(resolve => setTimeout(resolve, 500));
      
      response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log("Retry API response status:", response.status);
      
      // Check rate limit again after retry
      if (response.status === 429) {
        console.log("Rate limit exceeded on retry for dog details");
        return NextResponse.json({ 
          error: "Rate limit exceeded - please try again later",
          retryAfter: 300
        }, { status: 429 });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[❌ API Error] ${response.status}:`, errorText);
      console.error(`[❌ Response Headers]:`, Object.fromEntries(response.headers.entries()));
      console.error(`[❌ Request URL]:`, apiUrl);

      // Handle specific error cases
      if (response.status === 404) {
        console.error(`[❌ Dog Not Found] Dog ID ${numericDogId} does not exist in Petfinder`);
        return NextResponse.json({ 
          error: "Dog not found",
          details: `Dog with ID ${numericDogId} was not found in Petfinder. The dog may have been adopted or the listing removed.`
        }, { status: 404 });
      }

      if (response.status === 401) {
        console.error(`[❌ Auth Failed] Petfinder API credentials appear to be invalid`);
        console.error(`[❌ Token Info] Token: ${accessToken ? accessToken.substring(0, 20) + '...' : 'null'}`);
        return NextResponse.json({ 
          error: "Authentication failed",
          details: "Unable to authenticate with Petfinder API. Please check API credentials."
        }, { status: 401 });
      }

      // For other errors, throw error with more details
      throw new Error(`Petfinder API error: ${response.status} - ${errorText} - URL: ${apiUrl}`);
    }

    const data = await response.json();
    console.log(`[✅ Dog Details Success] Retrieved data for: ${data.animal?.name || dogId}`);

    return NextResponse.json(data);

  } catch (error) {
    console.error(`[❌ Dog Details Error] ${resolvedParams.dogId}:`, error);
    console.error(`[❌ Error Type]:`, typeof error);
    console.error(`[❌ Error Stack]:`, error instanceof Error ? error.stack : 'No stack trace');
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error(`[❌ Error Name]:`, error.name);
      console.error(`[❌ Error Message]:`, error.message);
    }

    return NextResponse.json(
      { 
        error: "Failed to fetch dog details",
        details: error instanceof Error ? error.message : String(error),
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'Unknown'
      },
      { status: 500 }
    );
  }
}
