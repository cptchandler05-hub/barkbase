let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch('https://api.petfinder.com/v2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.PETFINDER_CLIENT_ID!,
      client_secret: process.env.PETFINDER_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Token fetch failed:', errorText);
    throw new Error('Failed to retrieve Petfinder access token');
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}
