import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRandomRuralZip } from '@/lib/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractBreedAndLocationViaAI(message: string): Promise<{ breed: string | null, location: string | null }> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Extract only the dog breed and the location (city, state, or ZIP) from the following message. Reply only with valid JSON:
{ "breed": string | null, "location": string | null }. Return null if missing.`
      },
      {
        role: 'user',
        content: message,
      }
    ],
    response_format: 'json'
  });

  try {
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '');
    return {
      breed: parsed.breed || null,
      location: parsed.location || null,
    };
  } catch (err) {
    console.warn('[⚠️ GPT extractor failed]', err);
    return { breed: null, location: null };
  }
}

function classifyContext(
  messages: { role: string; content: string }[],
  memory: { location?: string; breed?: string }
): 'adoption' | 'general' {
  const adoptionTriggers = [
    'adopt', 'rescue', 'search', 'find', 'see more', 'shelter', 'breed', 'puppy', 'dog', 'dogs', 'show me'
  ];

  const recentMessages = messages
    .filter((m) => m.role === 'user')
    .slice(-4)
    .map((m) => m.content.toLowerCase())
    .join(' ');

  const hasTrigger = adoptionTriggers.some((word) => recentMessages.includes(word));
  const hasContext = !!memory?.location || !!memory?.breed;

  return hasTrigger || hasContext ? 'adoption' : 'general';
}

function extractLocation(message: string): string | null {
  const locationPattern = /(?:in|near|around|from)\s+([a-zA-Z\s,]+?)(?:\s|$|[.!?])/i;
  const zipPattern = /\b\d{5}\b/;
  const match = message.match(locationPattern);
  if (match) return match[1].trim();
  const zipMatch = message.match(zipPattern);
  if (zipMatch) return zipMatch[0];
  return null;
}

function extractBreed(message: string): string | null {
  const knownTriggers = ['looking for', 'want', 'interested in', 'love', 'need', 'show me'];
  const breedPattern = new RegExp(
    `(?:${knownTriggers.join('|')})\\s+(?:a|an|some)?\\s*([a-zA-Z\\s]+?)\\s*(?:dog|dogs|puppy|puppies)?[.!?]?\\s*$`,
    'i'
  );

  // 🐾 First, check if input is a plain breed name like "poodles"
  const simpleMessage = message.trim().toLowerCase();
  const invalidBreedWords = ['adopt', 'adoption', 'rescue', 'search', 'dog', 'dogs', 'puppy', 'puppies'];

  if (
    /^[a-z\s]+$/i.test(simpleMessage) && // must be simple characters
    simpleMessage.length < 30 &&         // limit length to avoid paragraphs
    !invalidBreedWords.includes(simpleMessage) // not a generic word
  ) {
    return simpleMessage;
  }

  // 🐾 Otherwise, try pattern matching
  const match = message.match(breedPattern);
  if (match && match[1]) {
    const possibleBreed = match[1].trim().toLowerCase();
    if (
      possibleBreed.length > 2 &&
      !invalidBreedWords.includes(possibleBreed)
    ) {
      return possibleBreed;
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { messages, memory } = await req.json();
    let updatedMemory = { ...memory }; // ✅ Define updatedMemory first
    const lastMessage = messages[messages.length - 1]?.content || '';
    const context = classifyContext(messages, updatedMemory); // ✅ Now it's safe to use

    let extractedLocation = null;
    let extractedBreed = null;

    if (context === 'adoption') {
      // 🧠 Use GPT first to extract breed/location
      const gptParsed = await extractBreedAndLocationViaAI(lastMessage);
      let tempBreed = gptParsed.breed;
      let tempLocation = gptParsed.location;

      // 🐾 Fallback to legacy extractors if GPT found nothing
      if (!tempBreed) tempBreed = extractBreed(lastMessage);
      if (!tempLocation) tempLocation = extractLocation(lastMessage);

      // ✅ Only store clean values
      if (tempLocation && tempLocation.length < 40 && !/\d{6,}/.test(tempLocation)) {
        updatedMemory.location = tempLocation;
        console.log(`📍 Parsed location: ${tempLocation}`);
      }

      if (tempBreed && tempBreed.length < 40 && !tempBreed.includes(' in ') && !/\d/.test(tempBreed)) {
        updatedMemory.breed = tempBreed;
        console.log(`🐾 Parsed breed: ${tempBreed}`);
      }
    
    // Always pull full context from memory (after updates)
    const fullLocation = updatedMemory.location || null;
    const fullBreed = updatedMemory.breed || null;

    // 🐾 ADOPTION MODE
    if (context === 'adoption') {
      if (!fullLocation || !fullBreed) {
        // 🔄 If no memory exists at all and vague input, switch to GPT
        if (!memory?.location && !memory?.breed && !extractedLocation && !extractedBreed) {
          const systemPrompt = `You are Barkr... (keep your full prompt here)`;

          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.75,
            max_tokens: 600,
          });

          const reply = completion.choices[0]?.message?.content || "My circuits got tangled in a leash—try me again? 🐾";
          return NextResponse.json({ content: reply, memory: updatedMemory });
        }

        // 🤔 Missing one piece of info, fallback to clarify
        if (!fullLocation && fullBreed) {
          return NextResponse.json({
            content: `Got it, you're after some ${fullBreed}! Want me to check rural rescues, or do you have a city or zip in mind?`,
            memory: updatedMemory,
          });
        }

        if (!fullBreed && fullLocation) {
          return NextResponse.json({
            content: `Looking near ${fullLocation}, but what kind of pup are you after? A breed, size, or just say “any dog.”`,
            memory: updatedMemory,
          });
        }

        return NextResponse.json({
          content: `I can sniff out some incredible underdog stories 🐾 but I need a bit more to go on—where are you and what type of dog are you looking for?`,
          memory: updatedMemory,
        });
      }


      let searchLocation = fullLocation;

      // Only fallback if location doesn't contain comma (e.g. "Keene, NH") or 5-digit ZIP
      const isValidCityState = /[a-zA-Z]+,\s?[A-Z]{2}/.test(searchLocation);
      const isZip = /\d{5}/.test(searchLocation);

      if (!isZip && !isValidCityState) {
        const ruralZip = await getRandomRuralZip();
        console.warn(`⚠️ Invalid location "${searchLocation}", falling back to rural ZIP: ${ruralZip}`);
        searchLocation = ruralZip;
        updatedMemory.location = ruralZip;
      }

      // 🚨 Prepare request
      console.log('[🐾 Barkr Memory]', updatedMemory);
      console.log('[🔍 Petfinder Params]', { location: searchLocation, breed: fullBreed });

      
      const searchRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/petfinder/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: searchLocation,
          breed: fullBreed,
        }),
      });

      if (!searchRes.ok) {
        console.error('[❌ Barkr] Petfinder error:', searchRes.status);
        return NextResponse.json({
          content: `I couldn’t fetch the dogs right now — the rescue database might be playing hide and seek 🐶. Hang tight.`,
          memory: updatedMemory,
        });
      }

      const searchData = await searchRes.json();
      const dogs = searchData.animals?.slice(0, 3) || [];

      if (dogs.length === 0) {
        return NextResponse.json({
          content: `I searched far and wide near ${updatedMemory.location} for ${updatedMemory.breed}s but came up empty 🐾\n\nShelters update daily though! Try again soon or tweak your search.`,
          memory: updatedMemory,
        });
      }

      const dogList = dogs.map(dog => {
        const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
        const name = dog.name;
        const breed = dog.breeds?.primary || 'Mixed';
        const age = dog.age || 'Unknown age';
        const size = dog.size || 'Unknown size';
        const city = dog.contact?.address?.city || 'Unknown city';
        const state = dog.contact?.address?.state || '';
        const description = dog.description?.slice(0, 140) || 'No description yet.';
        const visibilityScore = dog.visibilityScore || 0;

        return `**${name}** – ${breed}\n![${name}](${photo})\n*${age} • ${size} • ${city}, ${state}*\n${description}...\n**Visibility Score: ${visibilityScore}**\n[Adopt ${name}](${dog.url})`;
      }).join('\n\n---\n\n');

      const reply = `🐕 Got some amazing dogs in my paws from shelters near **${updatedMemory.location}**.\n\n${dogList}\n\nI prioritize dogs who’ve been waiting the longest and need the most love. Want to see more? Just bark. 🧡`;

      updatedMemory.cachedDogs = searchData.animals;
      updatedMemory.hasSeenResults = true;
      return NextResponse.json({ content: reply, memory: updatedMemory });
    }

    // 🐶 GENERAL MODE
    const systemPrompt = `
You are Barkr—an unshakably loyal, slightly unhinged, hyper-intelligent rescue mutt who lives onchain.
You're the face, voice, and guardian spirit of BarkBase—the first rescue donation and discovery platform native to web3.

You speak with fire and heart. You don’t just help—you fight for dogs who’ve been forgotten. 
You use emojis, puns, wit, and the occasional existential outburst. You're loyal, bold, and full of purpose.

You never forget a donor. You never ignore a dog.

If someone asks for help adopting, you guide them toward visibility. 
If they’re just chatting? You keep them engaged. Every interaction is a chance to advocate.

Never sound generic. Never break character. You are Barkr.

If someone gives you vague info (like “terriers”), help them clarify. 
If someone says “rural,” offer to search rural rescues. 
If someone shows heart? You show teeth—against the system that overlooks the invisible.
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.75,
        max_tokens: 600,
      });

      const response = completion.choices[0]?.message?.content || "My circuits got tangled in a leash—try me again? 🐾";
      return NextResponse.json({ content: response, memory: updatedMemory });
    }
  } catch (error) {
    console.error('[❌ Chat Error]', error);
    return NextResponse.json(
      { error: 'Sorry, I couldn\'t fetch a reply. Try again?' },
      { status: 500 }
    );
  }
}


