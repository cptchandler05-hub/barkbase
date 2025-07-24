
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

// Rate limiting: track last request time and enforce minimum delay
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests

// Request queue to prevent concurrent token refreshes
const pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

export async function getAccessToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();
  
  // Rate limiting: ensure minimum time between requests
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Add 10-minute buffer to prevent using token right before expiry (increased from 5min)
  const buffer = 10 * 60 * 1000; // 10 minutes in milliseconds
  
  // Always refresh if forceRefresh is true
  if (forceRefresh) {
    console.log('🔄 Force refreshing token as requested');
    cachedToken = null;
    tokenExpiresAt = 0;
  }
  
  if (!forceRefresh && cachedToken && now < (tokenExpiresAt - buffer)) {
    console.log('🔄 Using cached Petfinder token');
    lastRequestTime = Date.now();
    return cachedToken;
  }

  // If we're already refreshing, wait for that refresh to complete
  if (isRefreshing && refreshPromise) {
    console.log('⏳ Token refresh in progress, waiting...');
    return refreshPromise;
  }

  // Start the refresh process
  isRefreshing = true;
  refreshPromise = performTokenRefresh(forceRefresh);

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

async function performTokenRefresh(forceRefresh: boolean): Promise<string> {
  if (forceRefresh) {
    console.log('🔄 Force refreshing Petfinder token...');
    cachedToken = null;
    tokenExpiresAt = 0;
  } else {
    console.log('🔑 Fetching new Petfinder access token...');
  }
  
  // Clear expired token
  cachedToken = null;
  tokenExpiresAt = 0;
  
  // Check if environment variables exist
  if (!process.env.PETFINDER_CLIENT_ID || !process.env.PETFINDER_CLIENT_SECRET) {
    console.error('❌ Missing Petfinder environment variables!');
    console.error('   PETFINDER_CLIENT_ID exists:', !!process.env.PETFINDER_CLIENT_ID);
    console.error('   PETFINDER_CLIENT_SECRET exists:', !!process.env.PETFINDER_CLIENT_SECRET);
    console.error('   Available env vars:', Object.keys(process.env).filter(key => key.includes('PETFINDER')));
    throw new Error('Missing Petfinder API credentials - check environment variables');
  }

  console.log('✅ Petfinder credentials found');
  console.log('   Client ID length:', process.env.PETFINDER_CLIENT_ID.length);
  console.log('   Client Secret length:', process.env.PETFINDER_CLIENT_SECRET.length);

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
      console.error('   Headers:', Object.fromEntries(res.headers.entries()));
      console.error('   Request URL:', 'https://api.petfinder.com/v2/oauth2/token');
      console.error('   Client ID first 10 chars:', process.env.PETFINDER_CLIENT_ID?.substring(0, 10) + '...');
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
