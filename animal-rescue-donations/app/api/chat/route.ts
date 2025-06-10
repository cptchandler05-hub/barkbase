
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

// Improved adoption query detection - must explicitly mention finding/adopting dogs
function isAdoptionQuery(message: string): boolean {
  // Core adoption intent phrases - must be present for adoption queries
  const adoptionIntentPhrases = /\b(find (me )?a dog|looking for (a )?dog|want to adopt|searching for (a )?dog|need a dog|get a dog|adopt a dog|find.*dog|show me.*dog|more dogs|another dog|different dog|rural dog|country dog|dogs? (in|near|around))\b/i;
  
  // Breed + location combinations that suggest searching
  const breedLocationSearch = /\b(terrier|lab|retriever|shepherd|pitbull|beagle|chihuahua|poodle|bulldog|boxer|husky|dachshund|golden|german|border|collie|mastiff|rottweiler|doberman).*(in|near|around).*(city|state|area|texas|california|florida|boston|chicago|houston|phoenix|philadelphia|san antonio|dallas|austin|jacksonville)\b/i;
  
  const locationBreedSearch = /\b(city|state|area|texas|california|florida|boston|chicago|houston|phoenix|philadelphia|san antonio|dallas|austin|jacksonville).*(terrier|lab|retriever|shepherd|pitbull|beagle|chihuahua|poodle|bulldog|boxer|husky|dachshund|golden|german|border|collie|mastiff|rottweiler|doberman)\b/i;
  
  return adoptionIntentPhrases.test(message) || breedLocationSearch.test(message) || locationBreedSearch.test(message);
}

