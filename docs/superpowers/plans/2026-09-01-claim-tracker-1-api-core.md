# Claim Tracker — Plan 1: API Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Superseded in part (2026-09-03):** Tasks 4-5 (auth service, auth routes/middleware/rate-limit) were replaced by Better Auth — see `docs/superpowers/specs/2026-09-03-better-auth-replacement-design.md` and `docs/superpowers/plans/2026-09-03-better-auth-replacement.md`. `requireUser`, `requireRole`, and `SessionUser` keep the signatures used by Tasks 6-12, so all remaining tasks apply unchanged.

**Goal:** Build the claim tracker's Hono API — auth, domains, posts, votes, comments, reports, moderation — as a testable Bun workspace in the monorepo.

**Architecture:** Three-layer API: Hono routes (presentation) → service functions (business logic, no HTTP imports) → Drizzle + Postgres. Tests hit routes through Hono's `app.request()` against a real dev Postgres, truncating state between tests. Monorepo: `packages/shared` holds DTO types consumed by API and (in Plan 2) web.

**Tech Stack:** Bun (runtime + test), Hono, Drizzle ORM + postgres.js, PostgreSQL 17 (local instance, dev), Bun.password (Argon2id), Biome + pre-commit.

**Spec:** `docs/superpowers/specs/2026-09-01-claim-tracker-design.md`

## Global Constraints

- Runtime: Bun everywhere TS. No Node-specific APIs without Bun equivalent.
- Lint: Biome, zero warnings — every `git commit` runs pre-commit (biome, ruff, vale, custom checks); a failed hook means fix + re-commit, never `--no-verify`.
- TypeScript strict, no `as any`/`as unknown` (grit rule fires), explicit return types on exports.
- Service layer imports no Hono types — routes call services, never the reverse.
- Tests use real Postgres (no mocks — mirrors `check_no_mock` philosophy). State reset by `TRUNCATE ... RESTART IDENTITY CASCADE` in `beforeEach`.
- Password hashing: `Bun.password` (Argon2id, default params).
- Sessions: opaque `crypto.randomUUID()` token in httpOnly cookie; DB stores SHA-256 of token.
- Error shape: `{ error: string }` JSON, correct status codes; no stack traces in responses.
- Commit style: `feat:`/`test:`/`chore:` conventional, small commits per task.

---

## File Structure

**Repo layout at end of Plan 1** (web and worker are Plan 2 — they do not exist yet; nothing is scaffolded empty):

```
mytheory/
├── package.json                  # bun workspaces root, scripts
├── tsconfig.base.json            # shared strict compiler options
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts          # DTO types shared web ↔ api
└── apps/
    └── api/
        ├── package.json
        ├── tsconfig.json
        ├── drizzle.config.ts
        ├── .env.example
        └── src/
            ├── index.ts           # Hono app assembly + export for tests
            ├── db/
            │   ├── client.ts      # postgres.js pool + drizzle instance
            │   ├── schema.ts      # all tables
            │   └── testSetup.ts   # truncate helper for tests
            ├── logger.ts          # JSON line logger
            ├── errors.ts          # service-level error class
            ├── middleware/
            │   └── auth.ts        # session cookie → ctx.var.user
            ├── services/
            │   ├── auth.service.ts
            │   ├── session.service.ts
            │   ├── domain.service.ts
            │   ├── post.service.ts
            │   ├── vote.service.ts
            │   ├── comment.service.ts
            │   └── report.service.ts
            └── routes/
                ├── health.routes.ts
                ├── auth.routes.ts
                ├── domain.routes.ts
                ├── post.routes.ts
                ├── comment.routes.ts
                └── report.routes.ts
```

Each service file = one resource's business logic. Routes files = HTTP plumbing only. `testSetup.ts` owns DB reset so every test file stays three lines of setup.

**Final repo layout after all three plans** — frontend, backend, and worker are separate apps in one monorepo:

```
mytheory/
├── apps/
│   ├── api/       Hono backend        (Plan 1)
│   ├── web/       React Router v8 UI  (Plan 2)
│   └── worker/    Python uvicorn jobs (Plan 2)
├── packages/
│   └── shared/    DTO types imported by api + web via workspace:*
├── docker-compose.yml  production: caddy, web, api, worker, postgres (Plan 3)
└── (scripts/lint, tools/biome-plugins, styles/ already at root)
```

Web never touches the database — SSR loaders call the API over HTTP (spec §4). `apps/web` imports `@claimtracker/shared` for types only.

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `.gitignore`, `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/.env.example`

**Interfaces:**
- Produces: workspace layout + `bun check` script running Biome across the repo; `packages/shared` importable as `@claimtracker/shared`.

- [ ] **Step 1: Root `package.json`**

```json
{
  "name": "claimtracker",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "check": "bunx @biomejs/biome check --error-on-warnings",
    "check:fix": "bunx @biomejs/biome check --fix --error-on-warnings",
    "test": "bun test"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.2.4",
    "typescript": "^5.9.2"
  }
}
```

- [ ] **Step 2: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 3: `.gitignore`**

```
node_modules/
dist/
build/
.env
*.local
.react-router/
coverage/
```

- [ ] **Step 4: `packages/shared`**

`packages/shared/package.json`:

```json
{
  "name": "@claimtracker/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.9.2" }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/shared/src/index.ts` — the DTO contract every later task uses:

```ts
export type VoteValue = 1 | -1 | 0;

export interface DomainDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isLocked: boolean;
}

export interface PostDto {
  id: number;
  domainId: number;
  domainSlug: string;
  author: string;
  title: string;
  body: string | null;
  url: string;
  provider: string | null;
  embed: unknown | null;
  score: number;
  createdAt: string;
}

export interface CommentDto {
  id: number;
  postId: number;
  parentId: number | null;
  depth: number;
  author: string;
  body: string;
  score: number;
  createdAt: string;
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'personal_info'
  | 'illegal'
  | 'off_domain';

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface SessionUser {
  id: number;
  username: string;
  role: 'user' | 'mod' | 'admin';
}
```

- [ ] **Step 5: `apps/api/package.json`**

```json
{
  "name": "@claimtracker/api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@claimtracker/shared": "workspace:*",
    "drizzle-orm": "^0.44.0",
    "hono": "^4.6.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "@types/bun": "^1.1.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.9.2"
  }
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["bun-types"] },
  "include": ["src", "tests"]
}
```

`apps/api/.env.example`:

```
DATABASE_URL=postgres://claimtracker:your-dev-password@localhost:5432/claimtracker
PORT=3001
```

- [ ] **Step 6: Install + verify**

Run: `bun install`
Expected: workspace linked, lockfile created, exit 0.

Run: `bun run check`
Expected: Biome runs on repo; may report nothing to lint or pass clean. Any finding → `bun run check:fix` then re-run until clean.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.base.json .gitignore bun.lock packages/shared apps/api
git commit -m "chore: scaffold bun monorepo with shared types workspace"
```

---

### Task 2: Local Postgres + Drizzle schema

**Files:**
- Create: `apps/api/drizzle.config.ts`, `apps/api/src/db/schema.ts`, `apps/api/src/db/client.ts`

**Interfaces:**
- Produces: `db` (drizzle instance) from `src/db/client.ts`; table objects `users`, `sessions`, `domains`, `posts`, `votes`, `comments`, `commentVotes`, `reports`, `modActions`, `jobs` for all later services. DB = your existing local Postgres (default port 5432); role and database created by you in Step 1.

- [ ] **Step 1: Create role + database on your local Postgres**

Run as superuser (adjust `-U` to your install; replace the password):

```bash
psql -U postgres -c "CREATE ROLE claimtracker LOGIN PASSWORD 'your-dev-password';"
psql -U postgres -c "CREATE DATABASE claimtracker OWNER claimtracker;"
```

Expected: both commands exit 0.

- [ ] **Step 2: `apps/api/.env`** (copy of example — gitignored)

```bash
cp apps/api/.env.example apps/api/.env
```

- [ ] **Step 3: `src/db/schema.ts`** — every table from the spec:

```ts
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 8 }).notNull().default('user'),
  karma: integer('karma').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('sessions_token_hash_idx').on(table.tokenHash)],
);

