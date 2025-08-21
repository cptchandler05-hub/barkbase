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
    console.log('[🦮 RescueGroups] Response result structure:', {
      dataCount: result.data?.length || 0,
      includedCount: result.included?.length || 0,
      meta: result.meta || 'none'
    });

    return result;
  }

  async searchAnimals(params: RescueGroupsSearchParams): Promise<{ animals: RescueGroupsAnimal[], included: any[] }> {
    console.log(`[🦮 RescueGroups] Starting smart fallback search with params:`, params);

    // Attempt 1: Full filters
    console.log(`[🎯 RescueGroups] Attempt 1: Full filters`);
    let result = await this.attemptSearch(params);

    if (result.animals.length > 0) {
      console.log(`[✅ RescueGroups] Success with full filters: ${result.animals.length} dogs`);
      return result;
    }

    // Attempt 2: Remove breed filter if it was used
    if (params.breed) {
      console.log(`[🎯 RescueGroups] Attempt 2: Removing strict breed filter "${params.breed}"`);
      const paramsWithoutBreed = { ...params, breed: undefined };
      result = await this.attemptSearch(paramsWithoutBreed);

      if (result.animals.length > 0) {
        console.log(`[✅ RescueGroups] Success without breed filter: ${result.animals.length} dogs`);
        return result;
      }
    }

    // Attempt 3: Expand radius if location was provided
    if (params.latitude && params.longitude && (params.radius || 100) < 250) {
      console.log(`[🎯 RescueGroups] Attempt 3: Expanding radius to 250 miles`);
      const paramsWithLargerRadius = { ...params, breed: undefined, radius: 250 };
      result = await this.attemptSearch(paramsWithLargerRadius);

      if (result.animals.length > 0) {
        console.log(`[✅ RescueGroups] Success with expanded radius: ${result.animals.length} dogs`);
        return result;
      }
    }

    // Attempt 4: Location-only search (no breed, no other filters except location)
    if (params.latitude && params.longitude) {
      console.log(`[🎯 RescueGroups] Attempt 4: Location-only search (removing all non-location filters)`);
      const locationOnlyParams = {
        latitude: params.latitude,
        longitude: params.longitude,
        radius: 250,
        limit: params.limit
      };
      result = await this.attemptSearch(locationOnlyParams);

      if (result.animals.length > 0) {
        console.log(`[✅ RescueGroups] Success with location-only search: ${result.animals.length} dogs`);
        return result;
      }
    }

    console.log(`[❌ RescueGroups] All attempts failed - returning empty results to trigger Petfinder fallback`);
    return { animals: [], included: [] };
  }

  private async attemptSearch(params: RescueGroupsSearchParams): Promise<{ animals: RescueGroupsAnimal[], included: any[] }> {
    // CORRECTED: Use the proper dogs-specific endpoint as recommended by ChatGPT
    const endpoint = `${this.baseURL}/search/available/dogs`;
    const url = new URL(endpoint);
    const searchParams = url.searchParams;

    // CRITICAL: Force dogs only - use the correct field name
    searchParams.append('filter[species]', 'dog'); // lowercase as per API docs

    // Filter for recently updated animals (last 3 months to get more relevant results)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    searchParams.append('filter[updated]', `>${threeMonthsAgo.toISOString().split('T')[0]}`);

    // FIXED: Location-based filtering - Use single correct parameter format
    if (params.latitude && params.longitude) {
      const radius = params.radius || 250; // Increase default radius

      // Use only the correct RescueGroups v5 parameter format (don't duplicate)
      searchParams.append('filter[location.latitude]', params.latitude.toFixed(6));
      searchParams.append('filter[location.longitude]', params.longitude.toFixed(6));
      searchParams.append('filter[location.distance]', radius.toString());

      console.log(`[🗺️ RescueGroups] Using coordinates: ${params.latitude.toFixed(6)}, ${params.longitude.toFixed(6)} with radius ${radius}mi`);
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

      // Try multiple breed filter parameter formats
      searchParams.append('filter[breedPrimary]', apiBreed);
      searchParams.append('filter[animalBreed]', apiBreed);

      console.log(`[🔍 RescueGroups] Applying breed filter: ${apiBreed} (from: ${breedName})`);
    }

    // Other filters
    if (params.age) {
      searchParams.append('filter[ageGroup]', params.age);
    }

    if (params.size) {
      searchParams.append('filter[sizeGroup]', params.size);
    }

    if (params.gender) {
      searchParams.append('filter[sex]', params.gender);
    }

    // Set limit
    const limit = Math.min(params.limit || 50, 100);
    searchParams.append('limit', limit.toString());

    // Request specific fields - FIXED per ChatGPT feedback to include proper location fields
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
      'distance',
      'updated',
      'created',
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

      // IMPORTANT: Check if results are geographically relevant
      if (animals.length > 0 && params.latitude && params.longitude) {
        const relevantAnimals = this.filterGeographicallyRelevant(animals, included, params.latitude, params.longitude, params.radius || 100);
        console.log(`[🗺️ RescueGroups] Geographic filtering: ${animals.length} → ${relevantAnimals.length} relevant results`);

        // If most results are irrelevant, treat as failed search
        if (relevantAnimals.length < animals.length * 0.3) {
          console.log(`[⚠️ RescueGroups] Too many irrelevant results (${relevantAnimals.length}/${animals.length}) - treating as failed search`);
          return { animals: [], included: [] };
        }

        return { animals: relevantAnimals, included };
      }

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
      primary_breed: attrs.breedPrimary || 'Mixed Breed',
      secondary_breed: attrs.breedSecondary || null,
      is_mixed: attrs.breedMixed || false,
      is_unknown_breed: false,
      age: attrs.ageGroup || 'Unknown',
      gender: attrs.sex || 'Unknown',
      size: attrs.sizeGroup || 'Unknown',
      status: 'adoptable',
      spayed_neutered: null,
      house_trained: attrs.houseTrained || null,
      special_needs: attrs.specialNeeds || null,
      good_with_children: attrs.goodWithChildren || null,
      good_with_dogs: attrs.goodWithDogs || null,
      good_with_cats: attrs.goodWithCats || null,
      description: attrs.descriptionText || null,
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