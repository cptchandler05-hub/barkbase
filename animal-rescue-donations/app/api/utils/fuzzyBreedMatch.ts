import Fuse from 'fuse.js';

export function findBestMatchingBreed(userInput: string, breedList: string[]): string | null {
  const fuse = new Fuse(breedList, {
    includeScore: true,
    threshold: 0.4,
  });

  const results = fuse.search(userInput);
  return results.length > 0 ? results[0].item : null;
}
