
"use client";

import { useState, useEffect, useRef } from "react";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { motion } from "framer-motion";

interface Dog {
  id: string;
  name: string;
  breeds: { primary: string; mixed: boolean };
  age: string;
  size: string;
  photos: { medium: string }[];
  contact: { address: { city: string; state: string } };
  description: string;
  url: string;
  visibilityScore: number;
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

  // Auto-load most invisible dogs on page load
  useEffect(() => {
    handleShowMostInvisible();
  }, []);

  const handleShowMostInvisible = async () => {
    setLoading(true);
    setHasSearched(false);
    try {
      const res = await fetch("/api/invisible-dogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        // Parse the markdown response to extract dog data
        // For now, we'll fetch from a random rural location
        await fetchDogsFromRuralArea();
      }
    } catch (error) {
      console.error("Error fetching invisible dogs:", error);
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
    if (!searchLocation.trim()) {
      alert("Please enter a location (ZIP code or City, State)");
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const res = await fetch("/api/petfinder/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: searchLocation,
          breed: searchBreed || ""
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
    <div 
      className="min-h-screen w-full font-sans text-gray-800"
      style={{
        backgroundImage: "url('/barkbase-tech-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
      }}
    >
      <div className="min-h-screen bg-white bg-opacity-95">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <header className="flex items-center justify-between mb-8 z-50 relative">
            <a href="/">
              <img
                src="/logos/barkbase-logo.png"
                alt="BarkBase Logo"
                className="w-48 md:w-60 lg:w-72 h-auto cursor-pointer"
              />
            </a>
            <div className="relative z-50">
              <Wallet>
                <ConnectWallet>
                  <Avatar className="h-6 w-6" />
                  <Name />
                </ConnectWallet>
                <WalletDropdown>
                  <Identity className="px-4 pt-3 pb-2">
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownLink icon="wallet" href="https://keys.coinbase.com">
                    Wallet
                  </WalletDropdownLink>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </Wallet>
            </div>
          </header>

          {/* Hero Section */}
          <div className="text-center mb-12 relative">
            <div className="absolute inset-0 bg-[url('/images/pawprints.png')] bg-cover opacity-5" />
            <div className="relative z-10 max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-bold text-blue-900 mb-4">
                Adopt the dog they already scrolled past.
              </h1>
              <p className="text-xl md:text-2xl text-gray-700 mb-8">
                We don't show you the most wanted dogs. We show you the ones who still wait.
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
            <div className="mb-6">
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
                {currentDogs.map((dog) => (
                  <motion.div
                    key={dog.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-all duration-300"
                  >
                    <div className="relative">
                      <img
                        src={dog.photos?.[0]?.medium || "/images/barkr.png"}
                        alt={dog.name}
                        className="w-full h-48 object-cover"
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
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded-lg text-center transition"
                        >
                          View {dog.name}
                        </a>
                        <button
                          onClick={() => {
                            const url = `https://x.com/intent/tweet?text=${encodeURIComponent(`${dog.name} needs a home! This ${dog.breeds?.primary || 'dog'} has been waiting too long. Help spread the word! 🐾`)}&url=${encodeURIComponent(dog.url)}`;
                            window.open(url, '_blank');
                          }}
                          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition"
                          title={`Share ${dog.name}`}
                        >
                          📤
                        </button>
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
