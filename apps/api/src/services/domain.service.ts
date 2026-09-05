import type { DomainDto } from '@nocap/shared';
import { count, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { domains } from '../db/schema';
import { ServiceError } from '../errors';

const SLUG_RE = /^[a-z0-9-]{3,32}$/;
const MAX_DOMAINS_PER_USER = 3;

export async function listDomains(): Promise<DomainDto[]> {
  const rows = await db.select().from(domains).orderBy(domains.slug);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isLocked: row.isLocked,
  }));
}

export async function createDomain(
  userId: number,
  input: { slug: string; name: string; description?: string },
): Promise<DomainDto> {
  if (!SLUG_RE.test(input.slug)) {
    throw new ServiceError(
      400,
      'slug must be 3-32 lowercase letters, digits, or hyphens',
    );
  }
  if (input.name.length < 2 || input.name.length > 64) {
    throw new ServiceError(400, 'name must be 2-64 characters');
  }

  const owned = await db
    .select({ value: count() })
    .from(domains)
    .where(eq(domains.createdBy, userId));
  if ((owned[0]?.value ?? 0) >= MAX_DOMAINS_PER_USER) {
    throw new ServiceError(429, 'domain creation limit reached (3 per user)');
  }

  const existing = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.slug, input.slug))
    .limit(1);
  if (existing.length > 0) {
    throw new ServiceError(409, 'slug already taken');
  }

  const inserted = await db
    .insert(domains)
    .values({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      createdBy: userId,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new ServiceError(500, 'domain insert failed');
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isLocked: row.isLocked,
  };
}
