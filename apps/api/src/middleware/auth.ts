import { parseSessionRole, type SessionUser } from '@nocap/shared';
import type { Context } from 'hono';
import { ServiceError } from '../errors';
import { auth } from '../lib/auth';

export interface AuthEnv {
  Variables: { user: SessionUser | null };
}

export const sessionMiddleware = async (
  c: Context<AuthEnv>,
  next: () => Promise<void>,
): Promise<Response | undefined> => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set(
    'user',
    session
      ? {
          id: Number(session.user.id),
          username: session.user.username ?? session.user.name,
          role: parseSessionRole(session.user.role),
        }
      : null,
  );
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
