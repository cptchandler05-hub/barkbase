import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "../../utils/tokenManager";
import { calculateVisibilityScore } from "../../../../lib/scoreVisibility";

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

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

    // If we get 401, retry once with a fresh token
    if (response.status === 401) {
      console.log("Got 401, trying with fresh token...");
      accessToken = await getAccessToken(true);
      response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log("Retry API response status:", response.status);
    }

    // Handle successful response
    if (response.ok) {
      // Process the response
      const data = await response.json();
      console.log(`Fetched dog details for ${dogId}:`, data.animal?.name || 'Unknown name');

      if (data.animal) {
        // Add visibility score
        data.animal.visibilityScore = calculateVisibilityScore(data.animal);
        console.log(`Visibility score calculated: ${data.animal.visibilityScore}`);

        // Log description status for debugging
        if (data.animal.description) {
          console.log(`Description length: ${data.animal.description.length} chars`);
          if (data.animal.description.includes('...')) {
            console.warn(`⚠️ Description appears truncated for ${data.animal.name}`);
          }
        } else {
          console.warn(`⚠️ No description found for ${data.animal.name}`);
        }
      }

      return NextResponse.json(data.animal);
    }

    // Handle error responses
    const errorText = await response.text();
    console.error(`[❌ API Error] ${response.status} for dog ${dogId}:`, errorText);

    if (response.status === 404) {
      console.log("Dog not found:", dogId);
      return NextResponse.json({ error: "Dog not found" }, { status: 404 });
    }

    if (response.status === 401) {
      console.log("Authentication failed even after token refresh");
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    if (response.status === 429) {
      console.log("Rate limit exceeded for dog details");
      return NextResponse.json({ error: "Rate limit exceeded - please try again later" }, { status: 429 });
    }

    // For other errors, throw error
    throw new Error(`Petfinder API error: ${response.status} - ${errorText}`);

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