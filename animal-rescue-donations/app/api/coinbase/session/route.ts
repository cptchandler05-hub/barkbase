import { NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import crypto from 'crypto';

// Generate JWT for CDP API authentication
function generateJWT(apiKeyName: string, privateKey: string): string {
  const payload = {
    iss: 'coinbase-cloud',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes
    sub: apiKeyName,
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
    const privateKey = process.env.CDP_PRIVATE_KEY;

    if (!apiKeyName || !privateKey) {
      console.error('[❌ CDP Auth] CDP_API_KEY_NAME or CDP_PRIVATE_KEY not set');
      return NextResponse.json(
        { error: 'CDP API credentials not configured' },
        { status: 500 }
      );
    }

    // Generate JWT token
    const jwtToken = generateJWT(apiKeyName, privateKey);

    // Create session token request
    const requestBody = {
      addresses: {
        [address]: ['base'], // Support Base network
      },
      assets,
    };

    console.log('[🔐 Session Token] Requesting session token from Coinbase...');

    // Call Coinbase API to get session token
    const response = await fetch(
      'https://api.developer.coinbase.com/onramp/v1/session-token',
      {
        method: 'POST',
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
      token: data.token,
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
