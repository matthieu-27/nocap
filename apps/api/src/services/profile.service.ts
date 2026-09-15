import type { UserProfileDto } from '@nocap/shared';
import { and, count, desc, eq, isNull, sum } from 'drizzle-orm';
import { db } from '../db/client';
import { comments, posts, user } from '../db/schema';
import { ServiceError } from '../errors';
import { postsJoinedQuery, toDto } from './postProjection';

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

  const postRows = await postsJoinedQuery()
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

  const postSwag = Number(postKarma[0]?.value ?? 0);
  const commentSwag = Number(commentStats[0]?.commentKarma ?? 0);
  // No stored swag column survives the Better Auth swap — compute live until
  // the Plan 2 recount worker owns a persisted value.
  const swag = postSwag + commentSwag;

  return {
    username: row.username ?? row.name,
    role: row.role ?? 'user',
    swag,
    postSwag,
    commentSwag,
    createdAt: row.createdAt.toISOString(),
    posts: postRows.map(toDto),
    commentCount: commentStats[0]?.commentCount ?? 0,
  };
}
