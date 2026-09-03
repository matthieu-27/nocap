# Better Auth Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled auth layer (plan-1 Tasks 4-5) with Better Auth, keeping `requireUser` / `requireRole` / `SessionUser` interfaces unchanged for Tasks 6-12.

**Architecture:** Better Auth owns `/api/auth/*` via `auth.handler(c.req.raw)` mounted in Hono, backed by the Drizzle adapter over our existing `postgres.js` client. Our `sessionMiddleware` resolves the user through `auth.api.getSession` and exposes the same `c.var.user: SessionUser | null`. Schema: Better Auth CLI generates `auth-schema.ts` (`user` / `session` / `account` / `verification` / `rateLimit` tables); our `users` / `sessions` tables are dropped and domain FKs re-pointed.

**Tech Stack:** Bun, Hono, Drizzle ORM + postgres.js, Postgres, Better Auth (admin + username plugins), `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-03-better-auth-replacement-design.md` — read it first; this plan argues from it.

## Global Constraints

- Workspace: Bun monorepo, packages `@nocap/*`. Local DB: `postgres://nocap:nocap@localhost:5432/nocap` (in `apps/api/.env`); `.env.example` documents `your-dev-password` placeholder form.
- Run api tests from `apps/api` with `bun test` (they import `bun:test`). Root `bun run test` (vitest) excludes `apps/api`.
- Lint: `bun run check` at root (Biome, zero warnings) must pass before every commit; `bun run check:fix` first if needed. Pre-commit hooks run it anyway.
- Typecheck: `cd apps/api && bun run typecheck`.
- No mocks in tests; real DB via `resetDb` from `apps/api/src/db/testSetup.ts` (repo rule `check_no_mock`).
- `SessionUser` (`packages/shared/src/index.ts:45`) stays exactly: `{ id: number; username: string; role: 'user' | 'mod' | 'admin' }`. Role value is `'mod'`, not `'moderator'` (spec was loose here; the shared type wins).
- IDs stay integers: `advanced.database.generateId: 'serial'` keeps serial PKs so every `integer` domain FK keeps working.
- Sessions: 30-day expiry (`session.expiresIn: 60 * 60 * 24 * 30`).
- Password hashing: library default scrypt. No custom hash/verify code.
- Env vars: `BETTER_AUTH_SECRET` (32+ chars) and `BETTER_AUTH_URL=http://localhost:3001` must be in `apps/api/.env` before any test touches the auth instance.
- Better Auth `get-session` returns HTTP 200 with a `null` JSON body when unauthenticated (verified in library source). 401s come from our `requireUser`, not from the library. This supersedes spec test item 3's "anonymous get-session → 401".

---

### Task 1: Install Better Auth, env vars, `lib/auth.ts`, smoke test `/api/auth/ok`

**Files:**
- Create: `apps/api/src/lib/auth.ts`
- Create: `apps/api/tests/auth.ok.test.ts`
- Modify: `apps/api/package.json` (via `bun add`)
- Modify: `apps/api/.env`, `apps/api/.env.example`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: `db` from `apps/api/src/db/client.ts` (`drizzle(pool, { schema })`), `schema` from `apps/api/src/db/schema.ts`.
- Produces: `auth` — `export const auth` from `apps/api/src/lib/auth.ts`. Later tasks import `{ auth } from '../lib/auth'`. Endpoints live under `/api/auth/*`.

- [ ] **Step 1: Write the failing smoke test**

Create `apps/api/tests/auth.ok.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';

describe('better auth mount', () => {
  it('api auth ok endpoint reports status ok', async () => {
    const res = await app.request('/api/auth/ok');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/auth.ok.test.ts`
Expected: FAIL — 404, `res.status` is 404 (no `/api/auth/ok` route yet).

- [ ] **Step 3: Install better-auth**

Run: `cd apps/api && bun add better-auth`

- [ ] **Step 4: Add env vars**

Generate a secret and add both vars to `apps/api/.env` (which currently holds `DATABASE_URL` and `PORT`):

```bash
cd apps/api && bun -e "console.log('BETTER_AUTH_SECRET=' + Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'))"
```

Append to `apps/api/.env` (paste the generated value):

```
BETTER_AUTH_SECRET=<generated 44-char base64 value>
BETTER_AUTH_URL=http://localhost:3001
```

Append to `apps/api/.env.example`:

```
BETTER_AUTH_SECRET=<32+ char secret, e.g. openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3001
```

