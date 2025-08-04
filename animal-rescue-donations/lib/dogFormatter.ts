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

    // Get breed information
    const breedIds = animal.relationships?.breeds?.data || [];
    const primaryBreedId = breedIds[0]?.id;
    const secondaryBreedId = breedIds[1]?.id;

    const primaryBreed = primaryBreedId ? breedsMap.get(primaryBreedId)?.name : 'Mixed Breed';
    const secondaryBreed = secondaryBreedId ? breedsMap.get(secondaryBreedId)?.name : null;

    // Get location information
    const locationIds = animal.relationships?.locations?.data || [];
    const locationId = locationIds[0]?.id;
    const location = locationId ? locationsMap.get(locationId) : null;

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

    // Extract name safely
    const dogName = animal.attributes?.animalName || 
                   animal.attributes?.name || 
                   `Dog ${animal.id}`;

    // Extract description safely  
    const description = animal.attributes?.animalDescriptionText || 
                       animal.attributes?.descriptionText || 
                       animal.attributes?.description || '';

    return {
      id: animal.id,
      name: dogName,
      breeds: {
        primary: primaryBreed || 'Mixed Breed',
        secondary: secondaryBreed,
        mixed: breedIds.length > 1,
        unknown: !primaryBreed
      },
      age: this.normalizeAge(animal.attributes?.animalAgeGroup || animal.attributes?.ageGroup),
      size: this.normalizeSize(animal.attributes?.animalSizeGroup || animal.attributes?.sizeGroup),
      gender: this.normalizeGender(animal.attributes?.animalSex || animal.attributes?.sex),
      photos: photos,
      contact: {
        email: organization?.email || '',
        phone: organization?.phone || '',
        address: {
          address1: location?.street || '',
          address2: null,
          city: location?.city || '',
          state: location?.state || '',
          postcode: location?.postalcode || location?.postalCode || '',
          country: location?.country || 'US'
        }
      },
      description: description,
      url: animal.attributes?.animalUrl || animal.attributes?.url || '',
      distance: animal.attributes?.animalDistance || animal.attributes?.distance || null,
      published_at: animal.attributes?.created || new Date().toISOString(),
      status: 'adoptable',
      attributes: {
        spayed_neutered: null,
        house_trained: animal.attributes?.animalHouseTrained || animal.attributes?.houseTrained || null,
        declawed: null,
        special_needs: animal.attributes?.animalSpecialNeeds || animal.attributes?.specialNeeds || null,
        shots_current: null
      },
      environment: {
        children: animal.attributes?.animalGoodWithChildren || animal.attributes?.goodWithChildren || null,
        dogs: animal.attributes?.animalGoodWithDogs || animal.attributes?.goodWithDogs || null,
        cats: animal.attributes?.animalGoodWithCats || animal.attributes?.goodWithCats || null
      },
      tags: [],
      organization_id: orgId || '',
      source: 'rescuegroups',
      visibility_score: this.calculateVisibilityScore({
        photos: photos.length,
        description: description,
        location: location?.city || '',
        lastUpdated: animal.attributes?.updated || animal.attributes?.created
      })
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
      description: truncateDesc ? this.truncateDescription(dog.description) : dog.description,
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
        const lowerAge = age.toLowerCase();
        if (lowerAge.includes('baby')) return 'Baby';
        if (lowerAge.includes('young')) return 'Young';
        if (lowerAge.includes('adult')) return 'Adult';
        if (lowerAge.includes('senior')) return 'Senior';
        return 'Unknown';
    }

    // Helper method to normalize size
    static normalizeSize(size: string | undefined): string {
        if (!size) return 'Unknown';
        const lowerSize = size.toLowerCase();
        if (lowerSize.includes('small')) return 'Small';
        if (lowerSize.includes('medium')) return 'Medium';
        if (lowerSize.includes('large')) return 'Large';
        if (lowerSize.includes('extra large')) return 'X-Large';
        return 'Unknown';
    }

    // Helper method to normalize gender
    static normalizeGender(gender: string | undefined): string {
        if (!gender) return 'Unknown';
        const lowerGender = gender.toLowerCase();
        if (lowerGender.includes('male')) return 'Male';
        if (lowerGender.includes('female')) return 'Female';
        return 'Unknown';
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