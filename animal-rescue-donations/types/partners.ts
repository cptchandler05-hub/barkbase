export type RescuePartner = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  region?: string;
  mission_short: string;
  mission_long?: string;
  petfinder_org_id?: string;
  website?: string;
  email?: string;
  phone?: string;
  facebook_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  logo_url?: string;
  banner_url?: string;
  tags?: string[];
  is_featured: boolean;
  sort_rank?: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type RescueNeed = {
  id: string;
  rescue_id: string;
  title: string;
  body: string;
  priority: 1 | 2 | 3;
  updated_at: string;
};
