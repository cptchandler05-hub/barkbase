import { calculateVisibilityScore } from './scoreVisibility';

interface UnifiedDog {
  id: string;
  source: 'database' | 'rescuegroups' | 'petfinder';
  sourceId: string;
  organizationId: string;
  name: string;
  breeds: {
    primary: string;
    secondary?: string;
    mixed: boolean;
  };
  age: string;
  gender: string;
  size: string;
  description?: string;
  photos: Array<{
    small?: string;
    medium?: string;
    large?: string;
  }>;
  contact: {
    email?: string | null;
    phone?: string | null;
    address: {
      address1?: string | null;
      address2?: string | null;
      city: string;
      state: string;
      postcode?: string | null;
      country: string;
    };
  };
  characteristics?: {
    goodWithChildren?: boolean | null;
    goodWithDogs?: boolean | null;
    goodWithCats?: boolean | null;
    houseTrained?: boolean | null;
    specialNeeds?: boolean | null;
  };
  attributes?: {
    spayedNeutered?: boolean | null;
    houseTrained?: boolean | null;
    declawed?: boolean | null;
    specialNeeds?: boolean | null;
    shotsCurrent?: boolean | null;
    goodWithChildren?: boolean | null;
    goodWithDogs?: boolean | null;
    goodWithCats?: boolean | null;
  };
  url?: string;
  visibilityScore: number;
  verificationBadge: string;
  organizationName?: string; // Added for completeness
  primaryBreed?: string; // Added for completeness
  secondaryBreed?: string; // Added for completeness
  isMixed?: boolean; // Added for completeness
  petfinderId?: string; // Added for completeness
  rescueGroupsId?: string; // Added for completeness
  lastUpdated?: string; // Added for completeness
}

