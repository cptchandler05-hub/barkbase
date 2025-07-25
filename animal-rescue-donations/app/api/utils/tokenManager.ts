import { NextResponse } from 'next/server';

// Token management
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function clearTokenCache() {
  console.log('🧹 Clearing token cache');
  cachedToken = null;
  tokenExpiresAt = 0;
}

export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  try {
    // Return cached token if valid and not forcing refresh
    if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
      console.log('[🎫 Token Manager] Using cached token');
      return cachedToken.accessToken;
    }

    console.log('[🎫 Token Manager] Fetching new Petfinder access token...');

    const response = await fetch('https://api.petfinder.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PETFINDER_API_KEY!,
        client_secret: process.env.PETFINDER_SECRET!,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ Token Error]', response.status, errorText);
      // Clear cached token on error
      cachedToken = null;
      return null;
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error('[❌ Token Error] No access token in response');
      cachedToken = null;
      return null;
    }

    // Cache the token with expiration (subtract 10 minutes for safety)
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000) - (10 * 60 * 1000),
    };

    console.log('[✅ Token Manager] Got new Petfinder token, expires in', data.expires_in, 'seconds');
    return cachedToken.accessToken;

  } catch (error) {
    console.error('[❌ Token Manager Error]', error);
    // Clear cached token on error
    cachedToken = null;
    return null;
  }
}