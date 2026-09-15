import type { PostDto } from '@nocap/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { domains, posts, user } from '../db/schema';

export interface PostRow {
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

// The canonical post projection: the column list, the joined query every
// post-reading service starts from, and the row→DTO mapping. One definition
// keeps listPosts/getPost/profile listings rendering identical shapes.
export const postColumns = {
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

export function postsJoinedQuery() {
  return db
    .select(postColumns)
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(user, eq(user.id, posts.authorId));
}

export function toDto(row: PostRow): PostDto {
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
