import type { ReportReason } from '@nocap/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  comments,
  domains,
  modActions,
  posts,
  reports,
  user,
} from '../db/schema';
import { ServiceError } from '../errors';

const REASONS: ReportReason[] = [
  'spam',
  'harassment',
  'personal_info',
  'illegal',
  'off_domain',
];

export interface ReportView {
  id: number;
  reason: string;
  status: string;
  postId: number | null;
  commentId: number | null;
  reporter: string;
  createdAt: string;
}

export async function createReport(
  reporterId: number,
  input: { postId?: number; commentId?: number; reason: ReportReason },
): Promise<{ id: number; status: string }> {
  if (!REASONS.includes(input.reason)) {
    throw new ServiceError(400, `reason must be one of: ${REASONS.join(', ')}`);
  }
  if ((input.postId !== undefined) === (input.commentId !== undefined)) {
    throw new ServiceError(
      400,
      'exactly one of postId or commentId is required',
    );
  }
  if (input.postId !== undefined) {
    const exists = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .limit(1);
    if (exists.length === 0) throw new ServiceError(404, 'post not found');
  }
  if (input.commentId !== undefined) {
    const exists = await db
      .select({ id: comments.id })
      .from(comments)
      .where(eq(comments.id, input.commentId))
      .limit(1);
    if (exists.length === 0) throw new ServiceError(404, 'comment not found');
  }

  const inserted = await db
    .insert(reports)
    .values({
      reporterId,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
      reason: input.reason,
    })
    .returning({ id: reports.id, status: reports.status });
  const row = inserted[0];
  if (!row) throw new ServiceError(500, 'report insert failed');
  return row;
}

export async function listReports(
  status: 'open' | 'resolved' | 'dismissed',
): Promise<ReportView[]> {
  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      status: reports.status,
      postId: reports.postId,
      commentId: reports.commentId,
      // username is nullable in the Better Auth table; name never is
      reporter: sql<string>`coalesce(${user.username}, ${user.name})`,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(user, eq(user.id, reports.reporterId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function resolveReport(
  modId: number,
  reportId: number,
  decision: 'remove' | 'dismiss',
  reason: string,
): Promise<void> {
  if (reason.trim().length < 3) {
    throw new ServiceError(400, 'reason is required (min 3 characters)');
  }
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);
    const report = rows[0];
    if (!report) throw new ServiceError(404, 'report not found');
    if (report.status !== 'open') {
      throw new ServiceError(409, 'report already resolved');
    }

    if (decision === 'remove') {
      const now = new Date();
      if (report.postId !== null) {
        await tx
          .update(posts)
          .set({ deletedAt: now })
          .where(eq(posts.id, report.postId));
      }
      if (report.commentId !== null) {
        await tx
          .update(comments)
          .set({ deletedAt: now })
          .where(eq(comments.id, report.commentId));
      }
    }

    await tx
      .update(reports)
      .set({ status: decision === 'remove' ? 'resolved' : 'dismissed' })
      .where(eq(reports.id, reportId));

    await tx.insert(modActions).values({
      modId,
      action: decision === 'remove' ? 'remove_content' : 'dismiss_report',
      targetPostId: report.postId,
      targetUserId: null,
      reason,
    });
  });
}

export async function setDomainLock(
  modId: number,
  slug: string,
  locked: boolean,
  reason: string,
): Promise<void> {
  if (reason.trim().length < 3) {
    throw new ServiceError(400, 'reason is required (min 3 characters)');
  }
  const rows = await db
    .select({ id: domains.id })
    .from(domains)
    .where(eq(domains.slug, slug))
    .limit(1);
  if (rows.length === 0) throw new ServiceError(404, 'unknown domain');

  await db
    .update(domains)
    .set({ isLocked: locked })
    .where(eq(domains.slug, slug));
  await db.insert(modActions).values({
    modId,
    action: locked ? 'lock_domain' : 'unlock_domain',
    targetPostId: null,
    targetUserId: null,
    reason,
  });
}
