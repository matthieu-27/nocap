import { beforeEach, describe, expect, it } from 'bun:test';
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
});