- [ ] **Step 5: Create `apps/api/src/lib/auth.ts`**

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins/admin';
import { username } from 'better-auth/plugins/username';
import { db } from '../db/client';
import * as schema from '../db/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  plugins: [admin(), username()],
  advanced: { database: { generateId: 'serial' } },
  session: { expiresIn: 60 * 60 * 24 * 30 },
});
```

Note: rate limiting is added in Task 4 (TDD), not here.

- [ ] **Step 6: Mount the handler in `apps/api/src/index.ts`**

Add import and mount (keep everything else, including `sessionMiddleware` and the old `authRoutes` mount — old routes still compile and do not conflict with `/api/auth/ok`):

```ts
import { auth } from './lib/auth';

app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/api && bun test tests/auth.ok.test.ts`
Expected: PASS.

- [ ] **Step 8: Verify nothing else broke, then commit**

Run: `cd apps/api && bun test` (all 11 tests pass: 10 existing + 1 new) and `bun run typecheck` and root `bun run check`.

```bash
git add apps/api/package.json bun.lock apps/api/.env.example apps/api/src/lib/auth.ts apps/api/src/index.ts apps/api/tests/auth.ok.test.ts
git commit -m "feat: mount better-auth with drizzle adapter and ok smoke test"
```

---

### Task 2: Auth schema swap, delete hand-rolled auth, rewrite middleware

One atomic task: the schema change breaks compilation of the old auth code, so schema + deletion + middleware must land together.

**Files:**
- Create: `apps/api/src/db/auth-schema.ts` (via CLI)
- Modify: `apps/api/src/db/schema.ts` (drop `users`/`sessions`, FKs → `user`)
- Modify: `apps/api/src/db/testSetup.ts` (TRUNCATE list)
- Modify: `apps/api/drizzle/*` (regenerated from scratch)
- Delete: `apps/api/src/services/auth.service.ts`, `apps/api/src/services/session.service.ts`, `apps/api/src/routes/auth.routes.ts`, `apps/api/tests/auth.routes.test.ts`, `apps/api/tests/auth.service.test.ts`
- Rewrite: `apps/api/src/middleware/auth.ts`
- Modify: `apps/api/src/index.ts` (drop `authRoutes`)

**Interfaces:**
- Consumes: `auth` from Task 1.
- Produces: `user` table object exported from `apps/api/src/db/auth-schema.ts` (referenced by `schema.ts` FKs); `sessionMiddleware`, `AuthEnv`, `requireUser(c): SessionUser`, `requireRole(user, roles): void` from `apps/api/src/middleware/auth.ts` — signatures unchanged, so plan-1 Tasks 6-12 code needs no changes.

- [ ] **Step 1: Generate the Better Auth schema**

Run from `apps/api` (CLI ships as the `auth` package; no install needed. It finds `auth.ts` configs under `./`, `./lib`, `./utils`, or `./src` — ours is `src/lib/auth.ts`):

```bash
cd apps/api && bunx auth@latest generate --output src/db/auth-schema.ts
```

If the CLI cannot find the config, add `--config src/lib/auth.ts`.

- [ ] **Step 2: Verify the generated schema**

Open `src/db/auth-schema.ts` and check:
1. `pgTable('user', ...)` — the `id` column must be an integer/serial type, not `text`. If it is `text`, keep `advanced.database.generateId: 'serial'` in `lib/auth.ts`, re-run the generate command, and if it still emits `text`, replace the `id` column definitions with `id: serial('id').primaryKey(),` (import `serial` from `drizzle-orm/pg-core`). Better Auth with `generateId: 'serial'` omits `id` on INSERT, letting Postgres assign it.
2. `user` carries plugin fields: `username` (username plugin) and `role`, `banned`, `banReason`, `banExpires` (admin plugin). `session` carries `impersonatedBy`.
3. Tables present: `user`, `session`, `account`, `verification`, `rateLimit` (rate limit only appears after Task 4 adds the config — if absent now, add `'rateLimit'` to the TRUNCATE list in Step 5 when Task 4 lands; check then).

- [ ] **Step 3: Swap `schema.ts`**

In `apps/api/src/db/schema.ts`:
1. Delete the `users` and `sessions` table definitions (lines with `pgTable('users', ...)` and `pgTable('sessions', ...)`, including the `sessions` unique index block).
2. Add at the top: `import { user } from './auth-schema';`
3. Replace every `() => users.id` with `() => user.id` (all domain FKs: domains, posts, votes, comments, comment_votes, reports, mod_actions).

- [ ] **Step 4: Update `testSetup.ts` TRUNCATE list**

Read the exact table names from the generated `auth-schema.ts` `pgTable('name', ...)` calls and set `TABLES` to (order irrelevant — `CASCADE` handles deps; list children first as today):

```ts
const TABLES = [
  'jobs',
  'mod_actions',
  'reports',
  'comment_votes',
  'comments',
  'votes',
  'posts',
  'domains',
  'session',
  'account',
  'verification',
  'user',
] as const;
```

Add `'rateLimit'` once Task 4's generate run creates it.

- [ ] **Step 5: Regenerate migrations from scratch**

Dev data is throwaway (TRUNCATE'd between tests, no prod). Delete the old migration history and rebuild:

```bash
cd apps/api && rm -rf drizzle && bun run db:generate && bun run db:migrate
```

Expected: `drizzle/` gains one fresh `0000_*.sql` (or similar single init file) creating all tables; migrate exits 0. Verify: `psql -U nocap -d nocap -c '\dt'` lists `user`, `session`, `account`, `verification` + the 8 domain tables, and no `users`/`sessions`.

- [ ] **Step 6: Delete the hand-rolled auth code**

```bash
cd apps/api && rm src/services/auth.service.ts src/services/session.service.ts src/routes/auth.routes.ts tests/auth.routes.test.ts tests/auth.service.test.ts
```

- [ ] **Step 7: Rewrite `apps/api/src/middleware/auth.ts`**

Replace the whole file (signatures of `AuthEnv`, `requireUser`, `requireRole` stay identical; only the session lookup changes):

```ts
import type { SessionUser } from '@nocap/shared';
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
          // Better Auth types role as the admin plugin's default union;
          // the column also holds 'mod', so the assertion widens the type.
          role: (session.user.role ?? 'user') as SessionUser['role'],
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
```

- [ ] **Step 8: Drop `authRoutes` from `apps/api/src/index.ts`**

Delete `import authRoutes from './routes/auth.routes';` and `app.route('/', authRoutes);`. The Better Auth mount from Task 1 and `app.use('*', sessionMiddleware)` remain.

- [ ] **Step 9: Verify**

Run: `cd apps/api && bun run typecheck` → 0 errors. `bun test` → all remaining tests pass (health suite + `auth.ok.test.ts`; the five old auth tests are gone by design). Root: `bun run check` → clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor: replace hand-rolled auth with better-auth schema and middleware"
```

---

### Task 3: Auth integration tests — signup, session, duplicate email, anonymous

**Files:**
- Create: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes: mounted Better Auth endpoints: `POST /api/auth/sign-up/email` (`{ email, password, name, username }` — `name` is required by the library; pass the username value), `GET /api/auth/get-session`, session cookie from `set-cookie`.
- Produces: `authRequest` helper pattern used by Tasks 4-5 tests.

- [ ] **Step 1: Write the tests**

Create `apps/api/tests/auth.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '../src/db/testSetup';
import { app } from '../src/index';

async function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/api && bun test tests/auth.test.ts`
Expected: PASS on all three. If `signup.status` is 201 not 200, change the expectation to 201 — either is fine, the cookie + `get-session` assertions are the real contract. If duplicate-signup status is 409 rather than 400, update that expectation the same way.

- [ ] **Step 3: Full suite + commit**

Run: `cd apps/api && bun test` and root `bun run check`.

```bash
git add apps/api/tests/auth.test.ts
git commit -m "test: better-auth signup, session, and duplicate-email integration"
```

---

### Task 4: Rate limiting — 5 failed sign-ins then 429

**Files:**
- Modify: `apps/api/src/lib/auth.ts`
- Modify: `apps/api/tests/auth.test.ts`
- Modify: `apps/api/src/db/testSetup.ts` (TRUNCATE list + regenerate schema)

**Interfaces:**
- Consumes: `post` helper from Task 3.
- Produces: `rateLimit` config in `lib/auth.ts`; `rateLimit` table in the schema (name per generated file).

- [ ] **Step 1: Write the failing test**

Add to `apps/api/tests/auth.test.ts` inside the `describe`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun test tests/auth.test.ts -t "sign-in blocked"`
Expected: FAIL — sixth attempt returns 401, not 429 (no rate limit configured yet; the library also defaults rate limiting off outside production).

- [ ] **Step 3: Add the rate limit config**

In `apps/api/src/lib/auth.ts`, add to the `betterAuth({...})` config:

```ts
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: { '/sign-in/email': { window: 900, max: 5 } },
  },
```

- [ ] **Step 4: Regenerate schema for the rateLimit table and update TRUNCATE**

```bash
cd apps/api && bunx auth@latest generate --output src/db/auth-schema.ts && rm -rf drizzle && bun run db:generate && bun run db:migrate
```

Add the rate-limit table's exact name (check the `pgTable('...')` call in the regenerated `auth-schema.ts`; expected `'rateLimit'`) to `TABLES` in `src/db/testSetup.ts` — without this, rate-limit rows survive `resetDb` and later tests run pre-blocked.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && bun test tests/auth.test.ts -t "sign-in blocked"`
Expected: PASS. Contingency: if still 401, the library is skipping rate limiting because `NODE_ENV` is not `production` — add `process.env.NODE_ENV = 'production';` as the first line of `apps/api/tests/auth.test.ts`, before any imports, and re-run.

- [ ] **Step 6: Full suite + commit**

Run: `cd apps/api && bun test` (all pass) and root `bun run check`.

```bash
git add -A
git commit -m "feat: database-backed sign-in rate limiting via better-auth"
```

---

### Task 5: Sign-out, `requireUser`/`requireRole` guards, admin `set-role`

**Files:**
- Modify: `apps/api/tests/auth.test.ts`

**Interfaces:**
- Consumes: `sessionMiddleware`, `requireUser`, `requireRole` from `apps/api/src/middleware/auth.ts`; admin plugin endpoint `POST /api/auth/admin/set-role` (`{ userId, role }`, requires an `admin`-role session).
- Produces: none (test-only task; guards already consumed by plan-1 Tasks 6-12).

- [ ] **Step 1: Write the tests**

Add to `apps/api/tests/auth.test.ts` (new imports at top):

```ts
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../src/db/client';
import { user as userTable } from '../src/db/auth-schema';
import { type AuthEnv, requireRole, requireUser } from '../src/middleware/auth';
import { sessionMiddleware } from '../src/middleware/auth';
import { ServiceError } from '../src/errors';
```

Add inside the `describe`:

```ts
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
    const adminCookie = (adminSignup.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    // No admin exists yet, so the first one is seeded with a direct DB write
    // (the admin plugin sets role as input: false — signup cannot grant it).
    const [adminRow] = await db.select().from(userTable).where(eq(userTable.email, 'root@example.com'));
    await db.update(userTable).set({ role: 'admin' }).where(eq(userTable.id, adminRow.id));

    const target = await post('/api/auth/sign-up/email', {
      email: 'target@example.com',
      password: 'correct-horse-battery',
      name: 'target',
      username: 'target',
    });
    const targetCookie = (target.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const [targetRow] = await db.select().from(userTable).where(eq(userTable.email, 'target@example.com'));

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
```

Note: `ServiceError` import above may end up unused — drop it if Biome flags it. The `guarded` app mounts the real middleware against the real DB — no mocks.

- [ ] **Step 2: Run tests**

Run: `cd apps/api && bun test tests/auth.test.ts`
Expected: PASS on all (guards and sign-out are library/middleware behavior wired in Task 2 — these tests pin the contract Tasks 6-12 rely on). If `set-role` returns 403, the acting admin's role was not visible to their session — sign the admin in *after* the DB update (new sign-in creates a fresh session that reads the updated role) instead of reusing `adminCookie` from before the update; reorder the test accordingly.

- [ ] **Step 3: Full suite + commit**

Run: `cd apps/api && bun test` and root `bun run check`.

```bash
git add apps/api/tests/auth.test.ts
git commit -m "test: sign-out, auth guards, and admin set-role contracts"
```

---

### Task 6: Annotate the old plan, final verification

**Files:**
- Modify: `docs/superpowers/plans/2026-09-01-claim-tracker-1-api-core.md` (header note only — the file is a historical record, do not rewrite its contents)

**Interfaces:**
- Consumes: nothing.
- Produces: plan-1 readers learn Tasks 4-5 are superseded before they follow stale instructions.

- [ ] **Step 1: Add a supersession note under the plan's title**

```markdown
> **Superseded in part (2026-09-03):** Tasks 4-5 (auth service, auth routes/middleware/rate-limit) were replaced by Better Auth — see `docs/superpowers/specs/2026-09-03-better-auth-replacement-design.md` and `docs/superpowers/plans/2026-09-03-better-auth-replacement.md`. `requireUser`, `requireRole`, and `SessionUser` keep the signatures used by Tasks 6-12, so all remaining tasks apply unchanged.
```

- [ ] **Step 2: Final verification**

Run: `cd apps/api && bun run typecheck && bun test` and at root `bun run check && bun run test`.
Expected: everything passes — typecheck 0 errors, all `bun test` suites green, Biome zero warnings, vitest green.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-09-01-claim-tracker-1-api-core.md
git commit -m "docs: mark plan-1 tasks 4-5 superseded by better-auth"
```