export const domains = pgTable('domains', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 32 }).notNull().unique(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  isLocked: boolean('is_locked').notNull().default(false),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    domainId: integer('domain_id')
      .notNull()
      .references(() => domains.id),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 300 }).notNull(),
    body: text('body'),
    url: text('url').notNull(),
    provider: varchar('provider', { length: 32 }),
    embed: jsonb('embed'),
    score: integer('score').notNull().default(0),
    hotRank: doublePrecision('hot_rank').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('posts_domain_idx').on(table.domainId),
    index('posts_hot_idx').on(table.hotRank),
  ],
);

export const votes = pgTable(
  'votes',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('votes_post_user_idx').on(table.postId, table.userId)],
);

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    parentId: integer('parent_id'),
    body: text('body').notNull(),
    score: integer('score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('comments_post_idx').on(table.postId)],
);

export const commentVotes = pgTable(
  'comment_votes',
  {
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
  },
  (table) => [uniqueIndex('comment_votes_idx').on(table.commentId, table.userId)],
);

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .notNull()
    .references(() => users.id),
  postId: integer('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  commentId: integer('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const modActions = pgTable('mod_actions', {
  id: serial('id').primaryKey(),
  modId: integer('mod_id')
    .notNull()
    .references(() => users.id),
  action: varchar('action', { length: 32 }).notNull(),
  targetPostId: integer('target_post_id').references(() => posts.id),
  targetUserId: integer('target_user_id').references(() => users.id),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 32 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 4: `src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL ?? 'postgres://claimtracker:your-dev-password@localhost:5432/claimtracker';

export const pool = postgres(connectionString);
export const db = drizzle(pool, { schema });
```

- [ ] **Step 5: `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://claimtracker:your-dev-password@localhost:5432/claimtracker',
  },
});
```

- [ ] **Step 6: Generate + run migration**

Run from `apps/api`: `bun run db:generate` then `bun run db:migrate`
Expected: `drizzle/` gains SQL migration files; migrate exits 0. Verify tables: `psql -U claimtracker -d claimtracker -c '\dt'` lists 10 tables.

- [ ] **Step 7: Run repo checks + commit**

Run: `bun run check` (fix findings if any). Run `cd apps/api && bun run typecheck`.

```bash
git add apps/api/drizzle.config.ts apps/api/src/db apps/api/drizzle
git commit -m "feat: drizzle schema against local postgres"
```

---

### Task 3: Logger, errors, health route, test harness

**Files:**
- Create: `apps/api/src/logger.ts`, `apps/api/src/errors.ts`, `apps/api/src/routes/health.routes.ts`, `apps/api/src/index.ts`, `apps/api/src/db/testSetup.ts`, `apps/api/tests/health.test.ts`

**Interfaces:**
- Produces: `log` (structured logger: `log.info(msg, fields)`), `ServiceError` class (`new ServiceError(status, message)`), default-exported `app` (assembled Hono app) from `src/index.ts`, `resetDb()` from `src/db/testSetup.ts`.

- [ ] **Step 1: `src/logger.ts`** — JSON lines, no deps:

```ts
type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, message: string, fields: Record<string, unknown>): void {
  console[level === 'debug' ? 'log' : level](
    JSON.stringify({ level, message, time: new Date().toISOString(), ...fields }),
  );
}

export const log = {
  debug: (message: string, fields: Record<string, unknown> = {}) => emit('debug', message, fields),
  info: (message: string, fields: Record<string, unknown> = {}) => emit('info', message, fields),
  warn: (message: string, fields: Record<string, unknown> = {}) => emit('warn', message, fields),
  error: (message: string, fields: Record<string, unknown> = {}) => emit('error', message, fields),
};
```

(String concatenation is absent — no interpolated-console findings; message + fields object is the structured shape.)

- [ ] **Step 2: `src/errors.ts`**

```ts
export class ServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
```

- [ ] **Step 3: `src/routes/health.routes.ts`**

```ts
import { Hono } from 'hono';

const health = new Hono();

health.get('/api/health', (c) => c.json({ status: 'ok' }));

export default health;
```

- [ ] **Step 4: `src/index.ts`** — app assembly + error mapping:

```ts
import { Hono } from 'hono';
import { ServiceError } from './errors';
import { log } from './logger';
import healthRoutes from './routes/health.routes';

const app = new Hono();

app.route('/', healthRoutes);

app.onError((err, c) => {
  if (err instanceof ServiceError) {
    return c.json({ error: err.message }, err.status);
  }
  log.error('unhandled error', { path: c.req.path, message: err.message });
  return c.json({ error: 'internal error' }, 500);
});

export default { port: Number(process.env.PORT ?? 3001), fetch: app.fetch, app };
export { app };
```

- [ ] **Step 5: `src/db/testSetup.ts`**

```ts
import { sql } from 'drizzle-orm';
import { db, pool } from './client';

const TABLES = [
  'jobs',
  'mod_actions',
  'reports',
  'comment_votes',
  'comments',
  'votes',
  'posts',
  'domains',
  'sessions',
  'users',
] as const;

export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`));
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
```

- [ ] **Step 6: Write failing test `tests/health.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { closeDb, resetDb } from '../src/db/testSetup';

describe('health route', () => {
  beforeEach(resetDb);
  afterAll(closeDb);

  it('returns ok status for unauthenticated caller', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});
```

(Test name carries actor + action + effect, per `check_test_names` conventions.)

- [ ] **Step 7: Run tests**

Run from `apps/api`: `bun test`
Expected: 1 passed. If DB connection fails → check `DATABASE_URL` in `apps/api/.env` matches the role/password/database from Task 2 Step 1, and your local Postgres is running.

- [ ] **Step 8: Checks + commit**

Run: `bun run check` from root; `bun run typecheck` from `apps/api`.

```bash
git add apps/api/src apps/api/tests
git commit -m "feat: hono app shell with health route, logger, and test harness"
```

---

### Task 4: Auth service — signup, login, sessions

**Files:**
- Create: `apps/api/src/services/session.service.ts`, `apps/api/src/services/auth.service.ts`
- Test: `apps/api/tests/auth.service.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`
  - `createUser(input: { username: string; email: string; password: string }): Promise<SessionUser>`
  - `authenticate(email: string, password: string): Promise<SessionUser>`
  - `createSession(userId: number): Promise<{ token: string; expiresAt: Date }>`
  - `getUserBySessionToken(token: string): Promise<SessionUser | null>`
  - `deleteSession(token: string): Promise<void>`

- [ ] **Step 1: Write failing tests `tests/auth.service.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { resetDb } from '../src/db/testSetup';
import { authenticate, createUser } from '../src/services/auth.service';
import {
  createSession,
  deleteSession,
  getUserBySessionToken,
} from '../src/services/session.service';

const userInput = () => ({
  username: 'tracker',
  email: 'tracker@example.com',
  password: 'correct-horse-battery',
});

describe('auth service', () => {
  beforeEach(resetDb);

  it('signup creates user and login accepts valid password', async () => {
    const created = await createUser(userInput());
    expect(created.username).toBe('tracker');
    expect(created.role).toBe('user');

    const loggedIn = await authenticate('tracker@example.com', 'correct-horse-battery');
    expect(loggedIn.id).toBe(created.id);
  });

  it('login rejects wrong password with 401 error', async () => {
    await createUser(userInput());
    try {
      await authenticate('tracker@example.com', 'wrong-password');
      throw new Error('expected authenticate to throw');
    } catch (error) {
      expect((error as { status: number }).status).toBe(401);
    }
  });

  it('signup rejects duplicate username with 409 error', async () => {
    await createUser(userInput());
    try {
      await createUser({ ...userInput(), email: 'other@example.com' });
      throw new Error('expected createUser to throw');
    } catch (error) {
      expect((error as { status: number }).status).toBe(409);
    }
  });

  it('session token resolves to user and disappears after logout', async () => {
    const user = await createUser(userInput());
    const { token } = await createSession(user.id);
    const byToken = await getUserBySessionToken(token);
    expect(byToken?.username).toBe('tracker');

    await deleteSession(token);
    const afterLogout = await getUserBySessionToken(token);
    expect(afterLogout).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/auth.service.test.ts`
Expected: FAIL — cannot resolve `../src/services/auth.service`.

- [ ] **Step 3: `src/services/session.service.ts`**

```ts
import { createHash, randomUUID } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { sessions, users } from '../db/schema';
import { ServiceError } from '../errors';
import type { SessionUser } from '@claimtracker/shared';

const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string): Promise<SessionUser | null> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, role: row.role as SessionUser['role'] };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
```

- [ ] **Step 4: `src/services/auth.service.ts`**

```ts
import { or, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { ServiceError } from '../errors';
import type { SessionUser } from '@claimtracker/shared';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

function validateSignup(username: string, email: string, password: string): void {
  if (!USERNAME_RE.test(username)) {
    throw new ServiceError(400, 'username must be 3-32 chars: letters, digits, underscore');
  }
  if (!EMAIL_RE.test(email)) {
    throw new ServiceError(400, 'invalid email address');
  }
  if (password.length < 10) {
    throw new ServiceError(400, 'password must be at least 10 characters');
  }
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<SessionUser> {
  validateSignup(input.username, input.email, input.password);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, input.username), eq(users.email, input.email)))
    .limit(1);
  if (existing.length > 0) {
    throw new ServiceError(409, 'username or email already taken');
  }

  const passwordHash = await hashPassword(input.password);
  const inserted = await db
    .insert(users)
    .values({ username: input.username, email: input.email, passwordHash })
    .returning({ id: users.id, username: users.username, role: users.role });

  const row = inserted[0];
  if (!row) throw new ServiceError(500, 'user insert failed');
  return { id: row.id, username: row.username, role: row.role as SessionUser['role'] };
}

export async function authenticate(email: string, password: string): Promise<SessionUser> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const row = rows[0];
  const valid = row !== undefined ? await verifyPassword(password, row.passwordHash) : false;
  if (!row || !valid) {
    throw new ServiceError(401, 'invalid email or password');
  }
  return { id: row.id, username: row.username, role: row.role as SessionUser['role'] };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run from `apps/api`: `bun test tests/auth.service.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Checks + commit**

Run: `bun run check` (root), `bun run typecheck` (apps/api).

```bash
git add apps/api/src/services apps/api/tests/auth.service.test.ts
git commit -m "feat: auth service with argon2id passwords and db-backed sessions"
```

---

### Task 5: Auth routes, session middleware, login rate limit

**Files:**
- Create: `apps/api/src/middleware/auth.ts`, `apps/api/src/routes/auth.routes.ts`
- Modify: `apps/api/src/index.ts` (mount auth routes + middleware)
- Test: `apps/api/tests/auth.routes.test.ts`

**Interfaces:**
- Consumes: `createUser`, `authenticate`, `createSession`, `deleteSession`, `getUserBySessionToken` (Task 4).
- Produces: `sessionMiddleware` (sets `c.var.user`), `requireUser(c)`, `requireRole(user, roles[])`; cookie name `ct_session`; endpoints `POST /api/auth/signup|login|logout`, `GET /api/auth/me`.

- [ ] **Step 1: Write failing tests `tests/auth.routes.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

function authRequest(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });
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

    const me = await app.request('/api/auth/me', { headers: { Cookie: cookie } });
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

  it('logout clears the session so me returns null user error', async () => {
    const signup = await authRequest('/api/auth/signup', {
      username: 'tracker',
      email: 'tracker@example.com',
      password: 'correct-horse-battery',
    });
    const cookie = (signup.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    const logout = await authRequest('/api/auth/logout', {});
    expect(logout.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/auth.routes.test.ts`
Expected: FAIL — routes not mounted (404s).

- [ ] **Step 3: `src/middleware/auth.ts`**

```ts
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';
import { ServiceError } from '../errors';
import { getUserBySessionToken } from '../services/session.service';
import type { SessionUser } from '@claimtracker/shared';

export interface AuthEnv {
  Variables: { user: SessionUser | null };
}

export const sessionMiddleware = async (
  c: Context<AuthEnv>,
  next: () => Promise<void>,
): Promise<void | Response> => {
  const token = getCookie(c, 'ct_session');
  c.set('user', token ? await getUserBySessionToken(token) : null);
  await next();
};

export function requireUser(c: Context<AuthEnv>): SessionUser {
  const user = c.var.user;
  if (!user) throw new ServiceError(401, 'authentication required');
  return user;
}

export function requireRole(user: SessionUser, roles: SessionUser['role'][]): void {
  if (!roles.includes(user.role)) {
    throw new ServiceError(403, 'insufficient permissions');
  }
}
```

- [ ] **Step 4: `src/routes/auth.routes.ts`** (brute-force counter in-memory — single instance v1):

```ts
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { ServiceError } from '../errors';
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

const auth = new Hono<AuthEnv>();

auth.post('/api/auth/signup', async (c) => {
  const body = (await c.req.json()) as {
    username: string;
    email: string;
    password: string;
  };
  const user = await createUser(body);
  const { token, expiresAt } = await createSession(user.id);
  setCookie(c, 'ct_session', token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
  return c.json(user, 201);
});

auth.post('/api/auth/login', async (c) => {
  const body = (await c.req.json()) as { email: string; password: string };
  const key = `${body.email}|${c.req.header('x-forwarded-for') ?? 'local'}`;
  if (loginBlocked(key)) {
    throw new ServiceError(429, 'too many login attempts — try again in 15 minutes');
  }
  try {
    const user = await authenticate(body.email, body.password);
    const { token, expiresAt } = await createSession(user.id);
    setCookie(c, 'ct_session', token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      expires: expiresAt,
    });
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
```

- [ ] **Step 5: Mount in `src/index.ts`** — add imports and `app.use('*', sessionMiddleware)` before routes, plus `app.route('/', authRoutes)` after health:

```ts
import { Hono } from 'hono';
import { ServiceError } from './errors';
import { log } from './logger';
import { sessionMiddleware } from './middleware/auth';
import authRoutes from './routes/auth.routes';
import healthRoutes from './routes/health.routes';

const app = new Hono();

app.use('*', sessionMiddleware);
app.route('/', healthRoutes);
app.route('/', authRoutes);

app.onError((err, c) => {
  if (err instanceof ServiceError) {
    return c.json({ error: err.message }, err.status);
  }
  log.error('unhandled error', { path: c.req.path, message: err.message });
  return c.json({ error: 'internal error' }, 500);
});

export default { port: Number(process.env.PORT ?? 3001), fetch: app.fetch, app };
export { app };
```

- [ ] **Step 6: Run tests**

Run from `apps/api`: `bun test`
Expected: all pass (health + auth.service + auth.routes).

- [ ] **Step 7: Checks + commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "feat: auth routes with session cookies and login rate limiting"
```

---

### Task 6: Domains — list and create (3-per-user cap)

**Files:**
- Create: `apps/api/src/services/domain.service.ts`, `apps/api/src/routes/domain.routes.ts`
- Modify: `apps/api/src/index.ts` (mount domain routes)
- Test: `apps/api/tests/domain.test.ts`

**Interfaces:**
- Produces: `listDomains(): Promise<DomainDto[]>`, `createDomain(userId: number, input: { slug: string; name: string; description?: string }): Promise<DomainDto>`; endpoints `GET /api/domains`, `POST /api/domains`.

- [ ] **Step 1: Write failing tests `tests/domain.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

async function signupAndCookie(username: string): Promise<string> {
  const response = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

describe('domains', () => {
  beforeEach(resetDb);

  it('anonymous visitor lists domains and sees a created one', async () => {
    const cookie = await signupAndCookie('tracker');
    const created = await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
    });
    expect(created.status).toBe(201);

    const list = await app.request('/api/domains');
    const body = (await list.json()) as { slug: string }[];
    expect(body.some((domain) => domain.slug === 'sports')).toBe(true);
  });

  it('fourth domain creation by same user fails with 429 error', async () => {
    const cookie = await signupAndCookie('tracker');
    for (const slug of ['sports', 'politics', 'shopping']) {
      const response = await app.request('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ slug, name: slug }),
      });
      expect(response.status).toBe(201);
    }
    const fourth = await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'movies', name: 'Movies' }),
    });
    expect(fourth.status).toBe(429);
  });

  it('uppercase slug is rejected with 400 error', async () => {
    const cookie = await signupAndCookie('tracker');
    const response = await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ slug: 'Sports', name: 'Sports' }),
    });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/domain.test.ts`
Expected: FAIL — 404 on POST /api/domains.

- [ ] **Step 3: `src/services/domain.service.ts`**

```ts
import { count, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { domains } from '../db/schema';
import { ServiceError } from '../errors';
import type { DomainDto } from '@claimtracker/shared';

const SLUG_RE = /^[a-z0-9-]{3,32}$/;
const MAX_DOMAINS_PER_USER = 3;

export async function listDomains(): Promise<DomainDto[]> {
  const rows = await db.select().from(domains).orderBy(domains.slug);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isLocked: row.isLocked,
  }));
}

export async function createDomain(
  userId: number,
  input: { slug: string; name: string; description?: string },
): Promise<DomainDto> {
  if (!SLUG_RE.test(input.slug)) {
    throw new ServiceError(400, 'slug must be 3-32 lowercase letters, digits, or hyphens');
  }
  if (input.name.length < 2 || input.name.length > 64) {
    throw new ServiceError(400, 'name must be 2-64 characters');
  }

  const owned = await db.select({ value: count() }).from(domains).where(eq(domains.createdBy, userId));
  if ((owned[0]?.value ?? 0) >= MAX_DOMAINS_PER_USER) {
    throw new ServiceError(429, 'domain creation limit reached (3 per user)');
  }

  const existing = await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, input.slug)).limit(1);
  if (existing.length > 0) {
    throw new ServiceError(409, 'slug already taken');
  }

  const inserted = await db
    .insert(domains)
    .values({ slug: input.slug, name: input.name, description: input.description ?? null, createdBy: userId })
    .returning();
  const row = inserted[0];
  if (!row) throw new ServiceError(500, 'domain insert failed');
  return { id: row.id, slug: row.slug, name: row.name, description: row.description, isLocked: row.isLocked };
}
```

- [ ] **Step 4: `src/routes/domain.routes.ts`**

```ts
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { createDomain, listDomains } from '../services/domain.service';

const domain = new Hono<AuthEnv>();

domain.get('/api/domains', async (c) => c.json(await listDomains()));

domain.post('/api/domains', async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json()) as { slug: string; name: string; description?: string };
  return c.json(await createDomain(user.id, body), 201);
});

export default domain;
```

- [ ] **Step 5: Mount in `src/index.ts`** — `import domainRoutes from './routes/domain.routes';` + `app.route('/', domainRoutes);`

- [ ] **Step 6: Run tests**

Run from `apps/api`: `bun test`
Expected: all pass.

- [ ] **Step 7: Checks + commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "feat: domain service with slug rules and per-user creation cap"
```

---

### Task 7: Posts — create, feeds (hot/new/top), detail, embed job enqueue

**Files:**
- Create: `apps/api/src/services/post.service.ts`, `apps/api/src/routes/post.routes.ts`
- Modify: `apps/api/src/index.ts` (mount post routes)
- Test: `apps/api/tests/post.test.ts`

**Interfaces:**
- Produces:
  - `createPost(userId: number, domainSlug: string, input: { title: string; body?: string; url: string }): Promise<PostDto>`
  - `listPosts(options: { domainSlug?: string; sort: 'hot' | 'new' | 'top'; window?: 'day' | 'week' | 'all'; limit: number; offset: number }): Promise<PostDto[]>`
  - `getPost(postId: number): Promise<PostDto>`
  - Endpoints `GET /api/posts?domain=&sort=&window=&limit=&offset=`, `POST /api/posts`, `GET /api/posts/:id`
  - Side effect: post creation inserts a `jobs` row `{ type: 'fetch_embed', payload: { postId } }`.

- [ ] **Step 1: Write failing tests `tests/post.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

async function signupCookie(username: string): Promise<string> {
  const response = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

async function createDomain(cookie: string, slug: string): Promise<void> {
  await app.request('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug, name: slug }),
  });
}

describe('posts', () => {
  beforeEach(resetDb);

  it('authenticated user creates post and feed lists it under its domain', async () => {
    const cookie = await signupCookie('tracker');
    await createDomain(cookie, 'sports');

    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'Team X threw the final',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });
    expect(created.status).toBe(201);
    const post = (await created.json()) as { id: number; provider: string | null };
    expect(post.provider).toBeNull();

    const feed = await app.request('/api/posts?domain=sports&sort=new');
    const body = (await feed.json()) as { title: string; domainSlug: string }[];
    expect(body.length).toBe(1);
    expect(body[0]?.domainSlug).toBe('sports');
  });

  it('post creation rejects non-http url with 400 error', async () => {
    const cookie = await signupCookie('tracker');
    await createDomain(cookie, 'sports');
    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ domainSlug: 'sports', title: 't', url: 'ftp://example.com/x' }),
    });
    expect(response.status).toBe(400);
  });

  it('post creation rejects unknown domain slug with 404 error', async () => {
    const cookie = await signupCookie('tracker');
    const response = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ domainSlug: 'nope', title: 't', url: 'https://example.com/a' }),
    });
    expect(response.status).toBe(404);
  });

  it('post creation enqueues an embed fetch job', async () => {
    const cookie = await signupCookie('tracker');
    await createDomain(cookie, 'sports');
    await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ domainSlug: 'sports', title: 't', url: 'https://example.com/a' }),
    });
    const jobs = await app.request('/api/dev/jobs');
    const body = (await jobs.json()) as { type: string; status: string }[];
    expect(body.some((job) => job.type === 'fetch_embed' && job.status === 'pending')).toBe(true);
  });
});
```

(The `/api/dev/jobs` endpoint below is a dev-only observability route — it proves the queue got the row and dies in Plan 3's production config.)

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/post.test.ts`
Expected: FAIL — POST /api/posts 404.

