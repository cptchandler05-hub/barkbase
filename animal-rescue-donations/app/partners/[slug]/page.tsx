import { notFound } from 'next/navigation';
import { Share2, Heart } from 'lucide-react';
import { getPartnerBySlug, getPartnerNeeds } from '@/lib/partners';
import { PartnerHeader } from '../components/PartnerHeader';
import { PartnerNeeds } from '../components/PartnerNeeds';
import { PartnerAdoptables } from '../components/PartnerAdoptables';
import { PartnerContact } from '../components/PartnerContact';
import { ShareButton } from '../components/ShareButton';
import Navigation from '../../components/Navigation';

export default async function PartnerProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const partner = await getPartnerBySlug(params.slug);

  if (!partner) {
    notFound();
  }

  const needs = await getPartnerNeeds(partner.id);

  return (
    <div className="min-h-screen pb-12">
      <Navigation />
      <PartnerHeader partner={partner} />

      <div className="container mx-auto px-4 mt-12 max-w-6xl">
        <div className="space-y-8">
          <section className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">About</h2>
            <div className="prose prose-blue max-w-none">
              <p className="text-gray-700 leading-relaxed">
                {partner.mission_long || partner.mission_short}
              </p>
            </div>
          </section>

          <PartnerNeeds needs={needs} />

          <section className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Support This Rescue</h2>
              <p className="text-gray-700">
                Fuel a save in the Delta — cover the unglamorous costs that make new beginnings possible.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/#donate"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-500 transition-colors duration-200 font-bold text-lg shadow-md"
              >
                <Heart className="w-5 h-5" />
                Donate Now
              </a>
              <ShareButton />
            </div>
          </section>

          <PartnerAdoptables partner={partner} />

          <PartnerContact partner={partner} />

          {partner.slug === 'mutt-madness-ms-delta' && (
            <section className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Sources & Verification</h3>
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  • <a href="https://www.petfinder.com/member/us/ms/greenville/mutt-madness-in-the-ms-delta-ms242/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Petfinder Organization Page</a> - Mission, Greenville location, Organization ID MS242
                </p>
                <p>
                  • <a href="https://www.facebook.com/p/Mutt-Madness-in-the-MS-Delta-100071869243589/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Facebook</a> - Small foster-based dog rescue
                </p>
                <p>
                  • <a href="https://www.causeiq.com/organizations/mutt-madness-in-the-ms-delta,814480191/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Cause IQ</a> - 501(c)(3) EIN 81-4480191, Greenville MS, formed 2016
                </p>
                <p>
                  • Mississippi lifesaving context: Best Friends state dashboard and local shelter data
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export const revalidate = 300;
