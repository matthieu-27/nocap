# NoCaP — Plan 2: Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/web` (React Router v8 framework mode + Tailwind v4 + shadcn/ui), apply the tweakcn theme, and ship the app shell + auth pages + legal pages — signup/login/logout working end to end against the existing Better Auth API.

**Architecture:** SSR web app that never touches the database: server-side loaders call the Hono API over localhost, browser requests to `/api/*` are proxied same-origin (Vite dev proxy now, Caddy in production), so the Better Auth cookie is first-party and no CORS exists anywhere. Shell = flex-between navbar (logo / search / account dropdown) + channel sidebar in a layout route; auth pages render outside the shell, centered (login-01 / signup-01 block shapes). Content screens (feed, post detail, submit, mod queue, profile) are **not** this plan — they need API endpoints from Plan 1 Tasks 6-12, which are not yet implemented. Plan 3 covers them.

**Tech Stack:** Bun, React Router v8 framework mode (SSR, Vite), Tailwind v4 + shadcn/ui (new-york, source-copied), Better Auth React client, Vitest + Testing Library (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-09-01-claim-tracker-design.md` (product), `docs/superpowers/specs/2026-09-03-better-auth-replacement-design.md` (auth client scope), `docs/design/claim-tracker-ui-frames.html` (visual reference for every component).

## Global Constraints

- Runtime: Bun everywhere. Library scaffolding runs via `bunx`, never `npx`.
- Lint: Biome, zero warnings — `bun run check` before every commit; never `--no-verify`.
- TypeScript strict, `noUncheckedIndexedAccess` on, no `as any`/unjustified assertions.
- One test file per component, named exactly like the component file (`Navbar.tsx` → `Navbar.test.tsx`), in the same directory.
- Buttons tested with `getByRole('button', …)`, never `getByText`. Never `waitFor(async () => {…})`. All props passed in tests.
- Components are real components — no helper functions returning JSX (`no-render-helpers`).
- Tests use Testing Library + jsdom; web unit tests may stub `fetch`/pass callback props (frontend convention — the backend `check_no_mock` rule does not apply to the web layer, whose own rules file demonstrates `jest.mock` usage).
- Commit style: `feat:`/`test:`/`chore:` conventional, small commits per task, message ends with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Branch: `feat/web-foundation`, cut from `feat/better-auth-replacement` (web needs the Better Auth API).
- The tweakcn export in `app/styles.css` is the user's file, pasted verbatim — do not restyle, re-order, or "improve" its tokens.

---

## File Structure

**Layout at end of Plan 2:**

```
apps/web/
├── package.json                  # react-router template + added deps
├── vite.config.ts                # RRv8 + tailwindcss plugins + /api proxy
├── react-router.config.ts        # ssr: true
├── tsconfig.json                 # strict + @/* paths
├── components.json               # shadcn config
├── .env.example                  # API_URL
└── app/
    ├── root.tsx                  # Layout: html shell, fonts, styles, no-FOUC theme script
    ├── routes.ts                 # route table: shell layout + auth + legal
    ├── styles.css                # tweakcn export verbatim + fontsource wiring
    ├── vitest.setup.ts           # jest-dom + act environment (jsdom only)
    ├── lib/
    │   ├── utils.ts              # cn()
    │   ├── api.ts                # server-side API fetch with cookie forwarding
    │   └── auth-client.ts        # createAuthClient + toSessionUser adapter
    ├── components/
    │   ├── Logo.tsx              # wordmark slot (user generates real logo later)
    │   ├── SearchBar.tsx         # inert v1 (no search endpoint in spec §8)
    │   ├── ThemeToggle.tsx
    │   ├── Navbar.tsx            # flex-between: logo / search / account
    │   ├── AccountMenu.tsx       # logged-out buttons | logged-in dropdown
    │   ├── ChannelSidebar.tsx    # channels ScrollArea + Legal column
    │   ├── SignupForm.tsx        # signup-01 block shape, props-driven
    │   └── ui/                   # shadcn CLI-generated primitives
    └── routes/
        ├── _shell.tsx            # layout: navbar + sidebar + Outlet
        ├── home.tsx              # honest placeholder until Plan 3
        ├── terms.tsx  privacy.tsx  contact.tsx   # static legal pages
        └── login.tsx  signup.tsx                # auth pages (outside shell)
```

Modified outside `apps/web`: `vitest.config.ts` (root — jsdom env for web tests), `packages/shared/src/index.ts` (+ handle constants), `apps/api/src/lib/auth.ts` (one line: password min length).

---

### Task 1: Scaffold apps/web (RRv8 + Bun compatibility check)

**Files:**
- Create: `apps/web/` (template), `apps/web/vite.config.ts`, `apps/web/.env.example`
- Modify: `vitest.config.ts` (root)
- Delete: template's ESLint files, demo assets

**Interfaces:**
- Produces: runnable RRv8 SSR app (`bun run build` exits 0 — this IS the spec §11 "verify Bun + Vite 7 + RRv8 in week one" risk item), `/api` dev proxy, jsdom test environment for `.test.tsx` files.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/web-foundation
```

- [ ] **Step 2: Create the app from the official template**

```bash
bun create react-router@latest apps/web
```

Answer prompts: framework template (default), install dependencies yes. If the CLI offers ESLint/Prettier setup, decline — this repo lints with Biome. Then delete the template's ESLint/Prettier files if any were still created (`eslint.config.*`, `.eslintrc*`, `.prettierrc*`) and remove their deps from `apps/web/package.json` if listed.

- [ ] **Step 3: Add dependencies**

```bash
cd apps/web
bun add tailwindcss @tailwindcss/vite better-auth @nocap/shared@workspace:* clsx tailwind-merge class-variance-authority lucide-react
bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom
```

(`@nocap/shared` link — the existing shared package, note the scope is `@nocap`, not `@claimtracker`.)

- [ ] **Step 4: `vite.config.ts`** — replace template's file entirely:

```ts
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [reactRouter(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

Why the proxy: the browser talks to one origin (`:3000`); `/api/*` is forwarded to the Hono API. The Better Auth session cookie stays first-party — no CORS, no cross-site cookie config, and the same shape in production where Caddy proxies `/api` instead.

- [ ] **Step 5: `apps/web/.env.example`**

```
API_URL=http://localhost:3001
```

- [ ] **Step 6: Trim the template demo** — replace the body of `app/routes/home.tsx` with:

```tsx
export default function HomeRoute(): React.ReactElement {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">NoCaP</h1>
    </main>
  );
}
```

Delete `app/routes/*.tsx` demo routes other than `home.tsx` and update `app/routes.ts` accordingly:

```ts
import { type RouteConfig, index } from '@react-router/dev/routes';

export const routes: RouteConfig = [index('./routes/home.tsx')];
```

- [ ] **Step 7: Root `vitest.config.ts`** — replace entirely (adds jsdom for web component tests, `.tsx` test glob):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // apps/api tests import `bun:test` (Bun runtime) and run via `bun test`.
    exclude: ['**/node_modules/**', 'apps/api/**', 'apps/web/build/**'],
    include: ['apps/**/*.{test,spec}.{ts,tsx}', 'packages/**/*.{test,spec}.ts'],
    restoreMocks: true,
    environment: 'node',
    environmentMatchGlobs: [['apps/web/**/*.test.tsx', 'jsdom']],
    setupFiles: ['apps/web/vitest.setup.ts'],
  },
});
```

- [ ] **Step 8: `apps/web/app/vitest.setup.ts`** — DOM matchers load only in jsdom runs:

```ts
// Loaded by every vitest run (see root vitest.config.ts). DOM matchers only
// make sense under jsdom, so guard the import; the act flag is harmless in node.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
}
```

- [ ] **Step 9: Verify build (spec risk item — do not skip)**

```bash
cd apps/web && bun run build
```

Expected: build exits 0 and writes `apps/web/build/`. If React Router v8 or Vite fails under Bun, STOP — report the exact error. This is the spec's week-one compatibility gate; a failure here changes the stack decision, not just this task.

- [ ] **Step 10: Verify test plumbing**

```bash
cd <repo root> && bun run test
```

Expected: existing shared tests pass, zero web tests (none yet), exit 0.

- [ ] **Step 11: Checks + commit**

```bash
bun run check
git add apps/web vitest.config.ts
git commit -m "chore: scaffold react-router v8 web app with tailwind and test setup

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: tweakcn theme + fonts + dark mode

