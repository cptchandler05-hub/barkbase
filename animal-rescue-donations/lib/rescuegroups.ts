// RescueGroups v5 REST API Integration
// Documentation: https://userguide.rescuegroups.org/display/APIDG/API+Developer+Guide

interface RescueGroupsAnimal {
  id: string;
  name: string;
  status: string;
  species: string;
  organization: string;
  ageGroup: string;
  sex: string;
  sizeGroup: string;
  breedPrimary: string;
  breedSecondary?: string;
  breedMixed: boolean;
  descriptionText: string;
  specialNeeds: boolean;
  houseTrained: boolean;
  goodWithChildren: boolean;
  goodWithCats: boolean;
  goodWithDogs: boolean;
  pictures?: Array<{
    large?: string;
    original?: string;
    small?: string;
    order?: number;
  }>;
  thumbnailUrl?: string;
  url: string;
  distance?: number;
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
  latitude?: number;
  longitude?: number;
}

class RescueGroupsAPI {
  private apiKey: string;
  private baseURL = 'https://api.rescuegroups.org/v5/public/animals';

  constructor() {
    this.apiKey = process.env.RESCUEGROUPS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('RESCUEGROUPS_API_KEY environment variable is required');
    }
  }

  private async makeRequest(url: string): Promise<any> {
    console.log('[🦮 RescueGroups] Making GET request to:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'BarkBase/1.0'
      }
    });

    console.log('[🦮 RescueGroups] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ RescueGroups] Response error:', errorText);
      throw new Error(`RescueGroups API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[🦮 RescueGroups] Response result:', JSON.stringify(result, null, 2));

    return result;
  }

  async searchAnimals(params: RescueGroupsSearchParams): Promise<RescueGroupsAnimal[]> {
    const endpoint = `${this.baseURL}/search/available/dogs`;
    const url = new URL(endpoint);
    const searchParams = url.searchParams;

    // Add location-based filters
    if (params.latitude && params.longitude) {
      searchParams.append('filter[geoLatitude]', params.latitude.toString());
      searchParams.append('filter[geoLongitude]', params.longitude.toString());
      searchParams.append('filter[geoRadius]', (params.radius || 100).toString());
    } else if (params.location) {
      searchParams.append('filter[location]', params.location);
      searchParams.append('filter[distance]', (params.radius || 100).toString());
    }

    // Add breed filter
    if (params.breed) {
      searchParams.append('filter[breedPrimary]', params.breed);
    }

    // Add age filter
    if (params.age) {
      searchParams.append('filter[ageGroup]', params.age);
    }

    // Add size filter
    if (params.size) {
      searchParams.append('filter[sizeGroup]', params.size);
    }

    // Add gender filter
    if (params.gender) {
      searchParams.append('filter[sex]', params.gender);
    }

    // Add limit
    if (params.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    // Specify fields to return
    const fields = [
      'id',
      'name',
      'status',
      'species',
      'organization',
      'ageGroup',
      'sex',
      'sizeGroup',
      'breedPrimary',
      'breedSecondary',
      'breedMixed',
      'descriptionText',
      'specialNeeds',
      'houseTrained',
      'goodWithChildren',
      'goodWithCats',
      'goodWithDogs',
      'pictures',
      'thumbnailUrl',
      'url',
      'distance'
    ];
    searchParams.append('fields[animals]', fields.join(','));

    try {
      console.log('[🦮 RescueGroups] Searching with params:', params);
      const result = await this.makeRequest(url.toString());

      const animals = result.data || [];
      console.log(`[✅ RescueGroups] Found ${animals.length} animals`);

      return animals;
    } catch (error) {
      console.error('[❌ RescueGroups] Search failed:', error);
      throw error;
    }
  }

  async getAnimalDetails(animalId: string): Promise<RescueGroupsAnimal | null> {
    const endpoint = `${this.baseURL}/${animalId}`;
    const url = new URL(endpoint);

    // Specify fields to return
    const fields = [
      'id',
      'name',
      'status',
      'species',
      'organization',
      'ageGroup',
      'sex',
      'sizeGroup',
      'breedPrimary',
      'breedSecondary',
      'breedMixed',
      'descriptionText',
      'specialNeeds',
      'houseTrained',
      'goodWithChildren',
      'goodWithCats',
      'goodWithDogs',
      'pictures',
      'thumbnailUrl',
      'url'
    ];
    url.searchParams.append('fields[animals]', fields.join(','));

    try {
      console.log(`[🦮 RescueGroups] Getting details for animal: ${animalId}`);
      const result = await this.makeRequest(url.toString());

      const animal = result.data?.[0] || null;
      console.log(`[✅ RescueGroups] Got details for: ${animal?.name || 'Unknown'}`);

      return animal;
    } catch (error) {
      console.error(`[❌ RescueGroups] Failed to get details for ${animalId}:`, error);
      return null;
    }
  }

  // Transform RescueGroups animal to our database format
  transformToDatabaseFormat(animal: RescueGroupsAnimal): any {
    // Parse photos
    const photos = [];
    if (animal.pictures && Array.isArray(animal.pictures)) {
      // Sort by order and extract URLs
      const sortedPictures = animal.pictures
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      for (const pic of sortedPictures) {
        const url = pic.large || pic.original || pic.small;
        if (url) photos.push(url);
      }
    }

    // Add fallback for thumbnail URL if no pictures array
    if (photos.length === 0 && animal.thumbnailUrl) {
      photos.push(animal.thumbnailUrl);
    }

    return {
      rescuegroups_id: animal.id,
      api_source: 'rescuegroups',
      organization_id: animal.organization || '',
      url: animal.url || '',
      name: animal.name || 'Unknown',
      type: 'Dog',
      species: 'Dog',
      primary_breed: animal.breedPrimary || 'Mixed Breed',
      secondary_breed: animal.breedSecondary || null,
      is_mixed: animal.breedMixed || false,
      is_unknown_breed: false,
      age: animal.ageGroup || 'Unknown',
      gender: animal.sex || 'Unknown',
      size: animal.sizeGroup || 'Unknown',
      status: 'adoptable',
      spayed_neutered: null, // Not available in v5 API
      house_trained: animal.houseTrained || null,
      special_needs: animal.specialNeeds || null,
      good_with_children: animal.goodWithChildren || null,
      good_with_dogs: animal.goodWithDogs || null,
      good_with_cats: animal.goodWithCats || null,
      description: animal.descriptionText || null,
      photos: photos,
      tags: [],
      contact_info: {},
      city: 'Unknown',
      state: 'Unknown',
      postcode: null,
      latitude: null,
      longitude: null,
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  }
}

export { RescueGroupsAPI, type RescueGroupsAnimal, type RescueGroupsSearchParams };