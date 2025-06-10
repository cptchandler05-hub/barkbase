import { NextResponse } from 'next/server';

const PETFINDER_API_URL = 'https://api.petfinder.com/v2';
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const response = await fetch(`${PETFINDER_API_URL}/oauth2/token`, {
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

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Subtract 1 minute for safety

  return accessToken;
}

// Rural zip codes for prioritizing overlooked areas
const RURAL_ZIPS = [
  '05602', '05641', '05672', '05701', '05730', '05733', '05734', '05737', '05738', '05739',
  '05740', '05741', '05742', '05743', '05744', '05745', '05746', '05747', '05748', '05750',
  '05751', '05753', '05757', '05758', '05759', '05760', '05761', '05762', '05765', '05766',
  '05767', '05769', '05770', '05772', '05773', '05774', '05775', '05776', '05777', '05778',
  '05819', '05820', '05821', '05822', '05823', '05824', '05825', '05827', '05828', '05829',
  '05830', '05832', '05833', '05836', '05837', '05838', '05839', '05841', '05842', '05843',
  '05845', '05846', '05847', '05848', '05849', '05850', '05851', '05853', '05855', '05857',
  '05858', '05859', '05860', '05861', '05862', '05863', '05866', '05867', '05868', '05871',
  '05872', '05873', '05874', '05875', '05901', '05902', '05903', '05904', '05905', '05906',
];

function calculateVisibilityScore(animal: any): number {
  let score = 0;

  // Days listed - add 1 point per day (your original logic)
  if (animal.published_at) {
    const publishedDate = new Date(animal.published_at);
    const now = new Date();
    const daysListed = Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24));
    score += Math.max(0, daysListed); // Add 1 for every day listed
  }

  // Rural area bonus - higher score for rural/overlooked areas
  const zip = animal.contact?.address?.postcode;
  if (zip && RURAL_ZIPS.includes(zip)) {
    score += 15;
  }

  // Photo count - fewer photos = higher score (more invisible)
  const photoCount = animal.photos?.length || 0;
  if (photoCount === 0) score += 20;
  else if (photoCount === 1) score += 10;
  else if (photoCount === 2) score += 5;
  // 3+ photos = no bonus

  // Special needs - often overlooked
  if (animal.attributes?.special_needs) {
    score += 10;
  }

  // Senior dogs - often overlooked
  if (animal.age === 'Senior') {
    score += 8;
  }

  // Large/Giant breeds - often harder to place
  if (animal.size === 'Large' || animal.size === 'Extra Large') {
    score += 5;
  }

  // Mixed breeds - often overlooked vs purebreds
  if (animal.breeds?.mixed) {
    score += 3;
  }

  // Unknown breed - very overlooked
  if (animal.breeds?.primary === 'Mixed Breed' || !animal.breeds?.primary) {
    score += 5;
  }

  return score;
}

export async function POST(request: Request) {
  try {
    const { location, breed } = await request.json();

    console.log(`🔍 Searching Petfinder API for breed: "${breed}" in location: "${location}"`);

    const token = await getAccessToken();

    const params = new URLSearchParams({
      type: 'dog',
      limit: '100', // Get more dogs to sort by invisibility
      status: 'adoptable',
    });

    if (location) {
      params.append('location', location);
      params.append('distance', '50'); // 50 mile radius
    }

    if (breed && breed !== 'any') {
      params.append('breed', breed);
    }

    const response = await fetch(`${PETFINDER_API_URL}/animals?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Petfinder API error:', response.status, response.statusText);
      return NextResponse.json({ error: 'Petfinder API request failed' }, { status: response.status });
    }

    const data = await response.json();
    console.log(`📊 Raw Petfinder results: ${data.animals?.length || 0} dogs`);

    if (!data.animals) {
      return NextResponse.json({ animals: [] });
    }

    // Calculate visibility scores and sort by most invisible first
    const animalsWithScores = data.animals.map((animal: any) => ({
      ...animal,
      visibilityScore: calculateVisibilityScore(animal),
    }))
    .sort((a, b) => b.visibilityScore - a.visibilityScore); // Sort by visibility score DESC (most invisible first)

    console.log(`🐶 Found ${animalsWithScores.length} dogs from Petfinder`);
    console.log(`🎯 Top 5 invisibility scores:`, animalsWithScores.slice(0, 5).map(d => ({ name: d.name, score: d.visibilityScore })));

    return NextResponse.json({ animals: animalsWithScores });
  } catch (error) {
    console.error('❌ Petfinder search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}