class DogFormatter {
  // Format database dog to unified format
  static formatDatabaseDog(dog: any): UnifiedDog {
    console.log(`[🗄️ DB Format] Processing: ${dog.name} (ID: ${dog.id}, Source: ${dog.api_source})`);

    // Handle photos array based on source - ENHANCED FORMATTING
    const photos = (dog.photos || []).map((photo: any, index: number) => {
      console.log(`[🖼️ DB Photo ${index}] Raw photo data type: ${typeof photo}`, photo);

      // Handle string URLs (RescueGroups direct URLs)
      if (typeof photo === 'string') {
        console.log(`[✅ DB Photo ${index}] String URL: ${photo}`);
        return {
          small: photo,
          medium: photo,
          large: photo
        };
      }
      // Handle object formats
      else if (photo && typeof photo === 'object') {
        // RescueGroups object format: {small: "url", medium: "url", large: "url"}
        if (photo.small || photo.medium || photo.large) {
          const result = {
            small: photo.small || photo.medium || photo.large,
            medium: photo.medium || photo.large || photo.small,
            large: photo.large || photo.medium || photo.small
          };
          console.log(`[✅ DB Photo ${index}] RescueGroups object format:`, result.medium);
          return result;
        }
        // Petfinder nested object format: {medium: {url: "..."}}
        else if (photo.medium && typeof photo.medium === 'object' && photo.medium.url) {
          console.log(`[✅ DB Photo ${index}] Petfinder nested format: ${photo.medium.url}`);
          return {
            small: photo.medium.url,
            medium: photo.medium.url,
            large: photo.medium.url
          };
        }
        // Petfinder direct object format: {small: "url", medium: "url", large: "url"}
        else if (typeof photo.medium === 'string') {
          console.log(`[✅ DB Photo ${index}] Petfinder direct format: ${photo.medium}`);
          return {
            small: photo.small || photo.medium || photo.large,
            medium: photo.medium || photo.large || photo.small,
            large: photo.large || photo.medium || photo.small
          };
        }
      }

      // Fallback for invalid photo data
      console.log(`[⚠️ DB Photo ${index}] Using fallback image for invalid data`);
      return {
        small: '/images/barkr.png',
        medium: '/images/barkr.png',
        large: '/images/barkr.png'
      };
    });

    console.log(`[🔍 DB Debug] ${dog.name} - Final photos count: ${photos.length}`);

    const visibilityScore = dog.visibility_score || calculateVisibilityScore({
      name: dog.name,
      description: dog.description,
      photos: photos,
      breeds: {
        primary: dog.primary_breed,
        secondary: dog.secondary_breed,
        mixed: dog.is_mixed
      },
      age: dog.age,
      gender: dog.gender,
      size: dog.size,
      contact: {
        address: {
          city: dog.city || 'Unknown',
          state: dog.state || 'Unknown'
        }
      }
    });

    // Ensure we always have a valid ID, fallback to database auto-increment ID if needed
    const petfinderId = dog.petfinder_id && dog.petfinder_id !== 'null' ? dog.petfinder_id : null;
    const rescueGroupsId = dog.rescuegroups_id && dog.rescuegroups_id !== 'null' ? dog.rescuegroups_id : null;
    const dbId = dog.id ? dog.id.toString() : null;

    const finalId = petfinderId || rescueGroupsId || (dbId ? `db-${dbId}` : `temp-${Date.now()}`);

    return {
      id: finalId,
      source: dog.api_source === 'rescuegroups' ? 'rescuegroups' : 'database',
      sourceId: finalId,
      organizationId: dog.organization_id || '',
      organizationName: dog.organization_name || '', // Added for completeness
      name: dog.name || 'Unknown',
      primaryBreed: dog.primary_breed || 'Mixed Breed', // Added for completeness
      secondaryBreed: dog.secondary_breed || null, // Added for completeness
      isMixed: !!dog.secondary_breed || dog.is_mixed, // Added for completeness
      age: dog.age || 'Unknown',
      gender: dog.gender || 'Unknown',
      size: dog.size || 'Unknown',
      description: dog.description || '',
      photos: photos,
      contact: {
        email: dog.email || null,
        phone: dog.phone || null,
        address: {
          address1: dog.address1 || null,
          address2: null, // Added for completeness
          city: dog.city || 'Unknown',
          state: dog.state || 'Unknown',
          postcode: dog.zip || null,
          country: 'US'
        }
      },
      characteristics: {
        goodWithChildren: dog.good_with_children !== undefined ? Boolean(dog.good_with_children) : null,
        goodWithDogs: dog.good_with_dogs !== undefined ? Boolean(dog.good_with_dogs) : null,
        goodWithCats: dog.good_with_cats !== undefined ? Boolean(dog.good_with_cats) : null,
        houseTrained: dog.house_trained !== undefined ? Boolean(dog.house_trained) : null,
        specialNeeds: dog.special_needs !== undefined ? Boolean(dog.special_needs) : null
      },
      attributes: {
        spayedNeutered: dog.spayed_neutered !== undefined ? Boolean(dog.spayed_neutered) : null, // Added for completeness
        houseTrained: dog.house_trained !== undefined ? Boolean(dog.house_trained) : null,
        declawed: null, // Added for completeness
        specialNeeds: dog.special_needs !== undefined ? Boolean(dog.special_needs) : null,
        shotsCurrent: dog.shots_current !== undefined ? Boolean(dog.shots_current) : null, // Added for completeness
        goodWithChildren: dog.good_with_children !== undefined ? Boolean(dog.good_with_children) : null,
        goodWithDogs: dog.good_with_dogs !== undefined ? Boolean(dog.good_with_dogs) : null,
        goodWithCats: dog.good_with_cats !== undefined ? Boolean(dog.good_with_cats) : null
      },
      url: dog.url || '',
      visibilityScore: visibilityScore,
      verificationBadge: dog.api_source === 'rescuegroups' ? 'Verified by BarkBase' : 'In BarkBase Database',
      petfinderId: dog.petfinder_id || null, // Added for completeness
      rescueGroupsId: dog.rescuegroups_id || null, // Added for completeness
      lastUpdated: dog.last_updated || new Date().toISOString() // Added for completeness
    };
  }

