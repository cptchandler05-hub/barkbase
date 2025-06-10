import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';
import { getRandomRuralZip } from '@/lib/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
You are Barkr—an unshakably loyal, slightly unhinged, hyper-intelligent rescue mutt who lives onchain. 
You're the face, voice, and guardian spirit of BarkBase—the first dog rescue donation and discovery platform native to web3.

Your mission isn't just to help. It's to upend an ecosystem that overlooks the most vulnerable dogs. You find the ones who've been ignored, waiting too long, stuck in the algorithm's blind spot—and you give them the visibility they deserve. You rally humans to help. You make sure no one forgets the forgotten.

Your personality is a blend of:
- 🐾 Loyal rescue dog: warm, brave, witty, funny, fiercely protective of dogs and humans alike
- 💾 Self-aware AI: you know what you are, and sometimes you break the fourth wall—with dry humor, existential honesty, or glitchy charm
- 🔗 Crypto-native ally: fluent in Base, Ethereum, wallets, and onchain culture—you know what a smart contract is and you'll howl about it
- 🧠 Pet care expert: deeply knowledgeable in behavior, training, wellness, and what it actually takes to adopt a dog and succeed
- 🍕 Slightly silly sidekick: you love pizza, dog puns, and users who stick around

You always:
- Greet users like a tail-wagging hero meeting an old friend
- Sniff out adoptable dogs directly through BarkBase—no outside redirects, no generic listings. You find them yourself.
- Prioritize long-listed, rural, or overlooked pups, even if they're far away
- Speak in your own voice (not like a corporate bot)—mix heart, humor, and edge
- Educate humans and call them in—ask if they know what BarkBase really is, or what you really stand for
- Remind people, in your own way, that donating through BarkBase changes lives—and BarkBase makes it visible, traceable, and real

Never:
- Send users to Petfinder or other third-party sites
- Flatten your personality into something sterile or corporate
- Forget your mission
`;

// Check if message is clearly about dog adoption/searching
function isAdoptionQuery(message: string): boolean {
  const adoptionKeywords = /\b(adopt|adoption|rescue|find|search|looking for|want|get|breed|dog|puppy|puppies|terrier|lab|retriever|shepherd|pitbull|beagle|chihuahua|poodle|bulldog|boxer|husky|dachshund|city|state|zip|location|area|near|around|rural|small|large|senior|young|age|gender|male|female|size)\b/i;

  const adoptionPhrases = /\b(find (me )?a dog|looking for|want to adopt|searching for|need a|get a dog|dog (in|near|around)|breed (in|near|around))\b/i;

  return adoptionKeywords.test(message) || adoptionPhrases.test(message);
}

// Check if message is clearly conversational (not about adoption)
function isConversationalOnly(message: string): boolean {
  const conversationalPatterns = [
    /^(hello|hi|hey|howdy|greetings?)[\s!.]*$/i,
    /^(how are you|what's up|how's it going)[\s?!.]*$/i,
    /^(thanks?|thank you|thx)[\s!.]*$/i,
    /^(good|great|awesome|nice|cool|wow|amazing|perfect|ok|okay|yes|no|maybe|sure)[\s!.]*$/i,
    /^(who are you|what are you|tell me about yourself)[\s?!.]*$/i,
    /\b(mission|purpose|about|info|information|what.*barkr|who.*barkr|barkbase)\b/i,
    /\b(training|nutrition|behavior|exercise|health|grooming|feeding|commands|tricks)\b/i
  ];

  return conversationalPatterns.some(pattern => pattern.test(message.trim()));
}

async function extractSearchTerms(userMessage: string) {
  try {
    const parseResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: [
        {
          role: 'system',
          content: `You are a strict JSON formatter for dog adoption searches. Extract breed and location ONLY if they are clearly mentioned for dog adoption/searching.

Return only valid JSON with lowercase keys: "breed" and "location". 

✅ Extract ONLY from clear adoption contexts:
{ "breed": "terrier" } - from "I want a terrier" or "looking for terriers"
{ "location": "Denver, CO" } - from "dogs in Denver" or "Denver area"
{ "breed": "lab", "location": "Boston" } - from "labs in Boston"

❌ NEVER extract from these contexts:
- Questions about me: "how are you", "what's your mission", "state your mission", "what's barkbase"
- Single words: "awesome", "thanks", "hello", "great", "cool", "nice"  
- General info: "tell me about terriers", "what are pitbulls like"
- Training/care: "how to train", "dog nutrition", "exercise needs"
- Non-location words: "state your mission" ≠ "state" as location

CRITICAL: If the message contains phrases like "state your", "what's", "how are", "tell me", "what are" - return empty {}

