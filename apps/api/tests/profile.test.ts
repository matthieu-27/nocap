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
      swag: number;
      postSwag: number;
      commentSwag: number;
      posts: { id: number }[];
      commentCount: number;
    };
    expect(profile.username).toBe('alice');
    expect(profile.swag).toBe(0);
    expect(profile.postSwag).toBe(0);
    expect(profile.commentSwag).toBe(0);
    expect(profile.posts.length).toBe(1);
    expect(profile.commentCount).toBe(1);
  });

  it('unknown username returns 404 error', async () => {
    const response = await app.request('/api/users/ghost');
    expect(response.status).toBe(404);
  });

  it('profile splits swag into post and comment karma', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
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
    const commented = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'adding context' }),
    });
    const commentId = ((await commented.json()) as { id: number }).id;

    await app.request(`/api/posts/${postId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });
    await app.request(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });

    const response = await app.request('/api/users/alice');
    const profile = (await response.json()) as {
      swag: number;
      postSwag: number;
      commentSwag: number;
    };
    expect(profile.postSwag).toBe(1);
    expect(profile.commentSwag).toBe(1);
    expect(profile.swag).toBe(2);
  });

  it('profile shows comment karma without any posts', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
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

    const commented = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ body: 'bob weighs in' }),
    });
    const commentId = ((await commented.json()) as { id: number }).id;

    await app.request(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ value: 1 }),
    });

    const response = await app.request('/api/users/bob');
    const profile = (await response.json()) as {
      swag: number;
      postSwag: number;
      commentSwag: number;
      commentCount: number;
    };
    expect(profile.postSwag).toBe(0);
    expect(profile.commentSwag).toBe(1);
    expect(profile.swag).toBe(1);
    expect(profile.commentCount).toBe(1);
  });
});
