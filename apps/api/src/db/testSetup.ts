import { sql } from 'drizzle-orm';
import { db, pool } from './client';

const TABLES = [
  '"jobs"',
  '"mod_actions"',
  '"reports"',
  '"comment_votes"',
  '"comments"',
  '"votes"',
  '"posts"',
  '"domains"',
  '"session"',
  '"account"',
  '"verification"',
  // "user" is a reserved keyword — must stay quoted
  '"user"',
] as const;

export async function resetDb(): Promise<void> {
  await db.execute(
    sql.raw(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`),
  );
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
