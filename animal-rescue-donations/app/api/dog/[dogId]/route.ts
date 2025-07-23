import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "../../utils/tokenManager";
import { calculateVisibilityScore } from "../../../../lib/scoreVisibility";

const PETFINDER_API_URL = "https://api.petfinder.com/v2";

export async function GET(
  _request: NextRequest,
  { params }: { params: { dogId: string } }
) {
  try {
    const { dogId } = params;

    if (!dogId) {
      return NextResponse.json({ error: "Dog ID is required" }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const response = await fetch(`${PETFINDER_API_URL}/animals/${dogId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Dog not found" }, { status: 404 });
      }
      throw new Error(`Petfinder API error: ${response.status}`);
    }

    const data = await response.json();

    // Add visibility score calculation
    const dog = data.animal;

    // Calculate proper visibility score using the same algorithm as the search results
    const visibilityScore = calculateVisibilityScore(dog);
    dog.visibilityScore = visibilityScore;

    // Ensure we return all necessary fields
    const enrichedDog = {
      ...dog,
      visibilityScore,
      // Ensure we have the basic fields the frontend expects
      id: dog.id,
      name: dog.name,
      breeds: dog.breeds,
      age: dog.age,
      size: dog.size,
      photos: dog.photos,
      contact: dog.contact,
      description: dog.description,
    };

    return NextResponse.json(enrichedDog);
  } catch (error) {
    console.error("Error fetching dog details:", error);
    return NextResponse.json(
      { error: "Failed to fetch dog details" },
      { status: 500 }
    );
  }
}