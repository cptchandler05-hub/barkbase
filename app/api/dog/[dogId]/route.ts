import { NextResponse } from 'next/server';
import { PetfinderAPI } from '@/lib/petfinder';
import { DogFormatter } from '@/lib/dogFormatter';
import { searchPets } from '@/lib/adoptionPage';
import { getDogDetails as getDogDetailsFromDB } from '@/lib/db';
import { searchPets as searchChatPets } from '@/lib/chat';

// Mock RescueGroupsAPI for demonstration purposes if not provided
// If RescueGroupsAPI is truly removed, this mock might not be needed,
// but keeping it here as a placeholder if any part of the logic still expects it
class RescueGroupsAPI {
  async getAnimalDetails(dogId) {
    console.log(`Mock RescueGroupsAPI: getAnimalDetails called for ${dogId}`);
    // Simulate not finding the dog to test the fallback
    return null;
  }
  async searchAnimals(params) {
    console.log('Mock RescueGroupsAPI: searchAnimals called');
    return [];
  }
}

/**
 * Searches for dogs using a priority waterfall: Database -> RescueGroups -> Petfinder
 * This endpoint is used by the adoption page.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || '';
  const location = searchParams.get('location') || '';
  const breed = searchParams.get('breed') || '';
  const age = searchParams.get('age') || '';
  const size = searchParams.get('size') || '';
  const gender = searchParams.get('gender') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    // PHASE 1: Database Search
    console.log('[🍃 DB] Searching Database...');
    const dbResult = await searchPets(query, location, breed, age, size, gender, page, limit, 'db');

    if (dbResult && dbResult.animals && dbResult.animals.length > 0) {
      console.log(`[✅ DB Hit] Found ${dbResult.animals.length} dogs in Database`);
      return NextResponse.json({ animals: dbResult.animals, total: dbResult.total, source: 'db' });
    }

    // Removed RescueGroups search from here as per the user's request.
    // Now directly falls back to Petfinder.

    // PHASE 2: Petfinder Search
    console.log('[🐾 Petfinder] Searching Petfinder...');
    const petfinder = new PetfinderAPI();
    const pfResult = await petfinder.searchAnimals({
      query,
      location,
      breed,
      age,
      size,
      gender,
      page,
      limit
    });

    if (pfResult) {
      console.log(`[✅ Petfinder Hit] Found ${pfResult.animals.length} dogs in Petfinder`);
      const formattedAnimals = pfResult.animals.map(animal => DogFormatter.formatPetfinderDog(animal));
      return NextResponse.json({ animals: formattedAnimals, total: pfResult.total, source: 'petfinder' });
    }

    return NextResponse.json({ animals: [], total: 0, source: 'none' });

  } catch (error) {
    console.error('Error in adoption search:', error);
    return NextResponse.json({ error: 'An error occurred while searching for pets.' }, { status: 500 });
  }
}

/**
 * Fetches details for a specific dog.
 * This endpoint is used to get detailed information about a dog.
 */
export async function PUT(request) {
  const { dogId } = await request.json();

  if (!dogId) {
    return NextResponse.json({ error: 'Dog ID is required.' }, { status: 400 });
  }

  try {
    // PHASE 1: Database Lookup
    console.log(`[🍃 DB] Looking up dog details for ID: ${dogId}...`);
    const dbDog = await getDogDetailsFromDB(dogId);

    if (dbDog) {
      console.log(`[✅ DB Hit] Found dog details in Database for ID: ${dogId}`);
      // Assuming dbDog is already in the desired format or needs minimal formatting
      return NextResponse.json({ animal: dbDog, source: 'db' });
    }

    // Removed RescueGroups lookup from here as per the user's request.
    // Now directly falls back to Petfinder.

    // PHASE 2: Petfinder Fallback
    console.log(`[🐾 Petfinder] Looking up dog details for ID: ${dogId}...`);
    const petfinder = new PetfinderAPI();
    const pfAnimal = await petfinder.getAnimalDetails(dogId);

    if (pfAnimal) {
      console.log(`[✅ Petfinder Hit] Found dog details in Petfinder for ID: ${dogId}`);
      const formattedDog = DogFormatter.formatPetfinderDog(pfAnimal);
      return NextResponse.json({ animal: DogFormatter.toLegacyFormat(formattedDog, false), source: 'petfinder' });
    }

    return NextResponse.json({ error: 'Dog not found in any source.', source: 'none' }, { status: 404 });

  } catch (error) {
    console.error(`Error fetching dog details for ID ${dogId}:`, error);
    return NextResponse.json({ error: 'An error occurred while fetching dog details.' }, { status: 500 });
  }
}