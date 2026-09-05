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

describe('user profiles', () => {
  beforeEach(resetDb);

  it('profile lists the author posts and comment count', async () => {
    const alice = await signupCookie('alice');
    await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
    });
    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'Team X threw the final',
        url: 'https://example.com/a',
      }),
    });
    const postId = ((await created.json()) as { id: number }).id;
    await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'adding context' }),
    });

    const response = await app.request('/api/users/alice');
    expect(response.status).toBe(200);
    const profile = (await response.json()) as {
      username: string;
      karma: number;
      posts: { id: number }[];
      commentCount: number;
    };
    expect(profile.username).toBe('alice');
    expect(profile.posts.length).toBe(1);
    expect(profile.commentCount).toBe(1);
  });

  it('unknown username returns 404 error', async () => {
    const response = await app.request('/api/users/ghost');
    expect(response.status).toBe(404);
  });
});