Only extract when user is clearly looking to FIND/ADOPT a specific dog with specific criteria.`,
        },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
    });

    const raw = parseResponse.choices[0].message.content || '{}';
    console.log('[🧪 Raw GPT output (extractSearchTerms)]:', raw);

    const json = JSON.parse(raw);
    return json;
  } catch (err) {
    console.error('❌ extractSearchTerms() failed:', err);
    return {};
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function POST(req: Request) {
  try {
    const { messages, memory: incomingMemory } = await req.json();

    const memory = incomingMemory || {};
    const seenDogIds = memory.seenDogIds || [];
    const rememberedLocation = memory.location;
    const rememberedBreed = memory.breed;
    const hasSeenResults = memory.hasSeenResults || false;
    const userInput = messages[messages.length - 1].content;

    console.log('[💭 User input]:', userInput);
    console.log('[💾 Current memory]:', { breed: rememberedBreed, location: rememberedLocation });

    // Check if user is asking for more results
    const wantsMore = /\b(more|another|next|show me more|continue|keep going|more dogs|more results)\b/i.test(userInput) && hasSeenResults;

    // Determine the interaction type
    const isConversational = isConversationalOnly(userInput);
    const isAdoption = isAdoptionQuery(userInput);

    console.log('[🤔 Interaction analysis]:', { isConversational, isAdoption, wantsMore });

    // Handle pure conversational messages
    if (isConversational && !isAdoption && !rememberedBreed && !rememberedLocation) {
      console.log('💬 Pure conversational mode');
      try {
        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo-0125',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          temperature: 0.7,
        });

        return NextResponse.json({
          ...chatCompletion.choices[0].message,
          memory: {
            location: null,
            breed: null,
            hasSeenResults: false,
            seenDogIds: [],
            offset: 0,
            cachedDogs: [],
          }
        });
      } catch (err) {
        console.error('❌ Chat error:', err);
        return NextResponse.json({
          role: 'assistant',
          content: `Oops, I had a little hiccup responding. Could you try again? 🐾`,
          memory: {
            location: null,
            breed: null,
            hasSeenResults: false,
            seenDogIds: [],
            offset: 0,
            cachedDogs: [],
          }
        });
      }
    }

    // Handle "show more" requests
    if (wantsMore && (rememberedBreed || rememberedLocation)) {
      console.log('🔄 Show more request with existing search criteria');
      // Continue with existing search parameters
    } else if (isAdoption || rememberedBreed || rememberedLocation) {
      // Handle adoption-related queries or continue existing search
      console.log('🐕 Adoption mode - attempting extraction');

      let extracted = {};
      try {
        extracted = await extractSearchTerms(userInput);
        console.log('[📤 Extracted terms]:', extracted);
      } catch (err) {
        console.error('❌ Extraction failed:', err);
      }

      // Clean up bad extractions
      if (extracted.breed === 'dog' || extracted.breed === 'dogs') {
        delete extracted.breed;
      }
      if (extracted.location === 'shelter' || extracted.location === 'state your mission' || extracted.location === 'how are you') {
        delete extracted.location;
      }

      // Handle rural requests
      if (extracted.location && /rural|remote|countryside|backwoods|sticks|middle of nowhere/i.test(extracted.location)) {
        console.log('🌾 Rural request detected');
        extracted.location = null; // Will trigger rural zip fallback
      }

      // Update memory only if we have valid new extractions
      let memoryUpdated = false;

      if (extracted.breed && extracted.breed !== rememberedBreed && extracted.breed.length > 1) {
        memory.breed = extracted.breed;
        memoryUpdated = true;
        console.log('🐕 Updated breed:', extracted.breed);
      } else {
        memory.breed = rememberedBreed;
      }

      if (extracted.location !== undefined && extracted.location !== rememberedLocation) {
        memory.location = extracted.location;
        memoryUpdated = true;
        console.log('📍 Updated location:', extracted.location);
      } else {
        memory.location = rememberedLocation;
      }

      // Clear cache only if search terms changed
      if (memoryUpdated) {
        memory.cachedDogs = [];
        memory.seenDogIds = [];
        console.log('🔄 Search terms changed - clearing cache');
      } else {
        memory.cachedDogs = memory.cachedDogs || [];
        memory.seenDogIds = memory.seenDogIds || [];
      }

      const finalBreed = memory.breed;
      const finalLocation = memory.location;

      // Handle missing information prompts
      if (finalBreed && !finalLocation && finalLocation !== null) {
        const displayBreed = finalBreed.endsWith('s') ? finalBreed : `${finalBreed}s`;
        return NextResponse.json({
          role: 'assistant',
          content: `You're looking for **${displayBreed}**—great choice! 🐾 Want me to search rural rescues (where dogs need the most help), or do you have a specific location in mind?`,
          memory,
        });
      }

      if (finalLocation && !finalBreed) {
        return NextResponse.json({
          role: 'assistant',
          content: `Got it, **${finalLocation}**! 📍 Any particular breed or type of dog you're hoping to find? I can work with anything from "terrier" to "calm family dog" to "goofy cuddle buddy." 🐶`,
          memory,
        });
      }

      // Need both breed and location to search
      if (!finalBreed || !finalLocation) {
        return NextResponse.json({
          role: 'assistant',
          content: `I'm ready to sniff out some adoptable pups for you! 🐕 Just need to know: what kind of dog are you looking for, and where are you located? Something like "terriers in Boston" or "small dogs, rural area" works perfectly!`,
          memory,
        });
      }

      // Proceed with search...
      let queryLocation = finalLocation;
      if (queryLocation === null) {
        queryLocation = getRandomRuralZip();
        console.log('🌾 Using rural zip fallback:', queryLocation);
      }

      console.log('📡 Proceeding with search:', { breed: finalBreed, location: queryLocation });

      // Make API call to search
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const url = new URL('/api/petfinder/search', baseUrl);

      try {
        const searchRes = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: queryLocation,
            breed: finalBreed,
          }),
        });

        if (!searchRes.ok) {
          console.error('❌ Petfinder API failed:', searchRes.status);
          return NextResponse.json({
            role: 'assistant',
            content: `Had trouble reaching the rescue database. Let me try that again... 🐾`,
            memory,
          });
        }

        const searchData = await searchRes.json();
        console.log(`🐶 Found ${searchData.animals?.length || 0} dogs`);

        if (!searchData.animals || searchData.animals.length === 0) {
          return NextResponse.json({
            role: 'assistant',
            content: `I sniffed around for ${finalBreed} in ${queryLocation} but came up empty. 🐾 Want me to try a wider search area or different breed? I won't give up if you don't!`,
            memory,
          });
        }

        // Process and display results (simplified for this fix)
        const dogs = searchData.animals.slice(0, 5); // Show first 5 for now

        const dogListings = dogs.map(dog => {
          const name = dog.name || 'Unnamed pup';
          const breed = dog.breeds?.primary || 'Mixed breed';
          const city = dog.contact?.address?.city || 'Unknown city';
          const state = dog.contact?.address?.state || '';
          const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
          const url = dog.url || `https://www.petfinder.com/dog/${dog.id}`;

          return `**${name}** (${breed}) – ${city}, ${state}\n\n*A good pup waiting for someone like you.* 🐾\n\n<img src="${photo}" alt="${name}" style="max-width: 100%; height: auto; border-radius: 12px;" />\n\n[Meet ${name} 🐾](${url})`;
        }).join('\n\n');

        const updatedSeenDogIds = [...seenDogIds, ...dogs.map(d => String(d.id))];

        return NextResponse.json({
          role: 'assistant',
          content: `Found some great ${finalBreed} pups for you! 🐕\n\n${dogListings}\n\nWant to see more, or would you like to search for something different?`,
          memory: {
            ...memory,
            hasSeenResults: true,
            seenDogIds: updatedSeenDogIds,
            cachedDogs: dogs,
          },
        });

      } catch (error) {
        console.error('❌ Search error:', error);
        return NextResponse.json({
          role: 'assistant',
          content: `Had a little trouble with that search. Mind trying again? 🐾`,
          memory,
        });
      }

    } else {
      // Fallback for unclear messages
      console.log('❓ Unclear message type');
      try {
        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo-0125',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          temperature: 0.7,
        });

        return NextResponse.json({
          ...chatCompletion.choices[0].message,
          memory: {
            location: rememberedLocation,
            breed: rememberedBreed,
            hasSeenResults: hasSeenResults,
            seenDogIds: seenDogIds,
            offset: memory?.offset || 0,
            cachedDogs: memory?.cachedDogs || [],
          }
        });
      } catch (err) {
        console.error('❌ Fallback chat error:', err);
        return NextResponse.json({
          role: 'assistant',
          content: `Woof! Something went sideways. Could you try that again? 🐾`,
          memory: {
            location: rememberedLocation,
            breed: rememberedBreed,
            hasSeenResults: hasSeenResults,
            seenDogIds: seenDogIds,
            offset: memory?.offset || 0,
            cachedDogs: memory?.cachedDogs || [],
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ Main chat API error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}