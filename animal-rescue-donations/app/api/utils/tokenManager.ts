import { NextResponse } from 'next/server';

// Token management
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

// Add buffer time to prevent last-minute expiration issues
const TOKEN_BUFFER_SECONDS = 300; // 5 minutes buffer

export async function clearTokenCache() {
  console.log('🧹 Clearing token cache');
  cachedToken = null;
  tokenExpiry = 0;
}

export async function forceRefreshToken(): Promise<string | null> {
  console.log('[🔄 Token Manager] Forcing token refresh...');
  cachedToken = null;
  tokenExpiry = 0;
  return await getAccessToken();
}

export async function getAccessToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with buffer)
  if (cachedToken && tokenExpiry > (now + TOKEN_BUFFER_SECONDS)) {
    console.log('[🎫 Token Manager] Using cached token');
    return cachedToken;
  }

  // Clear expired token
  if (cachedToken) {
    console.log('[🎫 Token Manager] Token expired or near expiry, fetching new one');
    cachedToken = null;
    tokenExpiry = 0;
  }

  // Check environment variables first
  if (!process.env.PETFINDER_CLIENT_ID || !process.env.PETFINDER_CLIENT_SECRET) {
    console.error('[❌ Token Manager] Missing Petfinder API credentials');
    return null;
  }

  console.log('[🎫 Token Manager] Fetching new Petfinder access token...');

  try {
    const response = await fetch('https://api.petfinder.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PETFINDER_CLIENT_ID,
        client_secret: process.env.PETFINDER_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ Token Error]', response.status, errorText);

      // Clear cached token on error
      cachedToken = null;
      tokenExpiry = 0;

      return null;
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error('[❌ Token Error] No access token in response');
      cachedToken = null;
      tokenExpiry = 0;
      return null;
    }

    // Cache the token with expiration (subtract buffer time)
    const expiresIn = data.expires_in || 3600; // Default to 1 hour if not provided
    cachedToken = data.access_token;
    tokenExpiry = Math.floor(Date.now() / 1000) + expiresIn - TOKEN_BUFFER_SECONDS;

    console.log('[✅ Token Manager] Got new Petfinder token, expires in', expiresIn, 'seconds');
    return cachedToken;

  } catch (error) {
    console.error('[❌ Token Manager Error]', error);
    // Clear cached token on error
    cachedToken = null;
    tokenExpiry = 0;
    return null;
  }
}