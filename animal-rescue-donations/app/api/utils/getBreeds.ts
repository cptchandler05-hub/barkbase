import { getAccessToken } from './tokenManager';

export async function getBreeds(): Promise<string[]> {
  const accessToken = await getAccessToken();

  const res = await fetch('https://api.petfinder.com/v2/types/dog/breeds', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Failed to fetch breeds:', errorText);
    throw new Error('Could not fetch breed list');
  }

  const data = await res.json();
  return data.breeds.map((b: any) => b.name);
}
