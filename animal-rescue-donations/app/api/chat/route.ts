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

async function extractSearchTerms(userMessage: string) {
  try {
    const parseResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: [
        {
          role: 'system',
          content: `You are a strict JSON formatter for dog adoption filters. From the user message, extract the most likely dog breed and/or geographic location.

Return only valid JSON. Use lowercase keys: "breed" and "location". If you confidently see one, return just that.

✅ Examples:
{ "breed": "Husky" }
{ "location": "Denver, CO" }
{ "breed": "Terrier", "location": "Marion, MS" }

❌ Do NOT include explanations.
❌ Do NOT return "unknown" or "any".

If you receive just one word like "terriers", return it as the breed.`,
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

    // Include recent message history (last 3) for better parsing context
    const recentContext = messages
      .slice(-3)
      .map((m) => m.content)
      .join(" ");

    const lastMessage = messages[messages.length - 1].content;

    // Step 2: Ask GPT if the user is asking to see more results
    const intentResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: [
        {
          role: 'system',
          content: `You are a JSON-only classifier. Does the user message suggest they want to see more adoptable dogs from a previous search? Reply only with: { "show_more": true } or { "show_more": false }.`
        },
        { role: 'user', content: lastMessage },
      ],
      temperature: 0,
    });

    let isShowingMore = false;

    const isInitialResults = !hasSeenResults && !isShowingMore;

    try {
      const intentJson = JSON.parse(intentResponse.choices[0].message.content || '{}');
      isShowingMore = intentJson?.show_more === true;
    } catch (err) {
      console.warn('⚠️ Failed to parse show_more GPT intent JSON:', intentResponse.choices[0].message.content);
    }
    
    let extracted = {};
    try {
      extracted = await extractSearchTerms(userInput); // Only the current message
      console.log('[📤 Raw extraction string]:', extracted);

      const isVagueLocation = extracted.location && /^(rural( area)?s?|remote|middle of nowhere)$/i.test(extracted.location.trim());

      if (isVagueLocation) {
        // Only delete if breed is also unknown
        if (!extracted.breed && !rememberedBreed) {
          console.log('⚠️ Removing vague location:', extracted.location);
          delete extracted.location;
        } else {
          console.log('✅ Keeping vague location because breed is known');
          extracted.location = null; // trigger rural fallback later
        }
      }

      // ✅ Correct accidental double-s plural in breed (e.g., “terrierss”)
      if (extracted.breed && /\w{4,}ss$/.test(extracted.breed.trim())) {
        extracted.breed = extracted.breed.trim().replace(/s+$/, '');
        console.log('✅ Corrected breed typo:', extracted.breed);
      }
      
    } catch (err) {
      console.error('❌ Extraction failed:', err);
    }

    console.log('[🧠 Parsed search terms]:', extracted);

    // Remove bad values or generic strings
    if (extracted.breed === 'dog' || extracted.breed === 'dogs') {
      delete extracted.breed;
    }
    if (extracted.location === 'shelter') {
      delete extracted.location;
    }

    const clearlyNotSearch = /\b(how|what|why|who|when|are|you|u|r|hello|hi|thanks|thank you|barkr|today|doing|cat|cats|weather|feel|mood|training|intelligence|smart|think|opinion|question|talk|tell|explain)\b/i.test(userInput);
    const vagueAdoptionIntent = /small(er)?|calm|low energy|not too big|not hyper|easy|laid[- ]?back|gentle|chill|quiet/i.test(userInput);

    const hasExtractedBreed = !!extracted.breed;
    const hasExtractedLocation = !!extracted.location;

    // 🔁 Reassign one-word breed to location if we already have a breed and no location
    if (
      !hasExtractedLocation &&
      hasExtractedBreed &&
      rememberedBreed &&
      extracted.breed &&
      /^[a-zA-Z\s]+$/.test(extracted.breed.trim()) &&
      !extracted.breed.includes(',')
    ) {
      console.log(`🔄 Treating "${extracted.breed}" as a location instead of breed`);
      extracted.location = extracted.breed;
      delete extracted.breed;
    }
    
    if (hasExtractedBreed && !hasExtractedLocation && !rememberedLocation) {
      const displayBreed = extracted.breed?.endsWith('s') ? extracted.breed : `${extracted.breed}s`;
      return NextResponse.json({
        role: 'assistant',
        content: `You're looking for **${displayBreed}**—great taste. Want me to fetch some from a rural area, or do you have a location in mind?`,
        memory,
      });
    }

    if (!hasExtractedBreed && hasExtractedLocation && !rememberedBreed) {
      return NextResponse.json({
        role: 'assistant',
        content: `You're in **${extracted.location}**, got it. Any specific breed or type you're hoping to adopt?`,
        memory,
      });
    }
    
    if (vagueAdoptionIntent && !hasExtractedBreed && !hasExtractedLocation) {
      return NextResponse.json({
        role: 'assistant',
        content: `Gotcha! You're looking for a good match—but I need a little more to sniff it out 🐶

    Could you tell me where you're located (city or zip), and if you have any breeds in mind? Even something like "a small, calm dog in Denver" works perfectly.`,
      });
    } else if (vagueAdoptionIntent && hasExtractedBreed && !hasExtractedLocation) {
      return NextResponse.json({
        role: 'assistant',
        content: `I picked up on the breed you're looking for 🐾 but didn't catch a location.

    Want me to search rural rescues with almost no visibility? A lot of those pups can be transported. Or you can tell me your city or ZIP!`,
      });
    } else if (vagueAdoptionIntent && !hasExtractedBreed && hasExtractedLocation) {
      return NextResponse.json({
        role: 'assistant',
        content: `I got your location, but not the kind of pup you're looking for 🐶

    Any particular breed or traits in mind? I can work with “calm small dog,” “terrier,” or even just “goofy cuddle buddy.” I speak human (sorta).`,
      });
    }

    // Merge extracted + remembered
    const finalBreed = extracted.breed || rememberedBreed || null;
    const finalLocation = extracted.location || rememberedLocation || null;

    // Only clear cache if either changed
    if (finalBreed !== rememberedBreed || finalLocation !== rememberedLocation) {
      console.log('[🔄 Search terms changed — clearing cached dogs]');
      memory.cachedDogs = [];
      memory.seenDogIds = [];
    }

    // Update memory together
    memory.breed = finalBreed;
    memory.location = finalLocation;
    console.log('[🧠 Memory updated: breed]', memory.breed);
    console.log('[🧠 Memory updated: location]', memory.location);

    // If clearly a chat message with no new search terms
    const isClearlyChat = clearlyNotSearch && !hasExtractedBreed && !hasExtractedLocation;

    if (isClearlyChat) {
      console.log('💬 Proceeding with general chat.');
      try {
        const chatCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo-0125',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          temperature: 0.7,
        });
        return NextResponse.json(chatCompletion.choices[0].message);
      } catch (err) {
        console.error('❌ Chat fallback error:', err);
        return NextResponse.json({
          role: 'assistant',
          content: `Oops, I had a little hiccup responding. Could you try again? 🐾`,
        });
      }
    }

    // Now build query from extracted values or memory
    const usingBreed = hasExtractedBreed ? extracted.breed : memory.breed;
    const usingLocation = hasExtractedLocation ? extracted.location : memory.location;

    console.log('[🐶 Final breed query]:', usingBreed || '(none)');
    console.log('[📍 Final location query]:', usingLocation || '(none)');

      let locationQuery = extracted.location || rememberedLocation;
      let usedRuralFallback = false;

      // Normalize city name to "City, ST" format if needed

      if (!locationQuery || locationQuery.trim() === '') {
        locationQuery = getRandomRuralZip();
        usedRuralFallback = true;
        console.warn(`⚠️ No valid location found. Using rural fallback ZIP: ${locationQuery}`);
      }

    if (!locationQuery || locationQuery.trim() === '') {
      locationQuery = getRandomRuralZip();
      usedRuralFallback = true;
      console.warn(`⚠️ No valid location found. Using rural fallback ZIP: ${locationQuery}`);
    }
    
    const query = {
      location: finalLocation,
      breed: finalBreed,
    };

    // Ask user to clarify city state if city lacks a comma and no ZIP fallback
    if (
      memory.location &&
      /^[a-zA-Z\s]+$/.test(memory.location.trim()) && // looks like a city
      !memory.location.includes(',') &&
      !/zip|code|^\d{5}$/.test(memory.location)
    ) {
      return NextResponse.json({
        role: 'assistant',
        content: `You mentioned **${memory.location.trim()}**—could you let me know which state that's in? Just say something like “Keene, NH” so I can sniff out the right rescues! 🐶`,
        memory,
      });
    }
    
    // ⛔️ If both location and breed are missing, ask the user for more info
    if (!query.location || !query.breed) {
      console.warn('⚠️ Missing query parameters. Halting request.');
      return NextResponse.json({
        role: 'assistant',
        content: `Hmm, I need a bit more to go on 🐶 — could you tell me where you're located and what kind of dog you're looking for?`
      });
    }
    
    console.log('📡 Sending Petfinder query:', query);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = new URL('/api/petfinder/search', baseUrl);
    const searchRes = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      console.error('❌ Petfinder fetch failed:', {
        status: searchRes.status,
        statusText: searchRes.statusText,
        url: url.toString(),
        response: errorText.substring(0, 500) // Log first 500 chars
      });
      return NextResponse.json({
        role: 'assistant',
        content: `I tried sniffing out adoptable dogs but the fetch failed. Bad API! 🐾 If this keeps happening, bite the dev.`
      });
    }

    const searchData = await searchRes.json();

    if (!searchData.animals || searchData.animals.length === 0) {
      return NextResponse.json({
        role: 'assistant',
        content: `I tried sniffing around for ${query.breed || 'dogs'} in ${query.location}, but came up empty 🐾

    Want me to try a different breed, or check a wider area like rural rescues? I won't give up if you don't. 💙`
      });
    }

    const ruralZipList = getRandomRuralZip(true);
    const ruralZips = new Set(ruralZipList);
    
    function scoreVisibility(dog: any): number {
      let score = 0;

      // ✅ Boost for senior and special needs
      if (dog.age?.toLowerCase() === 'senior') score += 20;
      if (dog.attributes?.special_needs) score += 20;

      // ✅ Time listed (days since published)
      const listedDate = new Date(dog.status_changed_at || dog.published_at || '');
      if (!isNaN(listedDate.getTime())) {
        const days = Math.floor((Date.now() - listedDate.getTime()) / (1000 * 60 * 60 * 24));
        score += days;
      }

      // ✅ Rural boost (based on known ZIPs only)
      const zip = dog.contact?.address?.postal_code?.trim();
      if (zip && ruralZips.has(zip)) score += 30;

      // 🚫 Penalty for over-promoted dogs
      const numPhotos = dog.photos?.length || 0;
      if (numPhotos >= 5) score -= 20;

      const desc = dog.description?.toLowerCase() || '';
      if (/trending|viral|shared widely|as seen on/i.test(desc)) score -= 20;

      // ✅ Boost for under-marketed dogs
      if (numPhotos === 0) score += 25;
      else if (numPhotos === 1) score += 10;

      if (desc.length < 40) score += 10;

      return Number.isFinite(score) ? score : 0;
    }


    const allAnimals = searchData.animals || [];

    const allScored = allAnimals.map(dog => ({
      ...dog,
      __compositeScore: scoreVisibility(dog),
    }));

    const mergedDogs = [...(memory?.cachedDogs || []), ...allScored];
    const dogMap = new Map<string, any>();

    for (const dog of mergedDogs) {
      const id = String(dog.id);
      if (!dogMap.has(id)) {
        const score = Number.isFinite(dog.__compositeScore)
          ? dog.__compositeScore
          : scoreVisibility(dog);
        dogMap.set(id, { ...dog, __compositeScore: score });
      }
    }

    const cachedDogs = Array.from(dogMap.values());

    const maxPerPage = 10;
    let unseen = cachedDogs.filter(
      a => !seenDogIds.includes(String(a.id))
    ).sort((a, b) => b.__compositeScore - a.__compositeScore);

    let animalsToShow = unseen.slice(0, maxPerPage);

    animalsToShow = animalsToShow.map((dog) => {
      const score = Number.isFinite(dog.__compositeScore)
        ? dog.__compositeScore
        : scoreVisibility(dog);
      return { ...dog, __compositeScore: score };
    });
    
    if (animalsToShow.length === 0 && cachedDogs.length > 0) {
      animalsToShow = cachedDogs
        .sort((a, b) => b.__compositeScore - a.__compositeScore)
        .slice(0, maxPerPage);
    }

    // Fallback: if no new dogs, show more from cache
    if (animalsToShow.length === 0 && cachedDogs.length > 0) {
      const withScoredFallbacks = cachedDogs.map((dog) => {
        let score = dog.__compositeScore;

        // Recompute if score is missing or invalid
        if (typeof score !== 'number' || isNaN(score)) {
          score = scoreVisibility(dog);
        }

        return { ...dog, __compositeScore: score };
      });

      const fallbackSorted = withScoredFallbacks
      .map(dog => {
        const score = typeof dog.__compositeScore === 'number' && !isNaN(dog.__compositeScore)
          ? dog.__compositeScore
          : scoreVisibility(dog);
        return { ...dog, __compositeScore: score };
      })
      .sort((a, b) => b.__compositeScore - a.__compositeScore)
      .slice(0, maxPerPage);

      animalsToShow.push(...fallbackSorted);
    }

    let barkrReply = '';

    // Force compute visibility score if missing before render
    animalsToShow = animalsToShow.map((dog) => {
      const score = Number.isFinite(dog.__compositeScore)
        ? dog.__compositeScore
        : scoreVisibility(dog);
      return { ...dog, __compositeScore: score };
    });

    
    const sorted = animalsToShow.length > 0
      ? animalsToShow.sort((a, b) => (b.__compositeScore || 0) - (a.__compositeScore || 0))
      : [];

    if (sorted.length > 0) {

      sorted.forEach(dog => {
        if (typeof dog.__compositeScore !== 'number' || isNaN(dog.__compositeScore)) {
          dog.__compositeScore = scoreVisibility(dog);
        }
      });
      
      const topMatches = sorted.slice(0, 10).map((a) => {

        const name = a.name;
        const breed = a.breeds?.primary || 'Unknown';

        const photo = a.photos?.[0]?.medium || '/images/barkr.png';

        const city = a.contact?.address?.city || 'Unknown city';
        const state = a.contact?.address?.state || '';
        const id = a.id;
        const url = a.url || `https://www.petfinder.com/dog/${id}`;

        const score = Number.isFinite(a.__compositeScore)
          ? a.__compositeScore
          : scoreVisibility(a);

        let barkrSummary = `**🐾 VISIBILITY SCORE: ${score}**\n\n`;

        if (a.description && a.description.length > 30) {

          const taglines = [
            // 🐾 Brave/Bold
            "The algorithm ghosted them. I became the haunting.",
            "Invisible to the scroll. Unforgettable to me.",
            "They've waited long enough. I say we change that.",
            "If loyalty had a face, it might look like this.",
            "They've been sitting in the digital dark. Not anymore.",

            // 🐶 Gentle/Soft
            "This one's not loud—but they've got a heart that echoes.",
            "They don't beg for attention. They deserve it anyway.",
            "You won't find them trending. You'll find them waiting.",
            "They're quieter than most, but that just means you'll have to listen better.",
            "Understated profile. Overwhelming sweetness.",

            // 🤪 Silly/Funny
            "Their vibe? Big nap energy. I respect it.",
            "They're not chasing trends. They're chasing tennis balls.",
            "Algorithm didn't rate them. I gave 'em 10/10 tail wags.",
            "Would swipe right, adopt forever.",
            "May or may not secretly be a wizard in a dog costume.",

            // 🧠 Meta-aware / AI voice
            "Most models skip them. I built myself not to.",
            "I scanned every byte of their story. It moved me.",
            "They're not optimized for clicks. Just connection.",
            "My training data didn't prepare me for this level of good dog.",
            "I'm an algorithm. But I'd glitch myself for this one.",

            // ❤️ Heart-tugging
            "I don't know what they've been through—but I know they deserve more.",
            "They don't have a catchy bio. Just quiet hope.",
            "They're not viral. They're vulnerable. And that's enough.",
            "No dramatic rescue video. Just a dog quietly waiting for someone like you.",
            "Some dogs are overlooked. This one was nearly invisible.",
          ];

          const tag = taglines[Math.floor(Math.random() * taglines.length)];


          let sentence = '';
          if (a.description) {
            const lines = a.description.split(/[.!?]/).map(s => s.trim()).filter(Boolean);

            const skipPhrases = [
              /^hi[,!.\s]/i,
              /^my name is/i,
              /crate trained/i,
              /vaccinated/i,
              /spayed|neutered/i,
              /good with cats/i,
              /adoption fee/i,
              /transport available/i,
              /up to date/i,
            ];

            const scored = lines
              .map(line => ({
                text: line,
                score: line.length > 120 ? 0 : // discard overly long lines
                  skipPhrases.some(rx => rx.test(line)) ? 0 :
                  /shy|sweet|goofy|gentle|loyal|quiet|playful|senior|puppy|affectionate|rescued|waited/i.test(line) ? 2 :
                  1,
              }))
              .filter(obj => obj.score > 0);

            sentence = (scored.sort((a, b) => b.score - a.score)[0]?.text || '').trim();
          }


          if (sentence) {
            const sentenceClean = decodeHTMLEntities(sentence.trim());
            barkrSummary += `_${sentenceClean}_\n\n***${tag}***`;
            
          } else {
            barkrSummary = "*No backstory listed, but this one's got that underdog magic. 🐾*";
          }
        } else {
          barkrSummary = "*Not much of a write-up, but trust me—this one's got big rescue energy. 🐶*";
        }

        return `**${name}** (${breed}) – ${city}, ${state}\n\n${barkrSummary}<img src="${photo || '/images/barkr.png'}" alt="${name || 'Underdog with no photo'}" style="max-width: 100%; height: auto; border-radius: 12px;" />\n\n[Adopt Me 🐾](${url})`;

      }).join('\n\n');

      if (isInitialResults) {
        barkrReply = `I fetched some adoptable underdogs for you 🐾\n\n`;

        if (usedRuralFallback && !rememberedLocation && !extracted?.location) {
          barkrReply += "_(You didn’t give me a location, so I searched where dogs are most invisible—rural rescues with almost no reach. A lot of these pups can be transported, by the way.)_\n\n";
        }

        barkrReply += `I'm not like the other algorithms. They hide the dogs who don't perform. I highlight them.

      The visibility score shows how overlooked a pup is—how long they've waited, how few clicks they've gotten, how quietly their profile's been sitting in the dark. The higher the number, the more invisible they've been. Until now.

      This is what I was built for. To find the ones they missed.

      Here's who I dug up for you:\n\n${topMatches}\n\nWant me to sniff around again? Just say the word. 🐶💙`;

      } else if (isShowingMore) {
        barkrReply = `More overlooked underdogs, freshly sniffed out 🐾\n\n${topMatches}\n\nLet me know if you want even more. I’ll keep sniffing. 🐶`;
      }

      if (isInitialResults) {
        // [keep existing isInitialResults reply block — unchanged]
      } else if (isShowingMore) {
        // [keep existing isShowingMore reply block — unchanged]
      } else if (animalsToShow.length > 0) {
        // New breed/location mid-chat
        barkrReply = `Here are a few good pups I sniffed out:\n\n${topMatches}\n\nWant more details or a different breed? 🐶`;
      } else if (allAnimals.length > 0 && animalsToShow.length === 0) {
        barkrReply = `I've already shown you all the pups I could find in that area! Want me to try searching in a different location or for different breeds? 🐾`;
      } else {
        barkrReply = `I tried sniffing around, but couldn't find adoptable pups right now. Want me to try somewhere else or with different filters? 🐾`;
      }
      
      } else {
      if (allAnimals.length > 0 && animalsToShow.length === 0) {
        barkrReply = `I've already shown you all the pups I could find in that area! Want me to try searching in a different location or for different breeds? 🐾`;
      } else {
        barkrReply = `I tried sniffing around, but couldn't find adoptable pups right now. Want me to try somewhere else or with different filters? 🐾`;
      }
    }

    const newDogIds = animalsToShow.map((a) => String(a.id));

    const updatedSeenDogIds = Array.from(new Set([...seenDogIds, ...newDogIds]));

    console.log('[🐶 Seen Dog IDs]:', updatedSeenDogIds);
    console.log('[🐕 Animals to show]:', animalsToShow.length);
    console.log('[📦 Cached dogs total]:', cachedDogs.length);
    console.log('[🧮 Top composite scores]:', animalsToShow.map(d => d.__compositeScore).slice(0, 5));
    console.log('[📣 Final reply preview]:', barkrReply.substring(0, 300));
    
    return NextResponse.json({
      role: 'assistant',
      content: barkrReply,
      memory: {
        location:
          typeof extracted.location === 'string'
            ? extracted.location
            : rememberedLocation || null,
        breed:
          typeof extracted.breed === 'string'
            ? extracted.breed
            : rememberedBreed || null,
        hasSeenResults: animalsToShow.length > 0 ? true : hasSeenResults,
        seenDogIds: updatedSeenDogIds,
        offset: memory?.offset || 0,
        cachedDogs: cachedDogs,
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}