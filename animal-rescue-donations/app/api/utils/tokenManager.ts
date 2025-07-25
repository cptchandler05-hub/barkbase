
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

// Rate limiting: track last request time and enforce minimum delay
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 300; // Increased to 300ms for better rate limit handling

export async function getAccessToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();

  // Rate limiting: ensure minimum time between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`[⏳ Rate Limit] Waiting ${waitTime}ms before token request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Add 10-minute buffer to prevent using token right before expiry
  const buffer = 10 * 60 * 1000; // 10 minutes in milliseconds

  // Always refresh if forceRefresh is true
  if (forceRefresh) {
    console.log('🔄 Force refreshing token as requested');
    cachedToken = null;
    tokenExpiresAt = 0;
    isRefreshing = false;
    refreshPromise = null;
  }

  // Return cached token if it's still valid with buffer
  if (!forceRefresh && cachedToken && now < (tokenExpiresAt - buffer)) {
    console.log('🔄 Using cached Petfinder token (valid for another', Math.round((tokenExpiresAt - buffer - now) / 60000), 'minutes)');
    lastRequestTime = Date.now();
    return cachedToken;
  }

  // If we're already refreshing, wait for that refresh to complete
  if (isRefreshing && refreshPromise) {
    console.log('⏳ Token refresh in progress, waiting...');
    try {
      const token = await refreshPromise;
      lastRequestTime = Date.now();
      return token;
    } catch (error) {
      console.error('❌ Token refresh promise failed:', error);
      // If the refresh failed, reset state and try again
      isRefreshing = false;
      refreshPromise = null;
      throw error;
    }
  }

  // Start the refresh process
  isRefreshing = true;
  refreshPromise = performTokenRefresh();

  try {
    const token = await refreshPromise;
    lastRequestTime = Date.now();
    return token;
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    throw error;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function performTokenRefresh(): Promise<string> {
  console.log('🔑 Fetching new Petfinder access token...');

  // Clear expired token
  cachedToken = null;
  tokenExpiresAt = 0;

  // Check if environment variables exist
  if (!process.env.PETFINDER_CLIENT_ID || !process.env.PETFINDER_CLIENT_SECRET) {
    console.error('❌ Missing Petfinder environment variables!');
    console.error('PETFINDER_CLIENT_ID exists:', !!process.env.PETFINDER_CLIENT_ID);
    console.error('PETFINDER_CLIENT_SECRET exists:', !!process.env.PETFINDER_CLIENT_SECRET);
    throw new Error('Missing Petfinder API credentials - check environment variables');
  }

  console.log('✅ Petfinder credentials found, making token request...');

  try {
    const tokenUrl = 'https://api.petfinder.com/v2/oauth2/token';
    const requestBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.PETFINDER_CLIENT_ID!,
      client_secret: process.env.PETFINDER_CLIENT_SECRET!,
    });

    console.log('📡 Making token request to Petfinder...');

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'BarkBase/1.0'
      },
      body: requestBody,
    });

    console.log(`📡 Token response status: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error('❌ Token fetch failed:', res.status, errorText);

      // Handle rate limit errors specifically
      if (res.status === 429) {
        console.error('❌ Rate limit exceeded on token endpoint');
        throw new Error('Rate limit exceeded on token endpoint - please wait before retrying');
      }

      if (res.status === 401 || res.status === 403) {
        console.error('❌ Invalid API credentials');
        throw new Error('Invalid Petfinder API credentials - check client ID and secret');
      }

      throw new Error(`Failed to retrieve Petfinder access token: ${res.status} - ${errorText}`);
    }

    const data = await res.json();

    if (!data.access_token) {
      console.error('❌ No access token in response:', data);
      throw new Error('Invalid token response from Petfinder API - no access_token field');
    }

    if (!data.expires_in || typeof data.expires_in !== 'number') {
      console.error('❌ Invalid expires_in in response:', data);
      throw new Error('Invalid token response from Petfinder API - missing or invalid expires_in');
    }

    const now = Date.now();
    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000);

    console.log('✅ Successfully obtained new Petfinder token');
    console.log(`   Token expires in: ${data.expires_in} seconds (${Math.round(data.expires_in / 60)} minutes)`);
    console.log(`   Token valid until: ${new Date(tokenExpiresAt).toISOString()}`);

    return cachedToken;

  } catch (error) {
    console.error('❌ Error during token fetch:', error);
    cachedToken = null;
    tokenExpiresAt = 0;
    
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    } else {
      throw new Error(`Token refresh failed: ${String(error)}`);
    }
  }
}
