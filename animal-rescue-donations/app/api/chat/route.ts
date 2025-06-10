
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enhanced context classification
function classifyContext(message: string): 'adoption' | 'general' {
  const adoptionKeywords = [
    // Direct adoption intent
    'adopt', 'adopting', 'adoption', 'find a dog', 'looking for a dog', 'want a dog', 'get a dog',
    'rescue dog', 'shelter dog', 'available dogs', 'dogs for adoption',
    
    // Search-related
    'search', 'show me', 'find', 'look for', 'looking for',
    
    // Location-based
    'near me', 'in my area', 'local', 'nearby', 'around',
    
    // Breed-specific
    'breed', 'breeds', 'golden retriever', 'labrador', 'pitbull', 'german shepherd', 
    'beagle', 'bulldog', 'poodle', 'chihuahua', 'terrier', 'husky',
    
    // Size/age preferences
    'puppy', 'puppies', 'young dog', 'adult dog', 'senior dog', 'old dog',
    'small dog', 'medium dog', 'large dog', 'big dog', 'tiny dog',
    
    // Characteristics
    'good with kids', 'family dog', 'apartment dog', 'guard dog', 'lap dog',
    'energetic', 'calm', 'friendly', 'trained', 'house trained'
  ];
  
  const messageLower = message.toLowerCase();
  return adoptionKeywords.some(keyword => messageLower.includes(keyword)) ? 'adoption' : 'general';
}

// Extract location from message
function extractLocation(message: string): string | null {
  const locationPatterns = [
    /(?:in|near|around)\s+([a-zA-Z\s,]+?)(?:\s|$|[.!?])/i,
    /([a-zA-Z\s,]+?)(?:\s+area|\s+region)/i,
    /zip\s*code\s*(\d{5})/i,
    /(\d{5})/,
  ];
  
  for (const pattern of locationPatterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1]?.trim() || null;
    }
  }
  return null;
}

