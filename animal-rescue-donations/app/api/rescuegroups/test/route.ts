
import { NextResponse } from 'next/server';
import { RescueGroupsAPI } from '@/lib/rescuegroups';

export async function GET() {
  try {
    const rescueGroupsAPI = new RescueGroupsAPI();
    
    // Test basic API connectivity with a small search
    const testAnimals = await rescueGroupsAPI.searchAnimals({
      limit: 5
    });

    return NextResponse.json({
      success: true,
      message: `RescueGroups API test successful! Found ${testAnimals.length} animals`,
      data: {
        totalFound: testAnimals.length,
        sampleAnimal: testAnimals[0] ? {
          id: testAnimals[0].animalID,
          name: testAnimals[0].animalName,
          breed: testAnimals[0].animalPrimaryBreed,
          location: testAnimals[0].animalLocationCitystate
        } : null
      }
    });
  } catch (error) {
    console.error('[❌ RescueGroups Test] Failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'RescueGroups API test failed'
    }, { status: 500 });
  }
}
