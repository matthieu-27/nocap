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
    // No admin exists at signup time — the admin plugin refuses
    // role as signup input, so tests promote with a direct DB write.
    const body = (await response.json()) as { user: { id: number } };
    await db
      .update(userTable)
      .set({ role: 'admin' })
      .where(eq(userTable.id, body.user.id));
  }
  return cookie;
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

describe('moderation', () => {
  beforeEach(resetDb);

  it('mod removing a reported post hides it from feeds and logs the action', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const admin = await signupCookie('admin', true);
    const postId = await seedPost(alice);

    const report = await app.request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ postId, reason: 'spam' }),
    });
    expect(report.status).toBe(201);
    const reportId = ((await report.json()) as { id: number }).id;

    const resolved = await app.request(`/api/mod/reports/${reportId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: admin },
      body: JSON.stringify({
        decision: 'remove',
        reason: 'reposted referral spam',
      }),
    });
    expect(resolved.status).toBe(204);

    const detail = await app.request(`/api/posts/${postId}`);
    expect(detail.status).toBe(404);

    const queue = await app.request('/api/mod/reports?status=resolved', {
      headers: { Cookie: admin },
    });
    const queueBody = (await queue.json()) as { id: number; status: string }[];
    expect(
      queueBody.some(
        (entry) => entry.id === reportId && entry.status === 'resolved',
      ),
    ).toBe(true);
  });

  it('regular user cannot open the mod queue and gets 403 error', async () => {
    const alice = await signupCookie('alice');
    const response = await app.request('/api/mod/reports', {
      headers: { Cookie: alice },
    });
    expect(response.status).toBe(403);
  });

  it('locking a domain blocks new posts with 403 error', async () => {
    const alice = await signupCookie('alice');
    const admin = await signupCookie('admin', true);
    await seedPost(alice);

    const lock = await app.request('/api/mod/domains/sports/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: admin },
      body: JSON.stringify({ locked: true, reason: 'spam farm' }),
    });
    expect(lock.status).toBe(204);

    const blocked = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'Another claim',
        url: 'https://example.com/b',
      }),
    });
    expect(blocked.status).toBe(403);
  });

  it('report without target fails with 400 error', async () => {
    const alice = await signupCookie('alice');
    const response = await app.request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(response.status).toBe(400);
  });
});
