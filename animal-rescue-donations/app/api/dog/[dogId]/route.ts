import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "../../utils/tokenManager";
import { calculateVisibilityScore } from "../../../../lib/scoreVisibility";

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  request: NextRequest,
  { params }: { params: { dogId: string } }
) {
  try {
    console.log("Fetching dog details for ID:", params.dogId);

    if (!params.dogId) {
      console.error("No dogId provided");
      return NextResponse.json({ error: "Dog ID is required" }, { status: 400 });
    }

    // Always get a fresh token for individual dog requests to avoid stale token issues
    const accessToken = await getAccessToken(true);
    console.log("Got fresh access token for dog details");

    const apiUrl = `${PETFINDER_API_URL}/animals/${params.dogId}`;
    console.log("Making request to:", apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log("API response status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("Successfully fetched dog data for:", data.animal?.name);

      if (!data.animal) {
        console.error("No animal data in response");
        return NextResponse.json({ error: "Invalid response from API" }, { status: 500 });
      }

      const dog = data.animal;
      const visibilityScore = calculateVisibilityScore(dog);
      
      const enrichedDog = {
        ...dog,
        visibilityScore,
      };

      console.log("Returning enriched dog data with visibility score:", visibilityScore);
      return NextResponse.json(enrichedDog);
    }

    const errorText = await response.text();
    console.error("API Error Response:", errorText);
    
    if (response.status === 404) {
      return NextResponse.json({ error: "Dog not found" }, { status: 404 });
    }

    if (response.status === 401) {
      console.log("Got 401 with fresh token - credentials may be invalid");
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
    }

    // For other errors, throw error
    throw new Error(`Petfinder API error: ${response.status} - ${errorText}`);

  } catch (error) {
    console.error("Error fetching dog details:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch dog details", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}