**Files:**
- Create: `apps/web/app/styles.css`, `apps/web/app/components/ThemeToggle.tsx`
- Test: `apps/web/app/components/ThemeToggle.test.tsx`
- Modify: `apps/web/app/root.tsx`
- Delete: template's `app/app.css` (or equivalent)

**Interfaces:**
- Produces: `styles.css` (the theme — every component styles against its tokens), `ThemeToggle` (icon button, toggles `.dark` on `<html>`, persists to `localStorage` key `nocap-theme`), root `Layout` with no-FOUC theme script.

- [ ] **Step 1: Font packages (self-hosted — no Google Fonts requests; spec §7 "no trackers")**

```bash
cd apps/web
bun add @fontsource-variable/inter @fontsource-variable/geist @fontsource-variable/jetbrains-mono @fontsource/space-mono
```

- [ ] **Step 2: `app/styles.css`** — the user's tweakcn export verbatim (all of it: `@import "tailwindcss"`, `@custom-variant dark`, `:root`, `.dark`, `@theme inline`, `@layer base`), from `docs/design/claim-tracker-ui-frames.html` lines with the `/* ═══ tweakcn export ═══ */` comment — copy those token blocks exactly. Prepend font imports and append the font-name remap:

```css
@import '@fontsource-variable/inter';
@import '@fontsource-variable/geist';
@import '@fontsource-variable/jetbrains-mono';
@import '@fontsource/space-mono';

/* … user's tweakcn export, verbatim, unchanged … */

/* Font wiring (the only addition): fontsource registers families as
   "… Variable"; remap the export's font tokens to the local families. */
:root {
  --font-sans: 'Inter Variable', Inter, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', 'JetBrains Mono', monospace;
}

.dark {
  --font-sans: 'Geist Variable', Geist, system-ui, sans-serif;
  --font-mono: 'Space Mono', monospace;
}
```

If a later tweakcn export replaces the tokens, only the verbatim block changes — this addition and the components stay put.

- [ ] **Step 3: `app/root.tsx`** — replace the template's root entirely:

