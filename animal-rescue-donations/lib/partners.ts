import { Pool } from 'pg';
import type { RescuePartner, RescueNeed } from '@/types/partners';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getPartners(): Promise<RescuePartner[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM rescue_partners 
       WHERE active = true 
       ORDER BY is_featured DESC, sort_rank ASC, name ASC`
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching partners:', error);
    return [];
  }
}

export async function getPartnerBySlug(slug: string): Promise<RescuePartner | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM rescue_partners 
       WHERE slug = $1 AND active = true 
       LIMIT 1`,
      [slug]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching partner by slug:', error);
    return null;
  }
}

export async function getPartnerNeeds(rescueId: string): Promise<RescueNeed[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM rescue_needs 
       WHERE rescue_id = $1 
       ORDER BY priority ASC, updated_at DESC`,
      [rescueId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching partner needs:', error);
    return [];
  }
}