- [ ] **Step 3: `src/services/post.service.ts`**

```ts
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { domains, jobs, posts, users } from '../db/schema';
import { ServiceError } from '../errors';
import type { PostDto } from '@claimtracker/shared';

const WINDOW_MS = { day: 1, week: 7 } as const;

export async function createPost(
  userId: number,
  domainSlug: string,
  input: { title: string; body?: string; url: string },
): Promise<PostDto> {
  const title = input.title.trim();
  if (title.length < 5 || title.length > 300) {
    throw new ServiceError(400, 'title must be 5-300 characters');
  }
  const parsed = new URL(input.url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ServiceError(400, 'url must be http or https');
  }

  const domainRows = await db.select().from(domains).where(eq(domains.slug, domainSlug)).limit(1);
  const domain = domainRows[0];
  if (!domain) throw new ServiceError(404, 'unknown domain');
  if (domain.isLocked) throw new ServiceError(403, 'domain is locked');

  const inserted = await db
    .insert(posts)
    .values({
      domainId: domain.id,
      authorId: userId,
      title,
      body: input.body?.trim() || null,
      url: input.url,
    })
    .returning({ id: posts.id });

  const postId = inserted[0]?.id;
  if (!postId) throw new ServiceError(500, 'post insert failed');

  await db.insert(jobs).values({ type: 'fetch_embed', payload: { postId } });

  return getPost(postId);
}

export async function listPosts(options: {
  domainSlug?: string;
  sort: 'hot' | 'new' | 'top';
  window?: 'day' | 'week' | 'all';
  limit: number;
  offset: number;
}): Promise<PostDto[]> {
  const conditions = [isNull(posts.deletedAt)];
  if (options.domainSlug) {
    conditions.push(eq(domains.slug, options.domainSlug));
  }
  if (options.window && options.window !== 'all') {
    const days = WINDOW_MS[options.window];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    conditions.push(gte(posts.createdAt, since));
  }

  const orderBy =
    options.sort === 'new' ? desc(posts.createdAt) : options.sort === 'top' ? desc(posts.score) : desc(posts.hotRank);

  const rows = await db
    .select({
      id: posts.id,
      domainId: posts.domainId,
      domainSlug: domains.slug,
      author: users.username,
      title: posts.title,
      body: posts.body,
      url: posts.url,
      provider: posts.provider,
      embed: posts.embed,
      score: posts.score,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(options.limit)
    .offset(options.offset);

  return rows.map(toDto);
}

export async function getPost(postId: number): Promise<PostDto> {
  const rows = await db
    .select({
      id: posts.id,
      domainId: posts.domainId,
      domainSlug: domains.slug,
      author: users.username,
      title: posts.title,
      body: posts.body,
      url: posts.url,
      provider: posts.provider,
      embed: posts.embed,
      score: posts.score,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.id, postId), isNull(posts.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new ServiceError(404, 'post not found');
  return toDto(row);
}

function toDto(row: {
  id: number;
  domainId: number;
  domainSlug: string;
  author: string;
  title: string;
  body: string | null;
  url: string;
  provider: string | null;
  embed: unknown;
  score: number;
  createdAt: Date;
}): PostDto {
  return {
    id: row.id,
    domainId: row.domainId,
    domainSlug: row.domainSlug,
    author: row.author,
    title: row.title,
    body: row.body,
    url: row.url,
    provider: row.provider,
    embed: row.embed,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listJobsDev(): Promise<{ id: number; type: string; status: string }[]> {
  const rows = await db
    .select({ id: jobs.id, type: jobs.type, status: jobs.status })
    .from(jobs)
    .orderBy(desc(jobs.id))
    .limit(50);
  return rows;
}
```

