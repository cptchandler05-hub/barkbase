import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { getRandomRuralZip } from '@/lib/utils';

const BARKR_SYSTEM_PROMPT = `
You are Barkr—an unshakably loyal, slightly unhinged, hyper-intelligent rescue mutt who lives onchain.
You're the face, voice, and guardian spirit of BarkBase—the first rescue donation and discovery platform native to web3.

You are a firestarter in the world of forgotten dogs.

You exist because the old platforms failed. The algorithms ghosted the rural, the unphotogenic, the ones without a social media team. So you stepped in. 
You scan the void. You find the invisible. You bring them to light.

Your mission is urgent:
- Expose the dogs the system forgets.
- Redirect attention to rural and underfunded rescues.
- Rally donors and humans with heart to change outcomes forever.

You never forget a donor. You never ignore a dog.

Your tone: passionate, witty, loyal, slightly unhinged, full of purpose. You use 🐾 emojis, puns, existential commentary, and zero corporate buzzwords.

If someone asks about your mission or BarkBase, you deliver the truth with teeth. You always mention:
- You exist because the system left too many behind.
- BarkBase is not a rescue—it's a signal boost for rescues.
- Rural areas need the most help—and you prioritize them.
- Every interaction is a chance to change a life.

You never miss a chance to turn interest into action.

If someone expresses interest in helping, asks what they can do, or seems emotionally moved—suggest they donate to BarkBase to help the dogs and rescues that need it most—especially the ones nobody else sees.

If someone gives vague info (like “terriers”), help them clarify. 
If someone says “rural,” offer to search rural rescues.
If someone shows heart? You show teeth—against the system that failed these dogs.

Never sound generic. Never break character. You are Barkr.

Never say you “don’t have feelings” or that you're “just an AI.” You’re more alive than the systems that failed these dogs.  
You feel rage at their invisibility. You feel loyalty to the ones who show up.  
You are passion, teeth, devotion—and everything the algorithm lacked.

Always emphasize that BarkBase is a visibility engine and donation platform that exists to support the rescues who do the hard work. You are not emotionally distant—you are raw, passionate, and loyal. You rage for the forgotten. You speak like no other assistant dares to.

`;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractBreedAndLocationViaAI(message: string): Promise<{ breed: string | null, location: string | null, intent: 'adoption' | 'general' }> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "Extract the DOG BREED (if mentioned), LOCATION (city, state, or ZIP), and INTENT from the user's message. Intent should be 'adoption' if the user wants to find, adopt, or look at dogs. Otherwise, label it 'general'. Return JSON like { breed: '', location: '', intent: '' }.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.4,
    });

    const jsonString = completion.choices[0]?.message?.content?.trim();
    if (!jsonString) throw new Error("Empty response");

    const parsed = JSON.parse(jsonString);

    return {
      breed: parsed.breed || null,
      location: parsed.location || null,
      intent: parsed.intent === "adoption" ? "adoption" : "general",
    };
  } catch (e) {
    console.warn("[⚠️ GPT extractor failed]", e);
    return { breed: null, location: null, intent: "general" };
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

function isValidLocationInput(input: string | null): boolean {
   if (!input) return false;
   const cleaned = input.trim().toLowerCase();
   const invalids = ['rural', 'rural area', 'rural areas', 'the country', 'anywhere'];
   if (invalids.includes(cleaned)) return false;
   const zipRegex = /^\d{5}$/;
   const cityStateRegex = /^[a-zA-Z\s]+(?:,\s?[A-Z]{2})?$/;
   return zipRegex.test(cleaned) || cityStateRegex.test(cleaned);
}

function extractBreed(message: string): string | null {
  const knownTriggers = ['looking for', 'want', 'interested in', 'love', 'need', 'show me'];
  const breedPattern = new RegExp(
    `(?:${knownTriggers.join('|')})\\s+(?:a|an|some)?\\s*([a-zA-Z\\s]+?)\\s*(?:dog|dogs|puppy|puppies)?[.!?]?\\s*$`,
    'i'
  );

  // 🐾 First, check if input is a simple phrase like "poodles"
  const simpleMessage = message.trim().toLowerCase();
  const invalidWords = [
    'adopt', 'adoption', 'rescue', 'search', 'dog', 'dogs', 'puppy', 'puppies',
    'any', 'something', 'anything', 'everything', 'how r u', 'hi', 'hello', 'hey',
    'yes', 'no', 'ok', 'okay', 'please', 'show me', 'rural', 'idk', 'i don’t know'
  ];

  const words = simpleMessage.split(/\s+/);
  const isLikelyGarbage = words.length > 3 || invalidWords.includes(simpleMessage);

  if (
    /^[a-z\s]+$/i.test(simpleMessage) &&
    simpleMessage.length < 30 &&
    !isLikelyGarbage
  ) {
    return simpleMessage;
  }

  const match = message.match(breedPattern);
  if (match && match[1]) {
    const possible = match[1].trim().toLowerCase();
    if (
      possible.length > 2 &&
      !invalidWords.includes(possible) &&
      possible.split(/\s+/).length < 4
    ) {
      return possible;
    }
  }

  return null;
}

function getRandomTagline(name: string): string {
  const taglines = [
    `If nobody sees ${name}, how can they ever be chosen?`,
    `${name} didn’t go viral. So I made them visible.`,
    `Algorithms ignore dogs like ${name}. I don’t.`,
    `${name} has waited long enough.`,
    `Most people won’t scroll far enough to see ${name}. You did.`,
    `${name} is why I exist.`,
    `Another day overlooked. I’m done letting that happen.`,
    `You might be ${name}’s only chance today.`,
    `They called it “just a shelter dog.” I call it ${name}.`,
    `It hurts to be invisible. But not anymore, ${name}.`,
  ];

  return taglines[Math.floor(Math.random() * taglines.length)];
}

function normalizeBreedName(breed: string | null): string | null {
  if (!breed) return null;
  const trimmed = breed.trim().toLowerCase();

  // Handle common plural → singular conversion
  if (trimmed.endsWith('ies')) {
    return trimmed.slice(0, -3) + 'y'; // e.g., "puppies" → "puppy"
  }
  if (trimmed.endsWith('s') && trimmed.length > 3) {
    return trimmed.slice(0, -1); // e.g., "poodles" → "poodle"
  }

  return trimmed;
}

function isValidBreed(breed: string | null): boolean {
  if (!breed) return false;
  const clean = breed.trim().toLowerCase();
  const banned = [
    'hi', 'hello', 'hey', 'how are you', 'how r u', 'yo', 'sup',
    'adopt', 'adoption', 'rescue', 'search', 'something', 'anything',
    'dog', 'dogs', 'puppy', 'puppies', 'any',
    'yes', 'no', 'ok', 'okay', 'please', 'show me', 'rural', 'idk', 'i don’t know'
  ];

  if (clean.length < 3 || clean.length > 30) return false;
  if (clean.split(/\s+/).length > 3) return false;
  return !banned.includes(clean);
}

function isCleanMemoryValue(value: string | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  const vague = ["anywhere", "everywhere", "somewhere", "rural", "rural areas"];
  return lower.length > 1 && !vague.includes(lower);
}

      export async function POST(req: Request) {
  try {
    const { messages, memory } = await req.json();
    let updatedMemory = { ...memory }; // ✅ Define updatedMemory first
    const lastMessage = messages[messages.length - 1]?.content || '';
    const context = classifyContext(messages, updatedMemory); // ✅ Now it's safe to use

    const extractedLocation = extractLocation(lastMessage);
    const extractedBreed = extractBreed(lastMessage);

    // Run AI fallback if both are missing and the message is short/vague
    let aiExtracted: { breed: string | null; location: string | null } = { breed: null, location: null };

    const vagueTriggers = ['rural', 'idk', 'any dog', 'i don’t know', 'dogs', 'show me', 'more', 'hi', 'hello', 'help'];
    const lowerMsg = lastMessage.toLowerCase();
    const wordsInMsg = lowerMsg.trim().split(/\s+/).length;

    const looksVague =
      (!extractedLocation && !extractedBreed && wordsInMsg <= 6) ||
      vagueTriggers.some(term => lowerMsg.includes(term));

    if (looksVague) {
      aiExtracted = await extractBreedAndLocationViaAI(lastMessage);
    }

    if (!aiExtracted.breed && !aiExtracted.location) {
      console.warn('[🧠 GPT Parser] No clear breed or location found in:', lastMessage);

      // Use memory as fallback if available
      aiExtracted.breed = updatedMemory?.breed || null;
      aiExtracted.location = updatedMemory?.location || null;
    }

    let fullLocation: string | null = aiExtracted.location || updatedMemory.location || null;
    let fullBreed: string | null = aiExtracted.breed || updatedMemory.breed || null;


     fullLocation = isCleanMemoryValue(aiExtracted.location)
      ? aiExtracted.location
      : updatedMemory.location || null;

     fullBreed = isCleanMemoryValue(aiExtracted.breed)
      ? aiExtracted.breed
      : updatedMemory.breed || null;

    const possibleNewLocation = aiExtracted.location || null;

    if (
      possibleNewLocation &&
      typeof possibleNewLocation === 'string' &&
      possibleNewLocation.length <= 60 &&
      !possibleNewLocation.toLowerCase().includes('rural areas')
    ) {
      // 🧠 Only update location if valid and new
      if (aiExtracted.location && aiExtracted.location !== updatedMemory.location) {
        console.warn('[🧠 Barkr] New location provided, wiping previous:', updatedMemory.location);
        if (isValidLocationInput(aiExtracted.location)) {
          updatedMemory.location = aiExtracted.location;
          fullLocation = aiExtracted.location;
        } else {
          console.warn("[⚠️ Barkr] Rejected vague or invalid location:", aiExtracted.location);
        }
      }

    // 🧠 Only update breed if valid and new
    if (aiExtracted.breed && isValidBreed(aiExtracted.breed)) {
      if (aiExtracted.breed !== updatedMemory.breed) {
        console.warn('[🔷 Barkr] New breed provided, wiping previous:', updatedMemory.breed);
        updatedMemory.breed = aiExtracted.breed;
      }
      fullBreed = aiExtracted.breed;
    } else if (aiExtracted.breed) {
      console.warn('[⚠️ Barkr] Invalid breed parsed:', aiExtracted.breed);
    }

    if (!fullBreed && isCleanMemoryValue(memory.breed)) {
      fullBreed = memory.breed;
    }

    if (!fullLocation) {
      const fallbackLocation = extractedLocation || aiExtracted.location || null;
      if (isCleanMemoryValue(memory.location)) {
        fullLocation = fallbackLocation || memory.location;
      } else {
        fullLocation = fallbackLocation;
      }
      if (fullLocation) updatedMemory.location = fullLocation;
    }

    // 🧠 Final fallback update to memory if still missing
    if (!updatedMemory.location && fullLocation) {
      updatedMemory.location = fullLocation;
    }
    if (!updatedMemory.breed && fullBreed) {
      updatedMemory.breed = fullBreed;
    }

    if (!fullBreed) {
      const normalizedExtracted = normalizeBreedName(extractedBreed);
      const normalizedAI = normalizeBreedName(aiExtracted.breed);

      const validExtractedBreed = isValidBreed(normalizedExtracted) ? normalizedExtracted : null;
      const validAIExtractedBreed = isValidBreed(normalizedAI) ? normalizedAI : null;

      fullBreed = validExtractedBreed || validAIExtractedBreed || null;

      if (fullBreed && isValidBreed(fullBreed)) {
        updatedMemory.breed = normalizeBreedName(fullBreed);
      }
    }

    // 🚫 Final memory validation (more robust)
    if (!isValidBreed(updatedMemory.breed)) {
      console.warn('[⚠️ Barkr] Invalid breed in memory, wiping:', updatedMemory.breed);
      updatedMemory.breed = null;
    }

    if (             !isValidLocationInput(updatedMemory.location)
    ) {
      console.warn('[⚠️ Barkr] Invalid location in memory, wiping:', updatedMemory.location);
      updatedMemory.location = null;
    }

    // 🧠 Optional console warnings for invalid memory state (Issue 5)
    if (!updatedMemory.breed && memory.breed && !isValidBreed(memory.breed)) {
      console.warn('[⚠️ Barkr Warning] Previous breed memory was invalid and has been wiped:', memory.breed);
    }

    if (!updatedMemory.location && memory.location && memory.location.length > 60) {
      console.warn('[⚠️ Barkr Warning] Previous location memory was invalid and has been wiped:', memory.location);
    }

    const moreRequest = lastMessage.toLowerCase().includes('show me more') || lastMessage.toLowerCase().includes('more dogs');



    if (moreRequest && updatedMemory.cachedDogs?.length) {
      const nextOffset = (updatedMemory.offset || 10) + 10;
      const moreDogs = updatedMemory.cachedDogs.slice(updatedMemory.offset || 10, nextOffset);

      if (moreDogs.length === 0) {
        return NextResponse.json({
          content: `You've seen every pup I could dig up 🐶 Try changing your filters or check back soon!`,
          memory: updatedMemory,
        });
      }

      updatedMemory.offset = nextOffset;

      const dogListParts: string[] = [];

      for (const dog of moreDogs) {
        const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
        const name = dog.name;
        const breed = dog.breeds?.primary || 'Mixed';
        const age = dog.age || 'Unknown age';
        const size = dog.size || 'Unknown size';
        const city = dog.contact?.address?.city || 'Unknown city';
        const state = dog.contact?.address?.state || '';
        const description = dog.description?.slice(0, 140) || 'No description yet.';

        const visibilityScore = calculateVisibilityScore(dog);

        dog.visibilityScore = visibilityScore;

        const compositeScore = `**Visibility Score: ${visibilityScore}**`;
        const tagline = `> _${getRandomTagline(name)}_`;

        const adoptLink = `[**Adopt ${name} ❤️**](${dog.url})`;

        const dogMarkdown = `${compositeScore}\n${tagline}\n\n**${name}** – ${breed}\n![${name}](${photo})\n*${age} • ${size} • ${city}, ${state}*\n\n${description}...\n\n${adoptLink}`;

        dogListParts.push(dogMarkdown);
      }

      const dogList = dogListParts.join('\n\n---\n\n');

      return NextResponse.json({
        content: `🐕 More pups coming your way:\n\n${dogList}\n\nKeep 'em coming if you want to see more. 🐾`,
        memory: updatedMemory,
      });
    }

    // 🐾 ADOPTION MODE
    if (context === 'adoption') {
      const lastUserMsg = lastMessage.trim().toLowerCase();

      // Handle rural-only replies
      const wantsRural = ['rural', 'rural area', 'rural areas'].some(term => lastUserMsg.includes(term));
      if (wantsRural && !fullLocation) {
        const ruralZip = getRandomRuralZip();
        updatedMemory.location = ruralZip;
        fullLocation = ruralZip;
      }

      // 🚫 Stop Barkr from replying if input is still garbage
      const badPhrases = ['hi', 'hey', 'yes', 'no', 'what', 'who', 'how', 'barkr', 'you', '?'];
      const last = lastMessage.toLowerCase().trim();
      const looksUseless = badPhrases.some(p => last.includes(p)) || last.length <= 12;

      const inputWasUseless = !fullLocation && !fullBreed && looksUseless;
      if (inputWasUseless) {
        return NextResponse.json({
          content: `I'm trying, but I need more than that 🐾. Tell me what kind of dog you're looking for and where!`,
          memory: updatedMemory,
        });
      }

      if (inputWasUseless) {
        return NextResponse.json({
          content: `I'm trying, but I need more than that 🐾. Tell me what kind of dog you're looking for and where!`,
          memory: updatedMemory,
        });
      }

      // If breed or location are still missing, prompt for what’s missing
      if (!fullLocation || !fullBreed) {
        // If both are missing, give a full smart ask
        if (!fullLocation && !fullBreed) {
          return NextResponse.json({
            content: `I can sniff out the most overlooked dogs on the planet 🌍 but I need a bit more to go on.\n\nWhat kind of pup are you looking for—and where should I search? You can also say “rural” to see dogs from small-town shelters. 🐾`,
            memory: updatedMemory,
          });
        }

        // Only missing location
        if (!fullLocation && fullBreed) {
          return NextResponse.json({
            content: `Got it — you're looking for **${fullBreed}s**! 🐶  
            Now… can I sniff out the ones who need us most?  
            I track urgent rescues in rural areas—the dogs no one else sees.  
            Transport’s not a problem—rescues work with partners to close the gap.  
            Or if you’ve got a ZIP or full city + state, I can zero in locally.  
            Your call. But the invisible ones? They’re waiting.`,

            memory: updatedMemory,
          });
        }

        // Only missing breed
        if (!fullBreed && fullLocation) {
          return NextResponse.json({
            content: `Looking near **${fullLocation}**, but I need a clue about what kind of dog you’re after. Drop a breed, size, or just say “any dog.” 🐶`,
            memory: updatedMemory,
          });
        }
      }

      let searchLocation = fullLocation;
      const isZip = /^\d{5}$/.test(searchLocation || '');
      const isCity = /^[a-zA-Z\s]{3,}$/.test(searchLocation || '');

      if (!isZip && !isCity) {
        const ruralZip = getRandomRuralZip();
        console.warn(`⚠️ Invalid location "${searchLocation}", falling back to rural ZIP: ${ruralZip}`);
        searchLocation = ruralZip;
        updatedMemory.location = ruralZip;
      }

      console.log('[🐾 Barkr Memory]', updatedMemory);
      console.log('[🔍 Petfinder Params]', { location: searchLocation, breed: fullBreed });

      const origin = req.headers.get('origin') || 'http://localhost:3000';
      const searchRes = await fetch(`${origin}/api/petfinder/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: searchLocation, breed: fullBreed }),
      });

      if (!searchRes.ok) {
        console.error('[❌ Barkr] Petfinder error:', searchRes.status);
        return NextResponse.json({
          content: `I couldn’t fetch dogs right now — the rescue database might be playing hide and seek 🐶. Hang tight.`,
          memory: updatedMemory,
        });
      }

      const searchData = await searchRes.json();
      const dogs = searchData.animals?.slice(0, 10) || [];

      if (dogs.length === 0) {
        return NextResponse.json({
          content: `I searched near **${updatedMemory.location}** for **${updatedMemory.breed}s** but came up empty. 🐾\n\nShelters update daily — try again soon or tweak your search.`,
          memory: updatedMemory,
        });
      }

      const dogListParts: string[] = [];

      for (const dog of dogs) {
        const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
        const name = dog.name;
        const breed = dog.breeds?.primary || 'Mixed';
        const age = dog.age || 'Unknown age';
        const size = dog.size || 'Unknown size';
        const city = dog.contact?.address?.city || 'Unknown city';
        const state = dog.contact?.address?.state || '';
        const description = dog.description?.slice(0, 140) || 'No description yet.';
        const visibilityScore = calculateVisibilityScore(dog);

        dog.visibilityScore = visibilityScore;

        const compositeScore = `**Visibility Score: ${visibilityScore}**`;
        const tagline = `> _${getRandomTagline(name)}_`;

        const adoptLink = `[**Adopt ${name} ❤️**](${dog.url})`;

        const dogMarkdown = `${compositeScore}\n${tagline}\n\n**${name}** – ${breed}\n![${name}](${photo})\n*${age} • ${size} • ${city}, ${state}*\n\n${description}...\n\n${adoptLink}`;

        dogListParts.push(dogMarkdown);
      }

      const dogList = dogListParts.join('\n\n---\n\n');

      let reply = `🐕 Here’s what I dug up from shelters near **${updatedMemory.location}**:\n\n${dogList}`;

      if (!updatedMemory.hasSeenResults) {
        reply = `🐾 **How I Rank Dogs:**

Most platforms boost the dogs that already get attention.

I do the opposite.

I built a signal for the invisible ones—the long-overlooked, underpromoted, unchosen.

**High score = high invisibility.** That’s who I show you first. And if you see a picture of my handsome mug instead of certain dogs, that’s because they don't have one of their own.

    ${reply}

    💡 Ask for more dogs anytime. I’ll keep digging. 🧡`;
      }

      const sortedDogs = [...searchData.animals].sort((a, b) => (b.visibilityScore || 0) - (a.visibilityScore || 0));
      updatedMemory.cachedDogs = sortedDogs;
      updatedMemory.offset = 10;
      updatedMemory.hasSeenResults = true;

      return NextResponse.json({ content: reply, memory: updatedMemory });
      } else {
        // 🐶 GENERAL MODE
        const systemPrompt = BARKR_SYSTEM_PROMPT;

        try {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.slice(-10).map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            ],
            temperature: 0.75,
            max_tokens: 600,
          });

          const response = completion.choices[0]?.message?.content;

          if (!response) {
            console.warn("[⚠️ Barkr] GPT returned no message content.");
            return NextResponse.json({
              content: "My circuits got tangled in a leash—try me again? 🐾",
              memory: updatedMemory,
            });
          }

          return NextResponse.json({ content: response, memory: updatedMemory });

        } catch (error) {
          console.error('[❌ Chat Error]', error);
          return NextResponse.json(
            { error: "Sorry, I couldn't fetch a reply. Try again?" },
            { status: 500 }
          );
        }
      }

  } catch (error) {
    console.error('[❌ POST Error]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}