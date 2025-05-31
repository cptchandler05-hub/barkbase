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
    const query = {
      location: extracted.location || fallbackZip,
      breed: extracted.breed || '',
    };

    console.log('📡 Fetching /api/petfinder/search with payload:', query);
    
    const searchRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/petfinder/search`, {
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
      const topMatches = animals.slice(0, 10).map((a) => {
        const name = a.name;
        const breed = a.breeds?.primary || 'Unknown';
        const photo = a.photos?.[0]?.medium || null;
        const city = a.contact?.address?.city || 'Unknown city';
        const state = a.contact?.address?.state || '';
        const id = a.id;
        const url = a.url || `https://www.petfinder.com/dog/${id}`;
        const score = a.visibilityScore ?? '?';

        return `**${name}** (${breed}) – ${city}, ${state} • Visibility Score: ${score}\n${photo ? `![${name}](${photo})\n` : ''}[Adopt Me 🐾](${url})`;
      }).join('\n\n');

      barkrReply = `I dug up some overlooked gems just for you 🐾\n\n${topMatches}\n\nLet me know if you want to see more—or if none of these feel right, I can sniff around again! 🐶`;
    } else {
      barkrReply = `I gave it a good sniff, but couldn’t find any matches this time. Doesn’t mean they’re not out there! Want to try a different area or breed? 🐕`;
    }

    return NextResponse.json({
      role: 'assistant',
      content: barkrReply,
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
