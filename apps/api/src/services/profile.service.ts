import type { PostDto, UserProfileDto } from '@nocap/shared';
import { and, count, desc, eq, isNull, sql, sum } from 'drizzle-orm';
import { db } from '../db/client';
import { comments, domains, posts, user } from '../db/schema';
import { ServiceError } from '../errors';

export async function getUserProfile(
  username: string,
): Promise<UserProfileDto> {
  const userRows = await db
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  const row = userRows[0];
  if (!row) throw new ServiceError(404, 'user not found');

  const postRows = await db
    .select({
      id: posts.id,
      domainId: posts.domainId,
      domainSlug: domains.slug,
      author: sql<string>`coalesce(${user.username}, ${user.name})`,
      title: posts.title,
      body: posts.body,
      url: posts.url,
      provider: posts.provider,
      embed: posts.embed,
      score: posts.score,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(user, eq(user.id, posts.authorId))
    .where(and(eq(posts.authorId, row.id), isNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt))
    .limit(25);

  const [postKarma, commentStats] = await Promise.all([
    db
      .select({ value: sum(posts.score) })
      .from(posts)
      .where(and(eq(posts.authorId, row.id), isNull(posts.deletedAt))),
    db
      .select({
        commentCount: count(),
        commentKarma: sum(comments.score),
      })
      .from(comments)
      .where(and(eq(comments.authorId, row.id), isNull(comments.deletedAt))),
  ]);

  // No stored karma column survives the Better Auth swap — compute live until
  // the Plan 2 recount worker owns a persisted value.
  const karma =
    Number(postKarma[0]?.value ?? 0) +
    Number(commentStats[0]?.commentKarma ?? 0);

  const toDto = (post: (typeof postRows)[number]): PostDto => ({
    id: post.id,
    domainId: post.domainId,
    domainSlug: post.domainSlug,
    author: post.author,
    title: post.title,
    body: post.body,
    url: post.url,
    provider: post.provider,
    embed: post.embed,
    score: post.score,
    createdAt: post.createdAt.toISOString(),
  });

  return {
    username: row.username ?? row.name,
    role: row.role ?? 'user',
    karma,
    createdAt: row.createdAt.toISOString(),
    posts: postRows.map(toDto),
    commentCount: commentStats[0]?.commentCount ?? 0,
  };
}
