import type { SessionUser } from '@nocap/shared';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { ServiceError } from '../errors';
import { getUserBySessionToken } from '../services/session.service';

export interface AuthEnv {
  Variables: { user: SessionUser | null };
}

export const sessionMiddleware = async (
  c: Context<AuthEnv>,
  next: () => Promise<void>,
): Promise<Response | undefined> => {
  const token = getCookie(c, 'ct_session');
  c.set('user', token ? await getUserBySessionToken(token) : null);
  await next();
  return undefined;
};

export function requireUser(c: Context<AuthEnv>): SessionUser {
  const user = c.var.user;
  if (!user) throw new ServiceError(401, 'authentication required');
  return user;
}

export function requireRole(
  user: SessionUser,
  roles: SessionUser['role'][],
): void {
  if (!roles.includes(user.role)) {
    throw new ServiceError(403, 'insufficient permissions');
  }
}
