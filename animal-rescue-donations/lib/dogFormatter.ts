
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
  static formatRescueGroupsDog(dog: any): UnifiedDog {
    // Extract attributes from the nested structure
    const attrs = dog.attributes || dog;
    
    // Handle photos from RescueGroups API structure
    let photos = [];
    
    // Check if pictures exist in the attributes or root
    const pictures = attrs.pictures || dog.pictures || [];
    
    if (Array.isArray(pictures) && pictures.length > 0) {
      photos = pictures
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
        .map((pic: any) => ({
          small: pic.small || pic.medium || pic.large || pic.original,
          medium: pic.medium || pic.large || pic.original || pic.small,
          large: pic.large || pic.original || pic.medium || pic.small
        }))
        .filter((photo: any) => photo.large || photo.medium || photo.small);
    }

    if (photos.length === 0 && attrs.thumbnailUrl) {
      photos.push({
        small: attrs.thumbnailUrl,
        medium: attrs.thumbnailUrl,
        large: attrs.thumbnailUrl
      });
    }

    const formatted = {
      id: attrs.id || dog.id,
      source: 'rescuegroups' as const,
      sourceId: attrs.id || dog.id,
      organizationId: dog.organization || '',
      name: attrs.name || 'Unknown',
      breeds: {
        primary: attrs.breedPrimary || 'Mixed Breed',
        secondary: attrs.breedSecondary,
        mixed: attrs.breedMixed || !!attrs.breedSecondary
      },
      age: attrs.ageGroup || 'Unknown',
      gender: attrs.sex || 'Unknown',
      size: attrs.sizeGroup || 'Unknown',
      description: attrs.descriptionText,
      photos: photos,
      contact: {
        address: {
          city: 'Unknown', // RescueGroups doesn't provide this in search
          state: 'Unknown'
        }
      },
      characteristics: {
        goodWithChildren: attrs.goodWithChildren,
        goodWithDogs: attrs.goodWithDogs,
        goodWithCats: attrs.goodWithCats,
        houseTrained: attrs.houseTrained,
        specialNeeds: attrs.specialNeeds
      },
      url: attrs.url,
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
