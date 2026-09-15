import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { createServer, type Server } from 'node:http';
import { isPostEmbed } from '@nocap/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { domains, posts, user } from '../db/schema';
import { resetDb } from '../db/testSetup';
import { createPost, getPost, listJobsDev } from '../services/post.service';
import { linkEmbedFromHtml } from './adapters/link';
import { tiktokEmbedFromOEmbed } from './adapters/tiktok';
import { youtubeEmbedFromOEmbed } from './adapters/youtube';
import { hotRank } from './hot';
import { recomputeHot, runOnce } from './index';

const YOUTUBE_FIXTURE = await Bun.file(
  new URL('./fixtures/youtube-oembed.json', import.meta.url),
).text();
const TIKTOK_FIXTURE = await Bun.file(
  new URL('./fixtures/tiktok-oembed.json', import.meta.url),
).text();
const OG_PAGE = await Bun.file(
  new URL('./fixtures/og-page.html', import.meta.url),
).text();

// Real HTTP on localhost (no mocks): the worker's fetch calls hit this
// server through the same env overrides production uses.
function startFixtureServer(): Promise<{ server: Server; origin: string }> {
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      if (path === '/youtube/oembed' || path === '/tiktok/oembed') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(
          path === '/youtube/oembed' ? YOUTUBE_FIXTURE : TIKTOK_FIXTURE,
        );
        return;
      }
      if (path === '/page') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(OG_PAGE);
        return;
      }
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('fixture server failed to bind a port');
      }
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

let origin = '';
let server: Server | null = null;
const savedEnv: {
  key: 'YOUTUBE_OEMBED_URL' | 'TIKTOK_OEMBED_URL';
  value: string | undefined;
}[] = [];

beforeAll(async () => {
  const started = await startFixtureServer();
  server = started.server;
  origin = started.origin;
  for (const key of ['YOUTUBE_OEMBED_URL', 'TIKTOK_OEMBED_URL'] as const) {
    savedEnv.push({ key, value: process.env[key] });
  }
  process.env.YOUTUBE_OEMBED_URL = `${origin}/youtube/oembed`;
  process.env.TIKTOK_OEMBED_URL = `${origin}/tiktok/oembed`;
});