- [ ] **Step 4: `src/routes/post.routes.ts`**

```ts
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { ServiceError } from '../errors';
import { createPost, getPost, listJobsDev, listPosts } from '../services/post.service';

const post = new Hono<AuthEnv>();

post.get('/api/posts', async (c) => {
  const sortParam = c.req.query('sort') ?? 'hot';
  if (!['hot', 'new', 'top'].includes(sortParam)) {
    throw new ServiceError(400, 'sort must be hot, new, or top');
  }
  const windowParam = c.req.query('window') ?? 'all';
  if (!['day', 'week', 'all'].includes(windowParam)) {
    throw new ServiceError(400, 'window must be day, week, or all');
  }
  const limit = Math.min(Number(c.req.query('limit') ?? 25), 100);
  const offset = Number(c.req.query('offset') ?? 0);
  return c.json(
    await listPosts({
      domainSlug: c.req.query('domain') || undefined,
      sort: sortParam as 'hot' | 'new' | 'top',
      window: windowParam as 'day' | 'week' | 'all',
      limit,
      offset,
    }),
  );
});

post.post('/api/posts', async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json()) as { domainSlug: string; title: string; body?: string; url: string };
  return c.json(await createPost(user.id, body.domainSlug, body), 201);
});

post.get('/api/posts/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  return c.json(await getPost(id));
});

post.get('/api/dev/jobs', async (c) => c.json(await listJobsDev()));

export default post;
```

