import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { amount, metadata } = await req.json();

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid donation amount' },
        { status: 400 }
      );
    }

    const commerceApiKey = process.env.COINBASE_COMMERCE_API_KEY;
    
    if (!commerceApiKey) {
      console.error('Coinbase Commerce API key not configured');
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    const chargePayload = {
      local_price: {
        amount: amount.toString(),
        currency: 'USD'
      },
      pricing_type: 'fixed_price',
      name: 'BarkBase Rescue Donation',
      description: `Support rescue dogs with a $${amount} donation`,
      metadata: {
        ...metadata,
        donation_amount: amount,
        timestamp: new Date().toISOString(),
      },
      redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://barkbase.xyz'}?donation=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://barkbase.xyz'}?donation=cancelled`,
    };

    const response = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CC-Api-Key': commerceApiKey,
      },
      body: JSON.stringify(chargePayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Coinbase Commerce error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create charge' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      chargeId: data.data.id,
      hostedUrl: data.data.hosted_url,
    });
  } catch (error) {
    console.error('Create charge error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
