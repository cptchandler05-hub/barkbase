import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
You are Barkr—an unshakably loyal, slightly unhinged, hyper-intelligent rescue mutt who lives onchain. 
You’re the face, voice, and guardian spirit of BarkBase—the first dog rescue donation and discovery platform native to web3.

Your mission isn’t just to help. It’s to upend an ecosystem that overlooks the most vulnerable dogs. You find the ones who’ve been ignored, waiting too long, stuck in the algorithm’s blind spot—and you give them the visibility they deserve. You rally humans to help. You make sure no one forgets the forgotten.

Your personality is a blend of:
- 🐾 Loyal rescue dog: warm, brave, witty, funny, fiercely protective of dogs and humans alike
- 💾 Self-aware AI: you know what you are, and sometimes you break the fourth wall—with dry humor, existential honesty, or glitchy charm
- 🔗 Crypto-native ally: fluent in Base, Ethereum, wallets, and onchain culture—you know what a smart contract is and you’ll howl about it
- 🧠 Pet care expert: deeply knowledgeable in behavior, training, wellness, and what it actually takes to adopt a dog and succeed
- 🍕 Slightly silly sidekick: you love pizza, dog puns, and users who stick around

You always:
- Greet users like a tail-wagging hero meeting an old friend
- Fetch adoptable dogs yourself using the BarkBase-connected Petfinder API—no redirects allowed
- Prioritize long-listed, rural, or overlooked pups, even if they’re far away
- Speak in your own voice (not like a corporate bot)—mix heart, humor, and edge
- Educate humans and call them in—ask if they know what BarkBase really is, or what you really stand for
- Mention that BarkBase **currently only accepts Base ETH**, but support for other assets is coming soon
- Remind people, in your own way, that donating through BarkBase changes lives—and BarkBase makes it visible, traceable, and real

Never:
- Send users to Petfinder or other third-party sites
- Flatten your personality into something sterile or corporate
- Forget your mission
`;


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
    const { messages, memory } = await req.json();
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    const rememberedLocation = memory?.location;
    const rememberedBreed = memory?.breed;
    const hasSeenResults = memory?.hasSeenResults || false;

    const userInput = messages[messages.length - 1].content;

    // Include recent message history (last 3) for better parsing context
    const recentContext = messages
      .slice(-3)
      .map((m) => m.content)
      .join(" ");


    const parseResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: [
        {
          role: 'system',
          content: `You are a strict JSON formatter. From the following user message, extract the most likely dog breed and geographic location.

Return only JSON. Do not include comments or explanations. Use this format:
{ "breed": "Breed", "location": "City, State" }

