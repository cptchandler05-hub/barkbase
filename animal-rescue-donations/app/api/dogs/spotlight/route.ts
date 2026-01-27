import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseAvailable } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    if (!isSupabaseAvailable()) {
      console.warn('Spotlight: Supabase not configured - NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing');
      return NextResponse.json({ 
        dog: null, 
        reason: 'database_not_configured' 
      }, { status: 200 });
    }

    const { data, error } = await supabase!
      .from('dogs')
      .select('*')
      .eq('status', 'adoptable')
      .not('visibility_score', 'is', null)
      .order('visibility_score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Spotlight dog fetch error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json({ 
        dog: null, 
        reason: 'database_error' 
      }, { status: 200 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ 
        dog: null, 
        reason: 'no_dogs_available' 
      }, { status: 200 });
    }

    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const spotlightIndex = dayOfYear % data.length;
    
    const dog = data[spotlightIndex];
    
    let photos = dog.photos;
    if (typeof photos === 'string') {
      try {
        photos = JSON.parse(photos);
      } catch {
        photos = [];
      }
    }

    const photoUrls = Array.isArray(photos) 
      ? photos.map((p: any) => typeof p === 'string' ? p : p?.medium || p?.large || p?.small || '')
      : [];

    const createdAt = dog.created_at ? new Date(dog.created_at) : new Date();
    const daysListed = Math.floor((today.getTime() - createdAt.getTime()) / 86400000);
    
    return NextResponse.json({
      dog: {
        id: dog.petfinder_id || dog.rescuegroups_id || dog.id,
        name: dog.name,
        primary_breed: dog.primary_breed,
        secondary_breed: dog.secondary_breed,
        age: dog.age,
        gender: dog.gender,
        size: dog.size,
        city: dog.city,
        state: dog.state,
        photos: photoUrls,
        visibility_score: dog.visibility_score,
        special_needs: dog.special_needs,
        description: dog.description,
        days_listed: daysListed > 0 ? daysListed : 1,
      }
    });
  } catch (error) {
    console.error('Spotlight dog fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spotlight dog' },
      { status: 500 }
    );
  }
}
