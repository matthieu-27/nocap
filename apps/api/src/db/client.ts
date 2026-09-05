import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { log } from '../logger';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  log.error('DATABASE_URL is not set; refusing to connect', {
    hint: 'copy apps/api/.env.example to apps/api/.env',
  });
  throw new Error(
    'DATABASE_URL is not set; refusing to connect (see apps/api/.env.example)',
  );
}

export const pool = postgres(connectionString);
export const db = drizzle(pool, { schema });
