import { NextRequest, NextResponse } from 'next/server';
import { init } from '@dqbd/tiktoken';
import { ChatCompletionRequestMessage } from 'openai';

import { DatabaseAPI } from '@/lib/database';
import { PetfinderAPI } from '@/lib/petfinder';
import { SearchNormalizer } from '@/lib/searchNormalizer';
import { DogFormatter } from '@/lib/dogFormatter';
// Removed RescueGroupsAPI import as per instructions

// Initialize tiktoken for token counting
const encoder = init(
  'cl100k_base' // Use the appropriate model name for your OpenAI version
);

// Constants for Petfinder API rate limiting
const MAX_REQUESTS_PER_MINUTE = 4; // Petfinder's rate limit is 4 requests per second, so 4 per minute is a conservative estimate for our use.
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

let requestCount = 0;
let rateLimitResetTime = Date.now() + RATE_LIMIT_WINDOW;
let lastRequestTime = 0;

// --- Helper Functions ---

/**
 * Calculates the number of tokens in a given message.
 * @param message The message to tokenize.
 * @returns The number of tokens.
 */
const getTokenCount = (message: ChatCompletionRequestMessage): number => {
  if (!message.content) return 0;
  return encoder.encode(message.content).length;
};

/**
 * Normalizes search parameters for pet adoption queries.
 * @param searchParams The raw search parameters.
 * @returns Normalized search parameters.
 */
const normalizeSearchParams = (
  searchParams: Record<string, string | string[] | undefined>
): SearchParams => {
  const normalizer = new SearchNormalizer(searchParams);
  return normalizer.normalize();
};

/**
 * Fetches dogs from the database.
 * @param normalizedParams Normalized search parameters.
 * @returns A promise that resolves to an array of dogs from the database.
 */
const fetchFromDatabase = async (
  normalizedParams: SearchParams
): Promise<Dog[]> => {
  console.log('[🗄️ Database] Fetching dogs from database...');
  try {
    const database = new DatabaseAPI();
    const dbDogs = await database.searchDogs(normalizedParams);
    console.log(`[✅ Database Hit] Found ${dbDogs.length} dogs from database.`);
    return dbDogs;
  } catch (error) {
    console.warn('[⚠️ Database Fallback] Database search failed:', error);
    return [];
  }
};

/**
 * Fetches dogs from the Petfinder API.
 * @param normalizedParams Normalized search parameters.
 * @returns A promise that resolves to an array of dogs from the Petfinder API.
 */
const fetchFromPetfinder = async (
  normalizedParams: SearchParams
): Promise<Dog[]> => {
  console.log('[🐾 Petfinder] Searching Petfinder API...');
  console.log(
    `[📊 Current Results] ${
      allDogs.length
    } dogs found so far, need ${
      normalizedParams.limit! - allDogs.length
    } more`
  );

  // Rate limiting check with enhanced logging
  const now = Date.now();
  if (now > rateLimitResetTime) {
    requestCount = 0;
    rateLimitResetTime = now + RATE_LIMIT_WINDOW;
    console.log('[🔄 Rate Limit] Reset rate limit window');
  }

  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    console.warn(
      '[⚠️ Internal Rate Limit] Petfinder rate limit reached, returning partial results'
    );
    // Still return what we have instead of failing completely
  } else {
    // Ensure minimum time between requests
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_WINDOW / MAX_REQUESTS_PER_MINUTE) {
      const waitTime =
        RATE_LIMIT_WINDOW / MAX_REQUESTS_PER_MINUTE - timeSinceLastRequest;
      console.log(`[⏳ Rate Limit] Waiting ${waitTime}ms before next Petfinder request.`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    try {
      console.log('[🐾 Petfinder] Making Petfinder API call...');
      const petfinder = new PetfinderAPI();
      const pfResult = await petfinder.searchAnimals(normalizedParams);

      if (pfResult.animals && pfResult.animals.length > 0) {
        console.log(`[✅ Petfinder Hit] Found ${pfResult.animals.length} dogs from Petfinder`);
        const formattedPfDogs = pfResult.animals.map((animal) =>
          DogFormatter.formatPetfinderDog(animal)
        );

        // Deduplicate against existing dogs (from database and potentially other sources)
        const newPfDogs = formattedPfDogs.filter((pfDog) => {
          return !allDogs.some((existingDog) => {
            const nameMatch =
              existingDog.name.toLowerCase().trim() ===
              pfDog.name.toLowerCase().trim();
            const breedMatch = existingDog.breeds?.primary === pfDog.breeds?.primary;
            const ageMatch = existingDog.age === pfDog.age;
            return nameMatch && (breedMatch || ageMatch);
          });
        });

        console.log(`[🔄 Deduplication] ${formattedPfDogs.length - newPfDogs.length} duplicates removed from Petfinder`);
        requestCount++;
        lastRequestTime = Date.now();
        return newPfDogs;
      } else {
        console.log('[ℹ️ Petfinder] No dogs found on Petfinder.');
        return [];
      }
    } catch (pfError) {
      console.warn('[⚠️ Petfinder Fallback] Petfinder search failed:', pfError);
      return [];
    }
  }
  return []; // Return empty array if rate limit is hit or an error occurs
};

/**
 * Main handler for pet adoption search queries.
 * @param req The Next.js request object.
 * @returns A promise that resolves to the Next.js response object.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const normalizedParams = normalizeSearchParams(Object.fromEntries(searchParams));

  console.log(
    `[🔍 Search Request] ${
      normalizedParams.breed || 'Any breed'
    } in ${normalizedParams.location || 'Any location'}`
  );
  console.log('[📊 Search Params]', normalizedParams);
  console.log(
    `[🎯 Search Strategy] Using Database → Petfinder waterfall (RescueGroups removed from user queries)`
  );

  let allDogs: Dog[] = [];
  const sources: string[] = [];

  // PHASE 1: Database Search (First Priority)
  const dbDogs = await fetchFromDatabase(normalizedParams);
  allDogs = allDogs.concat(dbDogs);
  if (dbDogs.length > 0) {
    sources.push('database');
  }

  // PHASE 2: Petfinder Search (Second Priority)
  if (allDogs.length < normalizedParams.limit! && normalizedParams.location) {
    const pfDogs = await fetchFromPetfinder(normalizedParams);
    allDogs = allDogs.concat(pfDogs);
    if (pfDogs.length > 0) {
      sources.push('petfinder');
    }
  }

  // Return results
  return NextResponse.json({
    dogs: allDogs,
    searchParams: normalizedParams,
    sources: sources,
  });
}

// Define interfaces for clarity (assuming these are defined elsewhere in your project)
interface SearchParams {
  breed?: string;
  age?: string;
  size?: string;
  gender?: string;
  location?: string;
  radius?: number;
  limit?: number;
}

interface Dog {
  id: string;
  name: string;
  age: string;
  size: string;
  gender: string;
  breeds?: {
    primary?: string | null;
    secondary?: string | null;
    mixed: boolean;
    unknown: boolean;
  };
  photos: {
    small: string | null;
    medium: string | null;
    large: string | null;
    full: string | null;
  }[];
  contact: {
    email?: string | null;
    phone?: string | null;
    address?: {
      address1?: string | null;
      address2?: string | null;
      city: string | null;
      state: string | null;
      postcode: string | null;
      country: string | null;
    };
  };
  description: string | null;
  url: string;
  source: string;
  saved?: boolean; // For frontend use
}