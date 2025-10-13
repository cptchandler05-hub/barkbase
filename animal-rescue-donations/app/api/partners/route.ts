import { NextResponse } from 'next/server';
import { getPartners } from '@/lib/partners';

export async function GET() {
  try {
    const partners = await getPartners();
    return NextResponse.json(partners);
  } catch (error) {
    console.error('Error in partners API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch partners' },
      { status: 500 }
    );
  }
}

export const revalidate = 300;
