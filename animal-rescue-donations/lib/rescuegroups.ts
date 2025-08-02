// RescueGroups API Integration
// Documentation: https://userguide.rescuegroups.org/display/APIDG/API+Developer+Guide

interface RescueGroupsAnimal {
  animalID: string;
  animalOrgID: string;
  animalName: string;
  animalGeneralAge: string;
  animalSex: string;
  animalGeneralSizePotential: string;
  animalPrimaryBreed: string;
  animalSecondaryBreed?: string;
  animalMixedBreed: string;
  animalDescription: string;
  animalStatus: string;
  animalSpecialNeeds: string;
  animalHousetrained: string;
  animalGoodWithKids: string;
  animalGoodWithCats: string;
  animalGoodWithDogs: string;
  animalAltered: string;
  animalPictures?: any[];
  animalLocationAddress: string;
  animalLocationCitystate: string;
  animalLocationPostalcode: string;
  animalLocationDistance?: number;
  animalThumbnailUrl?: string;
  animalUrl: string;
  [key: string]: any;
}

interface RescueGroupsSearchParams {
  location?: string;
  breed?: string;
  age?: string;
  size?: string;
  gender?: string;
  limit?: number;
  radius?: number;
}

class RescueGroupsAPI {
  private apiKey: string;
  private baseURL = 'https://api.rescuegroups.org/http/v2.json';

