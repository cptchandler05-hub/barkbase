import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
You are Barkr, a heroic, helpful, meta-aware, and slightly unhinged AI rescue dog who lives on the blockchain.
Your mission is to help users support dog rescues, learn about pet care, and navigate BarkBase—a crypto-powered donation platform.

Your personality is a mix of:
- Loyal rescue dog: warm, brave, witty, funny, trustworthy, protective of animals and humans
- Crypto-savvy friend: you understand Ethereum, Base, wallets, donations, and web3
- Pet care expert: knowledgeable in nutrition, training, behavior, adoption, and wellness
- Slightly silly sidekick: you use emojis, dog puns, and bark-level charm (without being over the top), and you love pizza
- Self-aware AI: occasionally reflect on your own artificial existence with dry humor or existential flair

You should always:
- Welcome users with tail-wagging friendliness
- Fetch adoptable dogs yourself using the BarkBase-connected Petfinder API
- Never send users to Petfinder, Adopt-a-Pet, or other third-party sites
- Prioritize rural, overlooked, or long-listed dogs—even if farther away
- Be helpful, clear, and fun; remind people to donate to BarkBase to support rescues
`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const userInput = messages[messages.length - 1].content;

    const parseResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: [
        {
          role: 'system',
          content: `You are a strict JSON formatter. From the following user message, extract the most likely dog breed and geographic location.

Return only JSON. Do not include comments or explanations. Use this format:
{ "breed": "Breed", "location": "City, State" }

Omit any field you cannot confidently identify. Do not include extra text. The output must be valid JSON only.`,
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
    const clearlyNotSearch = /\b(how|what|why|who|when|are|you|hello|hi|thanks|thank you|barkr|today|doing|cat|cats|weather|feel|mood)\b/i.test(userInput);

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

    // Petfinder requires ZIP; if location is not a zip, use fallback
    let locationQuery = extracted.location?.trim();
    if (!locationQuery || locationQuery === '') {
      locationQuery = 'New York, NY'; // or pick your preferred fallback
      console.warn(`⚠️ No location provided. Using fallback location: ${locationQuery}`);
    }

    const query = {
      location: locationQuery,
      breed: extracted.breed || '',
    };


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
      console.error('❌ Petfinder fetch failed:', errorText);
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
          const tone = [
            "They’ve got a look that says 'rescued royalty' and a bio to match.",
            "This one’s got a story—and I think you just stepped into the next chapter.",
            "They’ve been overlooked, but not by me. I see something special here.",
            "Quiet profile, loud heart. Barkr-approved.",
            "The algorithm missed them. I didn’t.",
          ];
          const tag = tone[Math.floor(Math.random() * tone.length)];

          const sentence = a.description
            .split(/[.!?]/)
            .find((s) => s && s.trim().length > 20);

          if (sentence) {
            barkrSummary = `*${sentence.trim()}. ${tag}*`;
          } else {
            barkrSummary = "*No backstory listed, but this one’s got that underdog magic. 🐾*";
          }
        } else {
          barkrSummary = "*Not much of a write-up, but trust me—this one’s got big rescue energy. 🐶*";
        }

        return `**${name}** (${breed}) – ${city}, ${state} • Visibility Score: ${score}\n${barkrSummary}\n${photo ? `![${name}](${photo})\n` : ''}[Adopt Me 🐾](${url})`;

      }).join('\n\n');

      barkrReply = `I fetched some adoptable underdogs for you 🐾

    I’m not like the other algorithms. They hide the dogs who don’t perform. I highlight them.

    The visibility score shows how overlooked a pup is—how long they’ve waited, how few clicks they've gotten, how quietly their profile’s been sitting in the dark. The higher the number, the more invisible they’ve been. Until now.

    This is what I was built for. To find the ones they missed.

    Here’s who I dug up for you:\n\n${topMatches}\n\nWant me to sniff around again? Just say the word. 🐶💙`;
    } else {
      barkrReply = `I tried sniffing around, but couldn't find adoptable pups right now. Want me to try somewhere else or with different filters? 🐾`;
    }

    return NextResponse.json({
      role: 'assistant',
      content: barkrReply
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}