import type { SessionUser } from '@nocap/shared';
import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// baseURL omitted on purpose: the client defaults to same-origin /api/auth,
// which the Vite proxy (dev) / Caddy (prod) forwards to the Hono API.
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

const ROLES = ['user', 'mod', 'admin'] as const;

// Better Auth's client session-user type omits `role` and makes `username`
// optional, but the payload carries both — the API reads them the same way
// (apps/api/src/middleware/auth.ts). Accept that raw shape here and narrow it:
// missing or unknown roles fall back to 'user' so a future role value can
// never leak an unhandled union member into the UI. The id arrives as a
// string even with serial PKs, hence the Number() coercion (the API
// middleware does the same).
export function toSessionUser(
  user: {
    id: string | number;
    username?: string | null;
    name: string;
    role?: unknown;
  } | null,
): SessionUser | null {
  if (!user) return null;
  const knownRole =
    typeof user.role === 'string'
      ? ROLES.find((role) => role === user.role)
      : undefined;
  return {
    id: Number(user.id),
    username: user.username ?? user.name,
    role: knownRole ?? 'user',
  };
}
