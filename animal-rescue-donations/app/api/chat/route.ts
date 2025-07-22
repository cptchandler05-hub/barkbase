import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import { getRandomRuralZip } from '@/lib/utils';

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
            `Extract DOG BREED (only if relevant for searching/adopting), LOCATION (city, state, or ZIP), and INTENT from the user's message.

INTENT should be 'adoption' ONLY if the user wants to:
- Find dogs to adopt
- Search for dogs  
- See dogs for adoption
- Adopt a specific breed

INTENT should be 'general' if the user is:
- Asking questions about dog breeds (why, how, what, when, etc.)
- Asking about dog behavior, training, health
- Making casual conversation
- Saying thanks, goodbye, etc.

BREED should only be extracted if it's relevant for an adoption search, NOT for general questions about breeds.

Return JSON like { breed: '', location: '', intent: '' }.`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.3,
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

function isValidLocationInput(input: string | null): boolean {
   if (!input) return false;
   const cleaned = input.trim().toLowerCase().replace(/\s+/g, ' ');
   const invalids = ['rural', 'rural area', 'rural areas', 'the country', 'anywhere', 'you pick', 'up to you', 'whatever'];
   if (invalids.includes(cleaned)) return false;
   const zipRegex = /^\d{5}$/;
   const cityStateRegex = /^[a-zA-Z\s]+(?:,\s?[a-zA-Z]{2,})?$/i;
   return zipRegex.test(cleaned) || cityStateRegex.test(cleaned);
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

function isValidBreed(breed: string | null): boolean {
  if (!breed) return false;
  const clean = breed.trim().toLowerCase();
  const banned = [
    'hi', 'hello', 'hey', 'how are you', 'how r u', 'yo', 'sup',
    'adopt', 'adoption', 'rescue', 'search', 'something', 'anything',
    'dog', 'dogs', 'puppy', 'puppies', 'any', 'whatever', 'you pick', 'up to you',
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
// 🔍 Triggers for rural/urgent fallback ZIPs
const ruralTriggers = [
  'rural',
  'rural area',
  'rural areas',
  'small town',
  'country shelter',
  'country rescue'
];

const urgencyTriggers = [
  'urgent',
  'at risk',
  'invisible',
  'forgotten',
  'overlooked',
  'underdog',
  'dogs in danger',
  'the ones no one sees',
  'unseen'
];

      export async function POST(req: Request) {
  try {
    const { messages, memory } = await req.json();
    let updatedMemory = { ...memory }; // ✅ Define updatedMemory first
    const lastMessage = messages[messages.length - 1]?.content || '';
        const normalizedMsg = lastMessage.trim().toLowerCase();
    const moreRequest =
      ['more', 'more please', 'more dogs', 'show me more', 'another', 'next'].includes(normalizedMsg) ||
      normalizedMsg.includes('more dogs') ||
      normalizedMsg.includes('show me more');

    let context = classifyContext(messages, updatedMemory);

    // 🧠 Run GPT intent + breed/location parser on every message
    const aiExtracted = await extractBreedAndLocationViaAI(lastMessage);

    // 🧠 Trust the AI intent detection - don't override it just because breed/location was extracted
    let aiIntent: 'adoption' | 'general' = aiExtracted.intent;
    
    // Only override to adoption if we have strong adoption context in memory
    if (aiIntent === 'general' && memory.breed && memory.location && memory.isAdoptionMode) {
      console.log("[🧠 Override] General intent but strong adoption context in memory");
      aiIntent = 'adoption';
    }

    // ✅ Improved mode switching - prioritize AI intent and user signals
    const recentUserMsg = lastMessage.toLowerCase().trim();
    
    // Clear conversation enders and topic changes
    const conversationEnders = ['thanks', 'thank you', 'cool', 'awesome', 'great', 'nice', 'ok', 'okay'];
    const topicChangers = ['nevermind', 'never mind', 'different question', 'something else', 'change topic'];
    
    const isConversationEnder = conversationEnders.some(phrase => recentUserMsg === phrase);
    const isTopicChanger = topicChangers.some(phrase => recentUserMsg.includes(phrase));
    
    // Detect general questions that should override adoption mode
    const generalQuestionWords = ['who', 'what', 'why', 'how', 'when', 'where', 'tell me', 'explain', 'describe'];
    const adoptionKeywords = ['dog', 'dogs', 'breed', 'adopt', 'search', 'find', 'show', 'more'];
    
    const hasGeneralQuestion = generalQuestionWords.some(word => recentUserMsg.startsWith(word) || recentUserMsg.includes(word + ' '));
    const hasAdoptionKeywords = adoptionKeywords.some(word => recentUserMsg.includes(word));
    
    // Force general mode for conversation enders, topic changes, or general questions without adoption keywords
    if (isConversationEnder || isTopicChanger || (hasGeneralQuestion && !hasAdoptionKeywords)) {
      aiIntent = 'general';
      context = 'general';
      updatedMemory.isAdoptionMode = false;
      updatedMemory.hasSeenResults = false;
      console.log("[🧠 Mode Switch] Switching to general mode");
    }
    // Keep adoption mode for explicit "more" requests when in adoption context
    else if (
      memory.isAdoptionMode === true &&
      (moreRequest || ["more", "more dogs", "show me more", "more please", "another", "next"].includes(recentUserMsg))
    ) {
      aiIntent = 'adoption';
      console.log("[🧠 Adoption Mode] Kept adoption mode for more request");
    }
    // Trust AI intent if it detected general mode - don't override it
    else if (aiIntent === 'general') {
      context = 'general';
      updatedMemory.isAdoptionMode = false;
      console.log("[🧠 AI Intent] AI detected general question, switching modes");
    }
    // Only default to adoption mode if AI explicitly detected adoption intent
    else if (aiIntent === 'adoption') {
      context = 'adoption';
      updatedMemory.isAdoptionMode = true;
      console.log("[🧠 AI Intent] AI detected adoption intent, staying in adoption mode");
    }

    // 🧠 Use AI intent as final context
    context = aiIntent;
    console.log('[🧠 Barkr] Final context:', context);


    if (!aiExtracted.breed && !aiExtracted.location) {
      console.warn('[🧠 GPT Parser] No clear breed or location found in:', lastMessage);

      // Use memory as fallback if available
      aiExtracted.breed = updatedMemory?.breed || null;
      aiExtracted.location = updatedMemory?.location || null;
    }

    // 🧼 Clear memory fallback if AI gave confident new values (but not on more requests)
    if (aiExtracted.location && isValidLocationInput(aiExtracted.location) && !moreRequest) {
      updatedMemory.location = null;
    }
    if (aiExtracted.breed && isValidBreed(aiExtracted.breed) && !moreRequest) {
      updatedMemory.breed = null;
    }

    // 🚫 Filter out vague or invalid AI-extracted values before use
    if (aiExtracted.location && !isValidLocationInput(aiExtracted.location)) {
      console.warn('[⚠️ Barkr] GPT returned invalid location:', aiExtracted.location);
      aiExtracted.location = null;
    }
    if (aiExtracted.breed && !isValidBreed(aiExtracted.breed)) {
      console.warn('[⚠️ Barkr] GPT returned invalid breed:', aiExtracted.breed);
      aiExtracted.breed = null;
    }

    // ✅ Use cleaned and validated values only
    let fullLocation: string | null = null;
    let fullBreed: string | null = null;

    if (isValidLocationInput(aiExtracted.location) && !moreRequest) {
      fullLocation = aiExtracted.location;
      updatedMemory.location = aiExtracted.location;
      updatedMemory.seenDogIds = [];
      updatedMemory.cachedDogs = [];
    } else if (isValidLocationInput(updatedMemory.location)) {
      fullLocation = updatedMemory.location;
    }

    if (isValidBreed(aiExtracted.breed) && !moreRequest) {
      // Only clear cache if this is actually a different breed
      if (aiExtracted.breed !== updatedMemory.breed) {
        fullBreed = aiExtracted.breed;
        updatedMemory.breed = aiExtracted.breed;
        updatedMemory.hasSeenResults = false;
        updatedMemory.seenDogIds = [];
        updatedMemory.cachedDogs = [];
      } else {
        fullBreed = aiExtracted.breed;
      }
    } else if (isValidBreed(updatedMemory.breed)) {
      fullBreed = updatedMemory.breed;
    }

    const possibleNewLocation = aiExtracted.location || null;

    if (
      possibleNewLocation &&
      typeof possibleNewLocation === 'string' &&
      possibleNewLocation.length <= 60 &&
      !/^rural/i.test(possibleNewLocation.trim()) &&
      !possibleNewLocation.toLowerCase().includes('rural areas')
    )
{
      // 🧠 Only update location if valid and new
      if (aiExtracted.location && aiExtracted.location !== updatedMemory.location && !moreRequest) {
        console.warn('[🧠 Barkr] New location provided, wiping previous:', updatedMemory.location);
        if (isValidLocationInput(aiExtracted.location)) {
          updatedMemory.location = aiExtracted.location;
          fullLocation = aiExtracted.location;
          updatedMemory.seenDogIds = [];
          updatedMemory.cachedDogs = [];
        } else {
          console.warn("[⚠️ Barkr] Rejected vague or invalid location:", aiExtracted.location);
        }
      }
    }
    // 🧠 Only update breed if valid and new (but don't clear on "more dogs" requests)
    if (aiExtracted.breed && isValidBreed(aiExtracted.breed) && !moreRequest) {
      if (aiExtracted.breed !== updatedMemory.breed) {
        console.warn('[🔷 Barkr] New breed provided, wiping previous:', updatedMemory.breed);
        updatedMemory.breed = aiExtracted.breed;
        updatedMemory.hasSeenResults = false;
        updatedMemory.seenDogIds = [];
        updatedMemory.cachedDogs = [];
      }
      fullBreed = aiExtracted.breed;
    } else if (aiExtracted.breed && !moreRequest) {
      console.warn('[⚠️ Barkr] Invalid breed parsed:', aiExtracted.breed);
    }

    if (!fullBreed && isCleanMemoryValue(memory.breed)) {
      fullBreed = memory.breed;
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


    // ✅ Final context decision - trust the AI intent and mode switching logic above
    console.log(`[🧠 Final Decision] aiIntent: ${aiIntent}, context: ${context}, isAdoptionMode: ${updatedMemory.isAdoptionMode}`);

    if (moreRequest) {
      // 🧠 Check if we have cached dogs - if not, something went wrong with memory
      if (!updatedMemory.cachedDogs || updatedMemory.cachedDogs.length === 0) {
        return NextResponse.json({
          content: `Hmm… I don't have any more dogs cached right now 🐶. Try a new search or say a breed + location again.`,
          memory: updatedMemory,
        });
      }

      // ✅ Ensure all cached dogs have visibilityScore before filtering
      for (const dog of updatedMemory.cachedDogs) {
        if (dog.visibilityScore === undefined) {
          dog.visibilityScore = calculateVisibilityScore(dog);
        }
      }

      const unseenDogs = updatedMemory.cachedDogs.filter(
        (dog: Dog) => !updatedMemory.seenDogIds?.includes(dog.id)
      );

      const moreDogs = unseenDogs.slice(0, 10);

      // ✅ Add shown dogs to seen list *immediately*
      if (!updatedMemory.seenDogIds) updatedMemory.seenDogIds = [];
      updatedMemory.seenDogIds.push(...moreDogs.map((d: Dog) => d.id));
      if (updatedMemory.seenDogIds.length > 200) {
        updatedMemory.seenDogIds = updatedMemory.seenDogIds.slice(-200);
      }
      updatedMemory.hasSeenResults = true;

      if (moreDogs.length === 0) {
        return NextResponse.json({
          content: `Looks like I've already shown you all the dogs I could find for now. 🐾 Try a new location or breed—or head to the [**Adoption Page**](/adopt) to see more!`,
          memory: updatedMemory,
        });
      }

      updatedMemory.hasSeenResults = true;

      const dogListParts: string[] = [];

      // ✅ Ensure final batch is sorted by visibility score before formatting
      moreDogs.sort((a: Dog, b: Dog) => (b.visibilityScore || 0) - (a.visibilityScore || 0));

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
        const tagline = `> _${getRandomTagline(name || 'an overlooked pup')}_`;

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

      const msg = lastUserMsg;
      const hasRuralIntent = ruralTriggers.some((t) => msg.includes(t));
      const hasUrgencyIntent = urgencyTriggers.some((t) => msg.includes(t));

      if (
        context === 'adoption' &&
        !fullLocation &&
        (hasRuralIntent || hasUrgencyIntent)
      ) {
        const ruralZip = getRandomRuralZip();
        updatedMemory.location = ruralZip;
        fullLocation = ruralZip;
      }

      const missionIntentPhrases = [
        'invisible dogs',
        'forgotten dogs',
        'overlooked dogs',
        'dogs in danger',
        'underdogs',
        'rural dogs',
        'the dogs no one sees',
        'longest waiting',
        'show me the invisible dogs',
        'help the ones nobody sees',
      ];

      // 🧠 Garbage input fallback
      const badPhrases = [
        'hi', 'hey', 'hello', 'yes', 'no',
        'what', 'who', 'how', 'you', '?', 'ok', 'okay', 'help', 'idk'
      ];

      const last = lastMessage.toLowerCase().trim();
      const looksUseless = badPhrases.some(p => last.includes(p)) || last.length <= 12;

      const missionIntentDetected = missionIntentPhrases.some(p => last.includes(p));

      if (!fullBreed && !fullLocation && missionIntentDetected) {
        return NextResponse.json({
          content: `I see you. And I see them—the ones the system forgot. But I still need a location or breed to sniff them out.\n\nTell me what kind of pup you're drawn to, and give me a ZIP code or city + state to search. 🐾`,
          memory: updatedMemory,
        });
      }

      if (!fullBreed && !fullLocation && looksUseless) {
        return NextResponse.json({
          content: `I'm trying, but I need more than that 🐾. Tell me what kind of dog you're looking for and where!`,
          memory: updatedMemory,
        });
      }

      // 🐾 Prompt for missing inputs
      if (!fullBreed && !fullLocation) {
        return NextResponse.json({
          content: `I can sniff out the most overlooked dogs on the planet 🌍 but I need a bit more to go on.\n\nWhat kind of pup are you looking for—and where should I search? Give me a ZIP code or city + state. 🐾`,
          memory: updatedMemory,
        });
      }

      if (!fullLocation && fullBreed) {
        return NextResponse.json({
          content: `Got it — you're hoping to meet some **${fullBreed}** 🐶\n\nNow I just need to know WHERE to search. Give me a ZIP code or city + state, and I'll find the most overlooked ${fullBreed}s in that area. 🐾`,
          memory: updatedMemory,
        });
      }

      if (!fullBreed && fullLocation) {
        return NextResponse.json({
          content: `Looking near **${fullLocation}**, but I need a clue about what kind of dog you’re after. Drop a breed, size, or just say “any dog.” 🐶`,
          memory: updatedMemory,
        });
      }


      let searchLocation = (fullLocation || '').trim().toLowerCase();

      // ✅ Handle inputs like "austin texas"
      const commonStateNames: { [key: string]: string } = {
        alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
        colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
        hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
        kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
        massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
        missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
        "new hampshire": 'NH', "new jersey": 'NJ', "new mexico": 'NM', "new york": 'NY',
        "north carolina": 'NC', "north dakota": 'ND', ohio: 'OH', oklahoma: 'OK',
        oregon: 'OR', pennsylvania: 'PA', "rhode island": 'RI',
        "south carolina": 'SC', "south dakota": 'SD', tennessee: 'TN',
        texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
        washington: 'WA', "west virginia": 'WV', wisconsin: 'WI', wyoming: 'WY'
      };

      // ✅ Try ZIP
      const zipMatch = searchLocation.match(/\b\d{5}\b/);
      if (zipMatch) {
        searchLocation = zipMatch[0];
      } else {
        const words = searchLocation.split(/\s+/);
        const lastWord = words[words.length - 1];
        const possibleState = commonStateNames[lastWord];

        if (possibleState) {
          const cityWords = words.slice(0, -1).map(w => w.replace(/,+$/, ''));
          const city = cityWords
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          searchLocation = `${city}, ${possibleState}`;

          // 🧼 Final comma cleanup to avoid double commas
          searchLocation = searchLocation.replace(/,+/g, ',').replace(/\s+,/g, ',').replace(/,\s+/g, ', ');
          console.log("[🧼 Final Cleaned Location]", searchLocation);

        } else {
          // fallback for city + 2-letter state like "austin tx"
          const cityStateMatch = searchLocation.match(/([\w\s]+)[,]?\s+([a-zA-Z]{2})$/);
          if (cityStateMatch) {
            const rawCity = cityStateMatch[1].trim();
            const stateRaw = cityStateMatch[2].toUpperCase();
            const formattedCity = rawCity
              .split(/\s+/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            searchLocation = `${formattedCity}, ${stateRaw}`;
          }
        }
      }

      console.log("[📍 Normalized Location]", searchLocation);

      // ✅ Final assignment
      fullLocation = searchLocation;
      updatedMemory.location = searchLocation;

      const isZip = /^\d{5}$/.test(searchLocation || '');
      const isCityState = /^[a-zA-Z\s]+,\s?[A-Z]{2}$/.test(searchLocation || '');

      if (!isZip && !isCityState) {
        console.warn(`⚠️ Invalid location "${searchLocation}", asking user for clarification.`);
        return NextResponse.json({
          content: `Hmm… I couldn’t use **${searchLocation}** as a search location. Can you give me a ZIP code or full city + state like “Austin, TX”?`,
          memory: updatedMemory,
        });
      }

      console.log('[🐾 Barkr Memory]', updatedMemory);
      console.log('[🔍 Petfinder Params]', { location: searchLocation, breed: fullBreed });

      const origin = req.headers.get('origin') || 'http://localhost:3000';

      let allDogs: Dog[] = [];

      // ✅ Check if we need to fetch new dogs from API
      if (!updatedMemory.cachedDogs || updatedMemory.cachedDogs.length === 0) {
        const searchRes = await fetch(`${origin}/api/petfinder/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: searchLocation ?? '',
            breed: fullBreed ?? '',
          }),
        });

        if (!searchRes.ok) {
          const err = await searchRes.json();
          console.error('[❌ Barkr] Petfinder error:', searchRes.status);

          if (err.invalidLocation) {
            return NextResponse.json({
              content: `That location didn't work 🐾. Can you give me a ZIP code or a full city and state like "Austin, TX" or "Brooklyn, NY"?`,
              memory: updatedMemory,
            });
          }

          return NextResponse.json({
            content: `I couldn't fetch dogs right now — the rescue database might be playing hide and seek 🐶. Hang tight.`,
            memory: updatedMemory,
          });
        }

        const searchData = await searchRes.json();
        const fetchedDogs = searchData.animals || [];

        if (fetchedDogs.length === 0) {
          return NextResponse.json({
            content: `I searched near **${searchLocation}** for **${fullBreed || 'dogs'}** but came up empty. 🐾\n\nShelters update daily — try again soon or tweak your search.`,
            memory: updatedMemory,
          });
        }

        // ✅ Assign visibility scores to all fetched dogs
        for (const dog of fetchedDogs) {
          dog.visibilityScore = calculateVisibilityScore(dog);
        }

        // ✅ Sort all dogs by visibility score (highest first - most invisible)
        fetchedDogs.sort((a: Dog, b: Dog) => (b.visibilityScore || 0) - (a.visibilityScore || 0));

        // ✅ Cache all sorted dogs
        allDogs = fetchedDogs;
        updatedMemory.cachedDogs = fetchedDogs;
      } else {
        // Use cached dogs
        allDogs = updatedMemory.cachedDogs || [];
      }

      // Get dogs to display
      const seen = new Set(updatedMemory.seenDogIds || []);
      const unseenDogs = allDogs.filter((dog: Dog) => !seen.has(dog.id));
      const dogs = unseenDogs.slice(0, 10);

      // ✅ Add shown dogs to seen list and set adoption mode flag
      if (!updatedMemory.seenDogIds) updatedMemory.seenDogIds = [];
      updatedMemory.seenDogIds.push(...dogs.map((d) => d.id));
      if (updatedMemory.seenDogIds.length > 200) {
        updatedMemory.seenDogIds = updatedMemory.seenDogIds.slice(-200);
      }
      updatedMemory.isAdoptionMode = true;

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
        const tagline = `> _${getRandomTagline(name || 'an overlooked pup')}_`;

        const adoptLink = `[**Adopt ${name} ❤️**](${dog.url})`;

        const dogMarkdown = `${compositeScore}\n${tagline}\n\n**${name}** – ${breed}\n![${name}](${photo})\n*${age} • ${size} • ${city}, ${state}*\n\n${description}...\n\n${adoptLink}`;

        dogListParts.push(dogMarkdown);
      }

      const dogList = dogListParts.join('\n\n---\n\n');

      let reply: string;

      if (!updatedMemory.hasSeenResults) {
        // ✅ First time seeing results - show visibility explanation
        reply = `🐾 **How I Rank Dogs:**

Most platforms boost the dogs that already get attention.

I do the opposite.

I built a signal for the invisible ones—the long-overlooked, underpromoted, unchosen.

**High score = high invisibility.** That's who I show you first. And if you see a picture of my handsome mug instead of certain dogs, that's because they don't have one of their own.

🐕 Here's what I dug up from shelters near **${updatedMemory.location}**:

${dogList}

💡 Ask for more dogs anytime. I'll keep digging. 🧡`;

        // ✅ Mark that user has now seen results
        updatedMemory.hasSeenResults = true;
      } else {
        // ✅ Subsequent requests - simpler reply
        reply = `🐕 Here's what I dug up from shelters near **${updatedMemory.location}**:\n\n${dogList}`;
      }

      

      return NextResponse.json({
        content: reply,
        memory: updatedMemory,
      });
    } else {
      // 🐶 GENERAL MODE
      const systemPrompt = BARKR_SYSTEM_PROMPT;

      try {
        let trimmedMessages = messages;
        if (messages.length > 5) {
          trimmedMessages = messages.slice(-5);
        }

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            ...trimmedMessages.map((m: { role: string; content: string }) => ({

              role: m.role,
              content: m.content,
            })),
          ],
          temperature: 0.75,
          max_tokens: 600,
        });

        const response = completion.choices?.[0]?.message?.content;
        if (!response) {
         console.warn("[⚠️ Barkr] GPT returned no message content.");
          return NextResponse.json({
            content: "My circuits got tangled in a leash—try me again? 🐾",            memory: updatedMemory,
          });
        }

        return NextResponse.json({
          content: response,
          memory: updatedMemory,
        });

        } catch (error) {
          console.error('[❌ Chat Error]', error);
          return new NextResponse(
            JSON.stringify({ error: "Sorry, I couldn't fetch a reply. Try again?" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
    }
  } catch (error) {
    console.error('[❌ Chat Error]', error);
    return new NextResponse(
      JSON.stringify({ error: "Sorry, I couldn't fetch a reply. Try again?" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}