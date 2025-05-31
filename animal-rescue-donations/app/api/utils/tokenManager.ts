let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    console.log('🔄 Using cached Petfinder token');
    return cachedToken;
  }

  console.log('🔑 Fetching new Petfinder access token...');
  
  // Check if environment variables exist
  if (!process.env.PETFINDER_CLIENT_ID || !process.env.PETFINDER_CLIENT_SECRET) {
    console.error('❌ Missing Petfinder environment variables!');
    console.error('   PETFINDER_CLIENT_ID:', !!process.env.PETFINDER_CLIENT_ID);
    console.error('   PETFINDER_CLIENT_SECRET:', !!process.env.PETFINDER_CLIENT_SECRET);
    throw new Error('Missing Petfinder API credentials');
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
    console.error('❌ Token fetch failed:');
    console.error('   Status:', res.status);
    console.error('   Response:', errorText);
    console.error('   Client ID exists:', !!process.env.PETFINDER_CLIENT_ID);
    throw new Error('Failed to retrieve Petfinder access token');
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}
