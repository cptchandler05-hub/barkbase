"use client";

import { useState, useEffect, useRef } from "react";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { motion } from "framer-motion";
import { getAllDogs, searchDogs } from '@/lib/supabase';
import { getRandomRuralZip } from '@/lib/utils';
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";

interface Dog {
  id: string;
  name: string;
  breeds: { primary: string; mixed: boolean, secondary?:string };
  age: string;
  size: string;
  photos: { medium: string, large?: string, small?: string }[];
  contact: { address: { city: string; state: string }, email?: string, phone?: string };
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
        // Fallback to load 10 dogs initially
        loadInitialDogs();
      }
    } else {
      // No saved state, load initial 10 dogs
      loadInitialDogs();
    }
  }, []);

  const loadInitialDogs = async () => {
    setLoading(true);
    try {
      console.log("Loading most overlooked dogs from entire database...");
      // Use the dedicated invisible dogs API endpoint to get top 100 dogs
      const response = await fetch('/api/invisible-dogs', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Invisible dogs API response:", data);
        
        if (data.dogs && data.dogs.length > 0) {
          console.log("Using invisible dogs from API:", data.dogs.length);
          console.log("Top 5 scores:", data.dogs.slice(0, 5).map(d => `${d.name}: ${d.visibilityScore}`));
          setDogs(data.dogs);
          return;
        } else {
          console.log("No dogs returned from invisible dogs API");
        }
      } else {
        console.error("Invisible dogs API failed:", response.status, response.statusText);
      }
      
      // Fallback to getAllDogs if API fails
      console.log("Falling back to getAllDogs");
      const dbDogs = await getAllDogs(100);
      console.log("Loaded dogs from fallback:", dbDogs?.length || 0);
      if (dbDogs && dbDogs.length > 0) {
        setDogs(dbDogs);
      }
    } catch (error) {
      console.error("Error loading most overlooked dogs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Scroll to results when page changes
  useEffect(() => {
    if (currentPage > 1 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  }, [currentPage]);

  

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

      // If no location provided, search database directly with size/age/breed filters
      if (!effectiveLocation) {
        console.log("No location provided, searching database with filters");

        try {
          // Get a larger pool of dogs from database for filtering
          let allDbDogs = await getAllDogs(500); // Get more dogs for better filtering
          console.log("Fetched dogs from database for filtering:", allDbDogs?.length || 0);

          if (allDbDogs && allDbDogs.length > 0) {
            // Filter out any dogs with null or invalid IDs first
            let filteredDogs = allDbDogs.filter(dog => 
              dog && dog.id && dog.id !== 'null' && dog.id !== 'undefined' && dog.id !== null
            );
            console.log("After ID validation:", filteredDogs.length);

            // Apply size filter
            if (searchSize) {
              filteredDogs = filteredDogs.filter((dog: Dog) => 
                dog.size?.toLowerCase() === searchSize.toLowerCase()
              );
              console.log(`After size filter (${searchSize}):`, filteredDogs.length);
            }

            // Apply age filter - handle "Baby" mapping to "Puppy"
            if (searchAge) {
              const normalizedSearchAge = searchAge.toLowerCase();
              filteredDogs = filteredDogs.filter((dog: Dog) => {
                const dogAge = dog.age?.toLowerCase();
                // Handle puppy/baby mapping
                if (normalizedSearchAge === 'baby' || normalizedSearchAge === 'puppy') {
                  return dogAge === 'baby' || dogAge === 'puppy' || dogAge === 'young';
                }
                return dogAge === normalizedSearchAge;
              });
              console.log(`After age filter (${searchAge}):`, filteredDogs.length);
            }

            // Apply breed filter - improved to handle size searches that might be mistaken for breed
            if (searchBreed) {
              const normalizedBreed = searchBreed.toLowerCase();
              // Don't filter by breed if the search term is actually a size
              const sizes = ['small', 'medium', 'large', 'extra large'];
              if (!sizes.includes(normalizedBreed)) {
                filteredDogs = filteredDogs.filter((dog: Dog) => 
                  dog.breeds?.primary?.toLowerCase().includes(normalizedBreed) ||
                  dog.breeds?.secondary?.toLowerCase().includes(normalizedBreed)
                );
                console.log(`After breed filter (${searchBreed}):`, filteredDogs.length);
              }
            }

            setDogs(filteredDogs);
            console.log(`Using ${filteredDogs.length} filtered dogs from database`);
            return;
          }
        } catch (error) {
          console.error("Database search error:", error);
        }

        // If we reach here, database search failed
        // Use Petfinder to get more dogs, but focus on rural areas for invisible dogs
        console.log("Database search failed, using Petfinder API");
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
          // Filter out any dogs with null or invalid IDs first
          let formattedDogs = dbDogs.filter(dog => 
            dog && dog.id && dog.id !== 'null' && dog.id !== 'undefined' && dog.id !== null
          );

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
          // Filter out any dogs with null or invalid IDs first
          let filteredDogs = data.animals.filter(dog => 
            dog && dog.id && dog.id !== 'null' && dog.id !== 'undefined' && dog.id !== null
          );

          // Filter by size and age if specified
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
                Our visibility algorithm lifts up the dogs at greatest risk of being passed by. These are the most overlooked dogs nationwide, shown in order of urgent need.
              </p>
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
                  <option value="Baby">Puppy/Baby</option>
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
                  ? `Found ${dogs.length} dogs matching your search` 
                  : `${dogs.length} Dogs in the Most Urgent Need`
                }
              </h2>
              <p className="text-gray-600">
                {hasSearched 
                  ? "Results from your search criteria"
                  : "These dogs have the highest invisibility scores and need urgent attention"
                }
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
                {currentDogs.map((dog, index) => {
                  // Create a more robust unique key
                  const uniqueKey = dog.id 
                    ? `dog-${dog.id}` 
                    : `dog-fallback-${index}-${dog.name || 'unknown'}-${dog.breeds?.primary || 'mixed'}-${dog.age || 'unknown'}`;

                  return (
                    <motion.div
                      key={uniqueKey}
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
                      <div className="mt-4 flex items-center gap-2">
                        {dog.contact?.email && (
                          <a
                            href={`mailto:${dog.contact.email}`}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-center text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 focus:ring-4 focus:outline-none focus:ring-blue-300"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 5h-12a2 2 0 00-1.997 2.003z" />
                              <path d="M18 10a2 2 0 00-2-2v10a2 2 0 002-2V10z" />
                            </svg>
                            Email
                          </a>
                        )}
                        {dog.contact?.phone && (
                          <a
                            href={`tel:${dog.contact.phone}`}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-center text-green-700 bg-green-100 rounded-lg hover:bg-green-200 focus:ring-4 focus:outline-none focus:ring-green-300"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7 5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1h1V5zm1 3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H8z" clipRule="evenodd"/>
                            </svg>
                            Phone
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
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
                onClick={() => window.location.reload()}
                className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-lg transition"
              >
                Return to Most Overlooked Dogs
              </button>
            </div>
          )}

          <Footer />
        </div>
      </div>
    </div>
  );
}