import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

async function signupAndCookie(username: string): Promise<string> {
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

describe('domains', () => {
  beforeEach(resetDb);

  it('anonymous visitor lists domains and sees a created one', async () => {
    const cookie = await signupAndCookie('tracker');
    const created = await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
    });
    expect(created.status).toBe(201);

    const list = await app.request('/api/domains');
    const body = (await list.json()) as { slug: string }[];
    expect(body.some((domain) => domain.slug === 'sports')).toBe(true);
  });

  it('fourth domain creation by same user fails with 429 error', async () => {
    const cookie = await signupAndCookie('tracker');
    for (const slug of ['sports', 'politics', 'shopping']) {
      const response = await app.request('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ slug, name: slug }),
      });
      expect(response.status).toBe(201);
    }
    const fourth = await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'movies', name: 'Movies' }),
    });
    expect(fourth.status).toBe(429);
  });

  it('uppercase slug is rejected with 400 error', async () => {
    const cookie = await signupAndCookie('tracker');
    const response = await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'Sports', name: 'Sports' }),
    });
    expect(response.status).toBe(400);
  });

  it('anonymous domain creation is rejected with 401 error', async () => {
    const response = await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
    });
    expect(response.status).toBe(401);
  });
});
