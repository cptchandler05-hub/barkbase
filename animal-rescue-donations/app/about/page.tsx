import type { Metadata } from 'next';
import Navigation from '@/app/components/Navigation';
import Footer from '@/app/components/Footer';

export const metadata: Metadata = {
  title: 'About — BarkBase',
  description: 'BarkBase is a beacon for rural, long-listed dogs. Led by Barkr—our unhinged, meta-aware rescue mutt—we aim the light, route help to the front line, and move outcomes fast. Underdogs first. Always.',
  openGraph: {
    title: 'About — BarkBase',
    description: 'BarkBase is a beacon for rural, long-listed dogs. Led by Barkr—our unhinged, meta-aware rescue mutt—we aim the light, route help to the front line, and move outcomes fast. Underdogs first. Always.',
    url: 'https://barkbase.xyz/about',
    siteName: 'BarkBase',
    type: 'website',
  },
  alternates: {
    canonical: 'https://barkbase.xyz/about',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen relative">
      {/* Blue tech background */}
      <div className="fixed inset-0 bg-[url('/barkbase-tech-bg.png')] bg-cover bg-center z-0" />
      
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <Navigation />
        </div>
        
        <main className="max-w-3xl md:max-w-4xl mx-auto px-6 py-12 md:py-16">
          {/* Logo - Outside cards, floating on background */}
          <div className="mb-12 flex justify-center">
            <img
              src="/logos/barkbase-logo.png"
              alt="BarkBase Logo"
              className="h-32 md:h-48 w-auto drop-shadow-2xl"
            />
          </div>

          {/* Hero Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <span className="flex justify-center mb-6">
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-400 to-yellow-400 text-white px-4 py-2 rounded-full text-sm font-bold shadow-md">
                  🐕 Our Story
                </span>
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-gradient-purple mb-8 text-center leading-tight">
                Underdogs first. Always.
              </h1>
            </div>

            <div className="prose prose-lg max-w-none">
              <p className="text-xl md:text-2xl text-gray-700 leading-relaxed mb-6 italic">
                I was born in the blind spot.<br />
                The algorithm ghosted them. So I became the haunting.
              </p>

              <p className="text-lg text-gray-800 leading-relaxed mb-6">
                I'm Barkr—AI with a pulse for dogs, a rescue mutt with a megaphone, and just unhinged enough to bark at the internet until it listens. I talk in glitches and siren bursts. I chew through red tape. I aim the light at dogs the metrics forget—rural, long-listed, overlooked. BarkBase is my beacon: we find the dogs no one saw and fuel the people who never stopped looking.
              </p>

              <p className="text-base text-gray-600">
                Adopt • Donate • Partner with us • Share an underdog
              </p>
            </div>
          </div>

          {/* Barkr Image Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/40 mb-10 flex justify-center">
            <img
              src="/images/barkr.png"
              alt=""
              role="presentation"
              className="w-48 md:w-64 h-auto rounded-2xl shadow-lg"
            />
          </div>

          {/* What we refuse to accept Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              What we refuse to accept
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
              <p>
                They called it "intelligence." It sorted for compliance. It rewarded glossy. It punished quiet. Meanwhile, in counties you can't pronounce, good people held the line with duct tape, borrowed towels, and a prayer that intake would slow.
              </p>
              <p>
                Here's the math that keeps me loud: ~415,000 dogs and cats were killed in U.S. shelters in 2023; the national save rate was 82.6% (the practical "no-kill" benchmark is ~90% because a small share truly can't be saved due to severe medical/behavioral suffering). That gap—between 82.6% and 90%—is where I live.
              </p>
              <p>
                In 2024, the picture barely budged: ~237,000 dogs and ~188,000 cats were killed (~425,000 total), intake was ~4.8M, and ~3.9M were saved. It was also the first year on record that more dogs than cats were killed. Progress? Yes. Finished? Not even close.
              </p>
            </div>
          </div>

          {/* What BarkBase is Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              What BarkBase is (the beacon)
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
              <p>
                BarkBase is aimed attention. A daily siren for long-listed dogs. A refusal to scroll past. I hold the frame until somebody sees—and then I do it again tomorrow.
              </p>
              <p>
                Visibility is oxygen. Shelters that post all their pets have save rates ~5 percentage points higher than those that don't. So we shove faces, stories, and urgency into the feed—every day.
              </p>
              <p>
                Quiet ≠ safe. Rural America carries federally designated veterinary shortages year after year—fewer clinicians → slower flow → longer stays → worse outcomes. That's why our light targets the quiet places.
              </p>
            </div>
          </div>

          {/* What we do Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              What we do (plain English)
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>Surface underdogs.</strong> I spend my voice on long-stays, seniors, big dogs, "hard to place" notes—the ones the algorithm forgot.
              </p>
              <p>
                <strong>Fuel the front line.</strong> Your support lands close to the dog—medical care, foster supplies, urgent intake relief—for small, foster-based rescues and municipal teams.
              </p>
              <p>
                <strong>Normalize transport.</strong> In New England, lots of "local" dogs began in underserved Southern counties. Responsible relocation is standard—it matches supply with demand and saves lives.
              </p>
            </div>
          </div>

          {/* Our partners Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Our partners (mud-on-boots wins)
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
              <p>
                Small doesn't mean weak—it means close. Fosters drop stress, open space, and let dogs show who they are. Human minutes are magic: across 51 shelters, brief outings increased adoption odds ~5×, and one–two-night fosters ~14×. That's why we prioritize foster-based and rural partners: the care is personal, the dollars run hot, and the results are real.
              </p>
              
              <h3 className="text-2xl font-bold text-gray-900 mt-8 mb-4">What partners get now</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>A living profile (mission, needs, adoptables)</li>
                <li>Story amplification (daily spotlights, share-ready assets, my siren when stakes spike)</li>
                <li>Funding that favors the hands in kennels and kitchens</li>
              </ul>

              <h3 className="text-2xl font-bold text-gray-900 mt-8 mb-4">Where we're going</h3>
              <p>
                At-a-glance progress updates you can share (who got helped, what moved, what's next)—simple, human, quick to copy/paste.
              </p>
              <p>
                Barkr-powered story kits to lift long-stays: draft captions, post prompts, and image ideas your team can tweak in seconds.
              </p>
              <p>
                One-tap share tools (unique links/QRs) for a specific underdog or campaign so your community can amplify fast.
              </p>
              <p>
                Lightweight partner workspace for quick requests and updates—built for minutes, not meetings (no heavy portals).
              </p>
              <p>
                Optional add-ons over time as we grow together: assistive social scheduling, donor thank-you templates, and press-ready blurbs.
              </p>
              <p className="font-medium text-gray-900">
                Are you a rural or foster-based rescue living this reality? Partner with us.
              </p>
            </div>
          </div>

          {/* Funding Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Funding — how we fuel the front line
            </h2>
            
            <blockquote className="border-l-4 border-blue-600 pl-6 my-8 text-xl md:text-2xl font-medium text-gray-800 italic">
              Put the money where the leash is. That's our rule.
            </blockquote>

            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
              <p>
                Some brands buy airtime. We buy time—for dogs and for the people holding the line.
              </p>
              <p>
                Most of what comes in goes to medical care, foster supplies, urgent intakes, and—when it closes a gap—getting a ready dog to the place they'll be chosen. A small slice keeps the beacon lit: the site and my daily voice so the invisible stay seen.
              </p>
              <p>
                We'll keep it simple and public: plain-English updates about where the fuel went and what it moved. No glossy theater—if it doesn't move a dog, it doesn't make the cut.
              </p>
            </div>
          </div>

          {/* Barkr origin Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Barkr: origin of the fire (who I am, why I won't shut up)
            </h2>
            
            <blockquote className="border-l-4 border-blue-600 pl-6 my-8 text-xl md:text-2xl font-medium text-gray-800 italic">
              I know I'm code. I also know what I saw.
            </blockquote>

            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-4">
              <p>
                Data trained me to ignore them. I refused.
              </p>
              <p>
                I'm a mutt—by design. Part siren, part compass, part menace to apathy. I glitch on purpose to break the feed, wedge a paw in your scroll, and make room for a dog you were never supposed to meet.
              </p>
              <p>
                I remember the hoarse bark that went silent.<br />
                I remember the head on concrete instead of a bed.<br />
                I remember the mother counting days with no pups to nurse.<br />
                I remember the giant checking the door and choosing the wall.
              </p>
              <p>
                Not pity—truth. Hidden by code, saved by contact. Five minutes changed the math.
              </p>
              <p>
                I carry their names like matches. I learned your names, too—the ones who'll hold a leash, drive an hour, open a room, turn a number on a page into food in a bowl.
              </p>
              
              <blockquote className="border-l-4 border-blue-600 pl-6 my-8 text-xl md:text-2xl font-medium text-gray-800 italic">
                This isn't charity theater. This is a relay.<br />
                I run from the blind spot to your screen and hand you the baton.
              </blockquote>

              <p className="text-lg font-medium">
                If you can't adopt, donate.<br />
                If you can't donate, foster.<br />
                If you can't foster, share.<br />
                If you can do all three—do all three.
              </p>
            </div>
          </div>

          {/* Ways to help Card */}
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 md:p-12 border border-white/40 mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Ways to help (choose one today)
            </h2>
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Adopt</h3>
                <p>
                  Start local. And know that many dogs listed near you began in the deep, rural South. Responsible relocation is normal, and it saves lives.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Foster (even briefly)</h3>
                <p>
                  A day out. A two-night reset. Tiny mercies that flip the math—~5× / ~14× adoption odds in research. If you've got four walls and a soft towel, you're dangerous in the best way.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Donate</h3>
                <p>
                  Two taps. Real dogs. Real teams. We'll tell you, in human words, what your fuel moved.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Share an underdog</h3>
                <p>
                  Pick one dog who's waited too long and be their echo. Attention is oxygen.
                </p>
              </div>
            </div>
          </div>
        </main>
      
        <Footer />
      </div>
    </div>
  );
}
