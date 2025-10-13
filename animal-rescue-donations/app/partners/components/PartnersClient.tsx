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
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-blue-900 mb-4">
            Rescue Partners
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            Meet the dedicated rescues saving lives in overlooked places. These small,
            foster-based organizations are doing the impossible work of giving forgotten dogs
            a second chance.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, location, or mission..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                  selectedTag === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                    selectedTag === tag
                      ? 'bg-blue-600 text-white'
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
