import {
  detectProvider,
  detectTikTokVideoId,
  detectYouTubeVideoId,
  type PostEmbed,
  type ProviderId,
} from '@nocap/shared';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { jobs, posts } from '../db/schema';
import { log } from '../logger';
import { linkEmbedFromHtml } from './adapters/link';
import { tiktokEmbedFromOEmbed } from './adapters/tiktok';
import { youtubeEmbedFromOEmbed } from './adapters/youtube';
import { hotRank } from './hot';

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const HOT_EVERY_MS = Number(process.env.WORKER_HOT_EVERY_MS ?? 60000);
// One worker process by design (student budget). The claim below stays atomic
// even if two ran, but recomputeHot and the embed fetches would double their
// work, so main() holds a PG advisory lock for the process lifetime and a
// second instance exits at startup instead.
const BATCH_CAP = 10;
const HOT_WINDOW_DAYS = 30;
const FETCH_TIMEOUT_MS = 10_000;
// Arbitrary dedicated key for the embed-worker lock (pg_try_advisory_lock
// keys share one namespace with everything else in the database).
const SINGLETON_LOCK_KEY = 628_207_001;

interface ClaimedJob {
  id: number;
  type: string;
  payload: unknown;
}

// Drains up to BATCH_CAP pending jobs. Exported for tests and one-shot runs.
export async function runOnce(): Promise<{
  processed: number;
  failed: number;
}> {
  let processed = 0;
  let failed = 0;
  for (let claimed = 0; claimed < BATCH_CAP; claimed += 1) {
    const job = await claimJob();
    if (job === null) break;
    if ((await processJob(job)) === 'done') {
      processed += 1;
    } else {
      failed += 1;
    }
  }
  return { processed, failed };
}

// Atomic single-row claim: the subselect picks the oldest runnable job and
// the outer UPDATE flips it to running in the same statement, so a job is
// never handed to two ticks (spec §Stack — the jobs table is the v1 queue).
async function claimJob(): Promise<ClaimedJob | null> {
  const rows = await db.execute<{
    id: number;
    type: string;
    payload: unknown;
  }>(sql`
    UPDATE jobs SET status = 'running'
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_at <= now()
      ORDER BY id LIMIT 1
    )
    RETURNING id, type, payload
  `);
  return rows[0] ?? null;
}

async function processJob(job: ClaimedJob): Promise<'done' | 'failed'> {
  if (job.type !== 'fetch_embed') {
    // Unknown types would clog the queue forever — mark done and move on.
    log.warn('skipping unknown job type', { jobId: job.id, type: job.type });
    await db.update(jobs).set({ status: 'done' }).where(eq(jobs.id, job.id));
    return 'done';
  }

  const postId = payloadPostId(job.payload);
  if (postId === null) {
    log.error('fetch_embed payload missing postId', { jobId: job.id });
    await db.update(jobs).set({ status: 'failed' }).where(eq(jobs.id, job.id));
    return 'failed';
  }

  const rows = await db
    .select({ url: posts.url })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  const post = rows[0];
  if (!post) {
    log.error('fetch_embed target post not found', { jobId: job.id, postId });
    await db.update(jobs).set({ status: 'failed' }).where(eq(jobs.id, job.id));
    return 'failed';
  }

  const provider = detectProvider(post.url);
  const embed = await fetchEmbed(provider, post.url);
  if (embed === null) {
    log.error('embed fetch failed; post keeps link-card fallback', {
      jobId: job.id,
      postId,
      provider,
    });
    await db.update(jobs).set({ status: 'failed' }).where(eq(jobs.id, job.id));
    return 'failed';
  }

  await db.update(posts).set({ provider, embed }).where(eq(posts.id, postId));
  await db.update(jobs).set({ status: 'done' }).where(eq(jobs.id, job.id));
  return 'done';
}

function payloadPostId(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as { postId?: unknown }).postId;
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

// Network seam only — every parse lives in the pure adapters so tests pin
// transforms against fixtures and run the loop against a local HTTP server.
async function fetchEmbed(
  provider: ProviderId,
  url: string,
): Promise<PostEmbed | null> {
  if (provider === 'youtube') {
    const videoId = detectYouTubeVideoId(url);
    if (videoId === null) return null;
    const base =
      process.env.YOUTUBE_OEMBED_URL ?? 'https://www.youtube.com/oembed';
    const json = await fetchJson(`${base}?url=${encodeURIComponent(url)}`);
    return json === null ? null : youtubeEmbedFromOEmbed(json, videoId);
  }
  if (provider === 'tiktok') {
    const videoId = detectTikTokVideoId(url);
    if (videoId === null) return null;
    const base =
      process.env.TIKTOK_OEMBED_URL ?? 'https://www.tiktok.com/oembed';
    const json = await fetchJson(`${base}?url=${encodeURIComponent(url)}`);
    return json === null ? null : tiktokEmbedFromOEmbed(json, videoId);
  }
  const html = await fetchText(url);
  return html === null ? null : linkEmbedFromHtml(html, url);
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    // any from response.json() lands in unknown — the pure adapters
    // re-validate every field before the payload reaches a post row
    const json: unknown = await response.json();
    return json;
  } catch (error) {
    log.error('oembed request failed', { url, error: String(error) });
    return null;
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    log.error('page fetch failed', { url, error: String(error) });
    return null;
  }
}

// Recomputes hot_rank over the last 30 days of live posts. hotRank is pure,
// so rows are scored in JS and written in one transaction of single-row
// UPDATEs — fine at v1 scale, revisit if the window grows.
export async function recomputeHot(now: Date = new Date()): Promise<void> {
  const since = new Date(now.getTime() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: posts.id, score: posts.score, createdAt: posts.createdAt })
    .from(posts)
    .where(and(isNull(posts.deletedAt), gt(posts.createdAt, since)));
  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .update(posts)
        .set({ hotRank: hotRank(row.score, row.createdAt, now) })
        .where(eq(posts.id, row.id));
    }
  });
}

// Single-instance guard: pg_try_advisory_lock takes the lock on one pooled
// connection and the pool holds that connection open for the process
// lifetime, so the lock survives until the worker exits. Returns false when
// another worker already holds it.
async function acquireSingletonLock(): Promise<boolean> {
  const rows = await db.execute<{ locked: boolean }>(sql`
    select pg_try_advisory_lock(${SINGLETON_LOCK_KEY}) as locked
  `);
  return rows[0]?.locked === true;
}

// Poll loop — only when run as a process (`bun run worker`); tests import
// runOnce directly and never enter this branch (import.meta.main is false
// under `bun test`).
async function main(): Promise<void> {
  if (!(await acquireSingletonLock())) {
    log.error('another worker holds the advisory lock; exiting', {
      lockKey: SINGLETON_LOCK_KEY,
    });
    process.exitCode = 1;
    return;
  }
  log.info('embed worker started', {
    pollMs: POLL_MS,
    hotEveryMs: HOT_EVERY_MS,
  });
  let lastHot = 0;
  while (true) {
    const result = await runOnce();
    if (result.processed > 0 || result.failed > 0) {
      log.info('embed tick finished', { ...result });
    }
    const nowMs = Date.now();
    if (nowMs - lastHot > HOT_EVERY_MS) {
      await recomputeHot();
      lastHot = nowMs;
      log.info('hot rank recomputed', { windowDays: HOT_WINDOW_DAYS });
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    log.error('worker crashed', { error: String(error) });
    process.exitCode = 1;
  });
}
