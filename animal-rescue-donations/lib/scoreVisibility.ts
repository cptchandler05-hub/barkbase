export function calculateVisibilityScore(dog: any): number {
  let score = 0;

  // Days listed
  if (dog.published_at) {
    const publishedDate = new Date(dog.published_at);
    if (!isNaN(publishedDate.getTime())) {
      const daysListed = Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (!isNaN(daysListed) && daysListed >= 0) {
        score += daysListed;
      }
    }
  }

  // Photo penalty
  const photoCount = dog.photos?.length || 0;
  if (photoCount === 0) score += 50;
  else if (photoCount === 1) score += 25;
  else if (photoCount === 2) score += 10;

  // Description length
  const description = dog.description || '';
  if (description.length < 100) score += 30;
  else if (description.length < 200) score += 15;

  // Age bonus
  if (dog.age === 'Senior') score += 20;
  else if (dog.age === 'Adult') score += 10;

  // Size penalty
  if (dog.size === 'Large' || dog.size === 'Extra Large') score += 15;

  // Mixed breed bonus
  if (dog.breeds?.mixed) score += 10;

  // Special needs bonus
  if (dog.attributes?.special_needs) score += 25;

  // Gender bonus (male dogs often adopted less frequently)
  if (dog.gender === 'Male') score += 8;

  // Black Dog Syndrome - darker colored dogs face adoption challenges
  const colors = dog.colors || {};
  const primaryColor = colors.primary?.toLowerCase() || '';
  const secondaryColor = colors.secondary?.toLowerCase() || '';
  const tertiaryColor = colors.tertiary?.toLowerCase() || '';
  
  if (primaryColor.includes('black') || 
      secondaryColor.includes('black') || 
      tertiaryColor.includes('black') ||
      primaryColor.includes('dark')) {
    score += 15;
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
    score += 12;
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
    score += 18; // Less popular breeds get higher invisibility score
  }

  // Medical history - dogs with health issues are harder to place
  const attributes = dog.attributes || {};
  if (attributes.shots_current === false) score += 8;
  if (attributes.spayed_neutered === false) score += 5;
  if (dog.description?.toLowerCase().includes('medical') ||
      dog.description?.toLowerCase().includes('surgery') ||
      dog.description?.toLowerCase().includes('treatment') ||
      dog.description?.toLowerCase().includes('medication')) {
    score += 20;
  }

  // Energy level - high energy dogs may be overlooked by many families
  if (dog.attributes?.energy_level === 'High') score += 12;

  // Social restrictions - dogs with behavioral limitations
  if (attributes.good_with_children === false) score += 10;
  if (attributes.good_with_dogs === false) score += 8;
  if (attributes.good_with_cats === false) score += 6;

  // House training status
  if (attributes.house_trained === false) score += 7;

  // Ensure we always return a valid number
  const finalScore = Math.max(0, score);
  return isNaN(finalScore) ? 0 : finalScore;
}
