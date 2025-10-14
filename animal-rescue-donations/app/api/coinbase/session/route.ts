import { NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import crypto from 'crypto';

// Generate JWT for CDP API authentication
function generateJWT(apiKeyName: string, privateKey: string, uri: string): string {
  const payload = {
    iss: 'cdp',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes
    sub: apiKeyName,
    uri: uri,
  };

  return sign(payload, privateKey, {
    algorithm: 'ES256',
    header: {
      kid: apiKeyName,
      nonce: crypto.randomBytes(16).toString('hex'),
    },
  });
}

export async function POST(request: Request) {
  try {
    const { address, assets = ['USDC'] } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Get CDP API credentials from environment
    const apiKeyName = process.env.CDP_API_KEY_NAME;
    const privateKeyRaw = process.env.CDP_PRIVATE_KEY;

    if (!apiKeyName || !privateKeyRaw) {
      console.error('[❌ CDP Auth] CDP_API_KEY_NAME or CDP_PRIVATE_KEY not set');
      return NextResponse.json(
        { error: 'CDP API credentials not configured' },
        { status: 500 }
      );
    }

    // Normalize the private key - convert escaped newlines to real newlines
    // Coinbase PEM keys in .env have \n that need to be converted to actual newlines
    let privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    
    // Debug: Check if key looks correct
    const hasBeginMarker = privateKey.includes('-----BEGIN');
    const hasEndMarker = privateKey.includes('-----END');
    console.log('[🔍 Key Debug] Has BEGIN marker:', hasBeginMarker);
    console.log('[🔍 Key Debug] Has END marker:', hasEndMarker);
    console.log('[🔍 Key Debug] Key length:', privateKey.length);
    console.log('[🔍 Key Debug] Key starts with:', privateKey.substring(0, 30));
    
    if (!hasBeginMarker || !hasEndMarker) {
      console.error('[❌ Invalid Key] Private key is missing PEM markers');
      return NextResponse.json(
        { error: 'Invalid private key format - missing PEM markers. Please check your CDP_PRIVATE_KEY secret.' },
        { status: 500 }
      );
    }

    // Generate JWT token with proper URI
    const requestMethod = 'POST';
    const requestHost = 'api.developer.coinbase.com';
    const requestPath = '/onramp/v1/token';
    const uri = `${requestMethod} ${requestHost}${requestPath}`;
    
    let jwtToken;
    try {
      jwtToken = generateJWT(apiKeyName, privateKey, uri);
      console.log('[✅ JWT] Successfully generated JWT token');
    } catch (jwtError) {
      console.error('[❌ JWT Error]', jwtError);
      console.error('[❌ JWT Error] Private key preview (first 100 chars):', privateKey.substring(0, 100));
      return NextResponse.json(
        { error: 'Failed to generate JWT token. Please verify your CDP_PRIVATE_KEY is in proper PEM format.', details: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error' },
        { status: 500 }
      );
    }

    // Create session token request with correct format
    const requestBody = {
      addresses: [
        {
          address: address,
          blockchains: ['base'], // Support Base network
        }
      ],
      assets,
    };

    console.log('[🔐 Session Token] Requesting session token from Coinbase...');

    // Call Coinbase API to get session token (correct endpoint: /token not /session-token)
    const response = await fetch(
      `https://${requestHost}${requestPath}`,
      {
        method: requestMethod,
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ Session Token Error]', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create session token', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[✅ Session Token] Successfully created session token');

    return NextResponse.json({
      token: data.sessionToken,
    });
  } catch (error) {
    console.error('[❌ Session Token Error]', error);
    return NextResponse.json(
      {
        error: 'Failed to generate session token',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
