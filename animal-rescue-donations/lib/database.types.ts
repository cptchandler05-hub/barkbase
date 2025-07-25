

export interface Dog {
  id: number;
  petfinder_id: string;
  api_source: string;
  organization_id: string;
  url: string;
  name: string;
  type: string;
  species: string;
  primary_breed: string;
  secondary_breed?: string;
  is_mixed: boolean;
  is_unknown_breed: boolean;
  age: string;
  gender: string;
  size: string;
  coat?: string;
  primary_color?: string;
  secondary_color?: string;
  tertiary_color?: string;
  status: string;
  spayed_neutered?: boolean;
  house_trained?: boolean;
  good_with_children?: boolean;
  good_with_dogs?: boolean;
  good_with_cats?: boolean;
  description?: string;
  photos: any[]; // JSON array of photo objects
  tags: string[]; // JSON array of tags
  contact_info: any; // JSON object with contact details
  city: string;
  state: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  visibility_score: number;
  organization_animal_id?: string;
  last_updated_at: string;
  created_at: string;
}

export interface DogSync {
  id: number;
  sync_date: string;
  dogs_added: number;
  dogs_updated: number;
  dogs_removed: number;
  source: 'petfinder' | 'rescuegroups';
  status: 'completed' | 'failed' | 'in_progress';
  error_message?: string;
  created_at: string;
}

