import type { SessionUser } from '@nocap/shared';
import { eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { ServiceError } from '../errors';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

function validateSignup(
  username: string,
  email: string,
  password: string,
): void {
  if (!USERNAME_RE.test(username)) {
    throw new ServiceError(
      400,
      'username must be 3-32 chars: letters, digits, underscore',
    );
  }
  if (!EMAIL_RE.test(email)) {
    throw new ServiceError(400, 'invalid email address');
  }
  if (password.length < 10) {
    throw new ServiceError(400, 'password must be at least 10 characters');
  }
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<SessionUser> {
  validateSignup(input.username, input.email, input.password);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, input.username), eq(users.email, input.email)))
    .limit(1);
  if (existing.length > 0) {
    throw new ServiceError(409, 'username or email already taken');
  }

  const passwordHash = await hashPassword(input.password);
  const inserted = await db
    .insert(users)
    .values({ username: input.username, email: input.email, passwordHash })
    .returning({ id: users.id, username: users.username, role: users.role });

  const row = inserted[0];
  if (!row) throw new ServiceError(500, 'user insert failed');
  return {
    id: row.id,
    username: row.username,
    role: row.role as SessionUser['role'],
  };
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const row = rows[0];
  const valid =
    row !== undefined
      ? await verifyPassword(password, row.passwordHash)
      : false;
  if (!row || !valid) {
    throw new ServiceError(401, 'invalid email or password');
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role as SessionUser['role'],
  };
}