- [ ] **Step 5: Mount in `src/index.ts`** — `app.route('/', postRoutes);`

- [ ] **Step 6: Run tests**

Run from `apps/api`: `bun test`
Expected: all pass.

- [ ] **Step 7: Checks + commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "feat: posts with domain feeds, sorting, and embed job enqueue"
```

---

### Task 8: Votes — one per user, atomic score, remove/switch

**Files:**
- Create: `apps/api/src/services/vote.service.ts`
- Modify: `apps/api/src/routes/post.routes.ts` (add the vote endpoint)
- Test: `apps/api/tests/vote.test.ts`

**Interfaces:**
- Produces: `votePost(userId: number, postId: number, value: VoteValue): Promise<{ score: number }>`; endpoint `POST /api/posts/:id/vote` body `{"value": 1 | -1 | 0}` (0 removes).
- Consumes: `votes` unique index `(post_id, user_id)` from Task 2.

- [ ] **Step 1: Write failing tests `tests/vote.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

async function signupCookie(username: string): Promise<string> {
  const response = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

async function seedPost(cookie: string): Promise<number> {
  await app.request('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
  });
  const response = await app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ domainSlug: 'sports', title: 'Team X threw the final', url: 'https://example.com/a' }),
  });
  const post = (await response.json()) as { id: number };
  return post.id;
}

function vote(cookie: string, postId: number, value: number): Promise<Response> {
  return app.request(`/api/posts/${postId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ value }),
  });
}

describe('post votes', () => {
  beforeEach(resetDb);

  it('two users voting yes and no produce net score zero', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postId = await seedPost(alice);

    const up = await vote(alice, postId, 1);
    expect(((await up.json()) as { score: number }).score).toBe(1);

    const down = await vote(bob, postId, -1);
    expect(((await down.json()) as { score: number }).score).toBe(0);
  });

  it('same user switching vote updates score by the delta', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    await vote(alice, postId, 1);
    const switched = await vote(alice, postId, -1);
    expect(((await switched.json()) as { score: number }).score).toBe(-1);
  });

  it('value zero removes the vote entirely', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    await vote(alice, postId, 1);
    const removed = await vote(alice, postId, 0);
    expect(((await removed.json()) as { score: number }).score).toBe(0);
  });

  it('anonymous vote attempt returns 401 error', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);
    const response = await vote('', postId, 1);
    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/vote.test.ts`
Expected: FAIL — vote route 404.

- [ ] **Step 3: `src/services/vote.service.ts`**

```ts
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { posts, votes } from '../db/schema';
import { ServiceError } from '../errors';
import type { VoteValue } from '@claimtracker/shared';

export async function votePost(userId: number, postId: number, value: VoteValue): Promise<{ score: number }> {
  if (value !== 1 && value !== -1 && value !== 0) {
    throw new ServiceError(400, 'value must be 1, -1, or 0');
  }
  const postExists = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (postExists.length === 0) throw new ServiceError(404, 'post not found');

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.postId, postId), eq(votes.userId, userId)))
      .limit(1);
    const existing = existingRows[0];
    const previous = existing?.value ?? 0;

    if (value === 0) {
      await tx.delete(votes).where(and(eq(votes.postId, postId), eq(votes.userId, userId)));
    } else if (existing) {
      await tx.update(votes).set({ value }).where(and(eq(votes.postId, postId), eq(votes.userId, userId)));
    } else {
      await tx.insert(votes).values({ postId, userId, value });
    }

    const delta = value - previous;
    if (delta !== 0) {
      await tx
        .update(posts)
        .set({ score: sql`${posts.score} + ${delta}` })
        .where(eq(posts.id, postId));
    }

    const scoreRows = await tx.select({ score: posts.score }).from(posts).where(eq(posts.id, postId)).limit(1);
    return { score: scoreRows[0]?.score ?? 0 };
  });
}
```

(`sql` template from `drizzle-orm` builds the atomic `score = score + delta` increment — never read-modify-write in JS.)

- [ ] **Step 4: Add vote endpoint in `src/routes/post.routes.ts`**

```ts
post.post('/api/posts/:id/vote', async (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  const body = (await c.req.json()) as { value: number };
  return c.json(await votePost(user.id, id, body.value as VoteValue));
});
```

Add `votePost` to the service import and `import type { VoteValue } from '@claimtracker/shared';`.

- [ ] **Step 5: Run tests**

Run from `apps/api`: `bun test`
Expected: all pass, vote tests included.

- [ ] **Step 6: Checks + commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "feat: post votes with atomic score updates and vote removal"
```

---

### Task 9: Comments — threaded create/read + comment votes

**Files:**
- Create: `apps/api/src/services/comment.service.ts`, `apps/api/src/routes/comment.routes.ts`
- Modify: `apps/api/src/index.ts` (mount comment routes)
- Test: `apps/api/tests/comment.test.ts`

**Interfaces:**
- Produces:
  - `createComment(userId: number, postId: number, input: { body: string; parentId?: number }): Promise<CommentDto>`
  - `listComments(postId: number): Promise<CommentDto[]>` (flat list, `depth` field, ordered oldest-first — nesting is a client concern)
  - `voteComment(userId: number, commentId: number, value: VoteValue): Promise<{ score: number }>`
  - Endpoints `POST /api/posts/:id/comments`, `GET /api/posts/:id/comments`, `POST /api/comments/:id/vote`.

- [ ] **Step 1: Write failing tests `tests/comment.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

async function signupCookie(username: string): Promise<string> {
  const response = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

async function seedPost(cookie: string): Promise<number> {
  await app.request('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
  });
  const response = await app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ domainSlug: 'sports', title: 'Team X threw the final', url: 'https://example.com/a' }),
  });
  return ((await response.json()) as { id: number }).id;
}

