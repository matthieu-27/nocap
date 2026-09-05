import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { user as userTable } from '../src/db/auth-schema';
import { db } from '../src/db/client';
import { resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

async function signupCookie(
  username: string,
  makeAdmin = false,
): Promise<string> {
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
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  if (makeAdmin) {
    // The admin plugin refuses role as signup input — promote directly.
    const body = (await response.json()) as { user: { id: number } };
    await db
      .update(userTable)
      .set({ role: 'admin' })
      .where(eq(userTable.id, body.user.id));
  }
  return cookie;
}

const json = { 'Content-Type': 'application/json' };

describe('claim tracker journey', () => {
  beforeEach(resetDb);

  it('poster, voter, commenter, reporter, and mod complete one claim lifecycle', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const admin = await signupCookie('admin', true);

    const domain = await app.request('/api/domains', {
      method: 'POST',
      headers: { ...json, Cookie: alice },
      body: JSON.stringify({
        slug: 'sports',
        name: 'Sports',
        description: 'claims about sports',
      }),
    });
    expect(domain.status).toBe(201);

    const post = await app.request('/api/posts', {
      method: 'POST',
      headers: { ...json, Cookie: alice },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'Team X threw the final',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });
    expect(post.status).toBe(201);
    const postId = ((await post.json()) as { id: number }).id;

    const voted = await app.request(`/api/posts/${postId}/vote`, {
      method: 'POST',
      headers: { ...json, Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });
    expect(((await voted.json()) as { score: number }).score).toBe(1);

    const commented = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { ...json, Cookie: bob },
      body: JSON.stringify({
        body: 'footage contradicts the claim at minute four',
      }),
    });
    expect(commented.status).toBe(201);

    const profile = await app.request('/api/users/alice');
    const profileBody = (await profile.json()) as {
      posts: unknown[];
      commentCount: number;
    };
    expect(profileBody.posts.length).toBe(1);

    const flagged = await app.request('/api/reports', {
      method: 'POST',
      headers: { ...json, Cookie: bob },
      body: JSON.stringify({ postId, reason: 'spam' }),
    });
    const reportId = ((await flagged.json()) as { id: number }).id;

    const queue = await app.request('/api/mod/reports', {
      headers: { Cookie: admin },
    });
    const queueBody = (await queue.json()) as { id: number }[];
    expect(queueBody.some((entry) => entry.id === reportId)).toBe(true);

    const resolved = await app.request(`/api/mod/reports/${reportId}/resolve`, {
      method: 'POST',
      headers: { ...json, Cookie: admin },
      body: JSON.stringify({
        decision: 'remove',
        reason: 'spam confirmed by three reports',
      }),
    });
    expect(resolved.status).toBe(204);

    const afterRemoval = await app.request('/api/posts?domain=sports&sort=new');
    const feed = (await afterRemoval.json()) as { id: number }[];
    expect(feed.some((entry) => entry.id === postId)).toBe(false);
  });
});
