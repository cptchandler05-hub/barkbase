import { createClient } from '@supabase/supabase-js';
import type { RescuePartner, RescueNeed } from '@/types/partners';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

export async function getPartners(): Promise<RescuePartner[]> {
  const { data, error } = await supabase
    .from('rescue_partners')
    .select('*')
    .eq('active', true)
    .order('is_featured', { ascending: false })
    .order('sort_rank', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching partners:', error);
    return [];
  }

  return data || [];
}

export async function getPartnerBySlug(slug: string): Promise<RescuePartner | null> {
  const { data, error } = await supabase
    .from('rescue_partners')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) {
    console.error('Error fetching partner by slug:', error);
    return null;
  }

  return data;
}

export async function getPartnerNeeds(rescueId: string): Promise<RescueNeed[]> {
  const { data, error } = await supabase
    .from('rescue_needs')
    .select('*')
    .eq('rescue_id', rescueId)
    .order('priority', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching partner needs:', error);
    return [];
  }

  return data || [];
}
