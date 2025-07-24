
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

    if (!dogId) {
      console.error("No dogId provided after resolution");
      return NextResponse.json({ error: "Dog ID is required" }, { status: 400 });
    }

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

    const apiUrl = `${PETFINDER_API_URL}/animals/${dogId}`;
    console.log(`[📡 API Request] ${apiUrl}`);

    let response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log("API response status:", response.status);

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

      // For other errors, throw error
      throw new Error(`Petfinder API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[✅ Dog Details Success] Retrieved data for: ${data.animal?.name || dogId}`);

    return NextResponse.json(data);

  } catch (error) {
    console.error(`[❌ Dog Details Error] ${dogId}:`, error instanceof Error ? error.message : error);

    return NextResponse.json(
      { 
        error: "Failed to fetch dog details",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
