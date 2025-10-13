import type { RescuePartner } from '@/types/partners';

export function PartnerHeader({ partner }: { partner: RescuePartner }) {
  return (
    <div className="relative">
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-blue-100 to-blue-200 overflow-hidden">
        {partner.banner_url ? (
          <img
            src={partner.banner_url}
            alt={`${partner.name} banner`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🐾</div>
              <p className="text-blue-700 font-semibold text-lg">{partner.name}</p>
            </div>
          </div>
        )}
      </div>

      <div className="container mx-auto px-4 -mt-20 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-xl shadow-lg border-4 border-white overflow-hidden">
                <img
                  src={partner.logo_url || '/images/barkr.png'}
                  alt={`${partner.name} logo`}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    e.currentTarget.src = '/images/barkr.png';
                  }}
                />
              </div>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-blue-900 mb-3">{partner.name}</h1>
              <p className="text-lg text-gray-600 mb-4">
                📍 {partner.city}, {partner.state}
                {partner.region && <span className="text-gray-500"> • {partner.region}</span>}
              </p>

              {partner.tags && partner.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {partner.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
