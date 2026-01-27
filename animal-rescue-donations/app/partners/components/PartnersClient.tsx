'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { PartnerCard } from './PartnerCard';
import type { RescuePartner } from '@/types/partners';

export function PartnersClient({ initialPartners }: { initialPartners: RescuePartner[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const filteredPartners = initialPartners.filter((p) => {
    const matchesSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.mission_short.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTag = !selectedTag || p.tags?.includes(selectedTag);
    
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(initialPartners.flatMap((p) => p.tags || [])));

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="card-gradient-gold p-8 md:p-12 mb-12 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-yellow-200/30 rounded-full blur-3xl"></div>
          <div className="relative z-10 text-center">
            <span className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-4">
              🤝 Our Heroes
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gradient-gold mb-4">
              Rescue Partners
            </h1>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              Meet the dedicated rescues saving lives in overlooked places. Small, foster-based organizations doing impossible work.
            </p>
          </div>
        </div>

        {/* Search Panel */}
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-6 mb-8 border border-yellow-100">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, location, or mission..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-styled pl-10"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  selectedTag === null
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    selectedTag === tag
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredPartners.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPartners.map((partner) => (
              <PartnerCard key={partner.id} partner={partner} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-gray-200">
            <p className="text-gray-600">
              {initialPartners.length === 0 
                ? 'No partners found.' 
                : 'No partners match your search.'}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTag(null);
              }}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
