
interface UniversalSearchParams {
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

interface NormalizedLocation {
  city?: string;
  state?: string;
  zipcode?: string;
  coordinates?: { lat: number; lng: number };
  searchString: string;
}

class SearchNormalizer {
  // Normalize location input for all APIs
  static normalizeLocation(location: string): NormalizedLocation {
    if (!location || location.trim() === '' || location === 'null') {
      return { searchString: '' };
    }

    const cleaned = location.trim().replace(/\s+/g, ' ');
    
    // ZIP code detection
    const zipRegex = /^\d{5}$/;
    if (zipRegex.test(cleaned)) {
      return {
        zipcode: cleaned,
        searchString: cleaned
      };
    }

    // City, State format
    const locationParts = cleaned.split(',').map(part => part.trim());
    if (locationParts.length >= 2) {
      return {
        city: locationParts[0],
        state: locationParts[1],
        searchString: `${locationParts[0]}, ${locationParts[1]}`
      };
    }

    // Single location (city or state)
    const parts = cleaned.split(/\s+/);
    if (parts.length === 2 && /^[a-z]{2}$/i.test(parts[1])) {
      return {
        city: parts[0],
        state: parts[1],
        searchString: `${parts[0]}, ${parts[1]}`
      };
    }

    return { searchString: cleaned };
  }

  // Normalize breed for fuzzy matching
  static normalizeBreed(breed: string): string {
    if (!breed || breed.trim() === '' || breed === 'null') {
      return '';
    }

    let normalized = breed.toLowerCase().trim();
    
    // Remove trailing 's' if present and longer than 3 characters
    if (normalized.endsWith('s') && normalized.length > 3) {
      normalized = normalized.slice(0, -1);
    }
    
    // Capitalize first letter of each word
    return normalized
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Normalize age groups across APIs
  static normalizeAge(age: string): string {
    if (!age || age === 'null') return '';
    
    const ageMap: { [key: string]: string } = {
      'puppy': 'Young',
      'young': 'Young',
      'adult': 'Adult',
      'senior': 'Senior',
      'baby': 'Young'
    };

    return ageMap[age.toLowerCase()] || age;
  }

  // Normalize size across APIs
  static normalizeSize(size: string): string {
    if (!size || size === 'null') return '';
    
    const sizeMap: { [key: string]: string } = {
      'small': 'Small',
      'medium': 'Medium',
      'large': 'Large',
      'extra-large': 'Large',
      'xlarge': 'Large'
    };

    return sizeMap[size.toLowerCase()] || size;
  }

  // Normalize gender across APIs
  static normalizeGender(gender: string): string {
    if (!gender || gender === 'null') return '';
    
    const genderMap: { [key: string]: string } = {
      'male': 'Male',
      'female': 'Female',
      'm': 'Male',
      'f': 'Female'
    };

    return genderMap[gender.toLowerCase()] || gender;
  }

  // Create normalized search params for all APIs
  static normalizeSearchParams(params: any): UniversalSearchParams {
    const normalized: UniversalSearchParams = {};

    if (params.location) {
      const loc = this.normalizeLocation(params.location);
      normalized.location = loc.searchString;

      // 🧭 Use coordinates passed in or from parsed location
      if (params.latitude && params.longitude) {
        normalized.latitude = params.latitude;
        normalized.longitude = params.longitude;
      } else if (loc.coordinates) {
        normalized.latitude = loc.coordinates.lat;
        normalized.longitude = loc.coordinates.lng;
      }
    }

    if (params.breed) {
      normalized.breed = this.normalizeBreed(params.breed);
    }

    if (params.age) {
      normalized.age = this.normalizeAge(params.age);
    }

    if (params.size) {
      normalized.size = this.normalizeSize(params.size);
    }

    if (params.gender) {
      normalized.gender = this.normalizeGender(params.gender);
    }

    normalized.limit = params.limit || 100;
    normalized.radius = params.radius || 100;

    return normalized;
  }
}

export { SearchNormalizer, type UniversalSearchParams, type NormalizedLocation };