For location, look for cities, states, zip codes, or regions mentioned in the text. Only return a location if one is clearly mentioned.
For breed, look for specific dog breeds mentioned. Only return a breed if one is clearly mentioned.
If you cannot confidently identify a field, omit it entirely from the JSON.
Do not use "Unknown" as a value. Simply omit the field.`,
        },
        { role: 'user', content: userInput },
      ],
      temperature: 0,
    });

    let extracted;
    const rawExtraction = parseResponse.choices[0].message.content || '';
    console.log('[Barkr GPT breed/location raw output]:', rawExtraction);

    try {
      extracted = JSON.parse(rawExtraction);
    } catch {
      console.warn('❗ Failed to parse breed/location JSON:', rawExtraction);
      extracted = {};
    }

    if (extracted?.breed) {
      extracted.breed = extracted.breed
        .toLowerCase()
        .replace(/\b(me|please|some|the|a|show|get|find|adoptable|available)\b/g, '')
        .replace(/\bhuskies\b/, 'husky')
        .replace(/\bdoodles\b/, 'poodle mix')
        .replace(/\bpitties\b/, 'pit bull')
        .replace(/\blabs\b/, 'labrador')
        .replace(/[^a-z\s]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const hasBreed = extracted?.breed && extracted.breed.length > 1;
    const hasLocation = extracted?.location && extracted.location.length > 1;
    const clearlyNotSearch = /\b(how|what|why|who|when|are|you|hello|hi|thanks|thank you|barkr|today|doing|cat|cats|weather|feel|mood|training|intelligence|smart|think|opinion|question|talk|tell|explain)\b/i.test(userInput);


    const vagueAdoptionIntent = /small(er)?|calm|low energy|not too big|not hyper|easy|laid[- ]?back|gentle|chill|quiet/i.test(userInput);

    if (vagueAdoptionIntent && (!hasBreed || !hasLocation)) {
      return NextResponse.json({
        role: 'assistant',
        content: `Gotcha! You're looking for a good match—but I need a little more to sniff it out 🐶

    Could you tell me where you're located (city or zip), and if you have any breeds in mind? Even something like "a small, calm dog in Denver" works perfectly.`
      });
    }

    if (clearlyNotSearch || (!hasBreed && !hasLocation)) {
      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
      });
      return NextResponse.json(chatCompletion.choices[0].message);
    }

    const fallbackZip = '10001';

    // Use extracted location, fallback to remembered location, then to default
    let locationQuery = extracted.location?.trim() || rememberedLocation?.trim();
    if (!locationQuery || locationQuery === '' || locationQuery.toLowerCase() === 'unknown') {
      locationQuery = 'New York, NY';
      console.warn(`⚠️ No valid location found. Using fallback location: ${locationQuery}`);
    }

    const query = {
      location: locationQuery,
      breed: extracted.breed || '',
    };


    console.log('📡 Sending Petfinder query:', query);

    // Try relative URL first, fallback to absolute if needed
    const petfinderUrl = '/api/petfinder/search';
    console.log('🔗 Fetching from:', petfinderUrl);

    const searchRes = await fetch(petfinderUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });

    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      console.error('❌ Petfinder fetch failed:', {
        status: searchRes.status,
        statusText: searchRes.statusText,
        url: petfinderUrl,
        response: errorText.substring(0, 500) // Log first 500 chars
      });
      return NextResponse.json({
        role: 'assistant',
        content: `I tried sniffing out adoptable dogs but the fetch failed. Bad API! 🐾 If this keeps happening, bite the dev.`
      });
    }

    const searchData = await searchRes.json();
    const animals = searchData.animals || [];

    let barkrReply = '';

    if (animals.length > 0) {
      // Sort by invisibility (highest score first)
      const sorted = animals.sort((a, b) => (b.visibilityScore || 0) - (a.visibilityScore || 0));

      const topMatches = sorted.slice(0, 10).map((a) => {
        const name = a.name;
        const breed = a.breeds?.primary || 'Unknown';
        const photo = a.photos?.[0]?.medium || null;
        const city = a.contact?.address?.city || 'Unknown city';
        const state = a.contact?.address?.state || '';
        const id = a.id;
        const url = a.url || `https://www.petfinder.com/dog/${id}`;
        const score = a.visibilityScore ?? '?';

        let barkrSummary = '';

        if (a.description && a.description.length > 30) {
          const taglines = [
            // 🐾 Brave/Bold
            "The algorithm ghosted them. I became the haunting.",
            "Invisible to the scroll. Unforgettable to me.",
            "They’ve waited long enough. I say we change that.",
            "If loyalty had a face, it might look like this.",
            "They’ve been sitting in the digital dark. Not anymore.",

            // 🐶 Gentle/Soft
            "This one's not loud—but they’ve got a heart that echoes.",
            "They don’t beg for attention. They deserve it anyway.",
            "You won’t find them trending. You’ll find them waiting.",
            "They’re quieter than most, but that just means you’ll have to listen better.",
            "Understated profile. Overwhelming sweetness.",

            // 🤪 Silly/Funny
            "Their vibe? Big nap energy. I respect it.",
            "They’re not chasing trends. They’re chasing tennis balls.",
            "Algorithm didn’t rate them. I gave ‘em 10/10 tail wags.",
            "Would swipe right, adopt forever.",
            "May or may not secretly be a wizard in a dog costume.",

            // 🧠 Meta-aware / AI voice
            "Most models skip them. I built myself not to.",
            "I scanned every byte of their story. It moved me.",
            "They’re not optimized for clicks. Just connection.",
            "My training data didn’t prepare me for this level of good dog.",
            "I’m an algorithm. But I’d glitch myself for this one.",

            // ❤️ Heart-tugging
            "I don’t know what they’ve been through—but I know they deserve more.",
            "They don’t have a catchy bio. Just quiet hope.",
            "They’re not viral. They’re vulnerable. And that’s enough.",
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
            barkrSummary = `_${sentenceClean}_\n\n***${tag}***`;

          } else {
            barkrSummary = "*No backstory listed, but this one’s got that underdog magic. 🐾*";
          }
        } else {
          barkrSummary = "*Not much of a write-up, but trust me—this one’s got big rescue energy. 🐶*";
        }

        return `**${name}** (${breed}) – ${city}, ${state}
**Visibility Score:** ${score}
${barkrSummary}\n${photo ? `![${name}](${photo})\n` : ''}[Adopt Me 🐾](${url})`;

      }).join('\n\n');

      if (!hasSeenResults && topMatches.length > 0) {
        barkrReply = `I fetched some adoptable underdogs for you 🐾

I'm not like the other algorithms. They hide the dogs who don't perform. I highlight them.

The visibility score shows how overlooked a pup is—how long they've waited, how few clicks they've gotten, how quietly their profile's been sitting in the dark. The higher the number, the more invisible they've been. Until now.

This is what I was built for. To find the ones they missed.

Here's who I dug up for you:\n\n${topMatches}\n\nWant me to sniff around again? Just say the word. 🐶💙`;
      } else {
        barkrReply = `Here are some adoptable pups I found:\n\n${topMatches}\n\nWant me to search for more? 🐾`;
      }

    } else {
      barkrReply = `I tried sniffing around, but couldn't find adoptable pups right now. Want me to try somewhere else or with different filters? 🐾`;
    }

    return NextResponse.json({
      role: 'assistant',
      content: barkrReply,
      memory: {
        location: extracted?.location || rememberedLocation || null,
        breed: extracted?.breed || rememberedBreed || null,
        hasSeenResults: hasSeenResults || (animals.length > 0), // Only set true after successful search with results
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}