```tsx
import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import './styles.css';

// No-FOUC: runs before first paint; honors stored choice, falls back to system.
const themeInit = `try{var t=localStorage.getItem('nocap-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export function Layout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App(): React.ReactElement {
  return <Outlet />;
}
```

- [ ] **Step 4: Write failing test `app/components/ThemeToggle.test.tsx`**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('first click switches the page to dark theme and stores the choice', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('nocap-theme')).toBe('dark');
  });

  it('second click switches back to light theme', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('nocap-theme')).toBe('light');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd <repo root> && bun run test
```

Expected: FAIL — cannot resolve `./ThemeToggle`.

- [ ] **Step 6: `app/components/ThemeToggle.tsx`** (uses shadcn `Button` — generate primitives first if Task 3 hasn't run yet; otherwise run `bunx shadcn@latest add button` now):

```tsx
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

export function ThemeToggle(): React.ReactElement {
  function handleClick(): void {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('nocap-theme', isDark ? 'dark' : 'light');
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={handleClick}>
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

```bash
bun run test
```

Expected: ThemeToggle tests PASS.

- [ ] **Step 8: Build + check + commit**

```bash
cd apps/web && bun run build
cd .. && bun run check
git add apps/web/app/styles.css apps/web/app/root.tsx apps/web/app/vitest.setup.ts apps/web/app/components
git commit -m "feat: tweakcn theme with self-hosted fonts and dark mode toggle

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: shadcn/ui setup + primitives

**Files:**
- Create: `apps/web/components.json`, `apps/web/app/lib/utils.ts`, `apps/web/app/components/ui/*` (CLI-generated)

**Interfaces:**
- Produces: shadcn primitives the rest of the plan imports: `@/components/ui/{button,card,input,label,textarea,select,dropdown-menu,avatar,badge,scroll-area,separator,skeleton,alert,tabs,dialog}`, and `cn()` from `@/lib/utils`.

- [ ] **Step 1: `components.json`** — create at `apps/web/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/styles.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Path alias in `apps/web/tsconfig.json`** — add to `compilerOptions` (keep the template's other options, and set `"noUncheckedIndexedAccess": true` to match repo base):

```json
"baseUrl": ".",
"paths": { "@/*": ["./app/*"] }
```

- [ ] **Step 3: `app/lib/utils.ts`**:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Add primitives (bun, not npx)**

```bash
cd apps/web
bunx shadcn@latest add button card input label textarea select dropdown-menu avatar badge scroll-area separator skeleton alert tabs dialog
```

Expected: files appear under `app/components/ui/`, radix deps installed by the CLI via bun, exit 0. Deliberately NOT adding `sonner` here: the shadcn sonner wrapper imports `next-themes`, which doesn't apply to React Router. Toasts arrive in Plan 3 with the plain `sonner` package.

- [ ] **Step 5: Verify**

```bash
bun run build && cd .. && bun run check && bun run test
```

Expected: build exits 0; Biome may flag the generated files — fix with `bun run check:fix` and re-run until clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "chore: shadcn ui setup with base primitives

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Site handle + provider constants in shared

**Files:**
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/handles.test.ts`

**Interfaces:**
- Produces (consumed by web components and later by Plan 3's submit form):
  - `SITE_NAME: 'NoCaP'`, `SITE_HANDLE: 'nocap'` (changeable constants — the "domain signature")
  - `SUPPORTED_PROVIDERS: readonly ['youtube', 'tiktok', 'link']`, `ProviderId` type
  - `channelHandle(slug: string): string` → `nocap/sports`; `userHandle(username: string): string` → `nocap/trackfan`

- [ ] **Step 1: Write failing test `packages/shared/src/handles.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  SITE_HANDLE,
  SITE_NAME,
  SUPPORTED_PROVIDERS,
  channelHandle,
  userHandle,
} from './index';

describe('site handles', () => {
  it('channel handle prefixes slug with the site handle', () => {
    expect(channelHandle('politics')).toBe('nocap/politics');
  });

  it('user handle prefixes username with the site handle', () => {
    expect(userHandle('trackfan')).toBe('nocap/trackfan');
  });

  it('supported providers lists youtube, tiktok, and link for v1', () => {
    expect(SUPPORTED_PROVIDERS).toEqual(['youtube', 'tiktok', 'link']);
  });

  it('site name is NoCaP and its handle is nocap', () => {
    expect(SITE_NAME).toBe('NoCaP');
    expect(SITE_HANDLE).toBe('nocap');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test
```

Expected: FAIL — `SITE_NAME` etc. not exported.

- [ ] **Step 3: Append to `packages/shared/src/index.ts`**

```ts
export const SITE_NAME = 'NoCaP';
export const SITE_HANDLE = 'nocap';

// Registry of postable source types (spec §6). Provider adapters in the
// worker are separate modules keyed by these ids — adding a provider means
// one entry here plus one adapter, no form or schema changes.
export const SUPPORTED_PROVIDERS = ['youtube', 'tiktok', 'link'] as const;
export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

export function channelHandle(slug: string): string {
  return `${SITE_HANDLE}/${slug}`;
}

export function userHandle(username: string): string {
  return `${SITE_HANDLE}/${username}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 5: Checks + commit**

```bash
bun run check
git add packages/shared/src
git commit -m "feat: site handle and provider registry constants

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: API client + Better Auth client

**Files:**
- Create: `apps/web/app/lib/api.ts`, `apps/web/app/lib/auth-client.ts`
- Test: `apps/web/app/lib/api.test.ts`

**Interfaces:**
- Produces:
  - `apiFetch<T>(request: Request, path: string): Promise<T>` — server-side only (loaders); forwards the browser's `Cookie` header to `API_URL`, throws `ApiError(status, message)` on non-2xx.
  - `authClient` — Better Auth React client (same-origin `/api/auth` via the proxy; `useSession`, `signIn`, `signUp`, `signOut`).
  - `toSessionUser(user): SessionUser | null` — adapter from Better Auth's user object to the shared `SessionUser`.

- [ ] **Step 1: Write failing test `app/lib/api.test.ts`** (node environment — no jsdom pragma):

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards the browser cookie header and returns parsed json', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchSpy);

    const request = new Request('http://localhost:3000/d/sports', {
      headers: { Cookie: 'nocap_session=abc' },
    });
    const result = await apiFetch<{ ok: boolean }>(request, '/api/domains');

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/api/domains');
    expect(new Headers(init.headers).get('Cookie')).toBe('nocap_session=abc');
  });

  it('throws ApiError with the response status when the api rejects', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ error: 'nope' }, 500));

    const request = new Request('http://localhost:3000/');
    try {
      await apiFetch(request, '/api/domains');
      throw new Error('expected apiFetch to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test
```

Expected: FAIL — cannot resolve `./api`.

- [ ] **Step 3: `app/lib/api.ts`**

```ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

// Server-side only (SSR loaders). The spec forbids web→DB: loaders proxy to
// the Hono API on localhost, forwarding the session cookie so authenticated
// data renders on the server too.
export async function apiFetch<T>(request: Request, path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Cookie: request.headers.get('Cookie') ?? '' },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `API request failed: ${path}`);
  }
  return (await response.json()) as T;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 5: `app/lib/auth-client.ts`**

```ts
import type { SessionUser } from '@nocap/shared';
import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

// baseURL omitted on purpose: the client defaults to same-origin /api/auth,
// which the Vite proxy (dev) / Caddy (prod) forwards to the Hono API.
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

const ROLES = ['user', 'mod', 'admin'] as const;

// Better Auth's user object carries more fields than our SessionUser, and its
// role is a plain string. Narrow both: unknown roles fall back to 'user' so a
// future role value can never leak an unhandled union member into the UI.
export function toSessionUser(
  user: { id: number; username: string; role: string } | null,
): SessionUser | null {
  if (!user) return null;
  const knownRole = ROLES.find((role) => role === user.role);
  return { id: user.id, username: user.username, role: knownRole ?? 'user' };
}
```

- [ ] **Step 6: Checks + commit**

```bash
bun run check
git add apps/web/app/lib
git commit -m "feat: ssr api client and better-auth react client

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Navbar — logo, search, account dropdown

**Files:**
- Create: `apps/web/app/components/Logo.tsx`, `SearchBar.tsx`, `AccountMenu.tsx`, `Navbar.tsx`
- Test: `apps/web/app/components/AccountMenu.test.tsx`, `Navbar.test.tsx`

**Interfaces:**
- Consumes: `authClient` (Task 5), `SITE_NAME`/`userHandle` (Task 4), shadcn primitives (Task 3).
- Produces: `Navbar` props `{ user: SessionUser | null; onSignOut: () => void }` — the `_shell` layout (Task 8) owns the session hook and passes these down, keeping the component testable with props.

- [ ] **Step 1: Write failing test `AccountMenu.test.tsx`**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { SessionUser } from '@nocap/shared';
import { AccountMenu } from './AccountMenu';

const guest = null;
const trackfan: SessionUser = { id: 1, username: 'trackfan', role: 'user' };

describe('AccountMenu', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('logged-out visitor sees Log in and Sign up buttons', () => {
    render(
      <MemoryRouter>
        <AccountMenu user={guest} onSignOut={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
  });

  it('logged-in user opens the dropdown and sees handle and Log out', () => {
    render(
      <MemoryRouter>
        <AccountMenu user={trackfan} onSignOut={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('nocap/trackfan')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
  });

  it('logged-in user clicking Log out calls onSignOut', () => {
    const onSignOut = vi.fn();
    render(
      <MemoryRouter>
        <AccountMenu user={trackfan} onSignOut={onSignOut} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test
```

Expected: FAIL — cannot resolve `./AccountMenu`.

- [ ] **Step 3: `app/components/AccountMenu.tsx`**

```tsx
import { Link } from 'react-router';
import { LogOut } from 'lucide-react';
import type { SessionUser } from '@nocap/shared';
import { userHandle } from '@nocap/shared';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface AccountMenuProps {
  user: SessionUser | null;
  onSignOut: () => void;
}

export function AccountMenu({ user, onSignOut }: AccountMenuProps): React.ReactElement {
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link to="/login">Log in</Link>
        </Button>
        <Button asChild>
          <Link to="/signup">Sign up</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <Avatar className="size-8">
            <AvatarFallback>{user.username.slice(0, 2)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{userHandle(user.username)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Profile / Settings / Mod tools items arrive with Plan 3, when their
            routes exist. Items pointing at 404s are worse than fewer items. */}
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test
```

Expected: PASS. (If Radix dropdown interaction fails under jsdom with a pointer-event error, switch the two interaction tests to `@testing-library/user-event`'s `userEvent.setup().click(...)` — same assertions.)

- [ ] **Step 5: `app/components/Logo.tsx`** — the user generates the real logo; this is the slot it drops into:

```tsx
import { Link } from 'react-router';
import { SITE_NAME } from '@nocap/shared';

export function Logo(): React.ReactElement {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-bold">
      {/* Replace the mark below with <img src="/logo.svg" ... /> once the
          logo exists in apps/web/public/. Wordmark stays either way. */}
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground"
      >
        N/
      </span>
      {SITE_NAME}
    </Link>
  );
}
```

- [ ] **Step 6: `app/components/SearchBar.tsx`** — inert in v1 by design (spec §8 has no search endpoint; a dead input is more honest than one that pretends):

```tsx
import { Input } from './ui/input';

export function SearchBar(): React.ReactElement {
  return (
    <Input
      type="search"
      aria-label="Search"
      disabled
      placeholder="Search — coming soon"
      className="mx-auto w-full max-w-md rounded-full"
    />
  );
}
```

- [ ] **Step 7: Write failing test `Navbar.test.tsx`**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { SessionUser } from '@nocap/shared';
import { Navbar } from './Navbar';

const trackfan: SessionUser = { id: 1, username: 'trackfan', role: 'user' };

describe('Navbar', () => {
  it('renders logo wordmark, search, theme toggle, and account area', () => {
    render(
      <MemoryRouter>
        <Navbar user={trackfan} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('NoCaP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**, then **Step 9: `app/components/Navbar.tsx`** — the frames' flex-between top bar:

```tsx
import type { SessionUser } from '@nocap/shared';
import { AccountMenu } from './AccountMenu';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  user: SessionUser | null;
  onSignOut: () => void;
}

export function Navbar({ user, onSignOut }: NavbarProps): React.ReactElement {
  return (
    <header className="flex items-center gap-4 border-b bg-card px-4 py-2.5">
      <Logo />
      <SearchBar />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <AccountMenu user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
```

- [ ] **Step 10: Run tests to verify they pass**

```bash
bun run test
```

Expected: AccountMenu + Navbar + ThemeToggle all PASS.

- [ ] **Step 11: Checks + commit**

```bash
bun run check
git add apps/web/app/components
git commit -m "feat: navbar with logo slot, search, and account dropdown

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Channel sidebar — subscriptions scroll zone + Legal column

**Files:**
- Create: `apps/web/app/components/ChannelSidebar.tsx`
- Test: `apps/web/app/components/ChannelSidebar.test.tsx`

**Interfaces:**
- Consumes: `DomainDto`, `channelHandle` (Task 4), `ScrollArea` (Task 3).
- Produces: `ChannelSidebar` props `{ domains: DomainDto[]; activeSlug: string | null }`. Channel creation ("+ Create channel") is deferred to Plan 3 — it needs `POST /api/domains`, which the API does not expose yet.

- [ ] **Step 1: Write failing test `ChannelSidebar.test.tsx`**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import type { DomainDto } from '@nocap/shared';
import { ChannelSidebar } from './ChannelSidebar';

const domains: DomainDto[] = [
  { id: 1, slug: 'all', name: 'All', description: null, isLocked: false },
  { id: 2, slug: 'sports', name: 'Sports', description: null, isLocked: false },
  { id: 3, slug: 'politics', name: 'Politics', description: null, isLocked: false },
];

function componentTree(props?: { domains: DomainDto[]; activeSlug: string | null }): React.ReactElement {
  return (
    <MemoryRouter>
      <ChannelSidebar
        domains={props?.domains ?? domains}
        activeSlug={props?.activeSlug ?? 'sports'}
      />
    </MemoryRouter>
  );
}

describe('ChannelSidebar', () => {
  it('renders each domain as a nocap-prefixed channel link', () => {
    render(componentTree());
    expect(screen.getByRole('link', { name: 'nocap/sports' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'nocap/politics' })).toBeInTheDocument();
  });

  it('marks the active channel link as the current page', () => {
    render(componentTree());
    expect(screen.getByRole('link', { name: 'nocap/sports', current: 'page' })).toBeInTheDocument();
  });

  it('renders the Legal column with Terms, Privacy, and Contact links', () => {
    render(componentTree());
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toBeInTheDocument();
  });

  it('shows the empty state when no channels exist', () => {
    render(componentTree({ domains: [], activeSlug: null }));
    expect(screen.getByText('No channels yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test
```

Expected: FAIL — cannot resolve `./ChannelSidebar`.

- [ ] **Step 3: `app/components/ChannelSidebar.tsx`**

```tsx
import { Link } from 'react-router';
import type { DomainDto } from '@nocap/shared';
import { channelHandle } from '@nocap/shared';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

interface ChannelSidebarProps {
  domains: DomainDto[];
  activeSlug: string | null;
}

export function ChannelSidebar({ domains, activeSlug }: ChannelSidebarProps): React.ReactElement {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground">
      <p className="px-4 pt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Channels
      </p>
      <ScrollArea className="min-h-0 flex-1 px-2 py-2">
        <nav className="flex flex-col gap-0.5">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              to={`/d/${domain.slug}`}
              aria-current={domain.slug === activeSlug ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm hover:bg-sidebar-accent',
                domain.slug === activeSlug && 'bg-sidebar-accent font-medium',
              )}
            >
              {channelHandle(domain.slug)}
            </Link>
          ))}
          {domains.length === 0 && (
            <p className="px-3 py-1.5 text-sm text-muted-foreground">No channels yet.</p>
          )}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Legal</p>
        <nav className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
          <Link to="/terms" className="hover:text-sidebar-foreground">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-sidebar-foreground">Privacy Policy</Link>
          <Link to="/contact" className="hover:text-sidebar-foreground">Contact</Link>
        </nav>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test
```

Expected: PASS.

- [ ] **Step 5: Checks + commit**

```bash
bun run check
git add apps/web/app/components/ChannelSidebar.tsx apps/web/app/components/ChannelSidebar.test.tsx
git commit -m "feat: channel sidebar with subscriptions scrollzone and legal column

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Shell layout, routes, home, legal pages

**Files:**
- Create: `apps/web/app/routes/_shell.tsx`, `terms.tsx`, `privacy.tsx`, `contact.tsx`
- Modify: `apps/web/app/routes.ts`, `apps/web/app/routes/home.tsx`
- Test: `apps/web/app/routes/LegalPages.test.tsx`

**Interfaces:**
- Consumes: `Navbar`, `ChannelSidebar`, `apiFetch` (Tasks 5-7).
- Produces: `/` (placeholder feed), `/terms`, `/privacy`, `/contact` inside the shell; auth routes registered but their pages land in Task 9. Spec §7: legal pages must exist before first signup — they ship here.

- [ ] **Step 1: Write failing test `app/routes/LegalPages.test.tsx`**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import ContactRoute from './contact';
import PrivacyRoute from './privacy';
import TermsRoute from './terms';

describe('legal pages', () => {
  it('terms page states the content license and links to privacy policy', () => {
    render(<MemoryRouter><TermsRoute /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText(/license their posts/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
  });

  it('privacy page lists the personal data the site stores', () => {
    render(<MemoryRouter><PrivacyRoute /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText('Email address')).toBeInTheDocument();
    expect(screen.getByText('Password hash (never the password)')).toBeInTheDocument();
    expect(screen.getByText(/IP logs, kept 90 days/)).toBeInTheDocument();
  });

  it('contact page shows the report and legal contact email', () => {
    render(<MemoryRouter><ContactRoute /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument();
    expect(screen.getByText('contact@nocap.example.org')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test
```

Expected: FAIL — route files do not exist.

- [ ] **Step 3: `app/routes/terms.tsx`** — placeholder legal text, clearly marked; the spec requires review by a qualified person before promotion. Replace the email with the real one at launch:

```tsx
export default function TermsRoute(): React.ReactElement {
  return (
    <article className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placeholder text — must be reviewed before the site is promoted.
      </p>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          NoCaP is a forum where the community votes on whether a claim is well-sourced.
          By posting you license your posts and comments to other users to quote and
          discuss within the site.
        </p>
        <p>
          Vote on sourcing quality, never on agreement. Do not post personal information
          about others, harassment, or illegal content. Moderators may remove content and
          lock channels; every removal is logged with a reason.
        </p>
        <p>
          The service is provided as-is. See the <a className="underline" href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: `app/routes/privacy.tsx`**

```tsx
export default function PrivacyRoute(): React.ReactElement {
  return (
    <article className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placeholder text — must be reviewed before the site is promoted.
      </p>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>Data we store about you:</p>
        <ul className="list-disc pl-6">
          <li>Email address</li>
          <li>Password hash (never the password)</li>
          <li>Username, posts, votes, and comments you create</li>
          <li>IP logs, kept 90 days, used for abuse handling only</li>
        </ul>
        <p>
          No ads, no trackers, no analytics. Embedded media loads only after you click
          (GDPR: no third-party request happens without it).
        </p>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: `app/routes/contact.tsx`**

```tsx
export default function ContactRoute(): React.ReactElement {
  return (
    <article className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold">Contact</h1>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          To report content or raise a legal notice (DSA), email
          contact@nocap.example.org. Target response: 48 hours. Illegal content is
          removed on notice.
        </p>
      </div>
    </article>
  );
}
```

- [ ] **Step 6: `app/routes/_shell.tsx`** — layout route: navbar + sidebar + content. The domains loader degrades to an empty sidebar until Plan 1 Task 6 ships `GET /api/domains` (the catch logs — never silent, per lint rules):

```tsx
import { Outlet, useLoaderData } from 'react-router';
import type { Route } from './+types/_shell';
import type { DomainDto } from '@nocap/shared';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { Navbar } from '@/components/Navbar';
import { authClient, toSessionUser } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api';
import { useNavigate } from 'react-router';

export async function loader({ request }: Route.LoaderArgs): Promise<{ domains: DomainDto[] }> {
  try {
    const domains = await apiFetch<DomainDto[]>(request, '/api/domains');
    return { domains };
  } catch (error) {
    console.error('domains fetch failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return { domains: [] };
  }
}

export default function ShellRoute(): React.ReactElement {
  const { domains } = useLoaderData<typeof loader>();
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  async function handleSignOut(): Promise<void> {
    await authClient.signOut();
    navigate('/');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={toSessionUser(session?.user ?? null)} onSignOut={handleSignOut} />
      <div className="flex min-h-0 flex-1">
        <ChannelSidebar domains={domains} activeSlug={null} />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `app/routes/home.tsx`** — honest placeholder until Plan 3:

```tsx
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export default function HomeRoute(): React.ReactElement {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold">The feed is next</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Posts, votes, and comments arrive with the content plan — the API endpoints
        they need are the next backend milestone. Meanwhile:
      </p>
      <Button asChild className="mt-4">
        <Link to="/signup">Create an account</Link>
      </Button>
    </section>
  );
}
```

- [ ] **Step 8: `app/routes.ts`**

```ts
import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export const routes: RouteConfig = [
  layout('./routes/_shell.tsx', [
    index('./routes/home.tsx'),
    route('terms', './routes/terms.tsx'),
    route('privacy', './routes/privacy.tsx'),
    route('contact', './routes/contact.tsx'),
  ]),
  route('login', './routes/login.tsx'),
  route('signup', './routes/signup.tsx'),
];
```

(Registration now, files in Task 9 — build will fail until they exist; do Step 9 immediately after.)

- [ ] **Step 9: Run tests + build + commit**

```bash
bun run test
cd apps/web && bun run build
cd .. && bun run check
git add apps/web/app/routes.ts apps/web/app/routes
git commit -m "feat: app shell with channel sidebar and legal pages

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Expected: legal tests PASS; build FAILS on missing `login.tsx`/`signup.tsx` until Task 9 Step 4 — if you commit here, note that `bun run build` is red until the next task lands (or run Task 9 before committing; prefer completing Task 9 first).

---

### Task 9: Signup + login pages (login-01 / signup-01 shapes)

**Files:**
- Create: `apps/web/app/components/SignupForm.tsx`, `LoginForm.tsx`, `routes/signup.tsx`, `routes/login.tsx`
- Modify: `apps/api/src/lib/auth.ts` (one line — password minimum)
- Test: `apps/web/app/components/SignupForm.test.tsx`, `LoginForm.test.tsx`

**Interfaces:**
- Consumes: `authClient` (Task 5).
- Produces: `SignupForm` props `{ onSubmit: (input: SignupInput) => Promise<SignupResult>; onSuccess: () => void }` where `SignupInput = { username: string; email: string; password: string }`, `SignupResult = { ok: boolean; error?: string }`. Same shape for `LoginForm` with `{ email: string; password: string }`. Routes own the Better Auth call; forms are pure, testable components.

- [ ] **Step 1: Password minimum, server-side** — spec §6 says min 10; Better Auth defaults to 8, so the client check alone would lie. In `apps/api/src/lib/auth.ts` change:

```ts
  emailAndPassword: { enabled: true },
```

to:

```ts
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
```

Then re-run the API suite (uses the real DB, no mocks):

```bash
cd apps/api && bun test
```

Expected: all pass. (If a test signs up with a password shorter than 10 chars, fix the fixture password, not the minimum.)

- [ ] **Step 2: Write failing test `SignupForm.test.tsx`**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { SignupForm } from './SignupForm';

function typeInto(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const validInput = { username: 'trackfan', email: 'trackfan@example.com', password: 'correct-horse' };

describe('SignupForm', () => {
  it('valid signup input reaches onSubmit with username, email, and password', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(<MemoryRouter><SignupForm onSubmit={onSubmit} onSuccess={() => {}} /></MemoryRouter>);

    typeInto('Username', validInput.username);
    typeInto('Email', validInput.email);
    typeInto('Password', validInput.password);
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await vi.waitFor(() => onSubmit.mock.calls[0]?.[0])).toEqual(validInput);
  });

  it('short password is rejected before onSubmit is called', () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(<MemoryRouter><SignupForm onSubmit={onSubmit} onSuccess={() => {}} /></MemoryRouter>);

    typeInto('Username', 'trackfan');
    typeInto('Email', 'trackfan@example.com');
    typeInto('Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(screen.getByText('Password must be at least 10 characters.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('failed signup shows the server error as an alert', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, error: 'Username or email already taken.' }));
    render(<MemoryRouter><SignupForm onSubmit={onSubmit} onSuccess={() => {}} /></MemoryRouter>);

    typeInto('Username', 'trackfan');
    typeInto('Email', 'trackfan@example.com');
    typeInto('Password', 'correct-horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText('Username or email already taken.')).toBeInTheDocument();
  });

  it('successful signup calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(<MemoryRouter><SignupForm onSubmit={onSubmit} onSuccess={onSuccess} /></MemoryRouter>);

    typeInto('Username', 'trackfan');
    typeInto('Email', 'trackfan@example.com');
    typeInto('Password', 'correct-horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await vi.waitFor(() => onSuccess)).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
bun run test
```

Expected: FAIL — cannot resolve `./SignupForm`.

- [ ] **Step 4: `app/components/SignupForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface SignupInput {
  username: string;
  email: string;
  password: string;
}

export interface SignupResult {
  ok: boolean;
  error?: string;
}

interface SignupFormProps {
  onSubmit: (input: SignupInput) => Promise<SignupResult>;
  onSuccess: () => void;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

export function SignupForm({ onSubmit, onSuccess }: SignupFormProps): React.ReactElement {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!USERNAME_RE.test(username)) {
      setError('Username must be 3-32 letters, digits, or underscores.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    setBusy(true);
    const result = await onSubmit({ username, email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Signup failed.');
      return;
    }
    onSuccess();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>Enter your info below</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="3–32 letters, digits, _"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="min 10 characters"
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Sign up
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold underline">Login</Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          By signing up you accept the{' '}
          <Link to="/terms" className="underline">Terms of Service</Link> and{' '}
          <Link to="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun run test
```

Expected: SignupForm tests PASS.

- [ ] **Step 6: `app/routes/signup.tsx`** — wires the form to Better Auth:

```tsx
import { useNavigate } from 'react-router';
import { SignupForm } from '@/components/SignupForm';
import { authClient } from '@/lib/auth-client';

interface AuthClientError {
  code?: string;
  status?: number;
  message?: string;
}

function toFormError(error: AuthClientError): string {
  if (error.status === 429) {
    return 'Too many attempts — try again in 15 minutes.';
  }
  if (error.code === 'USER_ALREADY_EXISTS') {
    return 'Username or email already taken.';
  }
  return error.message ?? 'Something went wrong.';
}

export default function SignupRoute(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <SignupForm
        onSuccess={() => navigate('/')}
        onSubmit={async (input) => {
          const { error } = await authClient.signUp.email({
            email: input.email,
            password: input.password,
            // Better Auth requires a display name; v1 uses the username for it.
            name: input.username,
            username: input.username,
          });
          if (error) {
            return { ok: false, error: toFormError(error) };
          }
          return { ok: true };
        }}
      />
    </main>
  );
}
```

- [ ] **Step 7: Write failing test `LoginForm.test.tsx`** — same props-driven pattern, two tests:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('submits email and password to onSubmit', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    render(<MemoryRouter><LoginForm onSubmit={onSubmit} onSuccess={() => {}} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'trackfan@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await vi.waitFor(() => onSubmit.mock.calls[0]?.[0])).toEqual({
      email: 'trackfan@example.com',
      password: 'correct-horse',
    });
  });

  it('rate-limited login shows the retry message from onSubmit', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: false,
      error: 'Too many attempts — try again in 15 minutes.',
    }));
    render(<MemoryRouter><LoginForm onSubmit={onSubmit} onSuccess={() => {}} /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'trackfan@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Too many attempts — try again in 15 minutes.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**, then **Step 9: `app/components/LoginForm.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

interface LoginFormProps {
  onSubmit: (input: LoginInput) => Promise<LoginResult>;
  onSuccess: () => void;
}

export function LoginForm({ onSubmit, onSuccess }: LoginFormProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    const result = await onSubmit({ email, password });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Login failed.');
      return;
    }
    onSuccess();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>Enter your email and password below</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={busy}>
            Log in
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account yet?{' '}
          <Link to="/signup" className="font-semibold underline">Sign up</Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 10: `app/routes/login.tsx`**

```tsx
import { useNavigate } from 'react-router';
import { LoginForm } from '@/components/LoginForm';
import { authClient } from '@/lib/auth-client';

interface AuthClientError {
  code?: string;
  status?: number;
  message?: string;
}

function toFormError(error: AuthClientError): string {
  if (error.status === 429) {
    return 'Too many attempts — try again in 15 minutes.';
  }
  return error.message ?? 'Invalid email or password.';
}

export default function LoginRoute(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <LoginForm
        onSuccess={() => navigate('/')}
        onSubmit={async (input) => {
          const { error } = await authClient.signIn.email(input);
          if (error) {
            return { ok: false, error: toFormError(error) };
          }
          return { ok: true };
        }}
      />
    </main>
  );
}
```

- [ ] **Step 11: Run all tests + build**

```bash
bun run test
cd apps/web && bun run build
```

Expected: all tests PASS; build exits 0 (Task 8's routes now resolve).

- [ ] **Step 12: Checks + commit**

```bash
cd .. && bun run check
git add apps/web/app apps/api/src/lib/auth.ts
git commit -m "feat: signup and login pages wired to better-auth

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: End-to-end smoke + exit verification

**Files:**
- No new code. This task proves the plan's deliverable against the real API (both dev processes), and fixes whatever it surfaces.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Start the API**

```bash
cd apps/api && bun run dev
```

Expected: Hono listening on :3001 (health check `curl http://localhost:3001/api/health` → `{"status":"ok"}`).

- [ ] **Step 2: Start the web app**

```bash
cd apps/web && bun run dev
```

Expected: RRv8 dev server on :3000.

- [ ] **Step 3: Manual smoke checklist** — run through in the browser, in order. Record each result honestly; a failed step is a finding to fix, not a step to skip:

1. `http://localhost:3000/` renders the navbar (NoCaP wordmark, disabled search, theme toggle) + sidebar with "No channels yet." + legal links.
2. Theme toggle flips light↔dark; reload keeps the choice (localStorage).
3. `/terms`, `/privacy`, `/contact` render their headings under the shell.
4. `/signup` renders the centered card (no navbar).
5. Sign up with a real email + 10-char password → redirected to `/`; navbar shows the avatar; dropdown opens with `nocap/<username>` and Log out.
6. Duplicate signup with the same email → alert "Username or email already taken."
7. Log out → navbar shows Log in / Sign up.
8. Log in 5× with a wrong password, 6th attempt (even correct) → alert "Too many attempts — try again in 15 minutes." (Better Auth DB-backed rate limit through the proxy — proves the whole path.)
9. Reload while logged in → session persists (cookie survived the reload).

- [ ] **Step 4: Full pipeline**

```bash
cd <repo root>
bun run check
bun run test
cd apps/api && bun test
cd ../web && bun run build
```

Expected: Biome zero warnings; vitest green (shared + web); API suite green; web build exits 0.

- [ ] **Step 5: Fix and commit anything the smoke surfaced, then final commit**

```bash
git add -A
git commit -m "test: web foundation smoke verification

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

(Only if there is something to commit — the point of this task is the verification record, not the commit.)

---

## Plan 2 Exit Criteria

- `bun run build` green in `apps/web` — the Bun + Vite + RRv8 risk item from spec §11 is settled
- Signup → session → logout works in the browser against the real Better Auth API through the `/api` proxy
- Login rate limiting (429) surfaces in the UI
- tweakcn theme applies verbatim; light/dark toggle works and survives reload
- Legal pages live (placeholder text, marked for review) — spec §7 "before first signup" satisfied structurally
- Biome zero warnings; every component has its one test file, all green

## Explicitly NOT in Plan 2 (deferred, with reasons)

- Feed, post detail, submit, mod queue, profile pages — need `GET /api/posts` etc. (Plan 1 Tasks 6-12, unimplemented). Plan 3 will be written when those land.
- Channel creation UI — needs `POST /api/domains` (Plan 1 Task 6).
- Navbar search — no search endpoint exists in spec §8's v1 surface; the input ships disabled and honestly labeled.
- AccountMenu Profile/Settings/Mod items — their routes don't exist yet (Plan 3).
- Toasts (`sonner`) — the shadcn wrapper depends on next-themes; Plan 3 wires the plain `sonner` package.
- Caddy/prod config — deploy is its own plan.

## Self-Review Notes

- Spec coverage: §3 stack UI row (Tasks 1-3), §4 web-never-touches-DB rule (Task 5 api.ts doc + proxy design), §6 auth client (Tasks 5, 9 — Better Auth spec explicitly scopes the React client here), §7 ToS/Privacy/contact-before-signup (Task 8), §11 Bun/RRv8 verification (Task 1 Step 9, exit criteria), NoCaP rename + handle constants (Task 4). Gaps are all content screens — blocked on API endpoints, called out above.
- Placeholder scan: no TBDs; legal text is deliberately placeholder but complete and marked. Every code step shows full file content or an exact CLI command.
- Type consistency: `SessionUser` from `@nocap/shared` everywhere; `toSessionUser` narrows Better Auth's string role; `SignupResult`/`LoginResult` identical `{ ok, error? }` shape; `apiFetch` single generic signature used by the shell loader.
- Known risks flagged: Radix dropdown interaction under jsdom (fallback noted in Task 6), `bun create react-router` prompt variance (Task 1 Step 2 tells the executor to decline ESLint/Prettier), Task 8 registers routes whose files land in Task 9 (build red between tasks — flagged in Step 9).
