export function calculateVisibilityScore(dog: any): number {
  if (!dog) return 50; // Default fallback score

  let score = 0;

  try {
    // Photo scoring (0-40 points)
    const photoCount = (dog.photos && Array.isArray(dog.photos)) ? dog.photos.length : 0;
    if (photoCount === 0) score += 0;
    else if (photoCount === 1) score += 10;
    else if (photoCount === 2) score += 20;
    else if (photoCount >= 3) score += 40;

    // Description scoring (0-30 points)
    const description = dog.description || '';
    if (description.length === 0) score += 0;
    else if (description.length < 50) score += 5;
    else if (description.length < 150) score += 15;
    else score += 30;

    // Age scoring (0-20 points) - puppies get lower scores to balance visibility
    const age = (dog.age || '').toLowerCase();
    switch (age) {
      case 'baby':
      case 'young': score += 5; break;
      case 'adult': score += 20; break;
      case 'senior': score += 15; break;
      default: score += 10;
    }

    // Size scoring (0-10 points) - larger dogs often overlooked
    const size = (dog.size || '').toLowerCase();
    switch (size) {
      case 'small': score += 5; break;
      case 'medium': score += 7; break;
      case 'large':
      case 'extra large': score += 10; break;
      default: score += 5;
    }

    // Mixed breed bonus
    if (dog.breeds?.mixed) score += 5;

    // Special needs bonus
    if (dog.attributes?.special_needs) score += 10;

    // Gender bonus (male dogs often adopted less frequently)
    if (dog.gender === 'Male') score += 4;

    // Black Dog Syndrome - darker colored dogs face adoption challenges
    const colors = dog.colors || {};
    const primaryColor = colors.primary?.toLowerCase() || '';
    const secondaryColor = colors.secondary?.toLowerCase() || '';
    const tertiaryColor = colors.tertiary?.toLowerCase() || '';
    
    if (primaryColor.includes('black') || 
        secondaryColor.includes('black') || 
        tertiaryColor.includes('black') ||
        primaryColor.includes('dark')) {
      score += 8;
    }

      // Location type - rural areas get higher scores (less visibility)
    const city = dog.contact?.address?.city?.toLowerCase() || '';
    const state = dog.contact?.address?.state || '';
    const postcode = dog.contact?.address?.postcode || '';
    
    // Basic rural indicators
    if (city.includes('rural') || 
        city.includes('county') || 
        city.includes('township') ||
        city.includes('ville') ||
        city.length < 6) { // Small town names are often shorter
      score += 6;
    }

    // Breed popularity - less popular breeds get higher scores
    const primaryBreed = dog.breeds?.primary?.toLowerCase() || '';
    const popularBreeds = [
      'golden retriever', 'labrador retriever', 'german shepherd', 'bulldog',
      'poodle', 'beagle', 'rottweiler', 'yorkshire terrier', 'dachshund',
      'siberian husky', 'boxer', 'border collie', 'australian shepherd'
    ];
    
    const isPopularBreed = popularBreeds.some(breed => 
      primaryBreed.includes(breed.replace(' ', '').toLowerCase()) ||
      breed.includes(primaryBreed)
    );
    
    if (!isPopularBreed && primaryBreed !== 'mixed' && primaryBreed !== '') {
      score += 9; // Less popular breeds get higher invisibility score
    }

    // Medical history - dogs with health issues are harder to place
    const attributes = dog.attributes || {};
    if (attributes.shots_current === false) score += 4;
    if (attributes.spayed_neutered === false) score += 2;
    if (dog.description?.toLowerCase().includes('medical') ||
        dog.description?.toLowerCase().includes('surgery') ||
        dog.description?.toLowerCase().includes('treatment') ||
        dog.description?.toLowerCase().includes('medication')) {
      score += 10;
    }

    // Energy level - high energy dogs may be overlooked by many families
    if (dog.attributes?.energy_level === 'High') score += 6;

    // Social restrictions - dogs with behavioral limitations
    if (attributes.good_with_children === false) score += 5;
    if (attributes.good_with_dogs === false) score += 4;
    if (attributes.good_with_cats === false) score += 3;

    // House training status
    if (attributes.house_trained === false) score += 3;

    // Ensure score is within valid range
    return Math.max(0, Math.min(100, score));

  } catch (error) {
    console.error('Error calculating visibility score:', error);
    return 50; // Safe fallback
  }
}