
import { NextResponse } from 'next/server';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { getRandomRuralZip } from '@/lib/utils';
import { getAccessToken } from '@/app/api/utils/tokenManager';
import { findBestBreedMatch } from '@/app/api/utils/fuzzyBreedMatch';
import { createClient } from '@supabase/supabase-js';

type Dog = {
  id: string | number;
  name?: string;
  breeds?: { primary?: string };
  age?: string;
  size?: string;
  photos?: { medium?: string }[];
  contact?: { address?: { city?: string; state?: string } };
  description?: string;
  url?: string;
  visibilityScore?: number;
};

function getRandomTagline(name: string): string {
  const taglines = [
    `If nobody sees ${name}, how can they ever be chosen?`,
    `${name} didn't go viral. So I made them visible.`,
    `Algorithms ignore dogs like ${name}. I don't.`,
    `${name} has waited long enough.`,
    `Most people won't scroll far enough to see ${name}. You did.`,
    `${name} is why I exist.`,
    `Another day overlooked. I'm done letting that happen.`,
    `You might be ${name}'s only chance today.`,
    `They called it "just a shelter dog." I call it ${name}.`,
    `It hurts to be invisible. But not anymore, ${name}.`,
  ];

  return taglines[Math.floor(Math.random() * taglines.length)];
}

