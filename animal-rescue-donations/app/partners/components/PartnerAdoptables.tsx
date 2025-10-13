'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RescuePartner } from '@/types/partners';

interface Dog {
  id: string;
  name: string;
  age?: string;
  gender?: string;
  size?: string;
  photos?: { medium?: string }[];
  description?: string;
}

export function PartnerAdoptables({ partner }: { partner: RescuePartner }) {
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDogs() {
      if (!partner.petfinder_org_id) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/petfinder/search?organization=${partner.petfinder_org_id}&limit=8`
        );
        
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        setDogs(data.animals || []);
      } catch (error) {
        console.error('Error fetching adoptables:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDogs();
  }, [partner.petfinder_org_id]);

  if (!partner.petfinder_org_id) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Adoptable Dogs</h2>
        <p className="text-sm text-gray-600">
          Start with the ones who've waited the longest • {partner.city}, {partner.state} • Organization ID: {partner.petfinder_org_id}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading adoptable dogs...</p>
        </div>
      ) : dogs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {dogs.map((dog) => (
            <Link
              key={dog.id}
              href={`/adopt/${dog.id}`}
              className="group bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-all duration-200"
            >
              <div className="relative h-40 bg-gray-200">
                <img
                  src={dog.photos?.[0]?.medium || '/images/barkr.png'}
                  alt={dog.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <h3 className="font-bold text-blue-900 group-hover:text-blue-600 transition-colors">
                  {dog.name}
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  {[dog.gender, dog.age, dog.size].filter(Boolean).join(' • ')}
                </p>
                {dog.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                    {dog.description.replace(/<[^>]*>/g, '').substring(0, 80)}...
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600">
          <div className="text-5xl mb-4">🐾</div>
          <p className="text-lg font-semibold mb-2">Adoptable Dogs Coming Soon</p>
          <p className="text-sm">We're working on syncing this rescue's available dogs.</p>
          <p className="text-sm mt-2">In the meantime, you can <a href={`mailto:${partner.email}`} className="text-blue-600 hover:underline">contact them directly</a> to learn about dogs available for adoption.</p>
        </div>
      )}
    </div>
  );
}
