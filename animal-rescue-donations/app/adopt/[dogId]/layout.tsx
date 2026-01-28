import type { Metadata } from 'next';

interface DogData {
  id: string;
  name: string;
  primary_breed: string;
  age: string;
  gender: string;
  city: string;
  state: string;
  photos: { medium: string; large: string }[] | string | null;
  description: string;
}

async function getDogData(dogId: string): Promise<DogData | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return null;
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/dogs?petfinder_id=eq.${dogId}&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 3600 }
      }
    );

    if (!response.ok) return null;
    
    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error('Error fetching dog for metadata:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ dogId: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const dog = await getDogData(resolvedParams.dogId);
  
  if (!dog) {
    return {
      title: 'Dog Profile | BarkBase',
      description: 'Find your perfect rescue dog on BarkBase',
    };
  }

  const title = `${dog.name} - ${dog.primary_breed || 'Rescue Dog'} | BarkBase`;
  const description = `Meet ${dog.name}, a ${dog.age?.toLowerCase() || ''} ${dog.gender?.toLowerCase() || ''} ${dog.primary_breed || 'dog'} looking for a forever home in ${dog.city || ''}, ${dog.state || ''}. Help this overlooked pup find their family!`;
  
  let imageUrl = '/images/barkr.png';
  if (dog.photos) {
    try {
      const photos = typeof dog.photos === 'string' ? JSON.parse(dog.photos) : dog.photos;
      if (Array.isArray(photos) && photos.length > 0) {
        imageUrl = photos[0]?.large || photos[0]?.medium || photos[0] || imageUrl;
      }
    } catch {
      imageUrl = '/images/barkr.png';
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${dog.name} - ${dog.primary_breed || 'Rescue Dog'}`,
        },
      ],
      type: 'website',
      siteName: 'BarkBase',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function DogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
