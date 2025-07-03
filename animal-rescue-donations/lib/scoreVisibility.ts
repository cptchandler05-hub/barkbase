export function calculateVisibilityScore(dog: any): number {
  let score = 0;

  // Days listed
  if (dog.published_at) {
    const daysListed = Math.floor((Date.now() - new Date(dog.published_at).getTime()) / (1000 * 60 * 60 * 24));
    score += daysListed;
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

  return score;
}
