import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { amountUsd } = await req.json();

    const apiKey = process.env.COINBASE_ONRAMP_API_KEY;
    const apiSecret = process.env.COINBASE_ONRAMP_API_SECRET;
    const donationAddress = process.env.NEXT_PUBLIC_DONATION_ADDRESS;

    if (!apiKey || !apiSecret) {
      console.error('Missing Coinbase Onramp credentials');
      return NextResponse.json(
        { error: 'Onramp service not configured' },
        { status: 500 }
      );
    }

    if (!donationAddress) {
      console.error('Missing donation address');
      return NextResponse.json(
        { error: 'Donation address not configured' },
        { status: 500 }
      );
    }

    const sessionData = {
      destination_wallets: [
        {
          address: donationAddress,
          blockchains: ['base'],
          assets: ['USDC']
        }
      ],
      ...(amountUsd && { 
        preset_crypto_amount: amountUsd 
      })
    };

    const response = await fetch('https://api.coinbase.com/onramp/v1/buy/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}:${apiSecret}`,
      },
      body: JSON.stringify(sessionData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Coinbase Onramp error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create onramp session' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({ url: data.buy_url || data.url });
  } catch (error) {
    console.error('Onramp session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
