import type { ModPostDto, PostDto, VoteValue } from '@nocap/shared';
import { and, count, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { domains, jobs, posts, reports, user, votes } from '../db/schema';
import { ServiceError } from '../errors';
import { postColumns, postsJoinedQuery, toDto } from './postProjection';

const WINDOW_DAYS = { day: 1, week: 7 } as const;
const MOD_POSTS_LIMIT = 200;

// Session-scoped read: merge the viewer's own vote into each post so the
// web can render the vote arrows in their active state. Anonymous callers
// skip the merge — the field stays absent.
async function attachViewerVotes(
  postDtos: PostDto[],
  viewerId: number | null,
): Promise<PostDto[]> {
  if (viewerId === null || postDtos.length === 0) {
    return postDtos;
  }
  const voteRows = await db
    .select({ postId: votes.postId, value: votes.value })
    .from(votes)
    .where(
      and(
        eq(votes.userId, viewerId),
        inArray(
          votes.postId,
          postDtos.map((dto) => dto.id),
        ),
      ),
    );
  // Read-side validation: the write path only stores -1/0/1, but the smallint
  // column cannot enforce that itself, so an out-of-range row degrades to
  // "no vote" instead of leaking into PostDto.
  const byPostId = new Map<number, VoteValue>();
  for (const row of voteRows) {
    if (row.value === 1 || row.value === -1 || row.value === 0) {
      byPostId.set(row.postId, row.value);
    }
  }
  return postDtos.map((dto) => ({
    ...dto,
    viewerVote: byPostId.get(dto.id) ?? null,
  }));
}

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
  viewerId?: number | null;
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

  const rows = await postsJoinedQuery()
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(options.limit)
    .offset(options.offset);

  return attachViewerVotes(rows.map(toDto), options.viewerId ?? null);
}

export async function getPost(
  postId: number,
  viewerId: number | null = null,
): Promise<PostDto> {
  const rows = await postsJoinedQuery()
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new ServiceError(404, 'post not found');
  const [dto] = await attachViewerVotes([toDto(row)], viewerId);
  // attach preserves length; the fallback only satisfies the type checker
  return dto ?? toDto(row);
}

// Mod-facing listing: includes soft-deleted posts and counts open reports.
// The group by must enumerate the joined columns feeding the coalesce
// author template and the domain slug — the posts.id functional
// dependency only covers posts.* columns (else PG raises 42803).
export async function listModPosts(): Promise<ModPostDto[]> {
  const rows = await db
    .select({
      ...postColumns,
      deletedAt: posts.deletedAt,
      openReports: count(reports.id),
    })
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(user, eq(user.id, posts.authorId))
    .leftJoin(
      reports,
      and(eq(reports.postId, posts.id), eq(reports.status, 'open')),
    )
    .groupBy(posts.id, domains.slug, user.username, user.name)
    .orderBy(desc(posts.createdAt))
    .limit(MOD_POSTS_LIMIT);

  return rows.map((row) => ({
    ...toDto(row),
    removedAt: row.deletedAt?.toISOString() ?? null,
    openReports: row.openReports,
  }));
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
