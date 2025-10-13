import { Mail, Phone, Globe, Facebook, Instagram } from 'lucide-react';
import type { RescuePartner } from '@/types/partners';

export function PartnerContact({ partner }: { partner: RescuePartner }) {
  const hasContact = partner.website || partner.email || partner.phone || 
                     partner.facebook_url || partner.instagram_url;

  if (!hasContact) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-blue-900 mb-6">Contact & Connect</h2>

      <div className="space-y-4">
        {partner.website && (
          <a
            href={partner.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors"
          >
            <Globe className="w-5 h-5 text-blue-600" />
            <span className="underline">Visit Website</span>
          </a>
        )}

        {partner.email && (
          <a
            href={`mailto:${partner.email}`}
            className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors"
          >
            <Mail className="w-5 h-5 text-blue-600" />
            <span>{partner.email}</span>
          </a>
        )}

        {partner.phone && (
          <a
            href={`tel:${partner.phone}`}
            className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors"
          >
            <Phone className="w-5 h-5 text-blue-600" />
            <span>{partner.phone}</span>
          </a>
        )}

        {(partner.facebook_url || partner.instagram_url) && (
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            {partner.facebook_url && (
              <a
                href={partner.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-6 h-6" />
                <span className="text-sm">Facebook</span>
              </a>
            )}

            {partner.instagram_url && (
              <a
                href={partner.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-700 hover:text-pink-600 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-6 h-6" />
                <span className="text-sm">Instagram</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
