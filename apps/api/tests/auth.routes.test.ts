import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

async function authRequest(
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

describe('auth routes', () => {
  beforeEach(resetDb);

  it('signup returns session cookie and me endpoint resolves the new user', async () => {
    const signup = await authRequest('/api/auth/signup', {
      username: 'tracker',
      email: 'tracker@example.com',
      password: 'correct-horse-battery',
    });
    expect(signup.status).toBe(201);
    const cookie = signup.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('ct_session=');
    expect(cookie).toContain('HttpOnly');

    const me = await app.request('/api/auth/me', {
      headers: { Cookie: cookie },
    });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { username: string };
    expect(body.username).toBe('tracker');
  });

  it('login with wrong password five times blocks the sixth attempt', async () => {
    await authRequest('/api/auth/signup', {
      username: 'tracker',
      email: 'tracker@example.com',
      password: 'correct-horse-battery',
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      const wrong = await authRequest('/api/auth/login', {
        email: 'tracker@example.com',
        password: 'wrong-password',
      });
      expect(wrong.status).toBe(401);
    }

    const blocked = await authRequest('/api/auth/login', {
      email: 'tracker@example.com',
      password: 'correct-horse-battery',
    });
    expect(blocked.status).toBe(429);
  });

  it('anonymous me request gets rejected with 401 error', async () => {
    const me = await app.request('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('logout returns 204 and clears the session cookie', async () => {
    const signup = await authRequest('/api/auth/signup', {
      username: 'tracker',
      email: 'tracker@example.com',
      password: 'correct-horse-battery',
    });
    const cookie = (signup.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const logout = await authRequest('/api/auth/logout', {}, cookie);
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie') ?? '').toContain('ct_session=');

    const afterLogout = await app.request('/api/auth/me', {
      headers: { Cookie: cookie },
    });
    expect(afterLogout.status).toBe(401);
  });
});
