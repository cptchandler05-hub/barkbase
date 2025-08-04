import { calculateVisibilityScore } from '@/lib/scoreVisibility';

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
    address: {
      city: string;
      state: string;
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
}

class DogFormatter {
  // Format database dog to unified format
  static formatDatabaseDog(dog: any): UnifiedDog {
    // Handle photos array properly - ensure we always get strings
    const photos = (dog.photos || []).map((photo: any) => {
      // Handle string URLs (RescueGroups direct URLs)
      if (typeof photo === 'string') {
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
          return {
            small: photo.small || photo.medium || photo.large,
            medium: photo.medium || photo.large || photo.small,
            large: photo.large || photo.medium || photo.small
          };
        }
        // Petfinder nested object format: {medium: {url: "..."}}
        else if (photo.medium && typeof photo.medium === 'object' && photo.medium.url) {
          return {
            small: photo.medium.url,
            medium: photo.medium.url,
            large: photo.medium.url
          };
        }
      }
      // Fallback for invalid photo data
      return {
        small: '/images/barkr.png',
        medium: '/images/barkr.png',
        large: '/images/barkr.png'
      };
    });

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

    return {
      id: dog.petfinder_id || dog.rescuegroups_id || dog.id.toString(),
      source: dog.api_source === 'rescuegroups' ? 'rescuegroups' : 'database',
      sourceId: dog.petfinder_id || dog.rescuegroups_id || dog.id.toString(),
      organizationId: dog.organization_id || '',
      name: dog.name || 'Unknown',
      breeds: {
        primary: dog.primary_breed || 'Mixed Breed',
        secondary: dog.secondary_breed || null,
        mixed: !!dog.secondary_breed || dog.is_mixed
      },
      age: dog.age || 'Unknown',
      gender: dog.gender || 'Unknown',
      size: dog.size || 'Unknown',
      description: dog.description || '',
      photos: photos,
      contact: {
        address: {
          city: dog.city || 'Unknown',
          state: dog.state || 'Unknown'
        }
      },
      characteristics: {
        goodWithChildren: dog.good_with_children !== undefined ? Boolean(dog.good_with_children) : null,
        goodWithDogs: dog.good_with_dogs !== undefined ? Boolean(dog.good_with_dogs) : null,
        goodWithCats: dog.good_with_cats !== undefined ? Boolean(dog.good_with_cats) : null,
        houseTrained: dog.house_trained !== undefined ? Boolean(dog.house_trained) : null,
        specialNeeds: dog.special_needs !== undefined ? Boolean(dog.special_needs) : null
      },
      url: dog.url || '',
      visibilityScore: visibilityScore,
      verificationBadge: dog.api_source === 'rescuegroups' ? 'Verified by BarkBase' : 'In BarkBase Database'
    };
  }

  // Format RescueGroups dogs with included relationship data
  static formatRescueGroupsDog(dog: any, included: any[] = []): UnifiedDog {
    console.log(`[🦮 RG Format] Processing: ${dog.attributes?.name || dog.name || 'Unknown'} (ID: ${dog.id})`);

    // Use v5 API structure (attributes-based)
    const attrs = dog.attributes || {};
    const name = attrs.name || 'Unknown';
    const id = dog.id || 'unknown';

    // Parse photos with relationship support - FIXED PARSING
    const photos: any[] = [];

    // Try v5 relationship-based photos first
    if (dog.relationships?.pictures?.data && included.length > 0) {
      const pictureIds = dog.relationships.pictures.data.map((pic: any) => pic.id);
      const pictureObjects = included.filter((item: any) => 
        item.type === 'pictures' && pictureIds.includes(item.id)
      );

      console.log(`[🔍 RG Photos] Found ${pictureObjects.length} picture objects for ${name}`);

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
      console.log(`[🔍 RG Photos] Trying attributes.pictures for ${name}`);
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
      console.log(`[🔍 RG Photos] Using thumbnail for ${name}: ${attrs.thumbnailUrl}`);
      photos.push({
        small: attrs.thumbnailUrl,
        medium: attrs.thumbnailUrl,
        large: attrs.thumbnailUrl
      });
    }

    // Parse organization info from included data
    let orgInfo = { name: 'Unknown Organization', id: '' };
    if (dog.relationships?.orgs?.data?.[0] && included.length > 0) {
      const orgData = included.find((item: any) => 
        item.type === 'orgs' && item.id === dog.relationships.orgs.data[0].id
      );
      if (orgData) {
        orgInfo = {
          name: orgData.attributes?.name || 'Unknown Organization',
          id: orgData.id
        };
      }
    }

    // Parse location info from included data - FIXED PARSING
    let locationInfo = { city: 'Unknown', state: 'Unknown' };
    if (dog.relationships?.locations?.data?.[0] && included.length > 0) {
      const locationData = included.find((item: any) => 
        item.type === 'locations' && item.id === dog.relationships.locations.data[0].id
      );
      if (locationData?.attributes) {
        locationInfo = {
          city: locationData.attributes.city || locationData.attributes.cityname || 'Unknown',
          state: locationData.attributes.state || locationData.attributes.statename || 'Unknown'
        };
        console.log(`[🌍 RG Location] Found location for ${name}: ${locationInfo.city}, ${locationInfo.state}`);
      } else {
        console.log(`[⚠️ RG Location] No location attributes found for ${name}`);
      }
    } else {
      console.log(`[⚠️ RG Location] No location relationship found for ${name}`);
    }

    console.log(`[🔍 RG Debug] ${name} - Photos: ${photos.length}, Location: ${locationInfo.city}, ${locationInfo.state}`);

    const formatted: UnifiedDog = {
      id: id,
      name: name,
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
        email: orgInfo.name !== 'Unknown Organization' ? `Contact ${orgInfo.name}` : null,
        phone: null,
        address: {
          city: locationInfo.city || 'Unknown',
          state: locationInfo.state || 'Unknown',
          country: 'US'
        }
      },
      attributes: {
        spayedNeutered: null,
        houseTrained: attrs.houseTrained !== undefined ? Boolean(attrs.houseTrained) : null,
        declawed: null,
        specialNeeds: attrs.specialNeeds !== undefined ? Boolean(attrs.specialNeeds) : null,
        shotsCurrent: null,
        goodWithChildren: attrs.goodWithChildren !== undefined ? Boolean(attrs.goodWithChildren) : null,
        goodWithDogs: attrs.goodWithDogs !== undefined ? Boolean(attrs.goodWithDogs) : null,
        goodWithCats: attrs.goodWithCats !== undefined ? Boolean(attrs.goodWithCats) : null
      },
      url: attrs.url || '',
      source: 'rescuegroups' as const,
      distance: attrs.distance || null,
      lastUpdated: attrs.updated || new Date().toISOString(),
      visibilityScore: 0 // Will be calculated later
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

    const formatted = {
      id: dog.id.toString(),
      source: 'petfinder' as const,
      sourceId: dog.id.toString(),
      organizationId: dog.organization_id || '',
      name: dog.name,
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
        address: {
          city: 'Unknown',
          state: 'Unknown'
        }
      },
      characteristics: {
        goodWithChildren: dog.attributes?.good_with_children !== undefined ? Boolean(dog.attributes.good_with_children) : null,
        goodWithDogs: dog.attributes?.good_with_dogs !== undefined ? Boolean(dog.attributes.good_with_dogs) : null,
        goodWithCats: dog.attributes?.good_with_cats !== undefined ? Boolean(dog.attributes.good_with_cats) : null,
        houseTrained: dog.attributes?.house_trained !== undefined ? Boolean(dog.attributes.house_trained) : null,
        specialNeeds: dog.attributes?.special_needs !== undefined ? Boolean(dog.attributes.special_needs) : null
      },
      url: dog.url,
      visibilityScore: dog.visibilityScore || 0,
      verificationBadge: 'Verified on Petfinder'
    };

    // Calculate visibility score if not already present
    if (!formatted.visibilityScore) {
      formatted.visibilityScore = calculateVisibilityScore({
        name: formatted.name,
        description: formatted.description,
        photos: formatted.photos,
        breeds: formatted.breeds,
        age: formatted.age,
        gender: formatted.gender,
        size: formatted.size,
        contact: formatted.contact
      });
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
  static toLegacyFormat(dog: UnifiedDog, truncateDesc: boolean = false): any {
    return {
      id: parseInt(dog.id) || dog.id,
      organization_id: dog.organizationId,
      name: dog.name,
      breeds: dog.breeds,
      age: dog.age,
      gender: dog.gender,
      size: dog.size,
      description: truncateDesc ? DogFormatter.truncateDescription(dog.description) : dog.description,
      photos: dog.photos,
      contact: dog.contact,
      visibilityScore: dog.visibilityScore,
      source: dog.source,
      verificationBadge: dog.verificationBadge
    };
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

        return score;
    }
}

export { DogFormatter, type UnifiedDog };