import Fuse from 'fuse.js';
import { getAccessToken } from '@/app/api/utils/tokenManager';

// Direct fuzzy match logic
export function findBestMatchingBreed(userInput: string, breedList: string[]): string | null {
  const fuse = new Fuse(breedList, {
    includeScore: true,
    threshold: 0.4,
  });

  const results = fuse.search(userInput);
  return results.length > 0 ? results[0].item : null;
}

// 🔐 Authenticated fuzzy breed match with live Petfinder API call
export async function findBestBreedMatch(userInput: string): Promise<string | null> {
  try {
    const token = await getAccessToken(); // ✅ uses your verified token logic
    const res = await fetch('https://api.petfinder.com/v2/types/dog/breeds', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[❌ Breed Match API Error]', res.status, errorText);
      return null;
    }

    const data = await res.json();
    const breedList: string[] = data.breeds.map((b: any) => b.name);

    return findBestMatchingBreed(userInput, breedList);
  } catch (err) {
    console.error('[❌ Breed Match Fatal Error]', err);
    return null;
  }
}