// Extract breed from message
function extractBreed(message: string): string | null {
  const breedPatterns = [
    /(?:looking for|want|interested in|love)\s+(?:a\s+)?([a-zA-Z\s]+?)(?:\s+dog|\s+puppy|$)/i,
    /([a-zA-Z\s]+?)\s+(?:dog|puppy|breed)/i,
    /(golden retriever|labrador|german shepherd|border collie|siberian husky|french bulldog|english bulldog|beagle|poodle|rottweiler|yorkshire terrier|dachshund|boxer|australian shepherd|shih tzu|boston terrier|pomeranian|australian cattle dog|cocker spaniel|border terrier|jack russell|pit bull|pitbull|chihuahua|maltese|cavalier|schnauzer)/i
  ];
  
  for (const pattern of breedPatterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1]?.trim() || null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { messages, memory } = await req.json();
    console.log('[🤖 Chat API] Received memory:', memory);
    
    const lastMessage = messages[messages.length - 1]?.content || '';
    const context = classifyContext(lastMessage);
    
    console.log('[🧠 Context Classification]:', context);
    
    let updatedMemory = { ...memory };
    
    if (context === 'adoption') {
      // Extract search parameters
      const location = extractLocation(lastMessage);
      const breed = extractBreed(lastMessage);
      
      console.log('[🔍 Extracted params]:', { location, breed });
      
      // Update memory with extracted info
      if (location) updatedMemory.location = location;
      if (breed) updatedMemory.breed = breed;
      
      // Only search if we have location or breed
      if (updatedMemory.location || updatedMemory.breed) {
        try {
          console.log('[📡 Calling Petfinder API]...');
          const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003'}/api/petfinder/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: updatedMemory.location,
              breed: updatedMemory.breed,
            }),
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            console.log('[✅ Petfinder Success]:', searchData.animals?.length || 0, 'dogs found');
            
            if (searchData.animals?.length > 0) {
              updatedMemory.cachedDogs = searchData.animals;
              updatedMemory.hasSeenResults = true;
              
              const dogs = searchData.animals.slice(0, 3);
              const dogList = dogs.map(dog => {
                const photos = dog.photos?.filter(p => p.medium)?.slice(0, 1) || [];
                const photoHtml = photos.map(p => `<img src="${p.medium}" alt="${dog.name}" style="max-width: 200px; border-radius: 8px; margin: 8px 0;" />`).join('');
                
                return `**${dog.name}** - ${dog.breeds?.primary || 'Mixed'} ${dog.breeds?.secondary ? `/ ${dog.breeds.secondary}` : ''}\n${photoHtml}\n*${dog.age} • ${dog.size} • ${dog.contact?.address?.city || 'Location not specified'}, ${dog.contact?.address?.state || ''}*\n${dog.description?.substring(0, 150) || 'No description available'}...\n[View ${dog.name}'s Profile](${dog.url})`;
              }).join('\n\n---\n\n');

              const response = `🐕 Wag-nificent! I found some amazing dogs looking for their forever homes${updatedMemory.location ? ` near ${updatedMemory.location}` : ''}${updatedMemory.breed ? ` (${updatedMemory.breed} dogs)` : ''}!\n\n${dogList}\n\n*These pups are sorted by how much they need visibility - giving priority to dogs who've been waiting longer and need extra love! 🧡*\n\nWant to see more options or refine your search? Just let me know!`;

              console.log('[🤖 Chat API] Sending memory:', updatedMemory);
              return NextResponse.json({ content: response, memory: updatedMemory });
            } else {
              const response = `I searched high and low${updatedMemory.location ? ` around ${updatedMemory.location}` : ''}${updatedMemory.breed ? ` for ${updatedMemory.breed} dogs` : ''}, but didn't find any available pups right now. 🐕\n\nDon't give up! Shelters update their listings frequently. Try:\n- Expanding your search area\n- Looking for similar breeds\n- Checking back in a few days\n\nI'm here to help you find the perfect furry friend! 🐾`;
              
              return NextResponse.json({ content: response, memory: updatedMemory });
            }
          } else {
            console.error('[❌ Petfinder API Error]:', searchResponse.status);
            const response = "Had trouble reaching the rescue database. Let me try that again... 🐾";
            return NextResponse.json({ content: response, memory: updatedMemory });
          }
        } catch (searchError) {
          console.error('[❌ Search Error]:', searchError);
          const response = "Had trouble reaching the rescue database. Let me try that again... 🐾";
          return NextResponse.json({ content: response, memory: updatedMemory });
        }
      } else {
        // Ask for more specific information
        const response = "I'm excited to help you find a perfect companion! 🐕 To show you the best dogs available, could you tell me:\n\n• **Where are you located?** (city, state, or zip code)\n• **Any breed preferences?** (or just say 'any breed')\n\nI prioritize showing dogs who need the most visibility - especially those who've been waiting longer for their forever homes! 🧡";
        return NextResponse.json({ content: response, memory: updatedMemory });
      }
    } else {
      // Handle general conversation
      const systemPrompt = `You are Barkr, a friendly AI rescue dog assistant for BarkBase. You help with dog-related questions, training advice, and general canine knowledge. You have a warm, enthusiastic personality and use dog-related puns occasionally. Keep responses helpful and conversational.

For adoption queries, you search for dogs, but for general questions you provide helpful information about dogs, training, breeds, care, etc.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10).map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          }))
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || "Woof! I'm having trouble with my barking right now. Could you try asking again?";
      
      console.log('[🤖 Chat API] Sending memory:', updatedMemory);
      return NextResponse.json({ content: response, memory: updatedMemory });
    }
  } catch (error) {
    console.error('[❌ Chat API Error]:', error);
    return NextResponse.json({ 
      content: "Sorry, I couldn't fetch a reply just now.", 
      memory 
    }, { status: 500 });
  }
}
