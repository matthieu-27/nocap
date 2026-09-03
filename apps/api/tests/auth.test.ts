import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { user as userTable } from '../src/db/auth-schema';
import { db } from '../src/db/client';
import { resetDb } from '../src/db/testSetup';
import { ServiceError } from '../src/errors';
import { app } from '../src/index';
import {
  type AuthEnv,
  requireRole,
  requireUser,
  sessionMiddleware,
} from '../src/middleware/auth';

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

  it('sign-out invalidates the session cookie', async () => {
    const signup = await post('/api/auth/sign-up/email', {
      email: 'leaver@example.com',
      password: 'correct-horse-battery',
      name: 'leaver',
      username: 'leaver',
    });
    const cookie = (signup.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const out = await post('/api/auth/sign-out', {}, cookie);
    expect(out.status).toBe(200);

    const after = await app.request('/api/auth/get-session', {
      headers: { Cookie: cookie },
    });
    expect(await after.text()).toBe('null');
  });

  it('requireUser and requireRole reject through a mounted test route', async () => {
    const guarded = new Hono<AuthEnv>();
    guarded.onError((err, c) => {
      if (err instanceof ServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: 'internal error' }, 500);
    });
    guarded.use('*', sessionMiddleware);
    guarded.get('/me', (c) => c.json(requireUser(c)));
    guarded.get('/admin-only', (c) => {
      const u = requireUser(c);
      requireRole(u, ['admin']);
      return c.json({ ok: true });
    });

    const anonymous = await guarded.request('/me');
    expect(anonymous.status).toBe(401);

    const signup = await post('/api/auth/sign-up/email', {
      email: 'guard@example.com',
      password: 'correct-horse-battery',
      name: 'guard',
      username: 'guard',
    });
    const cookie = (signup.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const me = await guarded.request('/me', { headers: { Cookie: cookie } });
    expect(me.status).toBe(200);

    const forbidden = await guarded.request('/admin-only', {
      headers: { Cookie: cookie },
    });
    expect(forbidden.status).toBe(403);
  });

  it('admin set-role promotes a user via the admin endpoint', async () => {
    const adminSignup = await post('/api/auth/sign-up/email', {
      email: 'root@example.com',
      password: 'correct-horse-battery',
      name: 'root',
      username: 'root',
    });
    const adminCookie =
      (adminSignup.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    // No admin exists yet, so the first one is seeded with a direct DB write
    // (the admin plugin sets role as input: false — signup cannot grant it).
    const [adminRow] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, 'root@example.com'));
    await db
      .update(userTable)
      .set({ role: 'admin' })
      .where(eq(userTable.id, adminRow.id));

    const target = await post('/api/auth/sign-up/email', {
      email: 'target@example.com',
      password: 'correct-horse-battery',
      name: 'target',
      username: 'target',
    });
    const targetCookie =
      (target.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const [targetRow] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, 'target@example.com'));

    const setRole = await post(
      '/api/auth/admin/set-role',
      { userId: targetRow.id, role: 'mod' },
      adminCookie,
    );
    expect(setRole.status).toBe(200);

    const promoted = await app.request('/api/auth/get-session', {
      headers: { Cookie: targetCookie },
    });
    const body = (await promoted.json()) as { user: { role: string } };
    expect(body.user.role).toBe('mod');
  });
});