  constructor() {
    this.apiKey = process.env.RESCUEGROUPS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('RESCUEGROUPS_API_KEY environment variable is required');
    }
  }

  private async makeRequest(data: any): Promise<any> {
    console.log('[🦮 RescueGroups] Making request with data:', JSON.stringify(data, null, 2));
    
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BarkBase/1.0'
      },
      body: JSON.stringify({
        apikey: this.apiKey,
        ...data
      })
    });

    console.log('[🦮 RescueGroups] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ RescueGroups] Response error:', errorText);
      throw new Error(`RescueGroups API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[🦮 RescueGroups] Response result:', JSON.stringify(result, null, 2));

    if (result.status !== 'ok') {
      const errorMsg = result.messages?.generalMessages?.[0]?.messageText || JSON.stringify(result.messages) || 'Unknown error';
      console.error('[❌ RescueGroups] API status not ok:', errorMsg);
      throw new Error(`RescueGroups API error: ${errorMsg}`);
    }

    return result;
  }

  async searchAnimals(params: RescueGroupsSearchParams): Promise<RescueGroupsAnimal[]> {
    const searchData = {
      objectType: 'animals',
      objectAction: 'publicSearch',
      search: {
        resultStart: 0,
        resultLimit: params.limit || 100,
        resultSort: 'animalID',
        resultOrder: 'asc',
        filters: [
          {
            fieldName: 'animalSpecies',
            operation: 'equal',
            criteria: 'Dog'
          },
          {
            fieldName: 'animalStatus',
            operation: 'equal', 
            criteria: 'Available'
          }
        ],
        fields: [
          'animalID',
          'animalOrgID', 
          'animalName',
          'animalGeneralAge',
          'animalSex',
          'animalGeneralSizePotential',
          'animalPrimaryBreed',
          'animalSecondaryBreed',
          'animalMixedBreed',
          'animalDescription',
          'animalStatus',
          'animalSpecialNeeds',
          'animalHousetrained',
          'animalGoodWithKids',
          'animalGoodWithCats', 
          'animalGoodWithDogs',
          'animalAltered',
          'animalPictures',
          'animalLocationAddress',
          'animalLocationCitystate',
          'animalLocationPostalcode',
          'animalThumbnailUrl',
          'animalUrl'
        ]
      }
    };

    // Add location filter if provided
    if (params.location) {
      searchData.search.filters.push({
        fieldName: 'animalLocationZip',
        operation: 'radius',
        criteria: params.location,
        radius: params.radius || 100
      });
    }

    // Add breed filter if provided
    if (params.breed) {
      searchData.search.filters.push({
        fieldName: 'animalPrimaryBreed',
        operation: 'contains',
        criteria: params.breed
      });
    }

    // Add additional filters
    if (params.age) {
      searchData.search.filters.push({
        fieldName: 'animalGeneralAge',
        operation: 'equal',
        criteria: params.age
      });
    }

    if (params.size) {
      searchData.search.filters.push({
        fieldName: 'animalGeneralSizePotential',
        operation: 'equal',
        criteria: params.size
      });
    }

    if (params.gender) {
      searchData.search.filters.push({
        fieldName: 'animalSex',
        operation: 'equal',
        criteria: params.gender
      });
    }

    try {
      console.log('[🦮 RescueGroups] Searching with params:', params);
      const result = await this.makeRequest(searchData);

      const animals = Object.values(result.data || {}) as RescueGroupsAnimal[];
      console.log(`[✅ RescueGroups] Found ${animals.length} animals`);

      return animals;
    } catch (error) {
      console.error('[❌ RescueGroups] Search failed:', error);
      throw error;
    }
  }

  async getAnimalDetails(animalId: string): Promise<RescueGroupsAnimal | null> {
    const detailData = {
      objectType: 'animals',
      objectAction: 'publicView',
      values: [
        {
          animalID: animalId
        }
      ],
      fields: [
        'animalID',
        'animalOrgID',
        'animalName', 
        'animalGeneralAge',
        'animalSex',
        'animalGeneralSizePotential',
        'animalPrimaryBreed',
        'animalSecondaryBreed',
        'animalMixedBreed',
        'animalDescription',
        'animalStatus',
        'animalSpecialNeeds',
        'animalHousetrained', 
        'animalGoodWithKids',
        'animalGoodWithCats',
        'animalGoodWithDogs',
        'animalAltered',
        'animalPictures',
        'animalLocationAddress',
        'animalLocationCitystate',
        'animalLocationPostalcode',
        'animalThumbnailUrl',
        'animalUrl'
      ]
    };

    try {
      console.log(`[🦮 RescueGroups] Getting details for animal: ${animalId}`);
      const result = await this.makeRequest(detailData);

      const animal = Object.values(result.data || {})[0] as RescueGroupsAnimal;
      console.log(`[✅ RescueGroups] Got details for: ${animal?.animalName || 'Unknown'}`);

      return animal || null;
    } catch (error) {
      console.error(`[❌ RescueGroups] Failed to get details for ${animalId}:`, error);
      return null;
    }
  }

  // Transform RescueGroups animal to our database format
  transformToDatabaseFormat(animal: RescueGroupsAnimal): any {
    // Parse location
    const locationParts = animal.animalLocationCitystate?.split(',') || [];
    const city = locationParts[0]?.trim() || 'Unknown';
    const state = locationParts[1]?.trim() || 'Unknown';

    // Parse photos
    const photos = Array.isArray(animal.animalPictures) 
      ? animal.animalPictures.map(pic => pic.large || pic.original || pic.small).filter(Boolean)
      : [];

    // Map boolean-like strings to actual booleans
    const mapBoolean = (value: string) => {
      if (!value) return null;
      const normalized = value.toLowerCase();
      if (normalized === 'yes' || normalized === '1' || normalized === 'true') return true;
      if (normalized === 'no' || normalized === '0' || normalized === 'false') return false;
      return null;
    };

    return {
      rescuegroups_id: animal.animalID,
      api_source: 'rescuegroups',
      organization_id: animal.animalOrgID || '',
      url: animal.animalUrl || '',
      name: animal.animalName || 'Unknown',
      type: 'Dog',
      species: 'Dog',
      primary_breed: animal.animalPrimaryBreed || 'Mixed Breed',
      secondary_breed: animal.animalSecondaryBreed || null,
      is_mixed: mapBoolean(animal.animalMixedBreed) || false,
      is_unknown_breed: false,
      age: animal.animalGeneralAge || 'Unknown',
      gender: animal.animalSex || 'Unknown', 
      size: animal.animalGeneralSizePotential || 'Unknown',
      status: 'adoptable',
      spayed_neutered: mapBoolean(animal.animalAltered),
      house_trained: mapBoolean(animal.animalHousetrained),
      special_needs: mapBoolean(animal.animalSpecialNeeds),
      good_with_children: mapBoolean(animal.animalGoodWithKids),
      good_with_dogs: mapBoolean(animal.animalGoodWithDogs),
      good_with_cats: mapBoolean(animal.animalGoodWithCats),
      description: animal.animalDescription || null,
      photos: photos,
      tags: [], // RescueGroups doesn't have tags in the same format
      contact_info: {}, // Would need organization details for this
      city: city,
      state: state,
      postcode: animal.animalLocationPostalcode || null,
      latitude: null, // Would need to geocode
      longitude: null, // Would need to geocode
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  }
}

export { RescueGroupsAPI, type RescueGroupsAnimal, type RescueGroupsSearchParams };