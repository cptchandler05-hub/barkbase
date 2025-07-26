
export function calculateVisibilityScore(dog: any): number {
  if (!dog) return 50; // Default fallback score

  let score = 0;

  try {
    // Photo scoring (0-40 points) - FEWER photos = MORE invisible
    const photoCount = (dog.photos && Array.isArray(dog.photos)) ? dog.photos.length : 0;
    if (photoCount === 0) score += 40; // No photos = maximum invisibility boost
    else if (photoCount === 1) score += 20; // One photo = still quite invisible
    else if (photoCount === 2) score += 10; // Two photos = somewhat invisible
    // 3+ photos = 0 points (visible enough)

    // Description scoring (0-30 points) - SHORTER descriptions = MORE invisible
    const description = dog.description || '';
    if (description.length === 0) score += 30; // No description = maximum invisibility
    else if (description.length < 50) score += 20; // Very short = high invisibility
    else if (description.length < 150) score += 10; // Short = some invisibility
    // 150+ characters = 0 points (well described)

    // Age scoring (0-20 points) - older dogs are more invisible
    const age = (dog.age || '').toLowerCase();
    switch (age) {
      case 'baby':
      case 'young': score += 0; break; // Puppies are highly visible
      case 'adult': score += 10; break; // Adults somewhat invisible
      case 'senior': score += 20; break; // Seniors most invisible
      default: score += 5; // Unknown age gets some points
    }

    // Size scoring (0-10 points) - larger dogs are more invisible
    const size = (dog.size || '').toLowerCase();
    switch (size) {
      case 'small': score += 0; break; // Small dogs are popular
      case 'medium': score += 3; break; // Medium somewhat invisible
      case 'large': score += 7; break; // Large dogs face challenges
      case 'extra large': score += 10; break; // XL dogs most invisible
      default: score += 2; // Unknown size gets some points
    }

    // Mixed breed penalty (mixed breeds are often overlooked)
    if (dog.breeds?.mixed) score += 8;

    // Special needs penalty (harder to place)
    if (dog.attributes?.special_needs) score += 15;

    // Gender penalty (male dogs are adopted less frequently)
    if (dog.gender === 'Male') score += 6;

    // Black Dog Syndrome - darker colored dogs face adoption challenges
    const colors = dog.colors || {};
    const primaryColor = colors.primary?.toLowerCase() || '';
    const secondaryColor = colors.secondary?.toLowerCase() || '';
    const tertiaryColor = colors.tertiary?.toLowerCase() || '';
    
    if (primaryColor.includes('black') || 
        secondaryColor.includes('black') || 
        tertiaryColor.includes('black') ||
        primaryColor.includes('dark')) {
      score += 12;
    }

    // Location penalty - rural areas get higher scores (less visibility)
    const city = dog.contact?.address?.city?.toLowerCase() || '';
    const state = dog.contact?.address?.state || '';
    const postcode = dog.contact?.address?.postcode || '';
    
    // Basic rural indicators
    if (city.includes('rural') || 
        city.includes('county') || 
        city.includes('township') ||
        city.includes('ville') ||
        city.length < 6) { // Small town names are often shorter
      score += 8;
    }

    // Breed popularity penalty - less popular breeds get higher scores
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
      score += 12; // Less popular breeds get higher invisibility score
    }

    // Medical history penalties - dogs with health issues are harder to place
    const attributes = dog.attributes || {};
    if (attributes.shots_current === false) score += 6;
    if (attributes.spayed_neutered === false) score += 4;
    if (dog.description?.toLowerCase().includes('medical') ||
        dog.description?.toLowerCase().includes('surgery') ||
        dog.description?.toLowerCase().includes('treatment') ||
        dog.description?.toLowerCase().includes('medication')) {
      score += 15;
    }

    // Energy level penalty - high energy dogs may be overlooked by many families
    if (dog.attributes?.energy_level === 'High') score += 8;

    // Social restriction penalties - dogs with behavioral limitations
    if (attributes.good_with_children === false) score += 8;
    if (attributes.good_with_dogs === false) score += 6;
    if (attributes.good_with_cats === false) score += 4;

    // House training penalty
    if (attributes.house_trained === false) score += 5;

    // NO MAXIMUM CAP - return the true invisibility score
    return Math.max(0, score);

  } catch (error) {
    console.error('Error calculating visibility score:', error);
    return 50; // Safe fallback
  }
}
