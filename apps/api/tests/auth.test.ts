import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

async function post(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cookie) headers.Cookie = cookie;
  return app.request(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('better auth endpoints', () => {
  beforeEach(resetDb);

  it('signup returns session cookie and get-session resolves the new user', async () => {
    const signup = await post('/api/auth/sign-up/email', {
      email: 'tracker@example.com',
      password: 'correct-horse-battery',
      name: 'tracker',
      username: 'tracker',
    });
    expect(signup.status).toBe(200);
    const cookie = signup.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('session_token');
    expect(cookie).toContain('HttpOnly');

    const me = await app.request('/api/auth/get-session', {
      headers: { Cookie: cookie },
    });
    expect(me.status).toBe(200);
    const body = (await me.json()) as {
      user: { username: string; email: string; role: string };
    };
    expect(body.user.username).toBe('tracker');
    expect(body.user.role).toBe('user');
  });

  it('anonymous get-session returns null body', async () => {
    const me = await app.request('/api/auth/get-session');
    expect(me.status).toBe(200);
    expect(await me.text()).toBe('null');
  });

  it('duplicate signup email is rejected', async () => {
    const payload = {
      email: 'dupe@example.com',
      password: 'correct-horse-battery',
      name: 'dupe',
      username: 'dupe',
    };
    const first = await post('/api/auth/sign-up/email', payload);
    expect(first.status).toBe(200);
    const second = await post('/api/auth/sign-up/email', payload);
    expect(second.status).toBe(400);
  });

  it('sign-in blocked with 429 after five wrong passwords', async () => {
    await post('/api/auth/sign-up/email', {
      email: 'limited@example.com',
      password: 'correct-horse-battery',
      name: 'limited',
      username: 'limited',
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const wrong = await post('/api/auth/sign-in/email', {
        email: 'limited@example.com',
        password: 'wrong-password',
      });
      expect(wrong.status).toBe(401);
    }

    const blocked = await post('/api/auth/sign-in/email', {
      email: 'limited@example.com',
      password: 'correct-horse-battery',
    });
    expect(blocked.status).toBe(429);
  });
});
