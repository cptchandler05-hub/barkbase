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

// Fallback breed list for when API is unavailable - using Petfinder-compatible breeds
const COMMON_BREEDS = [
  'Affenpinscher', 'Afghan Hound', 'Airedale Terrier', 'Akita', 'American Bulldog',
  'American Eskimo Dog', 'American Staffordshire Terrier', 'Australian Cattle Dog',
  'Australian Shepherd', 'Basenji', 'Basset Hound', 'Beagle', 'Bernese Mountain Dog',
  'Bichon Frise', 'Border Collie', 'Boston Terrier', 'Boxer', 'Brittany', 'Bulldog',
  'Bull Terrier', 'Cairn Terrier', 'Cavalier King Charles Spaniel', 'Chihuahua',
  'Chinese Crested', 'Chow Chow', 'Cocker Spaniel', 'Collie', 'Dachshund', 'Dalmatian',
  'Doberman Pinscher', 'English Springer Spaniel', 'Fox Terrier', 'French Bulldog',
  'German Shepherd Dog', 'Golden Retriever', 'Great Dane', 'Hound', 'Havanese',
  'Husky', 'Irish Setter', 'Jack Russell Terrier', 'Japanese Chin', 'Labrador Retriever',
  'Maltese', 'Mastiff', 'Miniature Pinscher', 'Newfoundland', 'Papillon', 'Pekingese',
  'Pit Bull Terrier', 'Pointer', 'Poodle', 'Pug', 'Rottweiler', 'Saint Bernard',
  'Schnauzer', 'Scottish Terrier', 'Shar Pei', 'Shih Tzu', 'Siberian Husky',
  'Staffordshire Bull Terrier', 'Terrier', 'Vizsla', 'Weimaraner', 'Welsh Corgi',
  'West Highland White Terrier', 'Whippet', 'Yorkshire Terrier'
];

// 🔐 Authenticated fuzzy breed match with live Petfinder API call
export async function findBestBreedMatch(userInput: string): Promise<string | null> {
  try {
    // First try with fallback breed list for quick matching
    const fallbackMatch = findBestMatchingBreed(userInput, COMMON_BREEDS);
    if (fallbackMatch) {
      console.log(`[✅ Fallback Breed Match] "${userInput}" → "${fallbackMatch}"`);
      return fallbackMatch;
    }

    // If no fallback match, try live API
    const token = await getAccessToken();
    if (!token) {
      console.warn('[⚠️ Breed Match] No token available, using fallback only');
      return null;
    }

    const res = await fetch('https://api.petfinder.com/v2/types/dog/breeds', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[❌ Breed Match API Error]', res.status, errorText);

      // If 401, try to refresh token once
      if (res.status === 401) {
        console.log('[🔄 Breed Match] Trying with fresh token...');
        const freshToken = await getAccessToken(true);
        if (freshToken) {
          const retryRes = await fetch('https://api.petfinder.com/v2/types/dog/breeds', {
            headers: {
              Authorization: `Bearer ${freshToken}`,
            },
          });

          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const breedList: string[] = retryData.breeds.map((b: any) => b.name);
            return findBestMatchingBreed(userInput, breedList);
          }
        }
      }

      return null;
    }

    const data = await res.json();
    const breedList: string[] = data.breeds.map((b: any) => b.name);

    const apiMatch = findBestMatchingBreed(userInput, breedList);
    if (apiMatch) {
      console.log(`[✅ API Breed Match] "${userInput}" → "${apiMatch}"`);
    }

    return apiMatch;
  } catch (err) {
    console.error('[❌ Breed Match Fatal Error]', err);
    return null;
  }
}