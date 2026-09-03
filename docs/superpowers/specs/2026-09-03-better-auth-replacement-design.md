# Better Auth Replacement — Design Spec

Date: 2026-09-03
Status: approved design, pre-implementation
Supersedes: Tasks 4-5 of `docs/superpowers/plans/2026-09-01-claim-tracker-1-api-core.md` (hand-rolled auth, commits 24e086c, 678ee81)

## Context

Plan 1 Tasks 4-5 shipped hand-rolled auth: `Bun.password` argon2id hashing, opaque session tokens (SHA-256 in DB, `ct_session` cookie), and an in-memory login rate limiter. A fallow review of that changeset surfaced five trade-offs, three rated high-consequence:

1. **Rate-limit key trusts `x-forwarded-for`** (client-controlled header, attacker rotates keys).
2. **Rate-limit state is a module-level Map** — unbounded growth, wiped on restart, single-instance only.
3. **Expired sessions still authenticate** — `getUserBySessionToken` matches token hash without checking `expiresAt`; `purgeExpiredSessions` has no caller.
4. **Signup race** — read-then-insert without unique-violation mapping → 500 under concurrent signups.
5. **Global session middleware** — DB lookup on every cookie-bearing request, including public routes.

Decision: replace the hand-rolled layer with Better Auth rather than patch each item. The library owns each of the five problem areas as a supported feature.

## Decisions (made with the user)

- **Scope**: full replacement of Tasks 4-5 code. Library owns signup/login/logout/session/rate-limit.
- **Worker**: Plan 2's Python worker does not validate user sessions — it talks to the DB directly. Session format stays internal to the API.
- **Password hashing**: library default scrypt (OWASP's recommended fallback; chosen over custom argon2id to keep zero custom code in the library boundary).
- **Email flows**: none for v1. No email verification, no password reset. Both are config additions later, not schema changes.
- **Roles**: Better Auth `admin()` plugin (user choice over a plain additional field). Plugin gives `role`, `banned`, `banReason`, `banExpires` on the user table with `input: false` — roles only settable via admin endpoints, never via signup. Default role `user`; `moderator` works as a plain role string consumed by our `requireRole`.
- **Username**: Better Auth `username()` plugin — keeps our signup's username field, unique-constrained by the library.
- **Client scope**: API only. `auth-client.ts` + React wiring belongs to Plan 2, where it is consumed.
- **IDs**: `advanced.database.generateId: "serial"` — keeps integer primary keys so every domain FK (`posts.userId`, `votes.userId`, …, all `integer`) stays valid against the new `user` table.

## Architecture

```
apps/api/src/
├── lib/auth.ts                  ← NEW: betterAuth() config + drizzleAdapter
├── middleware/auth.ts           ← REWRITTEN: resolves user via auth.api.getSession
├── routes/auth.routes.ts        ← DELETED (library owns /api/auth/*)
├── services/auth.service.ts     ← DELETED
├── services/session.service.ts  ← DELETED
└── index.ts                     ← mounts auth.handler instead of authRoutes
```

What survives unchanged: `AuthEnv`, `requireUser(c)`, `requireRole(user, roles)` signatures and `SessionUser` in `@nocap/shared` (id, username, email, role). Plan Tasks 6-12 consume these interfaces and need no changes.

### `lib/auth.ts`

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { username } from "better-auth/plugins/username";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  plugins: [admin(), username()],
  advanced: { database: { generateId: "serial" } },
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: { "/sign-in/email": { window: 900, max: 5 } },
  },
  session: { expiresIn: 60 * 60 * 24 * 30 }, // 30 days, same as the plan
});
```

Environment: `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL=http://localhost:3001` (dev).

### Mount (`index.ts`)

```ts
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
```

The global `sessionMiddleware` mount stays (`c.var.user` everywhere), but its body becomes `auth.api.getSession({ headers: c.req.raw.headers })`.

## Schema

- Drop our `users` and `sessions` tables.
- Generate Better Auth schema via `npx auth@latest generate --output src/db/auth-schema.ts` (the CLI ships as the `auth` package; no install needed) → tables `user`, `session`, `account`, `verification`, plus admin/username plugin fields.
- Domain tables keep integer FKs, now referencing `user.id` (serial).
- Migrations through existing `db:generate` / `db:migrate` scripts.
- `testSetup.ts` TRUNCATE list: add `account`, `session`, `verification`, `rateLimit`; drop `sessions`; `users` becomes `user`.

`account`/`verification` exist for OAuth and email flows we do not use in v1. Cost: two extra tables. Benefit: email verification and OAuth become config-only additions later.

## How the five fallow trade-offs resolve

| # | Was | Now |
|---|-----|-----|
| 1 | Rate-limit key trusts `x-forwarded-for` | Library keys on request IP + path, DB-backed |
| 2 | In-memory Map, wiped on restart, single-instance | `rateLimit.storage: "database"` |
| 3 | Expired sessions authenticate | Expiry enforced at every session lookup by the library |
| 4 | Concurrent signup → 500 | Library maps unique-violation to a proper error response |
| 5 | Global middleware DB lookup per request | Stays global (uniform `c.var.user`); lookup now library-optimized. `session.cookieCache` available later if it ever matters |

## Accepted trade-offs

- **scrypt instead of argon2id** — OWASP lists scrypt as the recommended fallback when argon2id is unavailable. Zero custom code in the hashing path.
- **New secret dependency** — `BETTER_AUTH_SECRET` is required at boot; a missing secret is a new startup failure mode.
- **Library owns endpoint shapes** — responses are Better Auth's (`{user, token}`), errors carry codes like `USER_ALREADY_EXISTS`. Our `app.onError` continues to serve our domain routes only. Plan 2's web client uses `createAuthClient`, which speaks these shapes natively.
- **Bigger auth schema** — 4 tables instead of 2.
- **Bun runtime** — library is framework-agnostic (`auth.handler(request) => Promise<Response>`); documented to run under Bun. Residual risk low.

## Testing

Replace `apps/api/tests/auth.routes.test.ts` and delete `apps/api/tests/auth.service.test.ts` (service tests tested our validation code; validation is now library-owned — testing it would test the library).

New `apps/api/tests/auth.test.ts`, TDD, real DB, no mocks (repo rules):

1. signup (email + password + username) sets session cookie; `GET /api/auth/get-session` returns the user.
2. wrong password 5× then 6th attempt → 429 (rate limit rows live in DB — cleanup handled by the TRUNCATE in `testSetup.ts`).
3. anonymous `get-session` → 401.
4. sign-out invalidates the session (`get-session` → 401).
5. `requireRole` rejects a non-admin user (real session from signup, `set-role` via an admin fixture).

Rate limiting defaults to disabled in development (`NODE_ENV !== "production"`); tests must enable it explicitly or set `NODE_ENV=test` handling per library docs — pin this down during implementation.

## Out of scope

- Better Auth React client (`auth-client.ts`) — Plan 2.
- Email verification, password reset — later config additions.
- OAuth social providers — later config additions.
- Moderation endpoints (plan Tasks 10-11) — they consume `requireRole`, unchanged.
