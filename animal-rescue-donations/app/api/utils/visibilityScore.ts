
export function calculateVisibilityScore(dog: any): number {
  // Calculate a basic visibility score based on available data
  let score = 50; // Base score
  
  // Age factors (older dogs are less visible)
  if (dog.age === 'Senior') score += 20;
  else if (dog.age === 'Adult') score += 10;
  
  // Size factors (larger dogs are less visible)
  if (dog.size === 'Extra Large') score += 15;
  else if (dog.size === 'Large') score += 10;
  
  // Breed factors (pit bulls and mixed breeds are less visible)
  if (dog.breeds?.primary?.toLowerCase().includes('pit')) score += 15;
  if (dog.breeds?.mixed) score += 10;
  
  // Special needs add to invisibility
  if (dog.attributes?.special_needs) score += 20;
  
  // No photos make dogs invisible
  if (!dog.photos || dog.photos.length === 0) score += 25;
  
  // Time published (rough estimate based on published date)
  if (dog.published_at) {
    const daysSincePublished = Math.floor((Date.now() - new Date(dog.published_at).getTime()) / (1000 * 60 * 60 * 24));
    score += Math.min(daysSincePublished * 2, 30); // Cap at 30 points for time
  }
  
  return Math.min(Math.max(score, 0), 100); // Keep between 0-100
}
