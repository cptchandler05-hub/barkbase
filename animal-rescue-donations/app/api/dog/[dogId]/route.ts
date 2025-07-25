
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

    console.log(`[🐕 Dog Details] Starting fetch for dogId: ${dogId}`);

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

    console.log(`[🐕 Dog Details] Processing numeric dogId: ${numericDogId}`);

    // First try to get dog from Supabase database
    try {
      console.log(`[💾 Database] Checking database for dog ${numericDogId}`);
      const { getDogById } = await import('@/lib/supabase');
      const dbDog = await getDogById(dogId);
      
      if (dbDog) {
        console.log(`[✅ Database Hit] Found dog ${dbDog.name} in database`);
        
        // Convert database dog to Petfinder API format
        const formattedDog = {
          animal: {
            id: parseInt(dbDog.petfinder_id),
            organization_id: dbDog.organization_id,
            name: dbDog.name,
            breeds: {
              primary: dbDog.breed_primary,
              secondary: dbDog.breed_secondary,
              mixed: !!dbDog.breed_secondary
            },
            age: dbDog.age,
            gender: dbDog.gender,
            size: dbDog.size,
            description: dbDog.description,
            photos: dbDog.photos.map(url => ({ 
              small: url, 
              medium: url, 
              large: url, 
              full: url 
            })),
            contact: {
              address: {
                city: dbDog.location?.split(',')[0] || '',
                state: dbDog.location?.split(',')[1]?.trim() || ''
              },
              phone: dbDog.contact_info?.phone || '',
              email: dbDog.contact_info?.email || ''
            },
            url: dbDog.url,
            visibilityScore: dbDog.visibility_score,
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
            }
          }
        };
        
        return NextResponse.json(formattedDog);
      }
      
      console.log(`[💾 Database] Dog ${numericDogId} not found in database, trying Petfinder API`);
    } catch (dbError) {
      console.warn(`[⚠️ Database Error] Database lookup failed for dog ${numericDogId}:`, dbError);
      console.log(`[🔄 Fallback] Continuing with Petfinder API`);
    }

    // Get fresh access token for dog details
    let accessToken;
    try {
      console.log(`[🔑 Token] Getting access token for dog ${numericDogId}`);
      accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("No access token returned");
      }
      console.log(`[🔑 Token] Successfully obtained token for dog ${numericDogId}`);
    } catch (tokenError) {
      console.error(`[❌ Token Error] Failed to get access token for dog ${numericDogId}:`, tokenError);
      return NextResponse.json({ 
        error: "Authentication failed",
        details: "Could not obtain API access token"
      }, { status: 500 });
    }

    const apiUrl = `${PETFINDER_API_URL}/animals/${numericDogId}`;
    console.log(`[📡 API Request] Making request to: ${apiUrl}`);

    // Add delay before API call to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));

    // Make the API request with enhanced error handling
    let response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`[📡 Response] Initial response status: ${response.status} for dog ${numericDogId}`);

    // Handle rate limit specifically
    if (response.status === 429) {
      console.log(`[⚠️ Rate Limited] Dog ${numericDogId} - waiting and retrying`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try with fresh token
      try {
        accessToken = await getAccessToken(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        console.log(`[🔄 Rate Limit Retry] Status: ${response.status} for dog ${numericDogId}`);
      } catch (retryError) {
        console.error(`[❌ Rate Limit Retry Failed] Dog ${numericDogId}:`, retryError);
        return NextResponse.json({ 
          error: "Rate limit exceeded",
          details: "Please try again in a few moments"
        }, { status: 429 });
      }
    }

    // Handle 401 authentication errors with multiple retry attempts
    if (response.status === 401) {
      console.log(`[🔄 Auth Error] Got 401 for dog ${numericDogId}, attempting fresh token retry...`);

      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount < maxRetries && response.status === 401) {
        retryCount++;
        console.log(`[🔄 Auth Retry ${retryCount}] Attempting retry ${retryCount}/${maxRetries} for dog ${numericDogId}`);

        try {
          // Force refresh token
          accessToken = await getAccessToken(true);
          console.log(`[🔑 Fresh Token] Got new token for retry ${retryCount}`);

          // Wait longer between retries
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));

          response = await fetch(apiUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          console.log(`[🔄 Auth Retry ${retryCount}] Response status: ${response.status} for dog ${numericDogId}`);
        } catch (retryError) {
          console.error(`[❌ Auth Retry ${retryCount} Failed] Dog ${numericDogId}:`, retryError);
          
          if (retryCount === maxRetries) {
            return NextResponse.json({ 
              error: "Authentication failed after multiple retries",
              details: "Unable to authenticate with Petfinder API"
            }, { status: 401 });
          }
        }
      }
    }

    // Check if request was successful after all retries
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[❌ API Error Final] ${response.status} for dog ${numericDogId}:`, errorText);

      // Handle specific error cases
      if (response.status === 404) {
        console.error(`[❌ Dog Not Found] Dog ID ${numericDogId} does not exist in Petfinder`);
        return NextResponse.json({ 
          error: "Dog not found",
          details: `Dog with ID ${numericDogId} was not found. The dog may have been adopted or the listing removed.`
        }, { status: 404 });
      }

      if (response.status === 401) {
        console.error(`[❌ Auth Failed Final] Still getting 401 after all retries for dog ${numericDogId}`);
        return NextResponse.json({ 
          error: "Authentication failed",
          details: "Unable to authenticate with Petfinder API after multiple attempts"
        }, { status: 401 });
      }

      if (response.status === 500) {
        console.error(`[❌ Server Error] Petfinder API server error for dog ${numericDogId}`);
        return NextResponse.json({ 
          error: "Petfinder API server error",
          details: "The Petfinder API is experiencing issues. Please try again later."
        }, { status: 502 });
      }

      // For other errors
      return NextResponse.json({ 
        error: "Failed to fetch dog details",
        details: `Petfinder API error: ${response.status}`,
        dogId: numericDogId
      }, { status: response.status });
    }

    const data = await response.json();
    console.log(`[✅ Dog Details Success] Retrieved data for: ${data.animal?.name || 'Unknown'} (ID: ${numericDogId})`);

    // Validate the response structure
    if (!data.animal) {
      console.error(`[❌ Invalid Response] No animal data in response for dog ${numericDogId}`);
      return NextResponse.json({ 
        error: "Invalid response from Petfinder API",
        details: "No animal data found in response"
      }, { status: 502 });
    }

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
