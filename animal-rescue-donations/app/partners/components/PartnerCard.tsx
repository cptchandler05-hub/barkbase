import Link from 'next/link';
import type { RescuePartner } from '@/types/partners';

export function PartnerCard({ partner }: { partner: RescuePartner }) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-all duration-300">
      <div className="relative h-48 bg-gray-100">
        <img
          src={partner.logo_url || '/images/barkr.png'}
          alt={`${partner.name} logo`}
          className="w-full h-full object-contain p-4"
          onError={(e) => {
            e.currentTarget.src = '/images/barkr.png';
          }}
        />
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-blue-900 mb-2">{partner.name}</h3>
        <p className="text-sm text-gray-600 mb-3">
          📍 {partner.city}, {partner.state}
          {partner.region && <span className="block text-gray-500">{partner.region}</span>}
        </p>
        <p className="text-sm text-gray-700 mb-4 line-clamp-2">{partner.mission_short}</p>

        {partner.tags && partner.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {partner.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Link
            href={`/partners/${partner.slug}`}
            className="flex-1 text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold"
          >
            View Profile
          </Link>
          <a
            href="/#donate"
            className="flex-1 text-center px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-500 transition-colors duration-200 font-semibold"
          >
            Donate
          </a>
        </div>
      </div>
    </div>
  );
}
