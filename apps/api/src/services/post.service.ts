import type { PostDto } from '@nocap/shared';
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { domains, jobs, posts, user } from '../db/schema';
import { ServiceError } from '../errors';

const WINDOW_DAYS = { day: 1, week: 7 } as const;

interface PostRow {
  id: number;
  domainId: number;
  domainSlug: string;
  author: string;
  title: string;
  body: string | null;
  url: string;
  provider: string | null;
  embed: unknown;
  score: number;
  createdAt: Date;
}

function toDto(row: PostRow): PostDto {
  return {
    id: row.id,
    domainId: row.domainId,
    domainSlug: row.domainSlug,
    author: row.author,
    title: row.title,
    body: row.body,
    url: row.url,
    provider: row.provider,
    embed: row.embed,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
  };
}

const postColumns = {
  id: posts.id,
  domainId: posts.domainId,
  domainSlug: domains.slug,
  // username is nullable in the Better Auth table; name never is
  author: sql<string>`coalesce(${user.username}, ${user.name})`,
  title: posts.title,
  body: posts.body,
  url: posts.url,
  provider: posts.provider,
  embed: posts.embed,
  score: posts.score,
  createdAt: posts.createdAt,
};

export async function createPost(
  userId: number,
  domainSlug: string,
  input: { title: string; body?: string; url: string },
): Promise<PostDto> {
  const title = input.title.trim();
  if (title.length < 5 || title.length > 300) {
    throw new ServiceError(400, 'title must be 5-300 characters');
  }
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new ServiceError(400, 'url must be a valid http or https url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ServiceError(400, 'url must be http or https');
  }

  const domainRows = await db
    .select()
    .from(domains)
    .where(eq(domains.slug, domainSlug))
    .limit(1);
  const domain = domainRows[0];
  if (!domain) throw new ServiceError(404, 'unknown domain');
  if (domain.isLocked) throw new ServiceError(403, 'domain is locked');

  const inserted = await db
    .insert(posts)
    .values({
      domainId: domain.id,
      authorId: userId,
      title,
      body: input.body?.trim() || null,
      url: input.url,
    })
    .returning({ id: posts.id });

  const postId = inserted[0]?.id;
  if (!postId) throw new ServiceError(500, 'post insert failed');

  await db.insert(jobs).values({ type: 'fetch_embed', payload: { postId } });

  return getPost(postId);
}

export async function listPosts(options: {
  domainSlug?: string;
  sort: 'hot' | 'new' | 'top';
  window?: 'day' | 'week' | 'all';
  limit: number;
  offset: number;
}): Promise<PostDto[]> {
  const conditions = [isNull(posts.deletedAt)];
  if (options.domainSlug) {
    conditions.push(eq(domains.slug, options.domainSlug));
  }
  if (options.window && options.window !== 'all') {
    const days = WINDOW_DAYS[options.window];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    conditions.push(gte(posts.createdAt, since));
  }

  const orderBy =
    options.sort === 'new'
      ? desc(posts.createdAt)
      : options.sort === 'top'
        ? desc(posts.score)
        : desc(posts.hotRank);

  const rows = await db
    .select(postColumns)
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(user, eq(user.id, posts.authorId))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(options.limit)
    .offset(options.offset);

  return rows.map(toDto);
}

export async function getPost(postId: number): Promise<PostDto> {
  const rows = await db
    .select(postColumns)
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(user, eq(user.id, posts.authorId))
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new ServiceError(404, 'post not found');
  return toDto(row);
}

export async function listJobsDev(): Promise<
  { id: number; type: string; status: string }[]
> {
  const rows = await db
    .select({ id: jobs.id, type: jobs.type, status: jobs.status })
    .from(jobs)
    .orderBy(desc(jobs.id))
    .limit(50);
  return rows;
}