  // Format RescueGroups dogs with included relationship data
  static formatRescueGroupsDog(dog: any, included: any[] = []): UnifiedDog {
    console.log(`[🦮 RG Format] Processing: ${dog.attributes?.name || dog.name || 'Unknown'} (ID: ${dog.id})`);

    // Use v5 API structure (attributes-based)
    const attrs = dog.attributes || {};
    const id = dog.id || 'unknown';

    // Parse photos with relationship support - FIXED PARSING
    const photos: any[] = [];

    // Try v5 relationship-based photos first
    if (dog.relationships?.pictures?.data && included.length > 0) {
      const pictureIds = dog.relationships.pictures.data.map((pic: any) => pic.id);
      const pictureObjects = included.filter((item: any) =>
        item.type === 'pictures' && pictureIds.includes(item.id)
      );

      console.log(`[🔍 RG Photos] Found ${pictureObjects.length} picture objects for ${dog.attributes?.name}`);

      for (const pic of pictureObjects) {
        // Try different URL formats from RescueGroups API
        const url = pic.attributes?.large?.url ||
                   pic.attributes?.medium?.url ||
                   pic.attributes?.small?.url ||
                   pic.attributes?.large ||
                   pic.attributes?.original ||
                   pic.attributes?.small;

        if (url) {
          photos.push({
            small: url,
            medium: url,
            large: url
          });
          console.log(`[✅ RG Photo] Added photo: ${url}`);
        }
      }
    }

    // Fallback to direct photos in attributes
    if (photos.length === 0 && attrs.pictures && Array.isArray(attrs.pictures)) {
      console.log(`[🔍 RG Photos] Trying attributes.pictures for ${dog.attributes?.name}`);
      const sortedPictures = attrs.pictures.sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const pic of sortedPictures) {
        const url = pic.large || pic.original || pic.small;
        if (url) {
          photos.push({
            small: url,
            medium: url,
            large: url
          });
          console.log(`[✅ RG Photo] Added attribute photo: ${url}`);
        }
      }
    }

    // Use thumbnail as fallback
    if (photos.length === 0 && attrs.thumbnailUrl) {
      console.log(`[🔍 RG Photos] Using thumbnail for ${dog.attributes?.name}: ${attrs.thumbnailUrl}`);
      photos.push({
        small: attrs.thumbnailUrl,
        medium: attrs.thumbnailUrl,
        large: attrs.thumbnailUrl
      });
    }

    // Parse organization info and contact from included data - ENHANCED
    let orgInfo = { name: 'Unknown Organization', id: '', email: null, phone: null };
    if (dog.relationships?.orgs?.data?.[0] && included.length > 0) {
      const orgData = included.find((item: any) =>
        item.type === 'orgs' && item.id === dog.relationships.orgs.data[0].id
      );
      if (orgData?.attributes) {
        orgInfo = {
          name: orgData.attributes.name || 'Unknown Organization',
          id: orgData.id,
          email: orgData.attributes.email || orgData.attributes.publicEmail || orgData.attributes.contactEmail || null,
          phone: orgData.attributes.phone || orgData.attributes.phoneNumber || orgData.attributes.contactPhone || null
        };
        console.log(`[📞 RG Contact] Found org contact for ${dog.attributes?.name}:`, {
          name: orgInfo.name,
          email: orgInfo.email,
          phone: orgInfo.phone
        });
      }
    }