afterAll(() => {
  for (const { key, value } of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  server?.close();
});

async function seedUser(name: string): Promise<number> {
  const inserted = await db
    .insert(user)
    .values({ name, email: `${name}@example.com` })
    .returning({ id: user.id });
  const row = inserted[0];
  if (!row) throw new Error('user seed failed in test setup');
  return row.id;
}

async function seedChannel(slug: string, ownerId: number): Promise<void> {
  await db.insert(domains).values({ slug, name: slug, createdBy: ownerId });
}

async function seedPost(url: string, ownerId: number): Promise<number> {
  const created = await createPost(ownerId, 'sources', {
    title: 'Source that settles the debate',
    url,
  });
  return created.id;
}

describe('worker runOnce', () => {
  beforeEach(resetDb);

  it('worker drains a queued youtube job into stored provider and embed data', async () => {
    const ownerId = await seedUser('worker1');
    await seedChannel('sources', ownerId);
    const postId = await seedPost('https://youtu.be/dQw4w9WgXcQ', ownerId);

    const result = await runOnce();
    expect(result).toEqual({ processed: 1, failed: 0 });

    const post = await getPost(postId);
    expect(post.provider).toBe('youtube');
    expect(isPostEmbed(post.embed)).toBe(true);
    expect(post.embed).toEqual({
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'Benchmark run goes sideways',
      authorName: 'nocap labs',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    });
    const jobRows = await listJobsDev();
    expect(jobRows[0]?.status).toBe('done');
  });

  it('fails the job and leaves the post untouched when the source 404s', async () => {
    const ownerId = await seedUser('worker2');
    await seedChannel('sources', ownerId);
    const postId = await seedPost(`${origin}/missing-page`, ownerId);

    const result = await runOnce();
    expect(result).toEqual({ processed: 0, failed: 1 });

    const post = await getPost(postId);
    expect(post.provider).toBeNull();
    expect(post.embed).toBeNull();
    const jobRows = await listJobsDev();
    expect(jobRows[0]?.status).toBe('failed');
  });

  it('resolves a generic page into a link embed from og tags', async () => {
    const ownerId = await seedUser('worker3');
    await seedChannel('sources', ownerId);
    const postId = await seedPost(`${origin}/page`, ownerId);

    const result = await runOnce();
    expect(result).toEqual({ processed: 1, failed: 0 });

    const post = await getPost(postId);
    expect(post.provider).toBe('link');
    expect(post.embed).toEqual({
      provider: 'link',
      title: 'Study that debunks it & the legend built on it',
      image: 'https://example.com/assets/og-cover.png',
    });
  });

  it('drains every queued job in one batched runOnce pass', async () => {
    const ownerId = await seedUser('worker4');
    await seedChannel('sources', ownerId);
    await seedPost('https://youtu.be/dQw4w9WgXcQ', ownerId);
    await seedPost(`${origin}/page`, ownerId);
    await seedPost(`${origin}/missing-page`, ownerId);

    const result = await runOnce();
    expect(result).toEqual({ processed: 2, failed: 1 });
    const jobRows = await listJobsDev();
    expect(jobRows).toHaveLength(3);
    for (const job of jobRows) {
      expect(['done', 'failed']).toContain(job.status);
    }
  });
});

describe('recomputeHot', () => {
  beforeEach(resetDb);

  it('recompute rescores stored posts by blending score and post age', async () => {
    const ownerId = await seedUser('voter5');
    await seedChannel('sources', ownerId);
    const postId = await seedPost(`${origin}/page`, ownerId);
    await db.update(posts).set({ score: 10 }).where(eq(posts.id, postId));

    const before = new Date();
    await recomputeHot(before);

    const rows = await db
      .select({ hotRank: posts.hotRank, createdAt: posts.createdAt })
      .from(posts)
      .where(eq(posts.id, postId));
    const row = rows[0];
    if (!row) throw new Error('post vanished during recompute test');
    expect(row.hotRank).toBeCloseTo(hotRank(10, row.createdAt, before), 10);
  });
});

describe('embed adapters against fixtures', () => {
  it('youtube adapter pins the fixture payload into the embed shape', () => {
    expect(
      youtubeEmbedFromOEmbed(JSON.parse(YOUTUBE_FIXTURE), 'dQw4w9WgXcQ'),
    ).toEqual({
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'Benchmark run goes sideways',
      authorName: 'nocap labs',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    });
  });

  it('youtube adapter rejects payloads missing required fields', () => {
    expect(youtubeEmbedFromOEmbed(null, 'dQw4w9WgXcQ')).toBeNull();
    expect(youtubeEmbedFromOEmbed({}, 'dQw4w9WgXcQ')).toBeNull();
    expect(
      youtubeEmbedFromOEmbed({ title: 'x', author_name: 'y' }, 'dQw4w9WgXcQ'),
    ).toBeNull();
  });

  it('tiktok adapter pins the fixture payload into the embed shape', () => {
    expect(
      tiktokEmbedFromOEmbed(JSON.parse(TIKTOK_FIXTURE), '7301234567890123456'),
    ).toEqual({
      provider: 'tiktok',
      videoId: '7301234567890123456',
      title: 'Clip that settles the debate',
      authorName: 'nocap.clips',
      thumbnailUrl: 'https://p19-sign.tiktokcdn.com/fixture-thumb.jpg',
    });
  });

  it('link adapter extracts og title and image from the fixture page', () => {
    expect(linkEmbedFromHtml(OG_PAGE, 'https://example.com/article')).toEqual({
      provider: 'link',
      title: 'Study that debunks it & the legend built on it',
      image: 'https://example.com/assets/og-cover.png',
    });
  });

  it('link adapter falls back to the hostname when og tags are missing', () => {
    expect(
      linkEmbedFromHtml(
        '<html><head></head><body></body></html>',
        'https://example.org/story',
      ),
    ).toEqual({ provider: 'link', title: 'example.org', image: null });
  });

  it('link adapter returns null for an unparsable url', () => {
    expect(linkEmbedFromHtml('<p>x</p>', 'not-a-url')).toBeNull();
  });
});