export async function POST(req: Request) {
  try {
    console.log('[👻 /api/invisible-dogs] Fetching most invisible dogs');

    // First try to get dogs from the database
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: dbDogs, error: dbError } = await supabase
        .from('dogs')
        .select('*')
        .eq('status', 'adoptable')
        .limit(100);

      if (dbError) {
        console.error('[❌ Database Error]', dbError);
      } else if (dbDogs && dbDogs.length > 0) {
        console.log(`[📊 Database] Found ${dbDogs.length} dogs in database`);
        
        // Convert database dogs to expected format and calculate real visibility scores
        const formattedDogs = dbDogs.map(dog => ({
          id: dog.petfinder_id,
          name: dog.name,
          breeds: { 
            primary: dog.primary_breed, 
            secondary: dog.secondary_breed,
            mixed: dog.is_mixed 
          },
          age: dog.age,
          size: dog.size,
          gender: dog.gender,
          photos: (dog.photos && Array.isArray(dog.photos) && dog.photos.length > 0) 
            ? dog.photos.map(photo => {
                if (typeof photo === 'string') {
                  return { medium: photo };
                } else if (photo && typeof photo === 'object') {
                  return { medium: photo.medium || photo.large || photo.small || '/images/barkr.png' };
                }
                return { medium: '/images/barkr.png' };
              })
            : [{ medium: '/images/barkr.png' }],
          contact: { 
            address: { 
              city: dog.city || 'Unknown', 
              state: dog.state || 'Unknown'
            }
          },
          description: dog.description,
          attributes: {
            special_needs: dog.special_needs,
            spayed_neutered: dog.spayed_neutered,
            house_trained: dog.house_trained,
            shots_current: dog.shots_current
          },
          colors: {
            primary: dog.primary_color,
            secondary: dog.secondary_color,
            tertiary: dog.tertiary_color
          },
          environment: {
            children: dog.good_with_children,
            dogs: dog.good_with_dogs,
            cats: dog.good_with_cats
          }
        }));

        // Calculate real visibility scores for all dogs
        for (const dog of formattedDogs) {
          dog.visibilityScore = calculateVisibilityScore(dog);
        }

        // Sort by visibility score (highest first - most invisible)
        formattedDogs.sort((a, b) => (b.visibilityScore || 0) - (a.visibilityScore || 0));

        // Take the top 10 most invisible dogs
        const mostInvisibleDogs = formattedDogs.slice(0, 10);

        const dogListParts: string[] = [];

        for (const dog of mostInvisibleDogs) {
          const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
          const name = dog.name;
          const breed = dog.breeds?.primary || 'Mixed';
          const age = dog.age || 'Unknown age';
          const size = dog.size || 'Unknown size';
          const city = dog.contact?.address?.city || 'Unknown city';
          const state = dog.contact?.address?.state || '';
          const description = dog.description || 'No description yet.';
          const visibilityScore = dog.visibilityScore || 0;

          const compositeScore = `**Visibility Score: ${visibilityScore}**`;
          const tagline = `> _${getRandomTagline(name || 'an overlooked pup')}_`;
          const adoptLink = `[**Meet ${name} ❤️**](/adopt/${dog.id})`;

          const dogMarkdown = `${compositeScore}\n${tagline}\n\n**${name}** – ${breed}\n![${name}](${photo})\n*${age} • ${size} • ${city}, ${state}*\n\n${description}...\n\n${adoptLink}`;

          dogListParts.push(dogMarkdown);
        }

        const dogList = dogListParts.join('\n\n---\n\n');

        const reply = `👻 **The Most Invisible Dogs Right Now**

These are the most overlooked dogs from our rescue network—the ones with the highest scores = the most invisible.

They've been waiting the longest, have the fewest photos, or carry the traits that algorithms ignore. But not anymore.

${dogList}

🐾 Every one of these dogs deserves to be seen. Share them. Save them. They've been invisible long enough.`;

        return NextResponse.json({
          content: reply,
        });
      }
    } catch (dbError) {
      console.error('[❌ Database fallback error]', dbError);
    }

    // Fallback to Petfinder API if database is empty or unavailable
    console.log("Database empty or unavailable, falling back to Petfinder API");

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[❌ Token Error] Failed to get Petfinder access token');
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 500 });
    }

    // Get a random rural ZIP code
    const ruralZip = getRandomRuralZip();
    console.log('[📍 Rural ZIP selected]:', ruralZip);

    const baseUrl = 'https://api.petfinder.com/v2/animals';
    const params = new URLSearchParams({
      type: 'dog',
      status: 'adoptable',
      limit: '100',
      location: ruralZip,
      distance: '100',
    });

    const searchUrl = `${baseUrl}?${params.toString()}`;
    console.log('[📡 Fetching invisible dogs]:', searchUrl);

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[❌ API Error]', response.status, errorText);
      return NextResponse.json({
        content: `I couldn't reach the rural shelters right now 🐾. The invisible dogs will have to wait—but I won't give up on them.`,
      }, { status: 500 });
    }

    const data = await response.json();
    const fetchedDogs = data.animals || [];

    if (fetchedDogs.length === 0) {
      return NextResponse.json({
        content: `Even in rural **${ruralZip}**, I couldn't find any dogs right now. 🐾\n\nThat's either amazing news (they all found homes) or the shelters are updating their systems. Try again soon!`,
      });
    }

    // Calculate visibility scores and sort by highest (most invisible)
    for (const dog of fetchedDogs) {
      dog.visibilityScore = calculateVisibilityScore(dog);
    }

    fetchedDogs.sort((a: Dog, b: Dog) => (b.visibilityScore || 0) - (a.visibilityScore || 0));

    // Take the top 10 most invisible dogs
    const mostInvisibleDogs = fetchedDogs.slice(0, 10);

    const dogListParts: string[] = [];

    for (const dog of mostInvisibleDogs) {
      const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
      const name = dog.name;
      const breed = dog.breeds?.primary || 'Mixed';
      const age = dog.age || 'Unknown age';
      const size = dog.size || 'Unknown size';
      const city = dog.contact?.address?.city || 'Unknown city';
      const state = dog.contact?.address?.state || '';
      const description = dog.description || 'No description yet.';
      const visibilityScore = dog.visibilityScore || 0;

      const compositeScore = `**Visibility Score: ${visibilityScore}**`;
      const tagline = `> _${getRandomTagline(name || 'an overlooked pup')}_`;
      const adoptLink = `[**Meet ${name} ❤️**](/adopt/${dog.id})`;

      const dogMarkdown = `${compositeScore}\n${tagline}\n\n**${name}** – ${breed}\n![${name}](${photo})\n*${age} • ${size} • ${city}, ${state}*\n\n${description}...\n\n${adoptLink}`;

      dogListParts.push(dogMarkdown);
    }

    const dogList = dogListParts.join('\n\n---\n\n');

    const reply = `👻 **The Most Invisible Dogs Right Now**

These are the most overlooked dogs I could find in rural **${ruralZip}**—the ones with the highest scores = the most invisible.

They've been waiting the longest, have the fewest photos, or carry the traits that algorithms ignore. But not anymore.

${dogList}

🐾 Every one of these dogs deserves to be seen. Share them. Save them. They've been invisible long enough.`;

    return NextResponse.json({
      content: reply,
    });

  } catch (error) {
    console.error('[❌ Invisible Dogs Error]', error);
    return NextResponse.json({
      content: "Something went wrong while searching for invisible dogs—but I'll never stop looking for them. Try again soon. 🐾",
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'GET method not supported. Use POST.' },
    { status: 405 }
  );
}
