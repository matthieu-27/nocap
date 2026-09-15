import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { commentVotes } from '../src/db/schema';
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

describe('comments', () => {
  beforeEach(resetDb);

  it('reply nests under top comment with depth one', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    const top = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'the footage does not support this' }),
    });
    expect(top.status).toBe(201);
    const topId = ((await top.json()) as { id: number }).id;

    const reply = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'watch minute 4 again', parentId: topId }),
    });
    expect(reply.status).toBe(201);

    const list = await app.request(`/api/posts/${postId}/comments`);
    const body = (await list.json()) as {
      id: number;
      depth: number;
      parentId: number | null;
    }[];
    expect(body.length).toBe(2);
    const nested = body.find((comment) => comment.id !== topId);
    expect(nested?.depth).toBe(1);
    expect(nested?.parentId).toBe(topId);
  });

  it('reply to comment of another post fails with 400 error', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postA = await seedPost(alice);
    await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ slug: 'politics', name: 'Politics' }),
    });
    const postB = (await (
      await app.request('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: bob },
        body: JSON.stringify({
          domainSlug: 'politics',
          title: 'Other claim entirely',
          url: 'https://example.com/b',
        }),
      })
    ).json()) as { id: number };

    const onA = await app.request(`/api/posts/${postA}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'first' }),
    });
    const commentA = ((await onA.json()) as { id: number }).id;

    const cross = await app.request(`/api/posts/${postB}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'cross-post reply', parentId: commentA }),
    });
    expect(cross.status).toBe(400);
  });

  it('comment vote increments score and second vote switches it', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postId = await seedPost(alice);

    const created = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'sourcing is weak here' }),
    });
    const commentId = ((await created.json()) as { id: number }).id;

    const first = await app.request(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });
    expect(((await first.json()) as { score: number }).score).toBe(1);

    const switched = await app.request(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: -1 }),
    });
    expect(((await switched.json()) as { score: number }).score).toBe(-1);
  });

  it('comment on a missing post returns 404 error', async () => {
    const alice = await signupCookie('alice');
    const response = await app.request('/api/posts/9999/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'orphan' }),
    });
    expect(response.status).toBe(404);
  });

  it('comment list exposes the viewer own vote', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postId = await seedPost(alice);

    const created = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'sourcing is solid' }),
    });
    const createdComment = (await created.json()) as {
      id: number;
      viewerVote: number | null;
    };
    expect(createdComment.viewerVote).toBeNull();

    await app.request(`/api/comments/${createdComment.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });

    const bobList = await app.request(`/api/posts/${postId}/comments`, {
      headers: { Cookie: bob },
    });
    const bobView = (await bobList.json()) as {
      id: number;
      viewerVote: number | null;
    }[];
    expect(
      bobView.find((comment) => comment.id === createdComment.id)?.viewerVote,
    ).toBe(1);

    const anonymousList = await app.request(`/api/posts/${postId}/comments`);
    const anonymousView = (await anonymousList.json()) as {
      id: number;
      viewerVote?: number | null;
    }[];
    expect(
      anonymousView.find((comment) => comment.id === createdComment.id)
        ?.viewerVote,
    ).toBeUndefined();
  });

  it('a corrupted comment vote row reads as no vote instead of an invalid viewer vote', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postId = await seedPost(alice);

    const created = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'sourcing is solid' }),
    });
    const createdComment = (await created.json()) as { id: number };

    await app.request(`/api/comments/${createdComment.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });
    // Simulate an out-of-range value that bypassed the write path —
    // the read must not trust the smallint column.
    await db
      .update(commentVotes)
      .set({ value: 7 })
      .where(eq(commentVotes.commentId, createdComment.id));

    const bobList = await app.request(`/api/posts/${postId}/comments`, {
      headers: { Cookie: bob },
    });
    const bobView = (await bobList.json()) as {
      id: number;
      viewerVote: number | null;
    }[];
    expect(
      bobView.find((comment) => comment.id === createdComment.id)?.viewerVote,
    ).toBeNull();
  });
});
