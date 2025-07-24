
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

// Rate limiting: track last request time and enforce minimum delay
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 200; // Increased to 200ms between requests

export async function getAccessToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();
  
  // Rate limiting: ensure minimum time between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Add 5-minute buffer to prevent using token right before expiry
  const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  // Always refresh if forceRefresh is true
  if (forceRefresh) {
    console.log('🔄 Force refreshing token as requested');
    cachedToken = null;
    tokenExpiresAt = 0;
    isRefreshing = false;
    refreshPromise = null;
  }
  
  if (!forceRefresh && cachedToken && now < (tokenExpiresAt - buffer)) {
    console.log('🔄 Using cached Petfinder token');
    lastRequestTime = Date.now();
    return cachedToken;
  }

  // If we're already refreshing, wait for that refresh to complete
  if (isRefreshing && refreshPromise) {
    console.log('⏳ Token refresh in progress, waiting...');
    try {
      return await refreshPromise;
    } catch (error) {
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
    throw new Error('Missing Petfinder API credentials - check environment variables');
  }

  console.log('✅ Petfinder credentials found');

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
      console.error('❌ Token fetch failed:', res.status, errorText);
      
      // Handle rate limit errors specifically
      if (res.status === 429) {
        throw new Error('Rate limit exceeded on token endpoint');
      }
      
      throw new Error(`Failed to retrieve Petfinder access token: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    
    if (!data.access_token) {
      console.error('❌ No access token in response:', data);
      throw new Error('Invalid token response from Petfinder API');
    }
    
    const now = Date.now();
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
