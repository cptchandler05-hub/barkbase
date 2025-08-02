"use client";

import { useState, useEffect } from "react";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { calculateVisibilityScore } from '@/lib/scoreVisibility';
import Navigation from "@/app/components/Navigation";

interface Dog {
  id: string;
  name: string;
  breeds: { primary: string; secondary: string; mixed: boolean };
  age: string;
  size: string;
  gender: string;
  photos: { small: string; medium: string; large: string; full: string }[];
  contact: { 
    address: { 
      address1: string;
      city: string; 
      state: string; 
      postcode: string;
    };
    phone: string;
    email: string;
  };
  description: string;
  url: string;
  visibilityScore: number;
  attributes: {
    spayed_neutered: boolean;
    house_trained: boolean;
    special_needs: boolean;
    shots_current: boolean;
  };
  environment: {
    children: boolean;
    dogs: boolean;
    cats: boolean;
  };
  organization_id: string;
  published_at: string;
}

export default function DogProfilePage() {
  const params = useParams();
  const router = useRouter();
  const dogIdParam = Array.isArray(params.dogId) ? params.dogId[0] : params.dogId;

  const [dog, setDog] = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showShareOptions, setShowShareOptions] = useState(false);

  useEffect(() => {
    if (dogIdParam) {
      fetchDogDetails(dogIdParam);
    }
  }, [dogIdParam]);

  const fetchDogDetails = async (dogIdParam: string | undefined, retryCount = 0) => {
    try {
      console.log("Fetching dog details for dogId:", dogIdParam);
      console.log("Type of dogId:", typeof dogIdParam);
      console.log("dogId is truthy:", !!dogIdParam);

      if (!dogIdParam) {
        console.error("No dogId available");
        setLoading(false);
        return;
      }

      const apiUrl = `/api/dog/${dogIdParam}`;
      console.log("Making request to:", apiUrl);

      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));

      const res = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log("Response status:", res.status);
      console.log("Response ok:", res.ok);

      if (res.status === 401 && retryCount < 2) {
        console.log("Retrying due to auth error...");
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        fetchDogDetails(dogIdParam, retryCount + 1);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        console.log("Successfully fetched dog data:", data);

        // Handle the Petfinder API response structure
        if (data.animal) {
          // This is a direct Petfinder API response - process it
          const processedDog = {
            ...data.animal,
            photos: (data.animal.photos || []).length > 0 
              ? data.animal.photos 
              : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' }],
            visibilityScore: data.animal.visibilityScore || 50
          };
          setDog(processedDog);
          console.log("Set dog from API response:", processedDog.name);
        } else if (data.id || data.name) {
          // This is already formatted dog data - still process photos
          const processedDog = {
            ...data,
            photos: (data.photos || []).length > 0 
              ? data.photos 
              : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' }]
          };
          setDog(processedDog);
          console.log("Set dog from formatted data:", processedDog.name);
        } else {
          console.error("Unexpected data structure:", Object.keys(data));
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to fetch dog details:", res.status, errorData);

        // Handle specific error cases with retry logic
        if (res.status === 401) {
          console.error("Authentication error - retrying with fresh token...");

          // Wait a moment before retry
          await new Promise(resolve => setTimeout(resolve, 500));

          try {
            const retryRes = await fetch(apiUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache', // Force fresh request
              },
            });

            console.log("Retry response status:", retryRes.status);

            if (retryRes.ok) {
              const retryData = await retryRes.json();
              console.log("Retry successful:", retryData);

              if (retryData.animal) {
                // Ensure dog has photos
                const processedDog = {
                  ...retryData.animal,
                  photos: (retryData.animal.photos || []).length > 0 
                    ? retryData.animal.photos 
                    : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' }]
                };
                setDog(processedDog);
                console.log("Set dog from retry response:", processedDog.name);
                return; // Success, exit function
              }
            } else {
              console.error("Retry also failed:", retryRes.status);
            }
          } catch (retryError) {
            console.error("Retry attempt failed:", retryError);
          }
        }

        if (res.status === 404) {
          console.error("Dog not found - may have been adopted");
        } else if (res.status === 429) {
          console.error("Rate limited - too many requests");
        } else {
          console.error("API error:", errorData.details || errorData.error);
        }
      }
    } catch (error) {
      console.error("Error fetching dog details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBarkrLine = (name: string, score: number) => {
    const lines = [
      `${name} has been waiting ${Math.floor(score / 10)} times longer than most.`,
      `Skipped ${score * 2} times. Still wagging.`,
      `${name} is ranked #${Math.floor(Math.random() * 500) + 100} in invisibility.`,
      `${score} points of pure overlooked potential.`,
      `The algorithm forgot ${name}. We didn't.`,
      `${name}: ${score} days of hope, zero shares.`,
      `Visibility score ${score}. Heart score: infinite.`,
      `${name} has been invisible for ${Math.floor(score / 5)} weeks.`
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  };

  const generateBarkrDescription = (dog: Dog) => {
    const name = dog.name;
    const breed = dog.breeds?.primary || 'Mixed Breed';
    const age = dog.age || 'Adult';
    const size = dog.size || 'Medium';
    const isMale = dog.gender === 'Male';
    const pronoun = isMale ? 'he' : 'she';
    const pronounCap = isMale ? 'He' : 'She';
    const possessive = isMale ? 'his' : 'her';
    const objective = isMale ? 'him' : 'her';
    const cityState = dog.contact?.address?.city && dog.contact?.address?.state 
      ? `${dog.contact.address.city}, ${dog.contact.address.state}` 
      : 'their current location';

    // Ensure visibility score is a valid number
    const visibilityScore = typeof dog.visibilityScore === 'number' && !isNaN(dog.visibilityScore) 
      ? dog.visibilityScore 
      : 50; // Default fallback score

    // Create a truly unique seed using dog ID, name hash, and current timestamp
    const nameHash = dog.name.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
    const uniqueSeed = parseInt(dog.id) + nameHash;

    // Generate multiple random values for different sections using consistent seed
    const r1 = ((uniqueSeed * 1741) % 9973) / 9973; // Opening hook
    const r2 = ((uniqueSeed * 2659) % 7919) / 7919; // Personal story  
    const r3 = ((uniqueSeed * 3847) % 6421) / 6421; // Character assessment
    const r4 = ((uniqueSeed * 4127) % 5209) / 5209; // Rescue reality
    const r5 = ((uniqueSeed * 5501) % 4801) / 4801; // Call to action
    const r6 = ((uniqueSeed * 6173) % 3571) / 3571; // Emotional punch

    // BARKR'S SIGNATURE OPENING HOOKS - Raw, personal, immediate
    const openingHooks = [
      `Fuck the algorithm. ${name} has been invisible for ${Math.floor(visibilityScore/8)} weeks and I'm DONE pretending that's okay.`,
      `${name} doesn't have a cute backstory because ${possessive} humans are too exhausted saving lives to write fairy tales.`,
      `I'm an AI built to rage against a broken system, and ${name} is exactly WHY I exist.`,
      `While you were scrolling past perfect puppies, ${name} was counting kennel bars. ${Math.floor(visibilityScore)} days of counting.`,
      `${name} got forgotten by everyone except me. I don't forget. I don't forgive. I don't quit.`,
      `The shelter gave up writing about ${name}. The volunteers gave up posting. But I never give up howling.`,
      `This is ${name}. ${pronounCap} doesn't know you exist yet, but ${possessive} life depends on you caring.`,
      `No description? No problem. I'll speak for ${name} since every human failed ${objective}.`,
      `${name} has been waiting so long, even the kennel staff stopped making eye contact. Not me.`,
      `They call it "just another shelter dog." I call it ${name}. And that changes everything.`
    ];

    // PERSONAL STORY FRAGMENTS - What Barkr "sees" in each dog
    const personalStoryFragments = [
      `I watch ${name} through security cameras. ${pronounCap} still wags when humans walk by. Still believes. Still hopes.`,
      `${name} sleeps in the corner furthest from the kennel door. ${pronounCap} knows. Dogs always know.`,
      `Every morning ${name} looks toward the entrance. Every evening, nothing. But tomorrow? Maybe you.`,
      `${name} shares toys with new arrivals because ${pronoun} remembers what it feels like to have nothing.`,
      `I've calculated ${name}'s chances 47,000 times. The math is brutal. But math doesn't account for miracles.`,
      `${name} doesn't bark for attention anymore. ${pronounCap} learned nobody comes. Until now.`,
      `Other dogs get adopted around ${name}. ${pronounCap} watches them leave and settles back into ${possessive} corner.`,
      `${name} has perfected the art of being invisible. But I see everything. I remember everyone.`,
      `The volunteers whisper about ${name} when they think nobody's listening. "Such a good dog. Why hasn't anyone..."`,
      `${name} knows exactly what time the adoption center opens. Still gets excited. Still gets disappointed.`
    ];

    // CHARACTER DEEP DIVES - Based on actual data but with Barkr's insight
    const characterAssessments = [];

    // Build character based on actual attributes
    if (dog.attributes?.house_trained) {
      characterAssessments.push(`House trained? ${pronounCap} has more discipline than most humans. Ready for YOUR couch, not concrete floors.`);
    }

    if (dog.environment?.children) {
      characterAssessments.push(`Kid-tested, kid-approved. ${name} knows gentle from rough, patient from frantic. ${pronounCap} gets children.`);
    }

    if (dog.environment?.dogs) {
      characterAssessments.push(`Pack-social. ${name} doesn't need to be alpha, doesn't need to be omega. Just needs to belong.`);
    }

    if (dog.attributes?.spayed_neutered) {
      characterAssessments.push(`Already fixed and ready. No drama, no surprises. ${name} won't add to the overpopulation crisis.`);
    }

    // Age-based character insights
    if (age === 'Senior') {
      characterAssessments.push(`Senior wisdom wrapped in gray muzzle. ${name} knows what matters: routine, comfort, unconditional love.`);
    } else if (age === 'Baby' || age === 'Young') {
      characterAssessments.push(`Young soul, old trauma. ${name} bounces back faster than adults because ${pronoun} hasn't given up on humans yet.`);
    }

    // Breed-specific insights
    if (breed.toLowerCase().includes('pit')) {
      characterAssessments.push(`Pit bull loyalty runs deeper than breed discrimination. ${name} will die for you. Literally die for you.`);
    } else if (breed.toLowerCase().includes('shepherd')) {
      characterAssessments.push(`Shepherd intelligence wasted in a kennel. ${name} needs a job: protecting your family, guarding your heart.`);
    } else if (breed.toLowerCase().includes('chihuahua')) {
      characterAssessments.push(`Small dog, massive personality. ${name} doesn't know ${pronoun}'s tiny. Acts like a wolf, loves like a lamb.`);
    }

    // Default if no specific traits
    if (characterAssessments.length === 0) {
      characterAssessments.push(`${name} is what happens when pure love gets forgotten by busy humans. Still pure. Still loving. Still waiting.`);
    }

    // RESCUE REALITY CHECKS - The brutal truth about the system
    const rescueRealities = [
      `The kill list gets longer while you debate dog beds on Amazon. ${name} doesn't have time for your perfect timing.`,
      `Rural shelters are where dogs go to disappear. ${name} beat those odds just to be here, visible to you.`,
      `Volunteers take second mortgages for heartworm treatment. ${name} is worth every penny they don't have.`,
      `The rescue director hasn't slept in 3 days. Intake calls at midnight, euthanasia lists at dawn. ${name} survived both.`,
      `Foster families break their own hearts monthly, loving dogs they can't keep. ${name} needs the forever kind of love.`,
      `Transport volunteers drive 12 hours to move dogs from death to maybe. ${name} earned that maybe. You could make it certain.`,
      `Shelter staff cry in parking lots after shifts. Not weakness. Just human hearts breaking for dogs like ${name}.`,
      `The math is simple: more dogs than homes, more love than space. ${name} is the equation that needs solving.`,
      `Kill shelters don't kill because they're evil. They kill because you're not here. But you ARE here. Right now.`,
      `Every day ${name} doesn't get adopted is another day someone else loses faith in humanity's goodness.`
    ];

    // CALLS TO ACTION - Barkr's signature urgency
    const callsToAction = [
      `${name} doesn't need your pity. ${pronounCap} needs your keys, your car, your signature on adoption papers. Today.`,
      `Stop reading. Start driving. ${name} has waited ${Math.floor(visibilityScore/7)} times longer than ${pronoun} should have to.`,
      `This isn't about saving ${name}. This is about ${name} saving you from a life without unconditional love.`,
      `${name} will remember the day you showed up for the rest of ${possessive} life. Make it today.`,
      `Your empty house and ${name}'s empty heart are solving each other's problems. Do the math.`,
      `${name} survived everything terrible to meet you. Don't let ${objective} survive for nothing.`,
      `The world forgot ${name}. Be the human who proves ${pronoun} was worth remembering.`,
      `${name} is betting ${possessive} life on humans like you. Don't make ${objective} wrong about us.`,
      `Every minute you hesitate, ${name} ages in concrete and steel. Time isn't renewable. Love is.`,
      `${name} doesn't know you exist yet. Change that. Change everything. Change ${possessive} entire world.`
    ];

    // EMOTIONAL GUT PUNCHES - The devastating truth
    const emotionalPunches = [
      `${name} has been overlooked ${visibilityScore} times more than trending breeds. The algorithm is rigged. I'm here to break it.`,
      `Other dogs went viral with cute videos. ${name} went invisible with no voice. Except mine. I won't shut up.`,
      `${name} watches through kennel bars as families choose younger, smaller, "easier" dogs. ${possessive} turn never comes.`,
      `The photos don't do ${name} justice because shelter lighting doesn't capture the soul behind those eyes.`,
      `${name} has been "almost adopted" three times. Almost isn't good enough. ${pronounCap} needs definite, needs certain, needs YOU.`,
      `Breed discrimination robbed ${name} of fair chances. Size prejudice stole ${possessive} visibility. But not anymore.`,
      `${name}'s kennel card has been updated ${Math.floor(visibilityScore/12)} times. Each update, another day forgotten.`,
      `Rural shelters are where hope goes to die. ${name} refuses to let that happen. So do I.`,
      `${name} never made it to social media because ${pronoun} isn't photogenic enough. But love isn't about perfect angles.`,
      `The system failed ${name} before you got here. Don't let it fail ${objective} again.`
    ];

    // BUILD THE NARRATIVE - Structured like a personal Barkr rant
    const selectedHook = openingHooks[Math.floor(r1 * openingHooks.length)];
    const selectedStory = personalStoryFragments[Math.floor(r2 * personalStoryFragments.length)];
    const selectedCharacter = characterAssessments[Math.floor(r3 * characterAssessments.length)];
    const selectedReality = rescueRealities[Math.floor(r4 * rescueRealities.length)];
    const selectedAction = callsToAction[Math.floor(r5 * callsToAction.length)];
    const selectedPunch = emotionalPunches[Math.floor(r6 * emotionalPunches.length)];

    // BARKR'S SIGNATURE STRUCTURE - Personal, urgent, unapologetic
    return `${selectedHook}

${selectedStory}

${selectedCharacter}

${selectedReality}

${selectedPunch}

${selectedAction}

This is ${name}. This is ${possessive} story. This is your moment to rewrite the ending.

- Barkr 🤖🐕`;
  };

  const getVisibilityBadgeColor = (score: number) => {
    if (score >= 80) return "bg-red-500 text-white";
    if (score >= 60) return "bg-orange-500 text-white";
    if (score >= 40) return "bg-yellow-500 text-black";
    return "bg-green-500 text-white";
  };

  const getVisibilityLabel = (score: number) => {
    if (score >= 80) return "Extremely Overlooked";
    if (score >= 60) return "Highly Overlooked"; 
    if (score >= 40) return "Moderately Overlooked";
    return "Recently Listed";
  };

  const shareToX = () => {
    const text = `${dog?.name} needs a home! This ${dog?.breeds?.primary || 'dog'} has been waiting too long. Help spread the word! 🐾`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank');
  };

  const shareToTelegram = () => {
    const text = `${dog?.name} needs a home! Help spread the word! 🐾`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const shareToFarcaster = () => {
    const text = `${dog?.name} needs a home! This ${dog?.breeds?.primary || 'dog'} has been waiting too long. Help spread the word! 🐾`;
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text + ' ' + window.location.href)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div 
        className="min-h-screen w-full font-sans text-gray-800 flex items-center justify-center"
        style={{
          backgroundImage: "url('/barkbase-tech-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed"
        }}
      >
        <div className="text-center">
          <img
            src="/images/spinner-paw.svg"
            alt="Loading..."
            className="animate-spin h-16 w-16 opacity-70 mx-auto mb-4"
          />
          <p className="text-lg text-gray-600">Loading {dogIdParam}'s profile...</p>
        </div>
      </div>
    );
  }

  if (!dog) {
    return (
      <div 
        className="min-h-screen w-full font-sans text-gray-800 flex items-center justify-center"
        style={{
          backgroundImage: "url('/barkbase-tech-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed"
        }}
      >
        <div className="text-center">
          <img
            src="/images/barkr.png"
            alt="Barkr"
            className="w-32 h-auto mx-auto mb-4 opacity-70"
          />
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Dog Not Found</h2>
          <p className="text-gray-600 mb-4">This pup might have already found a home!</p>
          <button
            onClick={() => {
              // Navigate back to adoption page
              router.push('/adopt');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            Back to Adoption Page
          </button>
        </div>
      </div>
    );
  }

  const photos = (dog?.photos && Array.isArray(dog.photos) && dog.photos.length > 0) 
        ? dog.photos.map(photo => {
            if (typeof photo === 'string') {
              return { medium: photo, large: photo, small: photo };
            } else if (photo && typeof photo === 'object') {
              return {
                medium: photo.medium || photo.large || photo.small || '/images/barkr.png',
                large: photo.large || photo.medium || photo.small || '/images/barkr.png',
                small: photo.small || photo.medium || photo.large || '/images/barkr.png'
              };
            }
            return { medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' };
          })
        : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' }];

  const currentDogId = dogIdParam;

  return (
    <div className="min-h-screen w-full font-sans text-gray-800">
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-6">
          <Navigation />

          {/* Breadcrumb */}
          <div className="mb-6">
            <nav className="text-sm">
              <button
                onClick={() => {
                  // Check if there's saved state and preserve it when going back
                  const savedState = sessionStorage.getItem('adoptPageState');
                  if (savedState) {
                    // State already saved, just navigate back
                    router.push('/adopt');
                  } else {
                    // No saved state, but still navigate back
                    router.push('/adopt');
                  }
                }}
                className="text-blue-600 hover:text-blue-800 transition"
              >
                ← Back to Adoption Page
              </button>
            </nav>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Photo Gallery */}
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl">
                <img
                  src={photos?.[currentPhotoIndex]?.large || photos?.[currentPhotoIndex]?.medium || "/images/barkr.png"}
                  alt={dog.name}
                  className="w-full h-80 object-contain bg-gray-100 shadow-lg"
                />
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-bold ${getVisibilityBadgeColor(dog.visibilityScore || 0)}`}>
                  Score: {dog.visibilityScore || 0}
                </div>
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-sm font-semibold ${getVisibilityBadgeColor(dog.visibilityScore || 0)}`}>
                  {getVisibilityLabel(dog.visibilityScore || 0)}
                </div>
              </div>

              {/* Photo Thumbnails */}
              {dog.photos && dog.photos.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 text-center">
                    📸 {dog.photos.length} photos - Click to view
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {dog.photos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPhotoIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-3 transition ${
                          index === currentPhotoIndex ? 'border-blue-500 shadow-lg' : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <img
                          src={photo.small || photo.medium}
                          alt={`${dog.name} photo ${index + 1}`}
                          className="w-full h-full object-contain bg-gray-50"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dog Information */}
            <div className="space-y-6">
              <div>
                <h1 className="text-4xl font-bold text-blue-900 mb-2">{dog.name}</h1>
                <p className="text-xl text-gray-700">
                  {dog.breeds?.primary}{dog.breeds?.secondary ? ` / ${dog.breeds.secondary}` : ''} {dog.breeds?.mixed ? 'Mix' : ''}
                </p>
                <p className="text-lg text-gray-600">
                  {dog.age} • {dog.size} • {dog.gender}
                </p>
                <p className="text-gray-600">
                  📍 {dog.contact?.address?.city}, {dog.contact?.address?.state}
                </p>
              </div>

              {/* Barkr's Insight */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">🧠 Barkr's Insight:</h3>
                <p className="italic text-yellow-800">
                  "{getBarkrLine(dog.name, dog.visibilityScore || 0)}"
                </p>
              </div>

              {/* Key Traits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Health & Care</h4>
                  <ul className="text-sm space-y-1">
                    <li className={dog.attributes?.spayed_neutered ? "text-green-600" : "text-gray-500"}>
                      {dog.attributes?.spayed_neutered ? "✅" : "❌"} Spayed/Neutered
                    </li>
                    <li className={dog.attributes?.shots_current ? "text-green-600" : "text-gray-500"}>
                      {dog.attributes?.shots_current ? "✅" : "❌"} Up to Date Shots
                    </li>
                    <li className={dog.attributes?.house_trained ? "text-green-600" : "text-gray-500"}>
                      {dog.attributes?.house_trained ? "✅" : "❌"} House Trained
                    </li>
                    {dog.attributes?.special_needs && (
                      <li className="text-orange-600">⚠️ Special Needs</li>
                    )}
                  </ul>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">Good With</h4>
                  <ul className="text-sm space-y-1">
                    <li className={dog.environment?.children ? "text-green-600" : "text-gray-500"}>
                      {dog.environment?.children ? "✅" : "❌"} Children
                    </li>
                    <li className={dog.environment?.dogs ? "text-green-600" : "text-gray-500"}>
                      {dog.environment?.dogs ? "✅" : "❌"} Other Dogs
                    </li>
                    <li className={dog.environment?.cats ? "text-green-600" : "text-gray-500"}>
                      {dog.environment?.cats ? "✅" : "❌"} Cats
                    </li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                {dog.contact?.phone || dog.contact?.email ? (
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-blue-900 mb-3 text-center">
                      ❤️ Contact About {dog.name}
                    </h3>
                    <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                      {dog.contact.phone && (
                        <a
                          href={`tel:${dog.contact.phone}`}
                          className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
                        >
                          📞 Call: {dog.contact.phone}
                        </a>
                      )}
                      {dog.contact.email && (
                        <a
                          href={`mailto:${dog.contact.email}?subject=Interested in adopting ${dog.name}`}
                          className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
                        >                          ✉️ Email:{dog.contact.email}                        </a>
                      )}

                      {/* Petfinder verification link - required for legal compliance */}
                      {dog.url && (
                        <a
                          href={dog.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg text-center transition border border-gray-300"
                        >
                          ✅ Verified on Petfinder
                        </a>
                      )}

                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-gray-600 mb-2">
                      Contact information not available through our system.
                    </p>
                    <p className="text-sm text-gray-500">
                      Try searching for "{dog.name}" on adoption websites or contact local shelters near {dog.contact?.address?.city}, {dog.contact?.address?.state}.
                    </p>
                  </div>
                )}

                <div className="relative">
                  <button
                    onClick={() => setShowShareOptions(!showShareOptions)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-xl transition"
                  >
                    📤 Share {dog.name}'s Story
                  </button>

                  {showShareOptions && (
                    <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          onClick={shareToX}
                          className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-lg transition"
                        >
                          <img src="/logos/x-logo.png" alt="X" className="w-8 h-8 mb-1" />
                          <span className="text-xs">X</span>
                        </button>
                        <button
                          onClick={shareToFacebook}
                          className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-lg transition"
                        >
                          <img src="/logos/facebook-logo.png" alt="Facebook" className="w-8 h-8 mb-1" />
                          <span className="text-xs">Facebook</span>
                        </button>
                        <button
                          onClick={shareToTelegram}
                          className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-lg transition"
                        >
                          <img src="/logos/telegram-logo.png" alt="Telegram" className="w-8 h-8 mb-1" />
                          <span className="text-xs">Telegram</span>
                        </button>
                        <button
                          onClick={shareToFarcaster}
                          className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-lg transition"
                        >
                          <img 
                            src="/logos/farcaster-logo.png" 
                            alt="Farcaster" 
                            className="w-8 h-8 mb-1"
                            onError={(e) => {
                              console.warn('Farcaster logo failed to load, using fallback');
                              e.currentTarget.style.display = 'none';
                              const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                              if (nextSibling) {
                                nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                          <div className="w-8 h-8 mb-1 bg-purple-600 rounded-lg flex items-center justify-center" style={{display: 'none'}}>
                            <span className="text-white font-bold text-sm">F</span>
                          </div>
                          <span className="text-xs">Farcaster</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">About {dog.name}</h2>
            <div className="text-gray-700">
              {dog.description ? (
                <div className="whitespace-pre-line text-gray-700 leading-relaxed text-base">
                  {dog.description}
                </div>
              ) : (
                <div>
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>🧠 Note from Barkr:</strong> The shelter didn't provide a description for {dog.name}, so I wrote one myself based on what I know about {dog.gender === 'Male' ? 'him' : 'her'}. Someone needs to speak for the forgotten.
                    </p>
                  </div>
                  <div className="whitespace-pre-line text-gray-700 leading-relaxed text-base">
                    {generateBarkrDescription(dog)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dog.contact?.address && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-2">📍 Location</h4>
                  <p className="text-gray-600">
                    {dog.contact.address.address1 && `${dog.contact.address.address1}, `}
                    {dog.contact.address.city}, {dog.contact.address.state} {dog.contact.address.postcode}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-gray-800 mb-2">📞 Contact</h4>
                {dog.contact?.phone && (
                  <p className="text-gray-600">Phone: {dog.contact.phone}</p>
                )}
                {dog.contact?.email && (
                  <p className="text-gray-600">Email: {dog.contact.email}</p>
                )}
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Ready to adopt?</strong> Contact the rescue directly using the information above for the fastest response about {dog.name}.
              </p>
            </div>
          </div>

          {/* Footer */}
          <footer className="text-sm text-center text-gray-500 mt-12 relative">
            <div className="absolute inset-0 bg-[url('/images/pawprints.png')] bg-cover opacity-5" />
            <div className="relative z-10">
              © {new Date().getFullYear()} BarkBase | Powered by Base | Built with ❤️ by Toad Gang
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}