    // Parse location info from included data - ENHANCED PARSING
    let locationInfo = { city: 'Unknown', state: 'Unknown' };
    if (dog.relationships?.locations?.data?.[0] && included.length > 0) {
      const locationData = included.find((item: any) =>
        item.type === 'locations' && item.id === dog.relationships.locations.data[0].id
      );
      if (locationData?.attributes) {
        // Try multiple field variations for city and state
        const cityOptions = [
          locationData.attributes.city,
          locationData.attributes.cityname,
          locationData.attributes.name // Some locations use 'name' field
        ].filter(Boolean);

        const stateOptions = [
          locationData.attributes.state,
          locationData.attributes.statename,
          locationData.attributes.stateAbbr,
          locationData.attributes.region
        ].filter(Boolean);

        locationInfo = {
          city: cityOptions[0] || 'Unknown',
          state: stateOptions[0] || 'Unknown'
        };

        console.log(`[🌍 RG Location] Found location for ${dog.attributes?.name}: ${locationInfo.city}, ${locationInfo.state}`);
        console.log(`[🔍 RG Location Debug] Available location fields:`, Object.keys(locationData.attributes));
      } else {
        console.log(`[⚠️ RG Location] No location attributes found for ${dog.attributes?.name}`);
      }
    } else {
      console.log(`[⚠️ RG Location] No location relationship found for ${dog.attributes?.name}`);
    }

    console.log(`[🔍 RG Debug] ${dog.attributes?.name} - Photos: ${photos.length}, Location: ${locationInfo.city}, ${locationInfo.state}`);

    const formatted: UnifiedDog = {
      id: id,
      name: dog.attributes?.name || 'Unknown',
      primaryBreed: attrs.breedPrimary || 'Mixed Breed', // Added for completeness
      secondaryBreed: attrs.breedSecondary || null, // Added for completeness
      isMixed: Boolean(attrs.breedMixed), // Added for completeness
      breeds: {
        primary: attrs.breedPrimary || 'Mixed Breed',
        secondary: attrs.breedSecondary || null,
        mixed: Boolean(attrs.breedMixed),
        unknown: false
      },
      age: attrs.ageGroup || 'Unknown',
      gender: attrs.sex || 'Unknown',
      size: attrs.sizeGroup || 'Unknown',
      photos: photos,
      description: attrs.descriptionText || null,
      contact: {
        email: orgInfo.email || null,
        phone: orgInfo.phone || null,
        address: {
          address1: null, // Added for completeness
          address2: null, // Added for completeness
          city: locationInfo.city || 'Unknown',
          state: locationInfo.state || 'Unknown',
          postcode: null, // Added for completeness
          country: 'US'
        }
      },
      characteristics: {
        goodWithChildren: attrs.goodWithChildren !== undefined ? Boolean(attrs.goodWithChildren) : null,
        goodWithDogs: attrs.goodWithDogs !== undefined ? Boolean(attrs.goodWithDogs) : null,
        goodWithCats: attrs.goodWithCats !== undefined ? Boolean(attrs.goodWithCats) : null,
        houseTrained: attrs.houseTrained !== undefined ? Boolean(attrs.houseTrained) : null,
        specialNeeds: attrs.specialNeeds !== undefined ? Boolean(attrs.specialNeeds) : null
      },
      attributes: {
        spayedNeutered: null, // Added for completeness
        houseTrained: attrs.houseTrained !== undefined ? Boolean(attrs.houseTrained) : null,
        declawed: null, // Added for completeness
        specialNeeds: attrs.specialNeeds !== undefined ? Boolean(attrs.specialNeeds) : null,
        shotsCurrent: null, // Added for completeness
        goodWithChildren: attrs.goodWithChildren !== undefined ? Boolean(attrs.goodWithChildren) : null,
        goodWithDogs: attrs.goodWithDogs !== undefined ? Boolean(attrs.goodWithDogs) : null,
        goodWithCats: attrs.goodWithCats !== undefined ? Boolean(attrs.goodWithCats) : null
      },
      url: attrs.url || '',
      source: 'rescuegroups' as const,
      sourceId: id,
      organizationId: orgInfo.id,
      organizationName: orgInfo.name, // Added for completeness
      distance: attrs.distance || null,
      lastUpdated: attrs.updated || new Date().toISOString(),
      visibilityScore: 0, // Will be calculated later
      verificationBadge: 'Verified by BarkBase',
      petfinderId: null, // Added for completeness
      rescueGroupsId: id // Added for completeness
    };

