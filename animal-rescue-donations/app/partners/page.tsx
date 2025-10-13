'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { PartnerCard } from './components/PartnerCard';
import type { RescuePartner } from '@/types/partners';

export default function PartnersPage() {
  const [partners, setPartners] = useState<RescuePartner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<RescuePartner[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPartners() {
      try {
        const response = await fetch('/api/partners');
        if (!response.ok) throw new Error('Failed to fetch partners');
        const data = await response.json();
        setPartners(data);
        setFilteredPartners(data);
      } catch (error) {
        console.error('Error fetching partners:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPartners();
  }, []);

  useEffect(() => {
    let filtered = [...partners];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.city.toLowerCase().includes(term) ||
          p.state.toLowerCase().includes(term) ||
          p.mission_short.toLowerCase().includes(term) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(term))
      );
    }

    if (selectedTag) {
      filtered = filtered.filter((p) => p.tags?.includes(selectedTag));
    }

    setFilteredPartners(filtered);
  }, [searchTerm, selectedTag, partners]);

  const allTags = Array.from(new Set(partners.flatMap((p) => p.tags || [])));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-yellow-50">
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
                aria-label="Search partners"
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

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600">Loading rescue partners...</p>
            </div>
          ) : filteredPartners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPartners.map((partner) => (
                <PartnerCard key={partner.id} partner={partner} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-gray-200">
              <p className="text-gray-600">No partners found matching your search.</p>
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
    </div>
  );
}