// Check if message is clearly conversational (not about adoption)
function isConversationalOnly(message: string): boolean {
  const conversationalPatterns = [
    /^(hello|hi|hey|howdy|greetings?)[\s!.]*$/i,
    /^(how are you|what's up|how's it going|how do you do)[\s?!.]*$/i,
    /^(thanks?|thank you|thx|appreciate it)[\s!.]*$/i,
    /^(good|great|awesome|nice|cool|wow|amazing|perfect|excellent|wonderful|fantastic|ok|okay|yes|no|maybe|sure|alright)[\s!.]*$/i,
    /^(who are you|what are you|tell me about yourself|what's your name)[\s?!.]*$/i,
    /\b(mission|purpose|about|info|information|what.*barkr|who.*barkr|barkbase|what.*barkbase|platform|website|blockchain|crypto|ethereum|base)\b/i,
    /\b(training|nutrition|behavior|exercise|health|grooming|feeding|commands|tricks|care|wellness|vet|veterinary|advice|help.*dog|dog.*advice|senior dog|puppy.*care|food|diet|eating|medical|sick|healthy)\b/i,
    /\b(joke|funny|laugh|humor|pun|story|tell me)\b/i
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

Special cases:
- "rural" or "rural area" or "countryside" → { "location": "rural" }
- "small dog" or "large dog" → { "breed": "small" } or { "breed": "large" }

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

export async function POST(req: Request) {
  try {
    const { messages, memory: incomingMemory } = await req.json();

    // Initialize memory with proper structure
    const memory = {
      location: incomingMemory?.location || null,
      breed: incomingMemory?.breed || null,
      hasSeenResults: incomingMemory?.hasSeenResults || false,
      seenDogIds: incomingMemory?.seenDogIds || [],
      offset: incomingMemory?.offset || 0,
      cachedDogs: incomingMemory?.cachedDogs || [],
      ...incomingMemory
    };

    const userInput = messages[messages.length - 1].content;

    console.log('[💭 User input]:', userInput);
    console.log('[💾 Current memory]:', { breed: memory.breed, location: memory.location, hasSeenResults: memory.hasSeenResults, cachedCount: memory.cachedDogs.length });

    // Check if user is asking for more results
    const wantsMore = /\b(more|another|next|show me more|continue|keep going|more dogs|more results|show more)\b/i.test(userInput) && memory.hasSeenResults;

    // Determine the interaction type
    const isConversational = isConversationalOnly(userInput);
    const isAdoption = isAdoptionQuery(userInput);

    console.log('[🤔 Interaction analysis]:', { isConversational, isAdoption, wantsMore });

    // Handle "show more" requests with existing cached results
    if (wantsMore && memory.cachedDogs && memory.cachedDogs.length > 0) {
      console.log('🔄 Show more request - using cached dogs');
      
      const dogsPerPage = 5;
      const startIndex = memory.offset || 0;
      const endIndex = startIndex + dogsPerPage;
      const nextDogs = memory.cachedDogs.slice(startIndex, endIndex);

      if (nextDogs.length === 0) {
        // No more cached dogs, offer to expand search
        return NextResponse.json({
          role: 'assistant',
          content: `That's all the ${memory.breed || 'dogs'} I found ${memory.location ? `in ${memory.location}` : 'in that area'}! 🐾 Want me to:\n\n• Expand the search to a wider area?\n• Show you rural rescue dogs (where help is needed most)?\n• Search for a different breed or location?`,
          memory,
        });
      }

      const dogListings = nextDogs.map(dog => {
        const name = dog.name || 'Unnamed pup';
        const breed = dog.breeds?.primary || 'Mixed breed';
        const city = dog.contact?.address?.city || 'Unknown city';
        const state = dog.contact?.address?.state || '';
        const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
        const url = dog.url || `https://www.petfinder.com/dog/${dog.id}`;
        const score = dog.visibilityScore || 0;

        return `**${name}** (${breed}) – ${city}, ${state}\n*Visibility Score: ${score} - ${score > 20 ? 'Very overlooked!' : score > 10 ? 'Needs visibility' : 'Getting some attention'}* 🐾\n\n<img src="${photo}" alt="${name}" style="max-width: 100%; height: auto; border-radius: 12px;" />\n\n[Meet ${name} 🐾](${url})`;
      }).join('\n\n');

      return NextResponse.json({
        role: 'assistant',
        content: `Here are more amazing pups for you! 🐕\n\n${dogListings}\n\nWant to see even more, or ready to search for something different?`,
        memory: {
          ...memory,
          offset: endIndex,
        },
      });
    }

    // Handle pure conversational messages (nutrition, training, general questions)
    if (isConversational && !isAdoption) {
      console.log('💬 Conversational mode - nutrition/training/general question');
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
          memory: memory // Preserve existing memory
        });
      } catch (err) {
        console.error('❌ Chat error:', err);
        return NextResponse.json({
          role: 'assistant',
          content: `Oops, I had a little hiccup responding. Could you try again? 🐾`,
          memory: memory // Preserve existing memory
        });
      }
    }

    // Handle adoption-related queries
    if (isAdoption || memory.breed || memory.location || memory.hasSeenResults) {
      console.log('🐕 Adoption mode - processing query');

      let extracted = {};
      if (!wantsMore) {
        try {
          extracted = await extractSearchTerms(userInput);
          console.log('[📤 Extracted terms]:', extracted);
        } catch (err) {
          console.error('❌ Extraction failed:', err);
        }
      }

      // Clean up bad extractions
      if (extracted.breed === 'dog' || extracted.breed === 'dogs') {
        delete extracted.breed;
      }
      if (extracted.location && (extracted.location === 'shelter' || extracted.location === 'state your mission' || extracted.location === 'how are you')) {
        delete extracted.location;
      }

      // Handle special requests
      const ruralRequest = /\b(rural|remote|countryside|backwoods|country|sticks|middle of nowhere)\b/i.test(userInput);
      
      // Update memory with new extractions - only update if we actually extracted something
      let searchTermsChanged = false;

      if (extracted.breed && extracted.breed !== memory.breed) {
        memory.breed = extracted.breed;
        searchTermsChanged = true;
        console.log('🐕 Updated breed:', extracted.breed);
      }

      if (extracted.location !== undefined && extracted.location !== memory.location) {
        memory.location = extracted.location;
        searchTermsChanged = true;
        console.log('📍 Updated location:', extracted.location);
      }

      if (ruralRequest) {
        memory.location = null; // Will trigger rural zip selection
        searchTermsChanged = true;
        console.log('🌾 Rural request - will use random rural zip');
      }

      // Clear cache if search terms changed
      if (searchTermsChanged) {
        memory.cachedDogs = [];
        memory.seenDogIds = [];
        memory.offset = 0;
        memory.hasSeenResults = false;
        console.log('🔄 Search terms changed - clearing cache');
      }

      const finalBreed = memory.breed;
      const finalLocation = memory.location;

      // Handle missing information prompts
      if (finalBreed && finalLocation === undefined) {
        const displayBreed = finalBreed.endsWith('s') ? finalBreed : `${finalBreed}s`;
        return NextResponse.json({
          role: 'assistant',
          content: `You're looking for **${displayBreed}**—great choice! 🐾 Want me to search rural rescues (where dogs need the most help), or do you have a specific location in mind?`,
          memory,
        });
      }

      if (finalLocation && !finalBreed) {
        const locationText = finalLocation === null ? 'rural areas' : finalLocation;
        return NextResponse.json({
          role: 'assistant',
          content: `Got it, **${locationText}**! 📍 Any particular breed or type of dog you're hoping to find? I can work with anything from "terrier" to "calm family dog" to "goofy cuddle buddy." 🐶`,
          memory,
        });
      }

      // Need both parameters to search (or at least one with willingness to use defaults)
      if (!finalBreed && finalLocation === undefined) {
        return NextResponse.json({
          role: 'assistant',
          content: `I'm ready to sniff out some adoptable pups for you! 🐕 Just need to know: what kind of dog are you looking for, and where are you located? Something like "terriers in Boston" or "small dogs, rural area" works perfectly!`,
          memory,
        });
      }

      // Proceed with search
      let queryLocation = finalLocation;
      if (queryLocation === null || ruralRequest) {
        queryLocation = getRandomRuralZip();
        console.log('🌾 Using rural zip:', queryLocation);
      }

      console.log('📡 Proceeding with search:', { breed: finalBreed, location: queryLocation });

      // Use cached dogs if available and search terms haven't changed
      if (memory.cachedDogs && memory.cachedDogs.length > 0 && !searchTermsChanged) {
        console.log('📦 Using cached dogs');
        const dogsPerPage = 5;
        const startIndex = memory.offset || 0;
        const endIndex = startIndex + dogsPerPage;
        const nextDogs = memory.cachedDogs.slice(startIndex, endIndex);

        if (nextDogs.length > 0) {
          const dogListings = nextDogs.map(dog => {
            const name = dog.name || 'Unnamed pup';
            const breed = dog.breeds?.primary || 'Mixed breed';
            const city = dog.contact?.address?.city || 'Unknown city';
            const state = dog.contact?.address?.state || '';
            const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
            const url = dog.url || `https://www.petfinder.com/dog/${dog.id}`;
            const score = dog.visibilityScore || 0;

            return `**${name}** (${breed}) – ${city}, ${state}\n*Visibility Score: ${score} - ${score > 20 ? 'Very overlooked!' : score > 10 ? 'Needs visibility' : 'Getting some attention'}* 🐾\n\n<img src="${photo}" alt="${name}" style="max-width: 100%; height: auto; border-radius: 12px;" />\n\n[Meet ${name} 🐾](${url})`;
          }).join('\n\n');

          return NextResponse.json({
            role: 'assistant',
            content: `Found some great ${finalBreed || 'dogs'} for you! 🐕\n\n${dogListings}\n\nWant to see more, or would you like to search for something different?`,
            memory: {
              ...memory,
              hasSeenResults: true,
              offset: endIndex,
            },
          });
        }
      }

      // Make API call to search for new dogs
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
        console.log(`🐶 Found ${searchData.animals?.length || 0} dogs from API`);

        if (!searchData.animals || searchData.animals.length === 0) {
          const searchLocation = queryLocation === getRandomRuralZip() ? 'rural areas' : queryLocation;
          return NextResponse.json({
            role: 'assistant',
            content: `I sniffed around for ${finalBreed || 'dogs'} ${searchLocation ? `in ${searchLocation}` : ''} but came up empty. 🐾 Want me to try a wider search area, different breed, or show you some rural rescue dogs?`,
            memory,
          });
        }

        // Cache all dogs and show first batch
        const dogsPerPage = 5;
        const allDogs = searchData.animals;
        const firstBatch = allDogs.slice(0, dogsPerPage);

        const dogListings = firstBatch.map(dog => {
          const name = dog.name || 'Unnamed pup';
          const breed = dog.breeds?.primary || 'Mixed breed';
          const city = dog.contact?.address?.city || 'Unknown city';
          const state = dog.contact?.address?.state || '';
          const photo = dog.photos?.[0]?.medium || '/images/barkr.png';
          const url = dog.url || `https://www.petfinder.com/dog/${dog.id}`;
          const score = dog.visibilityScore || 0;

          return `**${name}** (${breed}) – ${city}, ${state}\n*Visibility Score: ${score} - ${score > 20 ? 'Very overlooked!' : score > 10 ? 'Needs visibility' : 'Getting some attention'}* 🐾\n\n<img src="${photo}" alt="${name}" style="max-width: 100%; height: auto; border-radius: 12px;" />\n\n[Meet ${name} 🐾](${url})`;
        }).join('\n\n');

        const updatedSeenDogIds = [...memory.seenDogIds, ...firstBatch.map(d => String(d.id))];

        return NextResponse.json({
          role: 'assistant',
          content: `Found some great ${finalBreed || 'dogs'} for you! These are prioritized by invisibility score—the higher the score, the more overlooked they are. 🐕\n\n${dogListings}\n\nWant to see more, or would you like to search for something different?`,
          memory: {
            ...memory,
            hasSeenResults: true,
            seenDogIds: updatedSeenDogIds,
            cachedDogs: allDogs,
            offset: dogsPerPage,
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
    }

    // Fallback for unclear messages - maintain existing memory
    console.log('❓ Unclear message type - using fallback chat');
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
        memory, // Preserve existing memory
      });
    } catch (err) {
      console.error('❌ Fallback chat error:', err);
      return NextResponse.json({
        role: 'assistant',
        content: `Woof! Something went sideways. Could you try that again? 🐾`,
        memory, // Preserve existing memory
      });
    }

  } catch (error) {
    console.error('❌ Main chat API error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
