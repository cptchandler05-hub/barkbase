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

    // Try up to 2 times with fresh token if 401
    let accessToken = await getAccessToken();
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      console.log(`Making API call attempt ${attempts + 1}...`);

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

      // If 401 (unauthorized) and we haven't tried refreshing token yet, try again
      if (response.status === 401 && attempts === 0) {
        console.log("Got 401, refreshing token and retrying...");
        accessToken = await getAccessToken();
        attempts++;
        continue;
      }

      // For other errors or if retry failed, throw error
      throw new Error(`Petfinder API error: ${response.status} - ${errorText}`);
    }

    throw new Error("Max attempts reached");

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