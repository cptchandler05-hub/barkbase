
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

    // FIXED: Location-based filtering - RescueGroups v5 uses geoLatitude/geoLongitude/geoRadius
    if (params.latitude && params.longitude) {
      // Use coordinates for precise filtering - EXACTLY as ChatGPT recommended
      searchParams.append('filter[geoLatitude]', params.latitude.toString());
      searchParams.append('filter[geoLongitude]', params.longitude.toString());
      
      const radius = params.radius || 100;
      searchParams.append('filter[geoRadius]', radius.toString());
      
      console.log(`[🗺️ RescueGroups] Using coordinates: ${params.latitude}, ${params.longitude} with radius ${radius}mi`);
    } else {
      // WITHOUT COORDINATES, WE CANNOT FILTER BY LOCATION AT ALL
      console.log(`[⚠️ RescueGroups] No coordinates available for "${params.location}" - results will be nationwide and unfiltered`);
      
      // Don't attempt any location filtering without coordinates
      // RescueGroups API requires lat/lng for geographic filtering
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
      
      // Use correct breed filter parameter - as per ChatGPT feedback
      searchParams.append('filter[animalBreed]', apiBreed);
      
      console.log(`[🔍 RescueGroups] Applying STRICT breed filter: ${apiBreed} (from: ${breedName})`);
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
      console.log('[🦮 RescueGroups] Final search URL:', url.toString());
      
      // Debug: Log all applied filters
      console.log('[🔍 RescueGroups] Applied filters:', {
        species: searchParams.get('filter[species]'),
        status: searchParams.get('filter[status]'),
        location: searchParams.get('filter[location]'),
        distance: searchParams.get('filter[distance]'),
        breedPrimary: searchParams.get('filter[breedPrimary]'),
        breedSecondary: searchParams.get('filter[breedSecondary]'),
        limit: searchParams.get('limit')
      });
      
      const result = await this.makeRequest(url.toString());

      const animals = result.data || [];
      const included = result.included || [];
      
      console.log(`[✅ RescueGroups] Found ${animals.length} animals with ${included.length} included items`);
      
      // Log sample data structure if we have results
      if (animals.length > 0) {
        console.log('[🔍 RescueGroups] Sample animal structure:', {
          id: animals[0].id,
          attributes: Object.keys(animals[0].attributes || {}),
          relationships: Object.keys(animals[0].relationships || {})
        });
        
        // Debug included data types
        if (included.length > 0) {
          const includedTypes = included.reduce((acc: any, item: any) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            return acc;
          }, {});
          console.log('[🔍 RG Included Types]:', includedTypes);
          
          // Show sample location data if available
          const sampleLocation = included.find((item: any) => item.type === 'locations');
          if (sampleLocation) {
            console.log('[🌍 RG Sample Location]:', {
              id: sampleLocation.id,
              attributes: Object.keys(sampleLocation.attributes || {})
            });
          }
          
          // Show sample picture data if available
          const samplePicture = included.find((item: any) => item.type === 'pictures');
          if (samplePicture) {
            console.log('[📷 RG Sample Picture]:', {
              id: samplePicture.id,
              attributes: Object.keys(samplePicture.attributes || {})
            });
          }
        }
      }

      return { animals, included };
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

    // Get location info - FIXED per ChatGPT feedback to use direct animal attributes
    let city = 'Unknown', state = 'Unknown', latitude = null, longitude = null;
    
    // First try direct animal attributes (per ChatGPT feedback)
    if (attrs.animalLocationCity || attrs.animalLocationState) {
      city = attrs.animalLocationCity || 'Unknown';
      state = attrs.animalLocationState || 'Unknown';
      console.log(`[🌍 RG Location Direct] ${attrs.name}: ${city}, ${state}`);
    }
    // Fallback to included data if direct attributes not available
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
        latitude = locationAttrs.lat || locationAttrs.latitude || null;
        longitude = locationAttrs.lon || locationAttrs.lng || locationAttrs.longitude || null;
        
        console.log(`[🌍 RG Location Included] ${attrs.name}: ${city}, ${state} (${latitude}, ${longitude})`);
      }
    }

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
      postcode: null,
      latitude: latitude,
      longitude: longitude,
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  }
}

export { RescueGroupsAPI, type RescueGroupsAnimal, type RescueGroupsSearchParams };
