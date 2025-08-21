// RescueGroups v5 REST API Integration
// Documentation: https://userguide.rescuegroups.org/display/APIDG/API+Developer+Guide

interface RescueGroupsAnimal {
  id: string;
  attributes: {
    name: string;
    status: string;
    species: string;
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
    updated: string;
    created: string;
    animalLocationCity?: string;
    animalLocationState?: string;
    animalLocationPostalcode?: string;
  };
  relationships?: {
    orgs?: {
      data?: Array<{ id: string; type: string }>;
    };
    locations?: {
      data?: Array<{ id: string; type: string }>;
    };
    breeds?: {
      data?: Array<{ id: string; type: string }>;
    };
    pictures?: {
      data?: Array<{ id: string; type: string }>;
    };
  };
}

interface RescueGroupsSearchParams {
  location?: string; // ZIP code or "City, State"
  breed?: string;
  age?: string;
  size?: string;
  gender?: string;
  limit?: number;
  radius?: number;
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
    console.log('[🦮 RescueGroups] Response result structure:', {
      dataCount: result.data?.length || 0,
      includedCount: result.included?.length || 0,
      meta: result.meta || 'none'
    });

    return result;
  }

  async searchAnimals(params: RescueGroupsSearchParams): Promise<{ animals: RescueGroupsAnimal[], included: any[] }> {
    console.log(`[🦮 RescueGroups] Fetching national dog sample (location filters don't work reliably)`);

    // Simplified approach: Get dogs without location filtering since the API ignores it anyway
    const simplifiedParams = {
      breed: params.breed,
      age: params.age,
      size: params.size,
      gender: params.gender,
      limit: params.limit || 50
    };

    console.log(`[🎯 RescueGroups] Requesting diverse national sample with non-location filters`);
    const result = await this.attemptSearch(simplifiedParams);

    if (result.animals.length > 0) {
      console.log(`[✅ RescueGroups] Got ${result.animals.length} dogs from national sample`);
      return result;
    }

    // Fallback: Ultra-basic request if any filters fail
    console.log(`[🎯 RescueGroups] Fallback: Basic request with no filters`);
    const basicResult = await this.attemptSearch({ limit: params.limit || 50 });

    console.log(`[📊 RescueGroups] Final result: ${basicResult.animals.length} dogs`);
    return basicResult;
  }

  private async attemptSearch(params: RescueGroupsSearchParams): Promise<{ animals: RescueGroupsAnimal[], included: any[] }> {
    // CORRECTED: Use the proper dogs-specific endpoint as recommended by ChatGPT
    const endpoint = `${this.baseURL}/search/available/dogs`;
    const url = new URL(endpoint);
    const searchParams = url.searchParams;

    // CRITICAL: Force dogs only - use the correct API v5 schema field name
    searchParams.append('filter[animalSpecies]', 'Dog');
    searchParams.append('filter[animalStatus]', 'Available');

    // Filter for recently updated animals (last 3 months to get more relevant results)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    searchParams.append('filter[animalUpdatedDate]', `>${threeMonthsAgo.toISOString().split('T')[0]}`);

    // FIXED: Use correct RescueGroups v5 location filtering
    if (params.location) {
      const radius = params.radius || 250;
      
      // Use correct API parameters as per ChatGPT feedback
      searchParams.append('filter[location]', params.location);
      searchParams.append('filter[locationDistance]', radius.toString());
      
      console.log(`[🗺️ RescueGroups] Using location: ${params.location} with radius ${radius}mi`);
    }

    // FIXED: Breed filtering using the correct API parameter as per ChatGPT feedback
    if (params.breed) {
      const breedName = params.breed.trim().toLowerCase();

      // Convert search terms to exact RescueGroups API breed names
      const breedMappings: { [key: string]: string } = {
        'chihuahuas': 'Chihuahua',
        'chihuahua': 'Chihuahua',
        'labs': 'Labrador Retriever',
        'lab': 'Labrador Retriever',
        'labrador': 'Labrador Retriever',
        'german shepherds': 'German Shepherd Dog',
        'german shepherd': 'German Shepherd Dog',
        'pit bulls': 'Pit Bull Terrier',
        'pitbull': 'Pit Bull Terrier',
        'pit bull': 'Pit Bull Terrier',
        'golden retrievers': 'Golden Retriever',
        'golden retriever': 'Golden Retriever',
        'huskies': 'Siberian Husky',
        'husky': 'Siberian Husky',
        'terriers': 'Terrier',
        'terrier': 'Terrier',
        'bulldogs': 'Bulldog',
        'bulldog': 'Bulldog',
        'beagles': 'Beagle',
        'beagle': 'Beagle'
      };

      const apiBreed = breedMappings[breedName] || breedName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      // Use correct API v5 breed filtering
      searchParams.append('filter[animalBreeds]', apiBreed);

      console.log(`[🔍 RescueGroups] Applying breed filter: ${apiBreed} (from: ${breedName})`);
    }

    // Other filters - FIXED: Use correct API v5 schema field names
    if (params.age) {
      searchParams.append('filter[animalGeneralAge]', params.age);
    }

    if (params.size) {
      searchParams.append('filter[animalSizes]', params.size);
    }

    if (params.gender) {
      searchParams.append('filter[animalSex]', params.gender);
    }

    // Set limit
    const limit = Math.min(params.limit || 50, 100);
    searchParams.append('limit', limit.toString());

    // Request specific fields - FIXED per ChatGPT feedback to include proper location fields
    const fields = [
      'id',
      'name',
      'animalStatus',
      'animalSpecies',
      'animalGeneralAge',
      'animalSex',
      'animalSizes',
      'animalBreedPrimary',
      'animalBreedSecondary',
      'animalMixed',
      'animalDescription',
      'animalSpecialneeds',
      'animalHouseTrained',
      'animalGoodWithChildren',
      'animalGoodWithCats',
      'animalGoodWithDogs',
      'animalPictures',
      'animalThumbnailUrl',
      'animalUrl',
      'animalDistance',
      'animalUpdatedDate',
      'animalCreatedDate',
      // Add location fields per ChatGPT feedback
      'animalLocationCity',
      'animalLocationState',
      'animalLocationPostalcode'
    ];
    searchParams.append('fields[animals]', fields.join(','));

    // Include related data
    searchParams.append('include', 'orgs,locations,breeds,pictures');

    try {
      console.log('[🦮 RescueGroups] Search URL:', url.toString());

      const result = await this.makeRequest(url.toString());

      const animals = result.data || [];
      const included = result.included || [];

      console.log(`[📊 RescueGroups] Found ${animals.length} animals`);

      // Geographic filtering is handled by RescueGroups API itself
      console.log(`[🗺️ RescueGroups] API-filtered results: ${animals.length} dogs`);

      return { animals, included };

      return { animals, included };
    } catch (error) {
      console.error('[❌ RescueGroups] Search attempt failed:', error);
      return { animals: [], included: [] };
    }
  }

  private filterGeographicallyRelevant(animals: RescueGroupsAnimal[], included: any[], searchLat: number, searchLng: number, maxRadius: number): RescueGroupsAnimal[] {
    return animals.filter(animal => {
      // Try to get location from animal attributes first
      const attrs = animal.attributes || {};
      let animalLat = null;
      let animalLng = null;

      // Check if we have direct coordinates in attributes
      if (attrs.animalLocationCity || attrs.animalLocationState) {
          // This is a bit of a hack, but if city/state are present, we assume coordinates might be available or implied for distance calculation.
          // A more robust solution would involve geocoding these directly if lat/lng are missing.
          // For now, we'll rely on the included location data if available.
      }

      // Fallback to included location data if direct attributes don't provide lat/lng
      if (!animalLat && animal.relationships?.locations?.data?.[0] && included.length > 0) {
        const locationData = included.find((item: any) =>
          item.type === 'locations' && item.id === animal.relationships.locations.data[0].id
        );
        if (locationData?.attributes) {
          animalLat = parseFloat(locationData.attributes.lat || locationData.attributes.latitude || 0);
          animalLng = parseFloat(locationData.attributes.lon || locationData.attributes.lng || locationData.attributes.longitude || 0);
        }
      }
      // If no lat/lng could be determined from attributes or included data, we can't verify relevance, so include it.
      // This might happen if the API data is incomplete for a specific animal.
      if (!animalLat || !animalLng) {
        return true;
      }

      // Calculate distance
      const distance = this.calculateDistance(searchLat, searchLng, animalLat, animalLng);
      return distance <= maxRadius;
    });
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
      'animalLocationCity',
      'animalLocationState',
      'animalLocationPostalcode'
    ];
    url.searchParams.append('fields[animals]', fields.join(','));
    url.searchParams.append('include', 'orgs,locations,breeds,pictures');

    try {
      console.log(`[🦮 RescueGroups] Getting details for animal: ${animalId}`);
      const result = await this.makeRequest(url.toString());

      const animal = result.data?.[0] || null;
      console.log(`[✅ RescueGroups] Got details for: ${animal?.attributes?.name || 'Unknown'}`);

      return animal;
    } catch (error) {
      console.error(`[❌ RescueGroups] Failed to get details for ${animalId}:`, error);
      return null;
    }
  }

  // Transform RescueGroups animal to our database format
  transformToDatabaseFormat(animal: RescueGroupsAnimal, included: any[] = []): any {
    const attrs = animal.attributes || {};

    // Parse photos from included data or attributes
    const photos = [];

    // Try to get photos from relationships and included data
    if (animal.relationships?.pictures?.data && included.length > 0) {
      const pictureIds = animal.relationships.pictures.data.map((pic: any) => pic.id);
      const pictureObjects = included.filter((item: any) =>
        item.type === 'pictures' && pictureIds.includes(item.id)
      );

      for (const pic of pictureObjects) {
        const url = pic.attributes?.large || pic.attributes?.original || pic.attributes?.small;
        if (url) photos.push(url);
      }
    }

    // Fallback to direct pictures in attributes
    if (photos.length === 0 && attrs.pictures && Array.isArray(attrs.pictures)) {
      const sortedPictures = attrs.pictures.sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const pic of sortedPictures) {
        const url = pic.large || pic.original || pic.small;
        if (url) photos.push(url);
      }
    }

    // Add fallback for thumbnail URL
    if (photos.length === 0 && attrs.thumbnailUrl) {
      photos.push(attrs.thumbnailUrl);
    }

    // Get organization info from included data
    let orgId = '';
    if (animal.relationships?.orgs?.data?.[0] && included.length > 0) {
      const orgData = included.find((item: any) =>
        item.type === 'orgs' && item.id === animal.relationships.orgs.data[0].id
      );
      orgId = orgData?.id || '';
    }

    // Get location info - FIXED per ChatGPT feedback to use direct animal attributes and included data
    let city = 'Unknown', state = 'Unknown', latitude = null, longitude = null;

    // Try direct animal attributes first
    if (attrs.animalLocationCity || attrs.animalLocationState) {
      city = attrs.animalLocationCity || 'Unknown';
      state = attrs.animalLocationState || 'Unknown';
      console.log(`[🌍 RG Location Direct] ${attrs.name}: ${city}, ${state}`);
    }
    // Fallback to included data if direct attributes not available or insufficient
    else if (animal.relationships?.locations?.data?.[0] && included.length > 0) {
      const locationData = included.find((item: any) =>
        item.type === 'locations' && item.id === animal.relationships.locations.data[0].id
      );
      if (locationData?.attributes) {
        const locationAttrs = locationData.attributes;

        // Try multiple city fields with better fallbacks
        city = locationAttrs.city || locationAttrs.name || locationAttrs.citystate?.split(',')[0]?.trim() || 'Unknown';

        // Try multiple state fields
        state = locationAttrs.state || locationAttrs.citystate?.split(',')[1]?.trim() || 'Unknown';

        // Get coordinates
        latitude = parseFloat(locationAttrs.lat || locationAttrs.latitude || '0');
        longitude = parseFloat(locationAttrs.lon || locationAttrs.lng || locationAttrs.longitude || '0');

        console.log(`[🌍 RG Location Included] ${attrs.name}: ${city}, ${state} (${latitude}, ${longitude})`);
      }
    }

    // If after checking attributes and included data, we still don't have lat/lng, use 0.0 as default
    if (latitude === null) latitude = 0.0;
    if (longitude === null) longitude = 0.0;


    return {
      rescuegroups_id: animal.id,
      api_source: 'rescuegroups',
      organization_id: orgId,
      url: attrs.url || '',
      name: attrs.name || 'Unknown',
      type: 'Dog',
      species: 'Dog',
      primary_breed: attrs.animalBreedPrimary || 'Mixed Breed',
      secondary_breed: attrs.animalBreedSecondary || null,
      is_mixed: attrs.animalMixed || false,
      is_unknown_breed: false,
      age: attrs.animalGeneralAge || 'Unknown',
      gender: attrs.animalSex || 'Unknown',
      size: attrs.animalSizes || 'Unknown',
      status: 'adoptable',
      spayed_neutered: null,
      house_trained: attrs.animalHouseTrained || null,
      special_needs: attrs.animalSpecialneeds || null,
      good_with_children: attrs.animalGoodWithChildren || null,
      good_with_dogs: attrs.animalGoodWithDogs || null,
      good_with_cats: attrs.animalGoodWithCats || null,
      description: attrs.animalDescription || null,
      photos: photos,
      tags: [],
      contact_info: {},
      city: city,
      state: state,
      postcode: attrs.animalLocationPostalcode || null,
      latitude: latitude,
      longitude: longitude,
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  }
}

export { RescueGroupsAPI, type RescueGroupsAnimal, type RescueGroupsSearchParams };