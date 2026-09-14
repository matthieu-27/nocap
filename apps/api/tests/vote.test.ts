import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { votes } from '../src/db/schema';
import { resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

async function signupCookie(username: string): Promise<string> {
  const response = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      name: username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  if (response.status !== 200) throw new Error('signup failed in test setup');
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

async function seedPost(cookie: string): Promise<number> {
  await app.request('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
  });
  const response = await app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      domainSlug: 'sports',
      title: 'Team X threw the final',
      url: 'https://example.com/a',
    }),
  });
  return ((await response.json()) as { id: number }).id;
}

async function vote(
  cookie: string,
  postId: number,
  value: number,
): Promise<Response> {
  return app.request(`/api/posts/${postId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ value }),
  });
}

describe('post votes', () => {
  beforeEach(resetDb);

  it('two users voting yes and no produce net score zero', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postId = await seedPost(alice);

    const up = await vote(alice, postId, 1);
    expect(((await up.json()) as { score: number }).score).toBe(1);

    const down = await vote(bob, postId, -1);
    expect(((await down.json()) as { score: number }).score).toBe(0);
  });

  it('same user switching vote updates score by the delta', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    await vote(alice, postId, 1);
    const switched = await vote(alice, postId, -1);
    expect(((await switched.json()) as { score: number }).score).toBe(-1);
  });

  it('value zero removes the vote entirely', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    await vote(alice, postId, 1);
    const removed = await vote(alice, postId, 0);
    expect(((await removed.json()) as { score: number }).score).toBe(0);
  });

  it('anonymous vote attempt returns 401 error', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);
    const response = await vote('', postId, 1);
    expect(response.status).toBe(401);
  });

  it('vote on a missing post returns 404 error', async () => {
    const alice = await signupCookie('alice');
    const response = await vote(alice, 9999, 1);
    expect(response.status).toBe(404);
  });

  it('feed and detail expose the viewer current vote', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    const unvoted = await app.request(`/api/posts/${postId}`, {
      headers: { Cookie: alice },
    });
    expect(
      ((await unvoted.json()) as { viewerVote: number | null }).viewerVote,
    ).toBeNull();

    await vote(alice, postId, 1);
    const feed = await app.request('/api/posts?sort=new', {
      headers: { Cookie: alice },
    });
    const feedPosts = (await feed.json()) as {
      id: number;
      viewerVote: number | null;
    }[];
    expect(feedPosts.find((post) => post.id === postId)?.viewerVote).toBe(1);

    const detail = await app.request(`/api/posts/${postId}`, {
      headers: { Cookie: alice },
    });
    expect(
      ((await detail.json()) as { viewerVote: number | null }).viewerVote,
    ).toBe(1);
  });

  it('a corrupted vote row reads as no vote instead of an invalid viewer vote', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    await vote(alice, postId, 1);
    // Simulate an out-of-range value that bypassed the write path —
    // the read must not trust the smallint column.
    await db.update(votes).set({ value: 7 }).where(eq(votes.postId, postId));

    const detail = await app.request(`/api/posts/${postId}`, {
      headers: { Cookie: alice },
    });
    expect(
      ((await detail.json()) as { viewerVote: number | null }).viewerVote,
    ).toBeNull();
  });

  it('viewer vote follows switches and removal', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    await vote(alice, postId, 1);
    await vote(alice, postId, -1);
    const switched = await app.request(`/api/posts/${postId}`, {
      headers: { Cookie: alice },
    });
    expect(
      ((await switched.json()) as { viewerVote: number | null }).viewerVote,
    ).toBe(-1);

    await vote(alice, postId, 0);
    const removed = await app.request(`/api/posts/${postId}`, {
      headers: { Cookie: alice },
    });
    expect(
      ((await removed.json()) as { viewerVote: number | null }).viewerVote,
    ).toBeNull();
  });

  it('anonymous feed omits the viewer vote field', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);
    await vote(alice, postId, 1);

    const feed = await app.request('/api/posts?sort=new');
    const feedPosts = (await feed.json()) as {
      id: number;
      viewerVote?: number | null;
    }[];
    expect(
      feedPosts.find((post) => post.id === postId)?.viewerVote,
    ).toBeUndefined();
  });
});