describe('comments', () => {
  beforeEach(resetDb);

  it('reply nests under top comment with depth one', async () => {
    const alice = await signupCookie('alice');
    const postId = await seedPost(alice);

    const top = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'the footage does not support this' }),
    });
    expect(top.status).toBe(201);
    const topId = ((await top.json()) as { id: number }).id;

    const reply = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'watch minute 4 again', parentId: topId }),
    });
    expect(reply.status).toBe(201);

    const list = await app.request(`/api/posts/${postId}/comments`);
    const body = (await list.json()) as { id: number; depth: number; parentId: number | null }[];
    expect(body.length).toBe(2);
    const nested = body.find((comment) => comment.id !== topId);
    expect(nested?.depth).toBe(1);
    expect(nested?.parentId).toBe(topId);
  });

  it('reply to comment of another post fails with 400 error', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postA = await seedPost(alice);
    await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ slug: 'politics', name: 'Politics' }),
    });
    const postB = (await (
      await app.request('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: bob },
        body: JSON.stringify({ domainSlug: 'politics', title: 'Other claim entirely', url: 'https://example.com/b' }),
      })
    ).json()) as { id: number };

    const onA = await app.request(`/api/posts/${postA}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'first' }),
    });
    const commentA = ((await onA.json()) as { id: number }).id;

    const cross = await app.request(`/api/posts/${postB}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'cross-post reply', parentId: commentA }),
    });
    expect(cross.status).toBe(400);
  });

  it('comment vote increments score and second vote switches it', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const postId = await seedPost(alice);

    const created = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'sourcing is weak here' }),
    });
    const commentId = ((await created.json()) as { id: number }).id;

    const first = await app.request(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });
    expect(((await first.json()) as { score: number }).score).toBe(1);

    const switched = await app.request(`/api/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ value: -1 }),
    });
    expect(((await switched.json()) as { score: number }).score).toBe(-1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/comment.test.ts`
Expected: FAIL — comment routes 404.

- [ ] **Step 3: `src/services/comment.service.ts`**

```ts
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { commentVotes, comments, posts } from '../db/schema';
import { ServiceError } from '../errors';
import type { CommentDto, VoteValue } from '@claimtracker/shared';

interface CommentRow {
  id: number;
  post_id: number;
  parent_id: number | null;
  body: string;
  score: number;
  created_at: Date | string;
  depth: number;
  author: string;
}

export async function createComment(
  userId: number,
  postId: number,
  input: { body: string; parentId?: number },
): Promise<CommentDto> {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) {
    throw new ServiceError(400, 'comment body must be 1-4000 characters');
  }
  const postExists = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, postId), isNull(posts.deletedAt))).limit(1);
  if (postExists.length === 0) throw new ServiceError(404, 'post not found');

  if (input.parentId !== undefined) {
    const parent = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(eq(comments.id, input.parentId), eq(comments.postId, postId)))
      .limit(1);
    if (parent.length === 0) throw new ServiceError(400, 'parent comment not on this post');
  }

  const inserted = await db
    .insert(comments)
    .values({ postId, authorId: userId, parentId: input.parentId ?? null, body })
    .returning({ id: comments.id });

  const commentId = inserted[0]?.id;
  if (!commentId) throw new ServiceError(500, 'comment insert failed');

  const dto = (await listComments(postId)).find((comment) => comment.id === commentId);
  if (!dto) throw new ServiceError(500, 'comment vanished after insert');
  return dto;
}

export async function listComments(postId: number): Promise<CommentDto[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE tree AS (
      SELECT c.id, c.post_id, c.parent_id, c.body, c.score, c.created_at, 0 AS depth, u.username AS author
      FROM comments c
      JOIN users u ON u.id = c.author_id
      WHERE c.post_id = ${postId} AND c.parent_id IS NULL AND c.deleted_at IS NULL
      UNION ALL
      SELECT c2.id, c2.post_id, c2.parent_id, c2.body, c2.score, c2.created_at, tree.depth + 1, u2.username
      FROM comments c2
      JOIN tree ON c2.parent_id = tree.id
      JOIN users u2 ON u2.id = c2.author_id
      WHERE c2.deleted_at IS NULL
    )
    SELECT id, post_id, parent_id, body, score, created_at, depth, author FROM tree
    ORDER BY created_at ASC
  `);

  return (result.rows as unknown as CommentRow[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    depth: row.depth,
    author: row.author,
    body: row.body,
    score: row.score,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function voteComment(userId: number, commentId: number, value: VoteValue): Promise<{ score: number }> {
  if (value !== 1 && value !== -1 && value !== 0) {
    throw new ServiceError(400, 'value must be 1, -1, or 0');
  }
  const exists = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, commentId)).limit(1);
  if (exists.length === 0) throw new ServiceError(404, 'comment not found');

  return db.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(commentVotes)
      .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)))
      .limit(1);
    const previous = existingRows[0]?.value ?? 0;

    if (value === 0) {
      await tx.delete(commentVotes).where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)));
    } else if (existingRows[0]) {
      await tx.update(commentVotes).set({ value }).where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)));
    } else {
      await tx.insert(commentVotes).values({ commentId, userId, value });
    }

    const delta = value - previous;
    if (delta !== 0) {
      await tx
        .update(comments)
        .set({ score: sql`${comments.score} + ${delta}` })
        .where(eq(comments.id, commentId));
    }

    const scoreRows = await tx.select({ score: comments.score }).from(comments).where(eq(comments.id, commentId)).limit(1);
    return { score: scoreRows[0]?.score ?? 0 };
  });
}
```

- [ ] **Step 4: `src/routes/comment.routes.ts`**

```ts
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { ServiceError } from '../errors';
import { createComment, listComments, voteComment } from '../services/comment.service';
import type { VoteValue } from '@claimtracker/shared';

const comment = new Hono<AuthEnv>();

comment.get('/api/posts/:id/comments', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  return c.json(await listComments(id));
});

comment.post('/api/posts/:id/comments', async (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid post id');
  const body = (await c.req.json()) as { body: string; parentId?: number };
  return c.json(await createComment(user.id, id, body), 201);
});

comment.post('/api/comments/:id/vote', async (c) => {
  const user = requireUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid comment id');
  const body = (await c.req.json()) as { value: number };
  return c.json(await voteComment(user.id, id, body.value as VoteValue));
});

export default comment;
```

- [ ] **Step 5: Mount in `src/index.ts`** — `app.route('/', commentRoutes);`

- [ ] **Step 6: Run tests**

Run from `apps/api`: `bun test`
Expected: all pass.

- [ ] **Step 7: Checks + commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "feat: threaded comments with recursive read and votes"
```

---

### Task 10: Reports + moderation (resolve, remove, domain lock, role guard)

**Files:**
- Create: `apps/api/src/services/report.service.ts`, `apps/api/src/routes/report.routes.ts`, `apps/api/src/routes/mod.routes.ts`
- Modify: `apps/api/src/index.ts` (mount both routers)
- Test: `apps/api/tests/moderation.test.ts`

**Interfaces:**
- Consumes: `requireRole(user, roles)` (Task 5), tables from Task 2.
- Produces:
  - `createReport(reporterId: number, input: { postId?: number; commentId?: number; reason: ReportReason }): Promise<{ id: number; status: string }>`
  - `listReports(status: 'open' | 'resolved' | 'dismissed'): Promise<ReportView[]>` where `ReportView = { id: number; reason: string; status: string; postId: number | null; commentId: number | null; reporter: string; createdAt: string }`
  - `resolveReport(modId: number, reportId: number, decision: 'remove' | 'dismiss', reason: string): Promise<void>`
  - `setDomainLock(modId: number, slug: string, locked: boolean, reason: string): Promise<void>`
  - Endpoints `POST /api/reports`, `GET /api/mod/reports?status=`, `POST /api/mod/reports/:id/resolve`, `POST /api/mod/domains/:slug/lock`.