    // Calculate visibility score
    formatted.visibilityScore = DogFormatter.calculateVisibilityScore(formatted);

    console.log(`[✅ RG Formatted] ${formatted.name}: ${formatted.breeds.primary}, ${formatted.age}, ${formatted.size}, Photos: ${formatted.photos.length}, Score: ${formatted.visibilityScore}`);

    return formatted;
  }

  // Format Petfinder dog to unified format
  static formatPetfinderDog(dog: any): UnifiedDog {
    const photos = (dog.photos || []).map((photo: any) => ({
      small: photo.small,
      medium: photo.medium,
      large: photo.large
    }));

    const formatted: UnifiedDog = {
      id: dog.id.toString(),
      source: 'petfinder' as const,
      sourceId: dog.id.toString(),
      organizationId: dog.organization_id || '',
      organizationName: dog.organization_name || '', // Added for completeness
      name: dog.name,
      primaryBreed: dog.breeds?.primary || 'Mixed Breed', // Added for completeness
      secondaryBreed: dog.breeds?.secondary, // Added for completeness
      isMixed: dog.breeds?.mixed || !!dog.breeds?.secondary, // Added for completeness
      breeds: {
        primary: dog.breeds?.primary || 'Mixed Breed',
        secondary: dog.breeds?.secondary,
        mixed: dog.breeds?.mixed || !!dog.breeds?.secondary
      },
      age: dog.age,
      gender: dog.gender,
      size: dog.size,
      description: dog.description,
      photos: photos,
      contact: dog.contact || {
        email: null, // Added for completeness
        phone: null, // Added for completeness
        address: {
          address1: null, // Added for completeness
          address2: null, // Added for completeness
          city: 'Unknown',
          state: 'Unknown',
          postcode: null, // Added for completeness
          country: 'US'
        }
      },
      characteristics: {
        goodWithChildren: dog.attributes?.good_with_children !== undefined ? Boolean(dog.attributes.good_with_children) : null,
        goodWithDogs: dog.attributes?.good_with_dogs !== undefined ? Boolean(dog.attributes.good_with_dogs) : null,
        goodWithCats: dog.attributes?.good_with_cats !== undefined ? Boolean(dog.attributes.good_with_cats) : null,
        houseTrained: dog.attributes?.house_trained !== undefined ? Boolean(dog.attributes.house_trained) : null,
        specialNeeds: dog.attributes?.special_needs !== undefined ? Boolean(dog.attributes.special_needs) : null
      },
      attributes: {
        spayedNeutered: dog.attributes?.spayed_neutered !== undefined ? Boolean(dog.attributes.spayed_neutered) : null, // Added for completeness
        houseTrained: dog.attributes?.house_trained !== undefined ? Boolean(dog.attributes.house_trained) : null,
        declawed: dog.attributes?.declawed !== undefined ? Boolean(dog.attributes.declawed) : null, // Added for completeness
        specialNeeds: dog.attributes?.special_needs !== undefined ? Boolean(dog.attributes.special_needs) : null,
        shotsCurrent: dog.attributes?.shots_current !== undefined ? Boolean(dog.attributes.shots_current) : null, // Added for completeness
        goodWithChildren: dog.attributes?.good_with_children !== undefined ? Boolean(dog.attributes.good_with_children) : null,
        goodWithDogs: dog.attributes?.good_with_dogs !== undefined ? Boolean(dog.attributes.good_with_dogs) : null,
        goodWithCats: dog.attributes?.good_with_cats !== undefined ? Boolean(dog.attributes.good_with_cats) : null
      },
      url: dog.url,
      visibilityScore: dog.visibilityScore || 0, // Default to 0 if not provided
      verificationBadge: 'Verified on Petfinder',
      petfinderId: dog.id.toString(), // Added for completeness
      rescueGroupsId: null, // Added for completeness
      lastUpdated: dog.last_updated || new Date().toISOString() // Added for completeness
    };

    // Calculate visibility score if not already present
    if (!formatted.visibilityScore) {
      formatted.visibilityScore = DogFormatter.calculateVisibilityScore(formatted);
    }

    return formatted;
  }

  // Sort dogs by visibility score (highest first)
  static sortByVisibilityScore(dogs: UnifiedDog[]): UnifiedDog[] {
    return dogs.sort((a, b) => b.visibilityScore - a.visibilityScore);
  }

  // Truncate description for chat display (preserves full description for dog detail pages)
  static truncateDescription(description?: string, maxLength: number = 150): string {
    if (!description) return '';
    if (description.length <= maxLength) return description;

    // Find last complete sentence within limit
    const truncated = description.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSentence > maxLength * 0.7) {
      return description.substring(0, lastSentence + 1);
    } else if (lastSpace > maxLength * 0.8) {
      return description.substring(0, lastSpace) + '...';
    } else {
      return truncated + '...';
    }
  }

  // Helper method to truncate description
  static truncateDescriptionNew(description: string, maxLength: number = 200): string {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength).trim() + '...';
  }

  // Convert unified format back to legacy API format for backward compatibility
  static toLegacyFormat(dog: UnifiedDog, truncateDescription: boolean = false): any {
    // Ensure we always have a valid ID - prefer petfinder_id for legacy compatibility,
    // but fall back to rescuegroups_id if needed
    const validId = dog.petfinderId || dog.rescueGroupsId || dog.id;

    if (!validId || validId === 'null' || validId === 'undefined') {
      console.warn(`[🚨 DogFormatter] Dog ${dog.name} has no valid ID:`, {
        petfinderId: dog.petfinderId,
        rescueGroupsId: dog.rescueGroupsId,
        id: dog.id
      });
    }

    const legacy = {
      id: validId,
      organization_id: dog.organizationId,
      name: dog.name,
      breeds: {
        primary: dog.primaryBreed, // Use primaryBreed from UnifiedDog
        secondary: dog.secondaryBreed, // Use secondaryBreed from UnifiedDog
        mixed: dog.isMixed // Use isMixed from UnifiedDog
      },
      age: dog.age,
      gender: dog.gender,
      size: dog.size,
      description: dog.description, // Never truncate - let calling code decide
      photos: dog.photos.map(photo => ({
        medium: photo.medium || photo.large || photo.small || '/images/barkr.png',
        large: photo.large || photo.medium || photo.small || '/images/barkr.png',
        small: photo.small || photo.medium || photo.large || '/images/barkr.png'
      })),
      contact: {
        email: dog.contact?.email || null,
        phone: dog.contact?.phone || null,
        address: {
          address1: dog.contact?.address?.address1 || null,
          address2: dog.contact?.address?.address2 || null,
          city: dog.contact?.address?.city || 'Unknown',
          state: dog.contact?.address?.state || 'Unknown',
          postcode: dog.contact?.address?.postcode || null,
          country: dog.contact?.address?.country || 'US'
        }
      },
      // Map unified attributes to frontend expected format
      attributes: {
        spayed_neutered: dog.attributes?.spayedNeutered || false,
        house_trained: dog.attributes?.houseTrained || dog.characteristics?.houseTrained || false,
        special_needs: dog.attributes?.specialNeeds || dog.characteristics?.specialNeeds || false,
        shots_current: dog.attributes?.shotsCurrent || false,
      },
      environment: {
        children: dog.attributes?.goodWithChildren || dog.characteristics?.goodWithChildren || false,
        dogs: dog.attributes?.goodWithDogs || dog.characteristics?.goodWithDogs || false,
        cats: dog.attributes?.goodWithCats || dog.characteristics?.goodWithCats || false,
      },
      url: dog.url,
      visibilityScore: dog.visibilityScore,
      source: dog.source, // Include source
      verificationBadge: dog.verificationBadge // Include verificationBadge
    };

    return legacy;
  }

  // Helper method to normalize age
  static normalizeAge(age: string | undefined): string {
    if (!age) return 'Unknown';
    const lowerAge = age.toLowerCase().trim();
    if (lowerAge.includes('baby') || lowerAge.includes('puppy') || lowerAge.includes('infant')) return 'Baby';
    if (lowerAge.includes('young') || lowerAge.includes('juvenile')) return 'Young';
    if (lowerAge.includes('adult') || lowerAge.includes('mature')) return 'Adult';
    if (lowerAge.includes('senior') || lowerAge.includes('elder') || lowerAge.includes('old')) return 'Senior';
    // Handle numeric ages
    if (lowerAge.match(/\d+/)) {
      const ageNum = parseInt(lowerAge.match(/\d+/)?.[0] || '0');
      if (ageNum < 1) return 'Baby';
      if (ageNum < 2) return 'Young';
      if (ageNum < 7) return 'Adult';
      return 'Senior';
    }
    return age; // Return original if we can't categorize
  }

  // Helper method to normalize size
  static normalizeSize(size: string | undefined): string {
    if (!size) return 'Unknown';
    const lowerSize = size.toLowerCase().trim();
    if (lowerSize.includes('small') || lowerSize.includes('tiny') || lowerSize.includes('mini')) return 'Small';
    if (lowerSize.includes('medium') || lowerSize.includes('med')) return 'Medium';
    if (lowerSize.includes('extra large') || lowerSize.includes('xl') || lowerSize.includes('x-large')) return 'X-Large';
    if (lowerSize.includes('large') || lowerSize.includes('big')) return 'Large';
    // Handle weight-based sizing
    if (lowerSize.match(/\d+/)) {
      const weight = parseInt(lowerSize.match(/\d+/)?.[0] || '0');
      if (weight < 25) return 'Small';
      if (weight < 60) return 'Medium';
      if (weight < 90) return 'Large';
      return 'X-Large';
    }
    return size; // Return original if we can't categorize
  }

  // Helper method to normalize gender
  static normalizeGender(gender: string | undefined): string {
    if (!gender) return 'Unknown';
    const lowerGender = gender.toLowerCase().trim();
    if (lowerGender.includes('male') && !lowerGender.includes('female')) return 'Male';
    if (lowerGender.includes('female')) return 'Female';
    if (lowerGender.includes('m') && lowerGender.length <= 2) return 'Male';
    if (lowerGender.includes('f') && lowerGender.length <= 2) return 'Female';
    return gender; // Return original if we can't categorize
  }

  static calculateVisibilityScore(dog: any): number {
    let score = 0;

    // Add points for having a description
    if (dog.description) {
      score += 20;
      // Add more points for longer descriptions
      score += Math.min(dog.description.length / 10, 30); // Up to 30 points
    }

    // Add points for each photo
    if (dog.photos && Array.isArray(dog.photos)) {
      score += Math.min(dog.photos.length * 10, 50); // Up to 50 points
    }

    // Add points for having a location
    if (dog.contact?.address?.city) {
      score += 10;
    }

    // Add points if the dog was recently updated
    if (dog.lastUpdated) {
      const lastUpdated = new Date(dog.lastUpdated);
      const now = new Date();
      const diff = now.getTime() - lastUpdated.getTime();
      const days = diff / (1000 * 3600 * 24);

      if (days < 30) {
        score += 20;
      } else if (days < 90) {
        score += 10;
      }
    }

    // Ensure score is not negative
    return Math.max(0, score);
  }
}

export { DogFormatter, type UnifiedDog };