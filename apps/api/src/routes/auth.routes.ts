import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { ServiceError } from '../errors';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { authenticate, createUser } from '../services/auth.service';
import { createSession, deleteSession } from '../services/session.service';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function loginBlocked(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

function sessionCookie(
  c: Parameters<typeof setCookie>[0],
  token: string,
  expiresAt: Date,
): void {
  setCookie(c, 'ct_session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
}

const auth = new Hono<AuthEnv>();

auth.post('/api/auth/signup', async (c) => {
  const body = (await c.req.json()) as {
    username: string;
    email: string;
    password: string;
  };
  const user = await createUser(body);
  const { token, expiresAt } = await createSession(user.id);
  sessionCookie(c, token, expiresAt);
  return c.json(user, 201);
});

auth.post('/api/auth/login', async (c) => {
  const body = (await c.req.json()) as { email: string; password: string };
  const key = `${body.email}|${c.req.header('x-forwarded-for') ?? 'local'}`;
  if (loginBlocked(key)) {
    throw new ServiceError(
      429,
      'too many login attempts — try again in 15 minutes',
    );
  }
  try {
    const user = await authenticate(body.email, body.password);
    const { token, expiresAt } = await createSession(user.id);
    sessionCookie(c, token, expiresAt);
    return c.json(user);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 401) {
      recordFailure(key);
    }
    throw error;
  }
});

auth.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, 'ct_session');
  if (token) await deleteSession(token);
  deleteCookie(c, 'ct_session', { path: '/' });
  return c.body(null, 204);
});

auth.get('/api/auth/me', (c) => c.json(requireUser(c)));

export default auth;
