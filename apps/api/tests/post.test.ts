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

async function createDomain(cookie: string, slug: string): Promise<void> {
  const response = await app.request('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug, name: slug }),
  });
  if (response.status !== 201)
    throw new Error('domain seed failed in test setup');
}

describe('posts', () => {
  beforeEach(resetDb);

  it('authenticated user creates post and feed lists it under its domain', async () => {
    const cookie = await signupCookie('tracker');
    await createDomain(cookie, 'sports');

    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'Team X threw the final',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });
    expect(created.status).toBe(201);
    const post = (await created.json()) as {
      id: number;
      provider: string | null;
    };
    expect(post.provider).toBeNull();

    const feed = await app.request('/api/posts?domain=sports&sort=new');
    const body = (await feed.json()) as { title: string; domainSlug: string }[];
    expect(body.length).toBe(1);
    expect(body[0]?.domainSlug).toBe('sports');
  });

  it('post creation rejects non-http url with 400 error', async () => {
    const cookie = await signupCookie('tracker');
    await createDomain(cookie, 'sports');
    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'throwaway title',
        url: 'ftp://example.com/x',
      }),
    });
    expect(response.status).toBe(400);
  });

  it('post creation rejects unknown domain slug with 404 error', async () => {
    const cookie = await signupCookie('tracker');
    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        domainSlug: 'nope',
        title: 'throwaway title',
        url: 'https://example.com/a',
      }),
    });
    expect(response.status).toBe(404);
  });

  it('post creation enqueues an embed fetch job', async () => {
    const cookie = await signupCookie('tracker');
    await createDomain(cookie, 'sports');
    await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'throwaway title',
        url: 'https://example.com/a',
      }),
    });
    const jobs = await app.request('/api/dev/jobs');
    const body = (await jobs.json()) as { type: string; status: string }[];
    expect(
      body.some(
        (job) => job.type === 'fetch_embed' && job.status === 'pending',
      ),
    ).toBe(true);
  });

  it('feed rejects an unknown sort value with 400 error', async () => {
    const response = await app.request('/api/posts?sort=controversial');
    expect(response.status).toBe(400);
  });

  it('post detail returns the post for an anonymous visitor', async () => {
    const cookie = await signupCookie('tracker');
    await createDomain(cookie, 'sports');
    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'Team X threw the final',
        url: 'https://example.com/a',
      }),
    });
    const { id } = (await created.json()) as { id: number };

    const detail = await app.request(`/api/posts/${id}`);
    expect(detail.status).toBe(200);
    const body = (await detail.json()) as { id: number; author: string };
    expect(body.id).toBe(id);
    expect(body.author).toBe('tracker');
  });
});
