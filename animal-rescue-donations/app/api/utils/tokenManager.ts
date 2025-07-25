let tokenCache: TokenCache | null = null;

export async function getAccessToken(forceRefresh: boolean = false): Promise<string> {
  // Check if we have a valid cached token (unless forcing refresh)
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > Date.now()) {
    console.log('[🔑 Token] Using cached token');
    return tokenCache.token;
  }

  console.log(`[🔑 Token] Fetching new token ${forceRefresh ? '(forced refresh)' : ''}`);

  const clientId = process.env.PETFINDER_CLIENT_ID;
  const clientSecret = process.env.PETFINDER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[🔑 Token] Missing credentials');
    throw new Error('Petfinder API credentials not configured');
  }

  try {
    const response = await fetch('https://api.petfinder.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      console.error(`[🔑 Token] Auth failed: ${response.status}`);
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();

    // Cache the token (expires in 1 hour, we'll refresh 5 minutes early)
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 5 minutes early
    };

    console.log('[🔑 Token] New token cached');
    return data.access_token;
  } catch (error) {
    // Clear any bad cached token
    tokenCache = null;
    console.error('[🔑 Token] Error getting token:', error);
    throw error;
  }
}

export async function clearTokenCache(): Promise<void> {
  tokenCache = null;
  console.log('[🔑 Token] Cache cleared');
}