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
  static formatRescueGroupsDog(dog: any, includedData?: any[]): UnifiedDog {
    const attrs = dog.attributes || {};

    // Helper function to find included data by type and id
    const findIncluded = (type: string, id: string) => {
      if (!includedData) return null;
      return includedData.find(item => item.type === type && item.id === id);
    };

    // Handle photos - RescueGroups v5 has photos in relationships
    const photos = [];
    if (dog.relationships?.pictures?.data && Array.isArray(dog.relationships.pictures.data)) {
      for (const photoRef of dog.relationships.pictures.data) {
        const pictureData = findIncluded('pictures', photoRef.id);
        if (pictureData?.attributes?.large?.url) {
          photos.push({ medium: pictureData.attributes.large.url });
        } else if (pictureData?.attributes?.original?.url) {
          photos.push({ medium: pictureData.attributes.original.url });
        }
      }
    }

    if (photos.length === 0) {
      photos.push({ medium: '/images/barkr.png' });
    }

    // Extract breeds from relationships
    let primaryBreed = 'Mixed Breed';
    let secondaryBreed = null;
    if (dog.relationships?.breeds?.data && Array.isArray(dog.relationships.breeds.data)) {
      const breed1 = findIncluded('breeds', dog.relationships.breeds.data[0]?.id);
      const breed2 = findIncluded('breeds', dog.relationships.breeds.data[1]?.id);

      if (breed1?.attributes?.name) primaryBreed = breed1.attributes.name;
      if (breed2?.attributes?.name) secondaryBreed = breed2.attributes.name;
    }

    // Extract location from relationships
    let city = 'Unknown';
    let state = 'Unknown';
    if (dog.relationships?.locations?.data?.[0]) {
      const locationData = findIncluded('locations', dog.relationships.locations.data[0].id);
      if (locationData?.attributes) {
        city = locationData.attributes.city || 'Unknown';
        state = locationData.attributes.state || 'Unknown';
      }
    }

    // Extract organization from relationships
    let organizationId = '';
    if (dog.relationships?.orgs?.data?.[0]) {
      const orgData = findIncluded('orgs', dog.relationships.orgs.data[0].id);
      if (orgData?.attributes?.name) {
        organizationId = orgData.attributes.name;
      }
    }

    const formatted = {
      id: dog.id,
      source: 'rescuegroups' as const,
      sourceId: dog.id,
      organizationId: organizationId,
      name: attrs.name || `Dog ${dog.id}`,
      breeds: {
        primary: primaryBreed,
        secondary: secondaryBreed,
        mixed: !!secondaryBreed
      },
      age: attrs.ageGroup || 'Unknown',
      gender: attrs.sex || 'Unknown',
      size: attrs.sizeGroup || 'Unknown',
      description: attrs.descriptionText || 'No description available.',
      photos: photos,
      contact: {
        address: {
          city: city,
          state: state
        }
      },
      characteristics: {
        goodWithChildren: attrs.goodWithChildren,
        goodWithDogs: attrs.goodWithDogs,
        goodWithCats: attrs.goodWithCats,
        houseTrained: attrs.houseTrained,
        specialNeeds: attrs.specialNeeds
      },
      url: attrs.url || `https://rescuegroups.org/animals/${dog.id}`,
      visibilityScore: 0, // Will be calculated
      verificationBadge: 'Verified by BarkBase'
    };

    // Calculate visibility score
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
}

export { DogFormatter, type UnifiedDog };