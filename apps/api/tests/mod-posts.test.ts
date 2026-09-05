import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { user as userTable } from '../src/db/auth-schema';
import { db } from '../src/db/client';
import { resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

async function signupCookie(
  username: string,
  role: 'user' | 'mod' = 'user',
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
  if (role !== 'user') {
    // The admin plugin refuses role as signup input — tests promote
    // with a direct DB write, same as moderation.test.ts.
    const body = (await response.json()) as { user: { id: number } };
    await db
      .update(userTable)
      .set({ role })
      .where(eq(userTable.id, body.user.id));
  }
  return cookie;
}

async function seedDomainAndPost(
  cookie: string,
  slug: string,
  title: string,
): Promise<number> {
  await app.request('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug, name: slug }),
  });
  const response = await app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      domainSlug: slug,
      title,
      url: 'https://example.com/a',
    }),
  });
  return ((await response.json()) as { id: number }).id;
}

async function reportPost(cookie: string, postId: number): Promise<number> {
  const response = await app.request('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ postId, reason: 'spam' }),
  });
  return ((await response.json()) as { id: number }).id;
}

describe('mod posts listing', () => {
  beforeEach(resetDb);

  it('mod listing includes soft-deleted posts with open report counts', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const mod = await signupCookie('modbot', 'mod');
    const postA = await seedDomainAndPost(alice, 'sports', 'Post A stays live');
    const postB = await seedDomainAndPost(
      alice,
      'sports',
      'Post B gets removed',
    );

    await reportPost(bob, postA);
    const reportB = await reportPost(bob, postB);
    const resolved = await app.request(`/api/mod/reports/${reportB}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: mod },
      body: JSON.stringify({ decision: 'remove', reason: 'clear spam' }),
    });
    expect(resolved.status).toBe(204);

    const response = await app.request('/api/mod/posts', {
      headers: { Cookie: mod },
    });
    expect(response.status).toBe(200);
    const posts = (await response.json()) as {
      id: number;
      removedAt: string | null;
      openReports: number;
    }[];
    const rowA = posts.find((post) => post.id === postA);
    const rowB = posts.find((post) => post.id === postB);
    expect(rowA?.removedAt).toBeNull();
    expect(rowA?.openReports).toBe(1);
    expect(typeof rowB?.removedAt).toBe('string');
    expect(rowB?.openReports).toBe(0);
    expect(posts[0]?.id).toBe(postB);
  });

  it('regular user cannot list mod posts and gets 403 error', async () => {
    const alice = await signupCookie('alice');
    const response = await app.request('/api/mod/posts', {
      headers: { Cookie: alice },
    });
    expect(response.status).toBe(403);
  });

  it('anonymous request cannot list mod posts and gets 401 error', async () => {
    const response = await app.request('/api/mod/posts');
    expect(response.status).toBe(401);
  });
});
