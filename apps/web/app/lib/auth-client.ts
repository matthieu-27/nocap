import type { SessionUser } from '@nocap/shared';
import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// baseURL omitted on purpose: the client defaults to same-origin /api/auth,
// which the Vite proxy (dev) / Caddy (prod) forwards to the Hono API.
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

const ROLES = ['user', 'mod', 'admin'] as const;

// Better Auth's user object carries more fields than our SessionUser, and its
// role is a plain string. Narrow both: unknown roles fall back to 'user' so a
// future role value can never leak an unhandled union member into the UI.
// The id arrives as a string even with serial PKs, hence the Number() coercion
// (the API middleware does the same — see apps/api/src/middleware/auth.ts).
export function toSessionUser(
  user: { id: string | number; username: string; role: string } | null,
): SessionUser | null {
  if (!user) return null;
  const knownRole = ROLES.find((role) => role === user.role);
  return {
    id: Number(user.id),
    username: user.username,
    role: knownRole ?? 'user',
  };
}
