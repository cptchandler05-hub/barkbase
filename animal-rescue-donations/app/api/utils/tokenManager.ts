
import { NextResponse } from 'next/server';

// Token management
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function clearTokenCache() {
  console.log('🧹 Clearing token cache');
  cachedToken = null;
  tokenExpiresAt = 0;
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5-minute buffer

  // Check if we have a valid cached token and not forcing refresh
  if (!forceRefresh && cachedToken && now < (tokenExpiresAt - buffer)) {
    console.log('🔄 Using cached Petfinder token');
    return cachedToken;
  }

  console.log('🔑 Fetching new Petfinder access token...');

  try {
    const response = await fetch('https://api.petfinder.com/v2/oauth2/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'BarkBase/1.0'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.PETFINDER_CLIENT_ID!,
        client_secret: process.env.PETFINDER_CLIENT_SECRET!,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token request failed:', response.status, errorText);
      throw new Error(`Failed to get token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token in response');
    }

    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in * 1000);

    console.log('✅ Got new Petfinder token, expires in', data.expires_in, 'seconds');
    return cachedToken;

  } catch (error) {
    console.error('❌ Failed to get access token:', error);
    // Clear cache on error
    cachedToken = null;
    tokenExpiresAt = 0;
    throw error;
  }
}
