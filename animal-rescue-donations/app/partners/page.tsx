import { getPartners } from '@/lib/partners';
import { PartnersClient } from './components/PartnersClient';
import Navigation from '../components/Navigation';

export default async function PartnersPage() {
  const partners = await getPartners();

  return (
    <div className="min-h-screen">
      <Navigation />
      <PartnersClient initialPartners={partners} />
    </div>
  );
}
