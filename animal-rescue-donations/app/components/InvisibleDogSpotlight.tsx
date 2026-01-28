'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Heart, MapPin, Clock, ArrowRight, Sparkles } from 'lucide-react';

interface Dog {
  id: string;
  name: string;
  primary_breed: string;
  secondary_breed?: string;
  age: string;
  gender: string;
  size: string;
  city: string;
  state: string;
  photos: string[];
  visibility_score: number;
  days_listed?: number;
  special_needs?: boolean;
  description?: string;
}

export default function InvisibleDogSpotlight() {
  const [dog, setDog] = useState<Dog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpotlightDog();
  }, []);

  const fetchSpotlightDog = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dogs/spotlight');
      if (!response.ok) throw new Error('Failed to fetch spotlight dog');
      const data = await response.json();
      setDog(data.dog);
    } catch (err) {
      console.error('Error fetching spotlight dog:', err);
      setError('Unable to load spotlight dog');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl p-8 text-white animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6" />
          <span className="text-lg font-semibold">Invisible Dog Spotlight</span>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-64 h-64 bg-white/20 rounded-2xl"></div>
          <div className="flex-1 space-y-4">
            <div className="h-8 bg-white/20 rounded w-1/2"></div>
            <div className="h-4 bg-white/20 rounded w-3/4"></div>
            <div className="h-4 bg-white/20 rounded w-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dog) {
    return null;
  }

  const photoUrl = dog.photos?.[0] || '/images/barkr.png';
  const breed = dog.secondary_breed 
    ? `${dog.primary_breed} & ${dog.secondary_breed} Mix`
    : dog.primary_breed;

  return (
    <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-3xl p-8 text-white shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-yellow-400 text-purple-900 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
            <Sparkles className="w-4 h-4" />
            Invisible Dog Spotlight
          </div>
          {dog.days_listed && dog.days_listed > 30 && (
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
              Waiting {dog.days_listed} days
            </span>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="relative w-full md:w-72 h-72 flex-shrink-0">
            <img
              src={photoUrl}
              alt={dog.name}
              className="w-full h-full object-cover rounded-2xl shadow-lg"
            />
            {dog.special_needs && (
              <div className="absolute top-2 left-2 bg-pink-500 text-white text-xs px-2 py-1 rounded-full">
                Special Needs
              </div>
            )}
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
              <Heart className="w-3 h-3 text-red-400" fill="currentColor" />
              Visibility Score: {Math.round(dog.visibility_score || 0)}
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-3xl font-bold mb-2">{dog.name}</h3>
            <p className="text-white/80 text-lg mb-3">{breed}</p>
            
            <div className="flex flex-wrap gap-3 mb-4">
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                {dog.age}
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                {dog.gender}
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                {dog.size}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-white/80 mb-4">
              <MapPin className="w-4 h-4" />
              <span>{dog.city}, {dog.state}</span>
            </div>
            
            {dog.description && (
              <p className="text-white/70 text-sm mb-4 line-clamp-2">
                {dog.description}
              </p>
            )}
            
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/adopt/${dog.id}`}
                className="inline-flex items-center gap-2 bg-white text-purple-700 px-6 py-3 rounded-full font-semibold hover:bg-yellow-300 transition-colors"
              >
                Meet {dog.name}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `Meet ${dog.name} - BarkBase`,
                      text: `${dog.name} has been waiting for a home. Help spread the word!`,
                      url: `https://barkbase.xyz/adopt/${dog.id}`,
                    });
                  }
                }}
                className="inline-flex items-center gap-2 bg-white/20 text-white px-6 py-3 rounded-full font-semibold hover:bg-white/30 transition-colors"
              >
                Share
              </button>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-white/20">
          <p className="text-white/60 text-sm italic">
            "Every dog deserves to be seen. {dog.name} has been overlooked—let's change that together."
          </p>
        </div>
      </div>
    </div>
  );
}
