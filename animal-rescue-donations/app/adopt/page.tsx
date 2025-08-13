"use client";

import { useState, useEffect, useRef } from "react";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { motion } from "framer-motion";
import { getAllDogs, searchDogs } from '@/lib/supabase';
import { getRandomRuralZip } from '@/lib/utils';
import Navigation from "@/app/components/Navigation";

interface Dog {
  id: string;
  name: string;
  breeds: { primary: string; mixed: boolean, secondary?:string };
  age: string;
  size: string;
  photos: { medium: string, large?: string, small?: string }[];
  contact: { address: { city: string; state: string } };
  description: string;
  url: string;
  visibilityScore: number;
  gender?: string;
}

export default function AdoptPage() {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLocation, setSearchLocation] = useState("");
  const [searchBreed, setSearchBreed] = useState("");
  const [searchSize, setSearchSize] = useState("");
  const [searchAge, setSearchAge] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const dogsPerPage = 12;
  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-load most invisible dogs on page load, but preserve state if returning from dog page
  useEffect(() => {
    const savedState = sessionStorage.getItem('adoptPageState');

    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        console.log('Restoring saved adoption page state:', state);

        // Restore all state
        setDogs(state.dogs || []);
        setSearchLocation(state.searchLocation || "");
        setSearchBreed(state.searchBreed || "");
        setSearchSize(state.searchSize || "");
        setSearchAge(state.searchAge || "");
        setHasSearched(state.hasSearched || false);
        setCurrentPage(state.currentPage || 1);

        // Clear the saved state after restoring
        sessionStorage.removeItem('adoptPageState');
      } catch (error) {
        console.error('Error restoring adoption page state:', error);
        // Fallback to default behavior
        handleShowMostInvisible();
      }
    } else {
      // No saved state, load default invisible dogs
      handleShowMostInvisible();
    }
  }, []);

  // Scroll to results when page changes
  useEffect(() => {
    if (currentPage > 1 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [currentPage]);

  const handleShowMostInvisible = async () => {
    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      console.log("Fetching most invisible dogs from database...");

      // First try to get dogs from Supabase dogs table
      const dbDogs = await getAllDogs(50); // Get top 50 most invisible
      console.log("Fetched dogs from database:", dbDogs?.length || 0);

      if (dbDogs && dbDogs.length > 0) {
        // Convert database dogs to expected format
        const formattedDogs = dbDogs.map(dog => ({
          id: dog.petfinder_id,
          name: dog.name,
          breeds: { 
            primary: dog.primary_breed, 
            secondary: dog.secondary_breed,
            mixed: dog.is_mixed 
          },
          age: dog.age,
          size: dog.size,
          gender: dog.gender,
          photos: (dog.photos && Array.isArray(dog.photos) && dog.photos.length > 0) 
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
            : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' }],
          contact: { 
            address: { 
              city: dog.city || 'Unknown', 
              state: dog.state || 'Unknown'
            }
          },
          description: dog.description,
          url: dog.url,
          visibilityScore: dog.visibility_score
        }));

        setDogs(formattedDogs);
        setLoading(false);
        return;
      }

      // Fallback to Petfinder API for most invisible dogs
      console.log("No dogs in database, falling back to Petfinder API");
      const res = await fetch('/api/invisible-dogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        // Extract dogs from the markdown content - this is a simplified approach
        setDogs([]); // For now, show empty as the API returns markdown
      }
    } catch (error) {
      console.error("Error fetching invisible dogs:", error);

      // Final fallback - fetch some dogs from Petfinder
      try {
        console.log("Final fallback: fetching from Petfinder search API");
        const res = await fetch('/api/petfinder/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            location: "10001", // Default to NYC area
            breed: "" 
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.animals) {
            setDogs(data.animals.slice(0, 20)); // Limit to 20 dogs
          }
        }
      } catch (fallbackError) {
        console.error("Fallback search failed:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDogsFromRuralArea = async () => {
    try {
      const res = await fetch("/api/petfinder/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "", // Will use getRandomRuralZip() on backend
          breed: ""
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.animals) {
          setDogs(data.animals);
        }
      }
    } catch (error) {
      console.error("Error fetching rural dogs:", error);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      let effectiveLocation = searchLocation.trim();

      // If no location provided, check database first for invisible dogs
      if (!effectiveLocation) {
        console.log("No location provided, checking database for invisible dogs first");

        try {
          // Check database for most invisible dogs first
          console.log("Fetching most invisible dogs from database...");
          const invisibleResponse = await fetch('/api/invisible-dogs', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });

          if (invisibleResponse.ok) {
            const invisibleData = await invisibleResponse.json();
            console.log("Fetched dogs from database:", invisibleData.dogs?.length || 0);

            if (invisibleData.dogs && invisibleData.dogs.length >= 20) {
              // We have enough dogs from database, filter by additional criteria
              let filteredDogs = invisibleData.dogs;

              if (searchSize) {
                filteredDogs = filteredDogs.filter((dog: Dog) => 
                  dog.size?.toLowerCase() === searchSize.toLowerCase()
                );
              }

              if (searchAge) {
                filteredDogs = filteredDogs.filter((dog: Dog) => 
                  dog.age?.toLowerCase() === searchAge.toLowerCase()
                );
              }

              if (searchBreed) {
                filteredDogs = filteredDogs.filter((dog: Dog) => 
                  dog.breeds?.primary?.toLowerCase().includes(searchBreed.toLowerCase()) ||
                  dog.breeds?.secondary?.toLowerCase().includes(searchBreed.toLowerCase())
                );
              }

              setDogs(filteredDogs);
              console.log(`Using ${filteredDogs.length} filtered invisible dogs from database`);
              return;
            } else {
              console.log(`Only ${invisibleData.dogs?.length || 0} dogs in database, supplementing with Petfinder`);
              // Continue to Petfinder to get more dogs
            }
          }
        } catch (error) {
          console.error("Database search error:", error);
        }

        // If we reach here, either database had insufficient dogs or failed
        // Use Petfinder to get more dogs, but focus on rural areas for invisible dogs
        console.log("Supplementing with Petfinder API for more invisible dogs");
        effectiveLocation = getRandomRuralZip();
        console.log("Using rural ZIP for Petfinder search:", effectiveLocation);
      }

      console.log("Searching with parameters:", { 
        location: effectiveLocation, 
        breed: searchBreed,
        size: searchSize,
        age: searchAge
      });

      // First try Supabase dogs table with location-based search
      if (effectiveLocation) {
        const dbDogs = await searchDogs(
          effectiveLocation, 
          searchBreed.trim() || undefined, 
          100
        );

        if (dbDogs && dbDogs.length > 0) {
          console.log(`Found ${dbDogs.length} dogs in database for location search`);

          // Convert database dogs to expected format
          let formattedDogs = dbDogs.map(dog => ({
            id: dog.petfinder_id,
            name: dog.name,
            breeds: { 
              primary: dog.primary_breed, 
              secondary: dog.secondary_breed,
              mixed: dog.is_mixed 
            },
            age: dog.age,
            size: dog.size,
            gender: dog.gender,
            photos: (dog.photos && Array.isArray(dog.photos) && dog.photos.length > 0) 
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
              : [{ medium: '/images/barkr.png', large: '/images/barkr.png', small: '/images/barkr.png' }],
            contact: { 
              address: { 
                city: dog.city || 'Unknown', 
                state: dog.state || 'Unknown'
              }
            },
            description: dog.description,
            url: dog.url,
            visibilityScore: dog.visibility_score
          }));

          // Apply additional filters
          if (searchSize) {
            formattedDogs = formattedDogs.filter((dog: Dog) => 
              dog.size?.toLowerCase() === searchSize.toLowerCase()
            );
          }

          if (searchAge) {
            formattedDogs = formattedDogs.filter((dog: Dog) => 
              dog.age?.toLowerCase() === searchAge.toLowerCase()
            );
          }

          setDogs(formattedDogs);
          setLoading(false);
          return;
        }
      }

      // Fallback to Petfinder API if no dogs in database
      console.log("No dogs found in database, falling back to Petfinder API");

      const res = await fetch('/api/petfinder/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          location: effectiveLocation,
          breed: searchBreed.trim() || null
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.animals) {
          // Filter by size and age if specified
          let filteredDogs = data.animals;

          if (searchSize) {
            filteredDogs = filteredDogs.filter((dog: Dog) => 
              dog.size?.toLowerCase() === searchSize.toLowerCase()
            );
          }

          if (searchAge) {
            filteredDogs = filteredDogs.filter((dog: Dog) => 
              dog.age?.toLowerCase() === searchAge.toLowerCase()
            );
          }

          setDogs(filteredDogs);
        }
      } else {
        const errorData = await res.json();
        if (errorData.invalidLocation) {
          alert("Location not found. Please try a different ZIP code or City, State format.");
        } else {
          alert("Search failed. Please try again.");
        }
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed. Please try again.");
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

  // Pagination
  const indexOfLastDog = currentPage * dogsPerPage;
  const indexOfFirstDog = indexOfLastDog - dogsPerPage;
  const currentDogs = dogs.slice(indexOfFirstDog, indexOfLastDog);
  const totalPages = Math.ceil(dogs.length / dogsPerPage);

  return (
    <div className="min-h-screen w-full font-sans text-gray-800">
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 pt-6 pb-6">
          <Navigation />

          {/* Hero Section */}
          <div className="text-center mb-12 relative">
            <div className="absolute inset-0 bg-[url('/images/pawprints.png')] bg-cover opacity-5" />
            <div className="relative z-10 max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold text-blue-900 mb-4">
                Every dog deserves to be seen.
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8">
                Our visibility algorithm lifts up the dogs at greatest risk of being passed by. This is adoption, rebalanced.
              </p>
              <div className="relative inline-block">
                <button
                  onClick={handleShowMostInvisible}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg px-8 py-4 rounded-full transition transform hover:scale-105 shadow-lg disabled:opacity-50"
                >
                  {loading ? "Finding the Invisible..." : "👻 Show Me the Most Invisible"}
                </button>
                {showTooltip && (
                  <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg whitespace-nowrap z-20">
                    "These aren't trending. These are forgotten. That's why they're here."
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search & Filter Panel */}
          <div className="bg-white shadow-xl rounded-2xl p-6 mb-8 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location *
                </label>
                <input
                  type="text"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  placeholder="ZIP or City, State"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Breed (Optional)
                </label>
                <input
                  type="text"
                  value={searchBreed}
                  onChange={(e) => setSearchBreed(e.target.value)}
                  placeholder="Any breed"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size
                </label>
                <select
                  value={searchSize}
                  onChange={(e) => setSearchSize(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Any Size</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                  <option value="Extra Large">Extra Large</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age
                </label>
                <select
                  value={searchAge}
                  onChange={(e) => setSearchAge(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">Any Age</option>
                  <option value="Baby">Puppy</option>
                  <option value="Young">Young</option>
                  <option value="Adult">Adult</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>

              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              📍 If you don't enter a location, we'll search rural areas where help is needed most.
            </p>
          </div>

          {/* Results Header */}
          {dogs.length > 0 && (
            <div ref={resultsRef} className="mb-6">
              <h2 className="text-2xl font-bold text-blue-900 mb-2">
                {hasSearched 
                  ? `Found ${dogs.length} overlooked dogs` 
                  : `${dogs.length} most invisible dogs from rural areas`
                }
              </h2>
              <p className="text-gray-600">
                Sorted by visibility score (highest = most overlooked)
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <img
                src="/images/spinner-paw.svg"
                alt="Loading..."
                className="animate-spin h-12 w-12 opacity-70"
              />
              <span className="ml-4 text-lg text-gray-600">Finding the most overlooked dogs...</span>
            </div>
          )}

          {/* Dog Grid */}
          {!loading && currentDogs.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {currentDogs.map((dog, index) => (
                  <motion.div
                    key={dog.id || `dog-${index}-${dog.name || 'unknown'}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-all duration-300"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={dog.photos?.[0]?.medium || "/images/barkr.png"}
                        alt={dog.name}
                        className="w-full h-48 object-cover object-center"
                        style={{ objectPosition: 'center 30%' }}
                      />
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${getVisibilityBadgeColor(dog.visibilityScore)}`}>
                        Score: {dog.visibilityScore}
                      </div>
                      <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-semibold ${getVisibilityBadgeColor(dog.visibilityScore)}`}>
                        {getVisibilityLabel(dog.visibilityScore)}
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="text-lg font-bold text-blue-900 mb-1">{dog.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        {dog.age} • {dog.size} • {dog.breeds?.primary || "Mixed"}
                      </p>
                      <p className="text-sm text-gray-500 mb-3">
                        📍 {dog.contact?.address?.city}, {dog.contact?.address?.state}
                      </p>

                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-3">
                        <p className="text-xs italic text-yellow-800">
                          "{getBarkrLine(dog.name, dog.visibilityScore)}"
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={`/adopt/${dog.id}`}
                          onClick={() => {
                            // Save current state before navigation
                            const stateToSave = {
                              dogs,
                              searchLocation,
                              searchBreed,
                              searchSize,
                              searchAge,
                              hasSearched,
                              currentPage
                            };
                            sessionStorage.setItem('adoptPageState', JSON.stringify(stateToSave));
                          }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg text-center transition"
                        >
                          View {dog.name}
                        </a>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const barkbaseUrl = `${window.location.origin}/adopt/${dog.id}`;
                              const url = `https://x.com/intent/tweet?text=${encodeURIComponent(`${dog.name} needs a home! This ${dog.breeds?.primary || 'dog'} has been waiting too long. Help spread the word! 🐾`)}&url=${encodeURIComponent(barkbaseUrl)}`;
                              window.open(url, '_blank');
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            title={`Share ${dog.name} on X`}
                          >
                            <img src="/logos/x-logo.png" alt="X" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const barkbaseUrl = `${window.location.origin}/adopt/${dog.id}`;
                              const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(barkbaseUrl)}`;
                              window.open(url, '_blank');
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            title={`Share ${dog.name} on Facebook`}
                          >
                            <img src="/logos/facebook-logo.png" alt="Facebook" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const barkbaseUrl = `${window.location.origin}/adopt/${dog.id}`;
                              const text = `${dog.name} needs a home! Help spread the word! 🐾`;
                              const url = `https://t.me/share/url?url=${encodeURIComponent(barkbaseUrl)}&text=${encodeURIComponent(text)}`;
                              window.open(url, '_blank');
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            title={`Share ${dog.name} on Telegram`}
                          >
                            <img src="/logos/telegram-logo.png" alt="Telegram" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              const barkbaseUrl = `${window.location.origin}/adopt/${dog.id}`;
                              const text = `${dog.name} needs a home! This ${dog.breeds?.primary || 'dog'} has been waiting too long. Help spread the word! 🐾`;
                              const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text + ' ' + barkbaseUrl)}`;
                              window.open(url, '_blank');
                            }}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            title={`Share ${dog.name} on Farcaster`}
                          >
                            <img 
                              src="/logos/farcaster-logo.png" 
                              alt="Farcaster" 
                              className="w-4 h-4"
                              onError={(e) => {
                                console.warn('Farcaster logo failed to load, using fallback');
                                e.currentTarget.style.display = 'none';
                                const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                                if (nextSibling) {
                                  nextSibling.style.display = 'flex';
                                }
                              }}
                            />
                            <div 
                              className="w-4 h-4 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                              style={{display: 'none'}}
                            >
                              F
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mb-8">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded-lg transition"
                  >
                    Previous
                  </button>

                  <span className="px-4 py-2 text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded-lg transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {/* No Results */}
          {!loading && dogs.length === 0 && hasSearched && (
            <div className="text-center py-12">
              <img
                src="/images/barkr.png"
                alt="Barkr"
                className="w-32 h-auto mx-auto mb-4 opacity-70"
              />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No dogs found</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search criteria or search a different location.
              </p>
              <button
                onClick={handleShowMostInvisible}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-lg transition"
              >
                Show Most Invisible Dogs Instead
              </button>
            </div>
          )}

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