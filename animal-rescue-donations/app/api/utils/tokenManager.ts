let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getAccessToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();
  
  // Add 5-minute buffer to prevent using token right before expiry
  const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  if (!forceRefresh && cachedToken && now < (tokenExpiresAt - buffer)) {
    console.log('🔄 Using cached Petfinder token');
    return cachedToken;
  }

  if (forceRefresh) {
    console.log('🔄 Force refreshing Petfinder token...');
  } else {
    console.log('🔑 Fetching new Petfinder access token...');
  }
  
  // Clear expired token
  cachedToken = null;
  tokenExpiresAt = 0;
  
  // Check if environment variables exist
  if (!process.env.PETFINDER_CLIENT_ID || !process.env.PETFINDER_CLIENT_SECRET) {
    console.error('❌ Missing Petfinder environment variables!');
    console.error('   PETFINDER_CLIENT_ID:', !!process.env.PETFINDER_CLIENT_ID);
    console.error('   PETFINDER_CLIENT_SECRET:', !!process.env.PETFINDER_CLIENT_SECRET);
    throw new Error('Missing Petfinder API credentials');
  }

  try {
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
      throw new Error(`Failed to retrieve Petfinder access token: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    
    if (!data.access_token) {
      console.error('❌ No access token in response:', data);
      throw new Error('Invalid token response from Petfinder API');
    }
    
    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000);
    
    console.log('✅ Successfully obtained new Petfinder token');
    console.log('   Token expires in:', data.expires_in, 'seconds');
    
    return cachedToken;
    
  } catch (error) {
    console.error('❌ Error during token fetch:', error);
    cachedToken = null;
    tokenExpiresAt = 0;
    throw error;
  }
}
