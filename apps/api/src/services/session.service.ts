import { createHash, randomUUID } from 'node:crypto';
import type { SessionUser } from '@nocap/shared';
import { eq, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { sessions, users } from '../db/schema';

const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db
    .insert(sessions)
    .values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(
  token: string,
): Promise<SessionUser | null> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role as SessionUser['role'],
  };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
