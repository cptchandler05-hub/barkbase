
export interface Dog {
  id: number;
  petfinder_id: string;
  name: string;
  breed_primary: string;
  breed_secondary?: string;
  age: string;
  gender: string;
  size: string;
  location: string;
  organization_id: string;
  description?: string;
  photos: string[]; // JSON array of photo URLs
  status: 'available' | 'adopted' | 'pending' | 'removed';
  visibility_score: number;
  last_updated: string;
  source: 'petfinder' | 'rescuegroups';
  raw_data: any; // JSON object with full API response
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