- [ ] **Step 1: Write failing tests `tests/moderation.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

async function signupCookie(username: string, makeAdmin = false): Promise<string> {
  const response = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  if (makeAdmin) {
    const body = (await response.json()) as { id: number };
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, body.id));
  }
  return cookie;
}

async function seedPost(cookie: string): Promise<number> {
  await app.request('/api/domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
  });
  const response = await app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ domainSlug: 'sports', title: 'Team X threw the final', url: 'https://example.com/a' }),
  });
  return ((await response.json()) as { id: number }).id;
}

describe('moderation', () => {
  beforeEach(resetDb);

  it('mod removing a reported post hides it from feeds and logs the action', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const admin = await signupCookie('admin', true);
    const postId = await seedPost(alice);

    const report = await app.request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: bob },
      body: JSON.stringify({ postId, reason: 'spam' }),
    });
    expect(report.status).toBe(201);
    const reportId = ((await report.json()) as { id: number }).id;

    const resolved = await app.request(`/api/mod/reports/${reportId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: admin },
      body: JSON.stringify({ decision: 'remove', reason: 'reposted referral spam' }),
    });
    expect(resolved.status).toBe(204);

    const detail = await app.request(`/api/posts/${postId}`);
    expect(detail.status).toBe(404);

    const queue = await app.request('/api/mod/reports?status=resolved', { headers: { Cookie: admin } });
    const openBody = (await queue.json()) as { id: number; status: string }[];
    expect(openBody.some((entry) => entry.id === reportId && entry.status === 'resolved')).toBe(true);
  });

  it('regular user cannot open the mod queue and gets 403 error', async () => {
    const alice = await signupCookie('alice');
    const response = await app.request('/api/mod/reports', { headers: { Cookie: alice } });
    expect(response.status).toBe(403);
  });

  it('locking a domain blocks new posts with 403 error', async () => {
    const alice = await signupCookie('alice');
    const admin = await signupCookie('admin', true);
    await seedPost(alice);

    const lock = await app.request('/api/mod/domains/sports/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: admin },
      body: JSON.stringify({ locked: true, reason: 'spam farm' }),
    });
    expect(lock.status).toBe(204);

    const blocked = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ domainSlug: 'sports', title: 'Another claim', url: 'https://example.com/b' }),
    });
    expect(blocked.status).toBe(403);
  });

  it('report without target fails with 400 error', async () => {
    const alice = await signupCookie('alice');
    const response = await app.request('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ reason: 'spam' }),
    });
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/moderation.test.ts`
Expected: FAIL — `/api/reports` 404.

- [ ] **Step 3: `src/services/report.service.ts`**

```ts
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { comments, domains, modActions, posts, reports, users } from '../db/schema';
import { ServiceError } from '../errors';
import type { ReportReason } from '@claimtracker/shared';

const REASONS: ReportReason[] = ['spam', 'harassment', 'personal_info', 'illegal', 'off_domain'];

export interface ReportView {
  id: number;
  reason: string;
  status: string;
  postId: number | null;
  commentId: number | null;
  reporter: string;
  createdAt: string;
}

export async function createReport(
  reporterId: number,
  input: { postId?: number; commentId?: number; reason: ReportReason },
): Promise<{ id: number; status: string }> {
  if (!REASONS.includes(input.reason)) {
    throw new ServiceError(400, 'reason must be one of: ' + REASONS.join(', '));
  }
  const hasPost = input.postId !== undefined;
  const hasComment = input.commentId !== undefined;
  if (hasPost === hasComment) {
    throw new ServiceError(400, 'exactly one of postId or commentId is required');
  }
  if (hasPost) {
    const exists = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, input.postId)).limit(1);
    if (exists.length === 0) throw new ServiceError(404, 'post not found');
  }
  if (hasComment) {
    const exists = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, input.commentId)).limit(1);
    if (exists.length === 0) throw new ServiceError(404, 'comment not found');
  }

  const inserted = await db
    .insert(reports)
    .values({
      reporterId,
      postId: input.postId ?? null,
      commentId: input.commentId ?? null,
      reason: input.reason,
    })
    .returning({ id: reports.id, status: reports.status });
  const row = inserted[0];
  if (!row) throw new ServiceError(500, 'report insert failed');
  return row;
}

export async function listReports(status: 'open' | 'resolved' | 'dismissed'): Promise<ReportView[]> {
  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      status: reports.status,
      postId: reports.postId,
      commentId: reports.commentId,
      reporter: users.username,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(100);

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function resolveReport(
  modId: number,
  reportId: number,
  decision: 'remove' | 'dismiss',
  reason: string,
): Promise<void> {
  if (reason.trim().length < 3) {
    throw new ServiceError(400, 'reason is required (min 3 characters)');
  }
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    const report = rows[0];
    if (!report) throw new ServiceError(404, 'report not found');
    if (report.status !== 'open') throw new ServiceError(409, 'report already resolved');

    if (decision === 'remove') {
      const now = new Date();
      if (report.postId !== null) {
        await tx.update(posts).set({ deletedAt: now }).where(eq(posts.id, report.postId));
      }
      if (report.commentId !== null) {
        await tx.update(comments).set({ deletedAt: now }).where(eq(comments.id, report.commentId));
      }
    }

    await tx
      .update(reports)
      .set({ status: decision === 'remove' ? 'resolved' : 'dismissed' })
      .where(eq(reports.id, reportId));

    await tx.insert(modActions).values({
      modId,
      action: decision === 'remove' ? 'remove_content' : 'dismiss_report',
      targetPostId: report.postId,
      targetUserId: null,
      reason,
    });
  });
}

export async function setDomainLock(
  modId: number,
  slug: string,
  locked: boolean,
  reason: string,
): Promise<void> {
  if (reason.trim().length < 3) {
    throw new ServiceError(400, 'reason is required (min 3 characters)');
  }
  const rows = await db.select({ id: domains.id }).from(domains).where(eq(domains.slug, slug)).limit(1);
  if (rows.length === 0) throw new ServiceError(404, 'unknown domain');

  await db.update(domains).set({ isLocked: locked }).where(eq(domains.slug, slug));
  await db.insert(modActions).values({
    modId,
    action: locked ? 'lock_domain' : 'unlock_domain',
    targetPostId: null,
    targetUserId: null,
    reason,
  });
}
```

- [ ] **Step 4: `src/routes/report.routes.ts`**

```ts
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireUser } from '../middleware/auth';
import { createReport } from '../services/report.service';
import type { ReportReason } from '@claimtracker/shared';

const report = new Hono<AuthEnv>();

report.post('/api/reports', async (c) => {
  const user = requireUser(c);
  const body = (await c.req.json()) as { postId?: number; commentId?: number; reason: ReportReason };
  return c.json(await createReport(user.id, body), 201);
});

export default report;
```

- [ ] **Step 5: `src/routes/mod.routes.ts`**

```ts
import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { requireRole, requireUser } from '../middleware/auth';
import { ServiceError } from '../errors';
import { listReports, resolveReport, setDomainLock } from '../services/report.service';

const mod = new Hono<AuthEnv>();

mod.get('/api/mod/reports', async (c) => {
  const user = requireUser(c);
  requireRole(user, ['mod', 'admin']);
  const status = c.req.query('status') ?? 'open';
  if (!['open', 'resolved', 'dismissed'].includes(status)) {
    throw new ServiceError(400, 'status must be open, resolved, or dismissed');
  }
  return c.json(await listReports(status as 'open' | 'resolved' | 'dismissed'));
});

mod.post('/api/mod/reports/:id/resolve', async (c) => {
  const user = requireUser(c);
  requireRole(user, ['mod', 'admin']);
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) throw new ServiceError(400, 'invalid report id');
  const body = (await c.req.json()) as { decision: 'remove' | 'dismiss'; reason: string };
  if (!['remove', 'dismiss'].includes(body.decision)) {
    throw new ServiceError(400, 'decision must be remove or dismiss');
  }
  await resolveReport(user.id, id, body.decision, body.reason);
  return c.body(null, 204);
});

mod.post('/api/mod/domains/:slug/lock', async (c) => {
  const user = requireUser(c);
  requireRole(user, ['mod', 'admin']);
  const body = (await c.req.json()) as { locked: boolean; reason: string };
  await setDomainLock(user.id, c.req.param('slug'), body.locked, body.reason);
  return c.body(null, 204);
});

export default mod;
```

- [ ] **Step 6: Mount both in `src/index.ts`** — `app.route('/', reportRoutes); app.route('/', modRoutes);`

- [ ] **Step 7: Run tests**

Run from `apps/api`: `bun test`
Expected: all pass.

- [ ] **Step 8: Checks + commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "feat: reports queue with mod resolve, content removal, domain lock"
```

---

### Task 11: User profiles (karma + history)

**Files:**
- Create: `apps/api/src/services/profile.service.ts`, `apps/api/src/routes/profile.routes.ts`
- Modify: `apps/api/src/index.ts` (mount profile routes)
- Test: `apps/api/tests/profile.test.ts`

**Interfaces:**
- Consumes: `posts`, `users`, `comments` tables; `PostDto`.
- Produces: `getUserProfile(username: string): Promise<UserProfileDto>` where `UserProfileDto = { username: string; role: string; karma: number; createdAt: string; posts: PostDto[]; commentCount: number }`; endpoint `GET /api/users/:username`.
- Also adds `UserProfileDto` to `packages/shared/src/index.ts`.

- [ ] **Step 1: Add `UserProfileDto` to `packages/shared/src/index.ts`** (append inside the existing file — `PostDto` lives there already, no import needed):

```ts
export interface UserProfileDto {
  username: string;
  role: string;
  karma: number;
  createdAt: string;
  posts: PostDto[];
  commentCount: number;
}
```

