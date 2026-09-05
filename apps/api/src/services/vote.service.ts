import type { VoteValue } from '@nocap/shared';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { posts, votes } from '../db/schema';
import { ServiceError } from '../errors';

export async function votePost(
  userId: number,
  postId: number,
  value: VoteValue,
): Promise<{ score: number }> {
  if (value !== 1 && value !== -1 && value !== 0) {
    throw new ServiceError(400, 'value must be 1, -1, or 0');
  }
  const postExists = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  if (postExists.length === 0) throw new ServiceError(404, 'post not found');

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.postId, postId), eq(votes.userId, userId)))
      .limit(1);
    const existing = existingRows[0];
    const previous = existing?.value ?? 0;

    if (value === 0) {
      await tx
        .delete(votes)
        .where(and(eq(votes.postId, postId), eq(votes.userId, userId)));
    } else if (existing) {
      await tx
        .update(votes)
        .set({ value })
        .where(and(eq(votes.postId, postId), eq(votes.userId, userId)));
    } else {
      await tx.insert(votes).values({ postId, userId, value });
    }

    const delta = value - previous;
    if (delta !== 0) {
      await tx
        .update(posts)
        .set({ score: sql`${posts.score} + ${delta}` })
        .where(eq(posts.id, postId));
    }

    const scoreRows = await tx
      .select({ score: posts.score })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    return { score: scoreRows[0]?.score ?? 0 };
  });
}
