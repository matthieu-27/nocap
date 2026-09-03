import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://nocap:your-dev-password@localhost:5432/nocap';

export const pool = postgres(connectionString);
export const db = drizzle(pool, { schema });