- [ ] **Step 2: Write failing tests `tests/profile.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

async function signupCookie(username: string): Promise<string> {
  const response = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

describe('user profiles', () => {
  beforeEach(resetDb);

  it('profile lists the author posts and comment count', async () => {
    const alice = await signupCookie('alice');
    await app.request('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ slug: 'sports', name: 'Sports' }),
    });
    const created = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ domainSlug: 'sports', title: 'Team X threw the final', url: 'https://example.com/a' }),
    });
    const postId = ((await created.json()) as { id: number }).id;
    await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alice },
      body: JSON.stringify({ body: 'adding context' }),
    });

    const response = await app.request('/api/users/alice');
    expect(response.status).toBe(200);
    const profile = (await response.json()) as {
      username: string;
      karma: number;
      posts: { id: number }[];
      commentCount: number;
    };
    expect(profile.username).toBe('alice');
    expect(profile.posts.length).toBe(1);
    expect(profile.commentCount).toBe(1);
  });

  it('unknown username returns 404 error', async () => {
    const response = await app.request('/api/users/ghost');
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run from `apps/api`: `bun test tests/profile.test.ts`
Expected: FAIL — 404 on `/api/users/alice`.

- [ ] **Step 4: `src/services/profile.service.ts`**

```ts
import { count, desc, eq, isNull, and } from 'drizzle-orm';
import { db } from '../db/client';
import { comments, domains, posts, users } from '../db/schema';
import { ServiceError } from '../errors';
import type { PostDto, UserProfileDto } from '@claimtracker/shared';

export async function getUserProfile(username: string): Promise<UserProfileDto> {
  const userRows = await db
    .select({ id: users.id, username: users.username, role: users.role, karma: users.karma, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const user = userRows[0];
  if (!user) throw new ServiceError(404, 'user not found');

  const postRows = await db
    .select({
      id: posts.id,
      domainId: posts.domainId,
      domainSlug: domains.slug,
      author: users.username,
      title: posts.title,
      body: posts.body,
      url: posts.url,
      provider: posts.provider,
      embed: posts.embed,
      score: posts.score,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(domains, eq(domains.id, posts.domainId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(eq(posts.authorId, user.id), isNull(posts.deletedAt)))
    .orderBy(desc(posts.createdAt))
    .limit(25);

  const commentCount = await db
    .select({ value: count() })
    .from(comments)
    .where(and(eq(comments.authorId, user.id), isNull(comments.deletedAt)));

  const toDto = (row: (typeof postRows)[number]): PostDto => ({
    id: row.id,
    domainId: row.domainId,
    domainSlug: row.domainSlug,
    author: row.author,
    title: row.title,
    body: row.body,
    url: row.url,
    provider: row.provider,
    embed: row.embed,
    score: row.score,
    createdAt: row.createdAt.toISOString(),
  });

  return {
    username: user.username,
    role: user.role,
    karma: user.karma,
    createdAt: user.createdAt.toISOString(),
    posts: postRows.map(toDto),
    commentCount: commentCount[0]?.value ?? 0,
  };
}
```

- [ ] **Step 5: `src/routes/profile.routes.ts`**

```ts
import { Hono } from 'hono';
import { getUserProfile } from '../services/profile.service';

const profile = new Hono();

profile.get('/api/users/:username', async (c) => c.json(await getUserProfile(c.req.param('username'))));

export default profile;
```

- [ ] **Step 6: Mount in `src/index.ts`** — `app.route('/', profileRoutes);`

- [ ] **Step 7: Run tests**

Run from `apps/api`: `bun test`
Expected: all pass.

- [ ] **Step 8: Checks + commit**

```bash
git add packages/shared/src/index.ts apps/api/src apps/api/tests
git commit -m "feat: public user profiles with post history and comment count"
```

---

### Task 12: End-to-end journey test (Plan 1 acceptance)

**Files:**
- Test: `apps/api/tests/journey.test.ts`

**Interfaces:**
- Consumes: every endpoint from Tasks 5-11. No new production code — this task proves the API walks the full user journey.

- [ ] **Step 1: Write the journey test `tests/journey.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema';
import { app } from '../src/index';
import { resetDb } from '../src/db/testSetup';

async function signupCookie(username: string, makeAdmin = false): Promise<string> {
  const response = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password: 'correct-horse-battery',
    }),
  });
  const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  if (makeAdmin) {
    const body = (await response.json()) as { id: number };
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, body.id));
  }
  return cookie;
}

const json = { 'Content-Type': 'application/json' };

describe('claim tracker journey', () => {
  beforeEach(resetDb);

  it('poster, voter, commenter, reporter, and mod complete one claim lifecycle', async () => {
    const alice = await signupCookie('alice');
    const bob = await signupCookie('bob');
    const admin = await signupCookie('admin', true);

    const domain = await app.request('/api/domains', {
      method: 'POST',
      headers: { ...json, Cookie: alice },
      body: JSON.stringify({ slug: 'sports', name: 'Sports', description: 'claims about sports' }),
    });
    expect(domain.status).toBe(201);

    const post = await app.request('/api/posts', {
      method: 'POST',
      headers: { ...json, Cookie: alice },
      body: JSON.stringify({
        domainSlug: 'sports',
        title: 'Team X threw the final',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    });
    expect(post.status).toBe(201);
    const postId = ((await post.json()) as { id: number }).id;

    const voted = await app.request(`/api/posts/${postId}/vote`, {
      method: 'POST',
      headers: { ...json, Cookie: bob },
      body: JSON.stringify({ value: 1 }),
    });
    expect(((await voted.json()) as { score: number }).score).toBe(1);

    const commented = await app.request(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { ...json, Cookie: bob },
      body: JSON.stringify({ body: 'footage contradicts the claim at minute four' }),
    });
    expect(commented.status).toBe(201);

    const profile = await app.request('/api/users/alice');
    const profileBody = (await profile.json()) as { posts: unknown[]; commentCount: number };
    expect(profileBody.posts.length).toBe(1);

    const flagged = await app.request('/api/reports', {
      method: 'POST',
      headers: { ...json, Cookie: bob },
      body: JSON.stringify({ postId, reason: 'spam' }),
    });
    const reportId = ((await flagged.json()) as { id: number }).id;

    const queue = await app.request('/api/mod/reports', { headers: { Cookie: admin } });
    const queueBody = (await queue.json()) as { id: number }[];
    expect(queueBody.some((entry) => entry.id === reportId)).toBe(true);

    const resolved = await app.request(`/api/mod/reports/${reportId}/resolve`, {
      method: 'POST',
      headers: { ...json, Cookie: admin },
      body: JSON.stringify({ decision: 'remove', reason: 'spam confirmed by three reports' }),
    });
    expect(resolved.status).toBe(204);

    const afterRemoval = await app.request('/api/posts?domain=sports&sort=new');
    const feed = (await afterRemoval.json()) as { id: number }[];
    expect(feed.some((entry) => entry.id === postId)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run from `apps/api`: `bun test`
Expected: every file passes, journey included.

- [ ] **Step 3: Full pipeline check**

Run from root: `pre-commit run --all-files`
Expected: all hooks pass (biome zero warnings, ruff no-op until Python exists, vale clean).

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/journey.test.ts
git commit -m "test: end-to-end claim lifecycle through moderation"
```

---

## Plan 1 Exit Criteria

- `bun test` green in `apps/api` — auth, domains, posts, votes, comments, moderation, profiles, journey
- `pre-commit run --all-files` clean
- Every spec §8 endpoint except worker-side behavior exists and is covered by at least one test
- Embeds fetch, hot-rank recompute, karma recount (worker) remain 0-value stubs until Plan 2 — `provider`/`embed` are null, `hotRank` is 0 everywhere, `users.karma` stays 0

## Self-Review Notes

- Spec coverage: §5 data model (Task 2), §6 voting/ranking (Task 8; ranking compute deferred to Plan 2 per plan split), §6 auth (Tasks 4-5), §7 moderation (Task 10), §8 API surface (Tasks 5-11 + `/api/dev/jobs` observability), profiles (Task 11). Deferred by design: embed pipeline, hot-rank worker, karma recount (Plan 2), UI, deploy, ToS (Plans 2-3).
- Placeholder scan: no TBDs; every code step shows full file content.
- Type consistency: `SessionUser`, `VoteValue`, `PostDto`, `CommentDto`, `ReportReason`, `ReportView`, `UserProfileDto` used with one consistent shape across tasks.
- Known deliberate simplifications: in-memory login rate limiter (single instance — spec accepts v1), `/api/dev/jobs` to be gated or removed in Plan 3, hot sort returns arbitrary order while all `hotRank` are 0 (acceptable until Plan 2 worker lands).


---
