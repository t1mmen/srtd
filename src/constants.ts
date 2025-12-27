export const CONFIG_FILE = 'srtd.config.json';

/**
 * Default PostgreSQL connection string for Supabase local development.
 * Used as fallback when POSTGRES_URL env var is not set.
 * Port 54322 is Supabase CLI's default local PostgreSQL port.
 */
export const DEFAULT_PG_CONNECTION = 'postgresql://postgres:postgres@localhost:54322/postgres';
