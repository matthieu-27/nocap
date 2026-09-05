import type { CommentDto, VoteValue } from '@nocap/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { comments, commentVotes, posts } from '../db/schema';
import { ServiceError } from '../errors';

// Recursive CTE computes the nesting depth so the client gets a flat list
// ordered oldest-first and renders the tree itself.
const TREE_QUERY = (postId: number) => sql`
  WITH RECURSIVE tree AS (
    SELECT c.id, c.post_id, c.parent_id, c.body, c.score, c.created_at,
           0 AS depth, coalesce(u.username, u.name) AS author
    FROM comments c
    JOIN "user" u ON u.id = c.author_id
    WHERE c.post_id = ${postId} AND c.parent_id IS NULL AND c.deleted_at IS NULL
    UNION ALL
    SELECT c2.id, c2.post_id, c2.parent_id, c2.body, c2.score, c2.created_at,
           tree.depth + 1, coalesce(u2.username, u2.name)
    FROM comments c2
    JOIN tree ON c2.parent_id = tree.id
    JOIN "user" u2 ON u2.id = c2.author_id
    WHERE c2.deleted_at IS NULL
  )
  SELECT id, post_id, parent_id, body, score, created_at, depth, author FROM tree
  ORDER BY created_at ASC
`;

export async function createComment(
  userId: number,
  postId: number,
  input: { body: string; parentId?: number },
): Promise<CommentDto> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) {
    throw new ServiceError(400, 'comment body must be 1-4000 characters');
  }
  const postExists = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);
  if (postExists.length === 0) throw new ServiceError(404, 'post not found');

  if (input.parentId !== undefined) {
    const parent = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, input.parentId), eq(comments.postId, postId)))
      .limit(1);
    if (parent.length === 0) {
      throw new ServiceError(400, 'parent comment not on this post');
    }
  }

  const inserted = await db
    .insert(comments)
    .values({
      postId,
      authorId: userId,
      parentId: input.parentId ?? null,
      body,
    })
    .returning({ id: comments.id });

  const commentId = inserted[0]?.id;
  if (!commentId) throw new ServiceError(500, 'comment insert failed');

  const dto = (await listComments(postId)).find(
    (comment) => comment.id === commentId,
  );
  if (!dto) throw new ServiceError(500, 'comment vanished after insert');
  return dto;
}

export async function listComments(postId: number): Promise<CommentDto[]> {
  // postgres-js execute returns untyped RowList; convert field by field
  const rows = await db.execute(TREE_QUERY(postId));
  return rows.map((row) => {
    return {
      id: Number(row.id),
      postId: Number(row.post_id),
      parentId:
        row.parent_id === null || row.parent_id === undefined
          ? null
          : Number(row.parent_id),
      depth: Number(row.depth),
      author: String(row.author),
      body: String(row.body),
      score: Number(row.score),
      createdAt: new Date(String(row.created_at)).toISOString(),
    };
  });
}

export async function voteComment(
  userId: number,
  commentId: number,
  value: VoteValue,
): Promise<{ score: number }> {
  if (value !== 1 && value !== -1 && value !== 0) {
    throw new ServiceError(400, 'value must be 1, -1, or 0');
  }
  const exists = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (exists.length === 0) throw new ServiceError(404, 'comment not found');

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(commentVotes)
      .where(
        and(
          eq(commentVotes.commentId, commentId),
          eq(commentVotes.userId, userId),
        ),
      )
      .limit(1);
    const existing = existingRows[0];
    const previous = existing?.value ?? 0;

    if (value === 0) {
      await tx
        .delete(commentVotes)
        .where(
          and(
            eq(commentVotes.commentId, commentId),
            eq(commentVotes.userId, userId),
          ),
        );
    } else if (existing) {
      await tx
        .update(commentVotes)
        .set({ value })
        .where(
          and(
            eq(commentVotes.commentId, commentId),
            eq(commentVotes.userId, userId),
          ),
        );
    } else {
      await tx.insert(commentVotes).values({ commentId, userId, value });
    }

    const delta = value - previous;
    if (delta !== 0) {
      await tx
        .update(comments)
        .set({ score: sql`${comments.score} + ${delta}` })
        .where(eq(comments.id, commentId));
    }

    const scoreRows = await tx
      .select({ score: comments.score })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    return { score: scoreRows[0]?.score ?? 0 };
  });
}
