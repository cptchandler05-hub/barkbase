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
    goodWithChildren?: boolean;
    goodWithDogs?: boolean;
    goodWithCats?: boolean;
    houseTrained?: boolean;
    specialNeeds?: boolean;
  };
  url?: string;
  visibilityScore: number;
  verificationBadge: string;
}

class DogFormatter {
  // Format database dog to unified format
  static formatDatabaseDog(dog: any): UnifiedDog {
    const photos = (dog.photos || []).map((url: string) => ({
      small: url,
      medium: url,
      large: url
    }));

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
      name: dog.name,
      breeds: {
        primary: dog.primary_breed || 'Mixed Breed',
        secondary: dog.secondary_breed,
        mixed: !!dog.secondary_breed || dog.is_mixed
      },
      age: dog.age,
      gender: dog.gender,
      size: dog.size,
      description: dog.description,
      photos: photos,
      contact: {
        address: {
          city: dog.city || 'Unknown',
          state: dog.state || 'Unknown'
        }
      },
      characteristics: {
        goodWithChildren: dog.good_with_children,
        goodWithDogs: dog.good_with_dogs,
        goodWithCats: dog.good_with_cats,
        houseTrained: dog.house_trained,
        specialNeeds: dog.special_needs
      },
      url: dog.url,
      visibilityScore: visibilityScore,
      verificationBadge: dog.api_source === 'rescuegroups' ? 'Verified by BarkBase' : 'In BarkBase Database'
    };
  }

  // Format RescueGroups dog to unified format
  static formatRescueGroupsDog(animal: any, included: any[] = []): UnifiedDog {
    // Create lookup maps for included data
    const breedsMap = new Map();
    const locationsMap = new Map();
    const orgsMap = new Map(); 
    const picturesMap = new Map();

    if (included && Array.isArray(included)) {
      included.forEach(item => {
        if (item.type === 'breeds') {
          breedsMap.set(item.id, item.attributes);
        } else if (item.type === 'locations') {
          locationsMap.set(item.id, item.attributes);
        } else if (item.type === 'orgs') {
          orgsMap.set(item.id, item.attributes);
        } else if (item.type === 'pictures') {
          picturesMap.set(item.id, item.attributes);
        }
      });
    }

    // Get breed information - try multiple sources
    const breedIds = animal.relationships?.breeds?.data || [];
    const primaryBreedId = breedIds[0]?.id;
    const secondaryBreedId = breedIds[1]?.id;

    // Try to get breed from relationships first, then fallback to attributes
    let primaryBreed = primaryBreedId ? breedsMap.get(primaryBreedId)?.name : null;
    let secondaryBreed = secondaryBreedId ? breedsMap.get(secondaryBreedId)?.name : null;

    // Fallback to direct attributes if relationships don't provide breeds
    if (!primaryBreed) {
      primaryBreed = animal.attributes?.breedPrimary || 
                    animal.attributes?.animalBreedPrimary || 
                    animal.breedPrimary ||
                    'Mixed Breed';
    }

    if (!secondaryBreed) {
      secondaryBreed = animal.attributes?.breedSecondary || 
                      animal.attributes?.animalBreedSecondary || 
                      animal.breedSecondary ||
                      null;
    }

    // Get location information - try multiple sources
    const locationIds = animal.relationships?.locations?.data || [];
    const locationId = locationIds[0]?.id;
    let location = locationId ? locationsMap.get(locationId) : null;

    // Fallback to direct attributes if relationships don't provide location
    if (!location) {
      location = {
        city: animal.attributes?.city || animal.attributes?.locationCity || animal.city || 'Unknown',
        state: animal.attributes?.state || animal.attributes?.locationState || animal.state || 'Unknown'
      };
    }

    // Get organization information
    const orgIds = animal.relationships?.orgs?.data || [];
    const orgId = orgIds[0]?.id;
    const organization = orgId ? orgsMap.get(orgId) : null;

    // Get photos - handle RescueGroups v5 picture format
    const pictureIds = animal.relationships?.pictures?.data || [];
    const photos: any[] = pictureIds
      .map((picRef: any) => {
        const pic = picturesMap.get(picRef.id);
        if (!pic) return null;

        return {
          small: pic.small?.url || pic.large?.url || pic.original?.url,
          medium: pic.large?.url || pic.original?.url,
          large: pic.large?.url || pic.original?.url,
          full: pic.original?.url || pic.large?.url
        };
      })
      .filter(Boolean)
      .slice(0, 6); // Limit to 6 photos

    // Extract name safely - try multiple possible field names
    const dogName = animal.attributes?.name || 
                   animal.attributes?.animalName || 
                   animal.attributes?.petName ||
                   animal.name ||
                   `Dog ${animal.id}`;

    // Extract description safely - try multiple possible field names  
    const description = animal.attributes?.descriptionText || 
                       animal.attributes?.animalDescriptionText || 
                       animal.attributes?.description || 
                       animal.attributes?.petDescription ||
                       animal.descriptionText ||
                       animal.description ||
                       '';

    const visibilityScore = DogFormatter.calculateVisibilityScore({
      photos: photos.length,
      description: description,
      location: location?.city || '',
      lastUpdated: animal.attributes?.updated || animal.attributes?.created
    });

    return {
      id: animal.id,
      source: 'rescuegroups' as const,
      sourceId: animal.id,
      organizationId: orgId || '',
      name: dogName,
      breeds: {
        primary: primaryBreed || 'Mixed Breed',
        secondary: secondaryBreed,
        mixed: breedIds.length > 1
      },
      age: DogFormatter.normalizeAge(
        animal.attributes?.ageGroup || 
        animal.attributes?.animalAgeGroup || 
        animal.attributes?.age ||
        animal.ageGroup ||
        animal.age
      ),
      size: DogFormatter.normalizeSize(
        animal.attributes?.sizeGroup || 
        animal.attributes?.animalSizeGroup || 
        animal.attributes?.size ||
        animal.sizeGroup ||
        animal.size
      ),
      gender: DogFormatter.normalizeGender(
        animal.attributes?.sex || 
        animal.attributes?.animalSex || 
        animal.attributes?.gender ||
        animal.sex ||
        animal.gender
      ),
      photos: photos,
      contact: {
        address: {
          city: location?.city || 'Unknown',
          state: location?.state || 'Unknown'
        }
      },
      description: description,
      url: animal.attributes?.url || animal.attributes?.animalUrl || animal.attributes?.petUrl || '',
      characteristics: {
        goodWithChildren: animal.attributes?.goodWithChildren || 
                         animal.attributes?.animalGoodWithChildren || 
                         animal.goodWithChildren || 
                         null,
        goodWithDogs: animal.attributes?.goodWithDogs || 
                     animal.attributes?.animalGoodWithDogs || 
                     animal.goodWithDogs || 
                     null,
        goodWithCats: animal.attributes?.goodWithCats || 
                     animal.attributes?.animalGoodWithCats || 
                     animal.goodWithCats || 
                     null,
        houseTrained: animal.attributes?.houseTrained || 
                     animal.attributes?.animalHouseTrained || 
                     animal.houseTrained || 
                     null,
        specialNeeds: animal.attributes?.specialNeeds || 
                     animal.attributes?.animalSpecialNeeds || 
                     animal.specialNeeds || 
                     null
      },
      visibilityScore: visibilityScore,
      verificationBadge: 'Verified by BarkBase'
    };
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
        goodWithChildren: dog.attributes?.good_with_children,
        goodWithDogs: dog.attributes?.good_with_dogs,
        goodWithCats: dog.attributes?.good_with_cats,
        houseTrained: dog.attributes?.house_trained,
        specialNeeds: dog.attributes?.special_needs
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