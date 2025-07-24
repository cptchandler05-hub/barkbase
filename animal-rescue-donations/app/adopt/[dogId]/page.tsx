
"use client";

import { useState, useEffect } from "react";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownLink, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";

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
  const dogId = params.dogId as string;
  
  const [dog, setDog] = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showShareOptions, setShowShareOptions] = useState(false);

  useEffect(() => {
    if (dogId) {
      fetchDogDetails();
    }
  }, [dogId]);

  const fetchDogDetails = async () => {
    try {
      console.log("Fetching dog details for dogId:", dogId);
      const res = await fetch(`/api/dog/${dogId}`);
      
      if (res.ok) {
        const dog = await res.json();
        console.log("Successfully fetched dog:", dog.name);
        setDog(dog);
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to fetch dog details:", res.status, errorData);
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
          <p className="text-lg text-gray-600">Loading {dogId}'s profile...</p>
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

  return (
    <div className="min-h-screen w-full font-sans text-gray-800">
      <div className="min-h-screen">
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
                  src={dog.photos?.[currentPhotoIndex]?.large || dog.photos?.[currentPhotoIndex]?.medium || "/images/barkr.png"}
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
                        >
                          ✉️ Email: {dog.contact.email}
                        </a>
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
                          <div className="w-8 h-8 mb-1 bg-purple-600 rounded-lg flex items-center justify-center">
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
          {dog.description && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">About {dog.name}</h2>
              <div className="prose max-w-none text-gray-700">
                <div className="whitespace-pre-line text-gray-700 leading-relaxed text-base">
                  {dog.description}
                </div>
              </div>
            </div>
          )}

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
