# NoCaP — Plan 3: Content Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four remaining UI frames from `docs/design/claim-tracker-ui-frames.html` — Feed (01), Post detail (02), Submit (03), Profile (06) — as real routes in `apps/web`, wired to the finished Plan 1 API. Plus the one backend piece the frames depend on: the embed worker that drains the `fetch_embed` jobs Plan 1 already enqueues, stores provider + embed JSON on each post, and recomputes `hot_rank` so the `hot` sort ranks by score + age instead of sitting on its constant default.

**Architecture:** Pure web wiring over an API-complete backend, with three contained API extensions: `viewerVote` on post/comment DTOs (vote widgets must show the signed-in user's own vote), swag breakdown on `UserProfileDto` (Frame 06's right card), and the worker (`apps/api/src/worker/`). The worker is a second Bun process: poll `jobs` → claim → fetch oEmbed/og-tags via provider adapters → store `provider` + `embed` → mark done. All network parsing lives in pure transform functions tested against fixture files; the worker's `runOnce()` is called from tests against a real local HTTP fixture server (node:http) so no mocks exist anywhere. Embeds render click-to-load: thumbnail/link card until the user clicks, iframe only after (GDPR, spec §Embeds). SSR loaders fetch through the existing `apiFetch` (cookie-forwarded); browser interactions (vote, comment, submit, report, create channel) go same-origin through a new thin `browser-api.ts` — no new auth paths, Better Auth cookie is already first-party. UI is shadcn-composed throughout: anything not already in `components/ui` comes from the registry (`bunx shadcn@latest add …`), forms lay out with `Field`/`FieldGroup`, empty states use `Empty`, every `Dialog` keeps its `DialogTitle`, every `Avatar` its `AvatarFallback` — hand-rolled markup only where a frame has no registry shape (the vote arrows, the click-to-load embed surface).

**Tech Stack:** Bun, Hono, Drizzle + postgres.js, React Router v8 framework mode (SSR), Tailwind v4 + shadcn/ui (new-york, radix base, registry-sourced), Sonner, vitest + Testing Library (jsdom for web), real-Postgres API tests, Biome.

**Spec:** `docs/superpowers/specs/2026-09-01-claim-tracker-design.md` (product + §Embeds + §Testing), `docs/superpowers/specs/2026-09-03-better-auth-replacement-design.md` (session shape), `docs/design/claim-tracker-ui-frames.html` (visual reference for every screen — frames are authoritative except `/mod`, which keeps default theme tokens).

## Global Constraints

- Runtime: Bun everywhere. Library scaffolding runs via `bunx`, never `npx`.
- Lint: Biome, zero warnings — `bun run check` before every commit; never `--no-verify`.
- TypeScript strict, `noUncheckedIndexedAccess` on, no `as any`/unjustified assertions.
- One test file per component/module, named exactly like the source file (`PostCard.tsx` → `PostCard.test.tsx`), same directory.
- Web tests: Testing Library + jsdom, `getByRole('button', …)`, never `getByText`, all props passed. API tests: real Postgres via `db/testSetup.ts` (`resetDb` between tests — truncate list already includes `jobs`), no `vi.mock`/`jest.mock` anywhere (`check_no_mock`), test names ≥ 3 descriptive words.
- Components are real components — no helper functions returning JSX (`check_no_render_helpers`); no setter-only effects (`check_no_setter_only_effect`); no interpolated console (`check_no_interpolated_console`); API logging through `app logger` (`check_app_logger`); `assert` statements carry a reason string (`check_require_assertion_reason`).
- Web never touches the database: loaders go through `apiFetch`, browser actions through same-origin `/api/*`.
- UI = shadcn composition by default: prefer registry primitives over custom markup (`bunx shadcn@latest add <name>`, never npx, never hand-copy what the registry serves). Composition rules enforced: `DialogTitle` on every Dialog, `AvatarFallback` with every Avatar, `SelectItem` inside `SelectGroup`, form layout via `FieldGroup` + `Field` (no `space-y-*` — `flex` + `gap-*`), `Empty` for empty states, pending buttons = `Spinner` + `disabled` (Button has no isPending), icons in buttons via `data-icon` with no sizing classes.
- The Plan 2 sidebar (`ChannelSidebar`) is locked: append the create-channel button, do not restructure it.
- Commit style: `feat:`/`test:`/`chore:` conventional, small commits per task, message ends with `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Branch: `feat/content-screens`, cut from `main` (main has PRs #1–#3 merged).
- The tweakcn export in `app/styles.css` is the user's file — do not restyle its tokens.

---

## File Structure

**Layout at end of Plan 3:**

```text
packages/shared/src/
├── index.ts                      # + PostEmbed union, detectProvider, isPostEmbed
└── index.test.ts

apps/api/src/
├── services/
│   ├── post.service.ts           # viewerId param, viewerVote in DTOs
│   ├── comment.service.ts        # viewerId param, viewerVote in DTOs
│   └── profile.service.ts        # postSwag / commentSwag
├── routes/…                      # pass c.var.user?.id through
└── worker/                       # NEW
    ├── index.ts                  # poll loop + runOnce() (exported for tests)
    ├── hot.ts                    # hot-rank math, pure
    ├── adapters/
    │   ├── youtube.ts            # videoId extraction + oEmbed transform (pure)
    │   ├── tiktok.ts             # videoId extraction + oEmbed transform (pure)
    │   └── link.ts               # og:title/og:image extraction (pure)
    ├── worker.test.ts            # real PG + real local HTTP fixture server
    ├── hot.test.ts
    └── fixtures/
        ├── youtube-oembed.json
        ├── tiktok-oembed.json
        └── og-page.html

apps/web/app/
├── lib/
│   ├── browser-api.ts            # same-origin JSON fetch, throws ApiError
│   └── relative-time.ts          # "2 h ago" helper, pure
├── components/
│   ├── VoteArrows.tsx            # shared post + comment vote widget
│   ├── PostCard.tsx               # frame 01 card (vote, question, embed slot, meta, actions)
│   ├── Embed.tsx                  # click-to-load dispatcher (youtube/tiktok/link/pending)
│   ├── ReportDialog.tsx          # reason select → POST /api/reports
│   ├── CreateChannelDialog.tsx   # slug/name/description → POST /api/domains (3 max)
│   ├── FeedControls.tsx          # Hot/New/Top tabs + window chips (day/week/all)
│   ├── CommentThread.tsx         # flat list → tree, depth indents, sort tabs
│   └── CommentComposer.tsx       # top-level + reply composers
├── routes.ts                     # + d/:slug, p/:id, u/:username, submit
├── routes/
│   ├── home.tsx                  # REPLACED: global feed
│   ├── channel.tsx               # NEW: /d/:slug
│   ├── post.tsx                  # NEW: /p/:id
│   ├── submit.tsx                # NEW: /submit (outside shell)
│   └── profile.tsx               # NEW: /u/:username
└── components/ui/               # registry additions (bunx shadcn@latest add)
    ├── sonner.tsx                   # toasts (mounted in root.tsx)
    ├── field.tsx                    # FieldGroup/Field/FieldLabel form layout
    ├── spinner.tsx                  # pending submit state
    ├── aspect-ratio.tsx             # 16:9 embed thumbnail box
    ├── empty.tsx                    # feed empty states
    ├── breadcrumb.tsx               # post detail breadcrumb
    ├── collapsible.tsx              # comment reply threads
    └── toggle-group.tsx             # submit source-type chips (brings toggle.tsx)
```

---

## Task 1: Shared embed vocabulary (packages/shared)

**Files:**

- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.test.ts`

**Interfaces:**

- Produces: `PostEmbed` discriminated union (`YouTubeEmbed | TikTokEmbed | LinkEmbed`), `detectProvider(url) → ProviderId`, `isPostEmbed(value): value is PostEmbed` (narrows `PostDto.embed` which stays `unknown` at the wire boundary).

- [x] **Step 1: Append to `packages/shared/src/index.ts`**

```ts
export interface YouTubeEmbed {
  provider: 'youtube';
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export interface TikTokEmbed {
  provider: 'tiktok';
  videoId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string;
}

export interface LinkEmbed {
  provider: 'link';
  title: string;
  image: string | null;
}

export type PostEmbed = YouTubeEmbed | TikTokEmbed | LinkEmbed;

// Provider detection matches the worker adapters (spec §Embeds): the URL
// decides which adapter runs; everything else falls through to og-tags.
export function detectProvider(url: string): ProviderId {
  if (detectYouTubeVideoId(url) !== null) return 'youtube';
  if (detectTikTokVideoId(url) !== null) return 'tiktok';
  return 'link';
}

export function detectYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
  } catch {
    return null;
  }
  // host check: youtube.com (watch?v=, /shorts/, /live/), youtu.be/<id>
  // return the id or null — same regexes the adapter tests pin down
  // …implementation follows fixture table below
}

export function detectTikTokVideoId(url: string): string | null {
  // tiktok.com/@user/video/<id> (incl. vt.tiktok.com redirect targets)
}

export function isPostEmbed(value: unknown): value is PostEmbed {
  if (typeof value !== 'object' || value === null) return false;
  const provider = (value as { provider?: unknown }).provider;
  return provider === 'youtube' || provider === 'tiktok' || provider === 'link';
}
```

- [x] **Step 2: Implement the two URL extractors** with this fixture table (each row = one test case in `index.test.ts`):

| URL | videoId |
| --- | --- |
| `https://youtu.be/dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| `https://www.youtube.com/shorts/x7f3kQm2PqA` | `x7f3kQm2PqA` |
| `https://www.youtube.com/live/aBcDeFgHiJk` | `aBcDeFgHiJk` |
| `https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=4s` | `dQw4w9WgXcQ` |
| `https://example.com/watch?v=x` | `null` |
| `https://www.tiktok.com/@user/video/7301234567890123456` | tiktok: `7301234567890123456` |
| `https://www.tiktok.com/@user` | `null` |
| `https://notyoutube.com/dQw4w9WgXcQ` | `null` |

YouTube ids are `[A-Za-z0-9_-]{11}` — reject anything else. TikTok ids are `[0-9]{15,25}` on a `/video/` path.

- [x] **Step 3: Tests** — `detectProvider` mapping (one per row + link fallback), `isPostEmbed` accepting each variant and rejecting `null`, `{}`, wrong provider.

- [x] **Step 4: Verify + commit** — `bun run check`, `vitest run packages/shared`. Commit: `feat: embed vocabulary and provider detection in shared`.

---

## Task 2: API — viewer's own vote on DTOs

**Files:**

- Modify: `packages/shared/src/index.ts` (PostDto + CommentDto)
- Modify: `apps/api/src/services/post.service.ts`, `apps/api/src/services/comment.service.ts`, `apps/api/src/routes/post.routes.ts`, `apps/api/src/routes/comment.routes.ts`
- Modify: `apps/api/tests/post.test.ts`, `apps/api/tests/comment.test.ts`, `apps/api/tests/vote.test.ts` (the bun-test suite in `apps/api/tests/` — extend, don't rewrite)

**Interfaces:**

- Produces: optional `viewerVote?: VoteValue | null` on `PostDto` and `CommentDto`. Anonymous → omitted-or-null; logged-in non-voter → `null`; voter → `1 | -1`. `ModPostDto` untouched (mods don't vote from the queue).

- [x] **Step 1: Shared types** — append `viewerVote?: VoteValue | null;` to both interfaces.

- [x] **Step 2: Services take a viewer** — `listPosts({…, viewerId: number | null})` and `getPost(postId, viewerId = null)`: after the main select, when `viewerId !== null`, batch-query `votes` by `inArray(votes.postId, ids)` + `eq(votes.userId, viewerId)`, merge into DTOs (`row viewerVote ?? null`). `listComments(postId, viewerId = null)`: same against `commentVotes`. `createComment` returns the new comment with `viewerVote: null` (fresh comment, no votes).

- [x] **Step 3: Routes thread the session** — every read route passes `c.var.user?.id ?? null`. `sessionMiddleware` already populates `c.var.user`; no middleware changes.

- [x] **Step 4: Tests** (real PG, existing files): anonymous list → `viewerVote` null; vote 1 → list shows `1`; change to -1 → shows `-1`; vote 0 (remove) → back to null; comment vote same ladder. Keep every existing test passing (DTO field is optional — nothing breaks).

- [x] **Step 5: Verify + commit** — `bun run check`, `bun test` (the API suite runs under Bun — the root vitest config excludes `apps/api`). Commit: `feat: expose viewer vote on post and comment dtos`.

---

## Task 3: API — swag breakdown on profiles

**Files:**

- Modify: `packages/shared/src/index.ts` (`UserProfileDto`)
- Modify: `apps/api/src/services/profile.service.ts`, `apps/api/tests/profile.test.ts`

**Interfaces:**

- Produces: `postSwag: number` and `commentSwag: number` on `UserProfileDto` (Frame 06 right card "Karma breakdown"). `swag` stays the sum — one field it already computes from.

- [x] **Step 1:** Add both fields to the interface; in `getUserProfile`, `postSwag = Number(postKarma[0]?.value ?? 0)`, `commentSwag = Number(commentStats[0]?.commentKarma ?? 0)`, `swag = postSwag + commentSwag` (the current sum becomes the composition — no query changes).

- [x] **Step 2: Tests** — user with posts and comments → split sums add to `swag`; user with nothing → `0/0/0`; comments-only user → `postSwag 0`. (Seed users cover all three cases.)

- [x] **Step 3: Verify + commit** — `bun run check`, `bun test` (API suite — Bun runtime, not vitest). Commit: `feat: post and comment swag breakdown on user profiles`.

---

## Task 4: API — embed worker + hot-rank recompute

**Files:**

- Create: `apps/api/src/worker/index.ts`, `worker/hot.ts`, `worker/adapters/youtube.ts`, `worker/adapters/tiktok.ts`, `worker/adapters/link.ts`, `worker/worker.test.ts`, `worker/hot.test.ts`, `worker/fixtures/youtube-oembed.json`, `worker/fixtures/tiktok-oembed.json`, `worker/fixtures/og-page.html`
- Modify: `apps/api/package.json` (script `"worker": "bun run src/worker/index.ts"`)

**Interfaces:**

- Produces: standalone process `bun run worker` that drains `jobs` (`fetch_embed`), writes `posts.provider` + `posts.embed`, and periodically recomputes `posts.hot_rank`. Exports `runOnce(): Promise<{ processed: number; failed: number }>` for tests and one-shot runs. Adapter env overrides: `YOUTUBE_OEMBED_URL`, `TIKTOK_OEMBED_URL` (tests point them at a local fixture server).

- [ ] **Step 1: Adapters — pure transforms.** Each adapter is two pure functions + zero network code:

```ts
// adapters/youtube.ts
export function youtubeEmbedFromOEmbed(json: unknown, videoId: string): PostEmbed | null
// validates title/author_name/thumbnail_url strings → YouTubeEmbed, else null

// adapters/link.ts
export function linkEmbedFromHtml(html: string, url: string): PostEmbed | null
// regex og:title / og:image; title falls back to URL hostname; image null when missing
```

TikTok mirrors YouTube (`tiktokEmbedFromOEmbed`), pulling `thumbnail_url` + `title` + `author_name`. Tests pin them against the fixture files (real JSON/HTML read from `fixtures/`).

- [ ] **Step 2: hot.ts — pure hot-rank math.**

```ts
// Reddit-style decay: score grows rank logarithmically, age decays it linearly.
// Constants are the two knobs to tune — picked so a 12-hour-old post needs
// ~10× the score of a fresh post to keep pace.
export function hotRank(score: number, createdAt: Date, now: Date): number {
  const ageHours = (now.getTime() - createdAt.getTime()) / 36e5;
  return Math.log10(Math.max(score + 1, 1)) - ageHours / 12;
}
```

Tests: fresh post rank ordering by score; age decay; negative scores; fixed `now` (pure function — pass dates in, no clocks inside).

- [ ] **Step 3: worker/index.ts — claim loop.**

```ts
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const HOT_EVERY_MS = Number(process.env.WORKER_HOT_EVERY_MS ?? 60000);

export async function runOnce(): Promise<{ processed: number; failed: number }> {
  // claim: UPDATE jobs SET status='running' WHERE id =
  //   (SELECT id FROM jobs WHERE status='pending' AND run_at <= now()
  //    ORDER BY id LIMIT 1) RETURNING id, type, payload
  // loop until no rows (batch cap 10/tick). For each fetch_embed:
  //   load post → detectProvider(post.url)
  //   youtube/tiktok: fetch oEmbed (env-overridable base URL) → transform → success: store provider+embed
  //   link: fetch page HTML → linkEmbedFromHtml
  //   any failure (non-200, invalid body, transform null): log.error + job status='failed',
  //     post keeps provider=null/embed=null → web falls back to link card (spec: posts never block)
  //   success: job status='done'
}

async function recomputeHot(): Promise<void> {
  // posts where deleted_at is null and created_at > now() - 30 days
  // hotRank() per row in JS (it's pure) → single UPDATE per post, batched in a transaction
}

// main loop (skipped under vitest):
let lastHot = 0;
while (true) {
  const r = await runOnce();
  if (now() - lastHot > HOT_EVERY_MS) { await recomputeHot(); lastHot = now(); }
  await sleep(POLL_MS);
}
```

Use the app logger (`log.error`) for failures; `assert` calls carry reason strings.

- [ ] **Step 4: worker.test.ts — real PG + real HTTP, no mocks.** `beforeAll`: start a `node:http` server serving `fixtures/youtube-oembed.json` at `/oembed?...`, `og-page.html` at `/page`; set `process.env.YOUTUBE_OEMBED_URL`/`TIKTOK_OEMBED_URL` to it. Test flow against real PG: `createPost` (youtu.be URL) → `runOnce()` → `getPost` shows `provider:'youtube'` + embed → `listJobsDev` shows job done. Second post with a URL that 404s on the fixture server → job `failed`, post fields untouched, no throw. Third post with generic URL → `link` embed from og tags. `resetDb` between tests (jobs included). Restore env in `afterAll`, close the server.

- [ ] **Step 5: package.json script** — `"worker": "bun run src/worker/index.ts"` in `apps/api/package.json`.

- [ ] **Step 6: Verify + commit** — `bun run check`, `bun test`. Commit: `feat: embed job worker with provider adapters and hot rank recompute`.

---

## Task 5: Web — browser API client + relative time

**Files:**

- Create: `apps/web/app/lib/browser-api.ts`, `apps/web/app/lib/browser-api.test.ts`, `apps/web/app/lib/relative-time.ts`, `apps/web/app/lib/relative-time.test.ts`

**Interfaces:**

- Produces: `apiJson<T>(path, init?)` — same-origin `fetch('/api/…')`, `credentials: 'same-origin'`, JSON headers, throws `ApiError` (reuse the class from `lib/api.ts`) with the server's error message. And `timeAgo(iso: string, now: Date): string` — `'just now' | '<n> m| h| d| w ago'`, pure, `now` injected.

- [x] **Step 1: browser-api.ts** — thin wrapper; tests stub `fetch` on `globalThis` (web-layer convention, `check_no_mock` is API-only) covering: ok JSON passthrough, non-JSON body send, `!response.ok` → `ApiError` with body error message and status.

- [x] **Step 2: relative-time.ts** — thresholds: <1 m `'just now'`, minutes `'N m ago'`, hours `'N h ago'`, days `'N d ago'`, else weeks `'N w ago'`. Tests with fixed `now`.

- [x] **Step 3: Verify + commit** — `bun run check`, `vitest run apps/web`. Commit: `feat: browser api client and relative time helper`.

---

## Task 6: Web — VoteArrows, PostCard, ReportDialog, Sonner

**Files:**

- Create: `apps/web/app/components/VoteArrows.tsx` + `.test.tsx`, `PostCard.tsx` + `.test.tsx`, `ReportDialog.tsx` + `.test.tsx`
- Create via registry: `ui/sonner.tsx`, `ui/field.tsx`, `ui/spinner.tsx` — `bunx shadcn@latest add sonner field spinner` (field/spinner are consumed from Task 8 onward; adding the interactive vocabulary in one commit keeps later tasks pure composition)
- Modify: `apps/web/package.json` (registry adds pull their deps), `apps/web/app/root.tsx` (mount `<Toaster />`)

**Interfaces:**

- Produces: the Frame 01 card — vote column, channel badge, the question line, embed slot, meta row (author · time · comment count), actions (Share, Report). `PostCard` is used by feed and profile mini-rows stay separate (they're a different shape).

```tsx
interface VoteArrowsProps {
  score: number;
  viewerVote: VoteValue | null;
  onVote: (value: VoteValue) => void;
}
interface PostCardProps {
  post: PostDto;
  onVote: (value: VoteValue) => void;   // page owns the API call + optimistic state
  onReport: (reason: ReportReason) => void;
}
```

- [x] **Step 1: Registry adds + Toaster** — `bunx shadcn@latest add sonner field spinner` (new-york style, radix base — same source the Plan 2 primitives came from; the CLI rewrites imports to `@/components/ui`). Two gotchas, verified by dry-run: **(a)** the registry `sonner.tsx` imports `next-themes` `useTheme` — this project owns dark mode itself (`ThemeToggle` toggles `documentElement.classList`), so remove `next-themes` entirely (ruled by user): strip the import and the `useTheme` call from `ui/sonner.tsx`, never install the package, and let the Toaster default to system preference; **(b)** the `field` add also overwrites `ui/label.tsx` and `ui/separator.tsx` — use the `field` component (ruled by user): run `bunx shadcn@latest add field --diff label.tsx separator.tsx` once to confirm the overwrites are upstream-only (Plan 2 installed both unmodified from the same registry), then accept them. Mount `<Toaster richColors position="bottom-right" />` in `root.tsx`.

- [x] **Step 2: VoteArrows** — up/down `Button variant="ghost" size="icon"` shaped like the frame's `vbtn` (arrows + centered score in a `flex flex-col` — `gap`, never `space-y`), clicking the active arrow votes `0` (removal); clicking up while down flips via `onVote(1)`. Styling: `aria-pressed` marks the active arrow. **Finding:** the frames' `--up`/`--down` tokens do not exist in the tweakcn export, so VoteArrows uses `text-primary` (up) / `text-destructive` (down) for now — swapping to dedicated vote tokens is a user-owned `styles.css` revision away.

- [x] **Step 3: PostCard** — full `Card` composition per Frame 01: `CardHeader` carries the topline (`channelHandle(post.domainSlug)` + provider as `Badge variant="secondary"`s), `CardContent` holds the `flex gap-3` row — left vote column, right body. Title as `Link` to `/p/${post.id}`. Question line: `? One question — Is this well-sourced?` with the `text-muted-foreground` styling. Embed slot: `<Embed post={post} compact />` (built in Task 7 — until then render the link-card fallback inline; the slot contract is `Embed` takes the post and compact/full mode). Meta: author handle (`userHandle`), `timeAgo`, `💬 N comments` count prop (pages pass it; the list DTOs don't carry it — commentCount comes from the post page only, feeds pass `null` and hide the count). Actions: Share (`Button variant="ghost" size="sm"` + `Share2` icon `data-icon="inline-start"`, `clipboard.writeText(location.origin + '/p/' + post.id)` + toast `Link copied`), Report (`Flag` icon, same button shape, opens `ReportDialog`).

- [x] **Step 4: ReportDialog** — shadcn `Dialog` with a `DialogTitle` (`Report this claim` — required for accessibility even though the frame shows none) + `Select` over the five `ReportReason` values (`spam, harassment, personal_info, illegal, off_domain`), `SelectItem`s inside a `SelectGroup`, human labels, no free-text detail (API takes reason only), submit → `onReport(reason)`. Page wires `apiJson('/api/reports', { method: 'POST', body: { postId } })` → toast `Report filed` / inline `Alert` on 4xx.

- [x] **Step 5: Tests** — VoteArrows: renders score, active state per viewerVote, removal click on active arrow, flip call args. PostCard: renders title link, channel handle, question line, vote arrows present, Share button role. ReportDialog: opens, select each reason, submit callback fires with reason, closes. Fetch stubbed at the page level later; component tests pass callbacks as props.

- [x] **Step 6: Verify + commit** — `bun run check`, `vitest run apps/web`. Commit: `feat: post card with vote arrows report dialog and toasts`.

---

## Task 7: Web — click-to-load Embed components

**Files:**

- Create: `apps/web/app/components/Embed.tsx` + `.test.tsx`
- Create via registry: `ui/aspect-ratio.tsx` — `bunx shadcn@latest add aspect-ratio`

**Interfaces:**

- Produces: `<Embed post={PostDto} compact?: boolean />` rendering by post state: `provider` + `isPostEmbed(embed)` → provider view; else **pending/failed → link card** (never blocks, spec §Embeds). GDPR: no third-party iframe before a click, anywhere.

- [ ] **Step 1: Views per state**
  - `youtube`: thumbnail `img` inside `<AspectRatio ratio={16 / 9}>` (from `embed.thumbnailUrl`), play icon, hint `Load YouTube embed — iframe only loads after your click (GDPR)`; the click-to-load surface is a full-size `Button variant="secondary"` overlay — click swaps to `<iframe src={https://www.youtube-nocookie.com/embed/${embed.videoId}} allow="encrypted-media; picture-in-picture" allowFullScreen>`.
  - `tiktok`: same shape; iframe `https://www.tiktok.com/embed/v2/${embed.videoId}`.
  - `link`: `Card` with og title + image (when present) as an external link, `Badge` with the hostname.
  - pending (no provider/embed): link card built from `post.url` (hostname + full URL), plus `Waiting for embed…` hint when `compact` is false.
  - `compact` (feed rows): `AspectRatio` keeps 16:9 without height blowout; full mode scales the thumbnail hero per Frame 02.

- [ ] **Step 2: Tests** — pending post renders hostname card and no iframe; youtube renders click-to-load button and NO iframe; after `userEvent.click`, iframe with `youtube-nocookie.com/embed/<videoId>` present; tiktok same; link post renders og title; malformed embed (`{provider:'youtube'}` without fields rejected by `isPostEmbed` path) falls back to link card.

- [ ] **Step 3: Verify + commit** — `bun run check`, `vitest run apps/web`. Commit: `feat: click to load embeds for youtube tiktok and link cards`.

---

## Task 8: Web — Feed screens (home + channel) + create channel

**Files:**

- Modify: `apps/web/app/routes.ts`, `apps/web/app/routes/home.tsx`, `apps/web/app/routes/_shell.tsx`, `apps/web/app/components/ChannelSidebar.tsx` (+ its test)
- Create: `apps/web/app/routes/channel.tsx` + `+types` (generated), `apps/web/app/components/FeedControls.tsx` + `.test.tsx`, `FeedList.tsx` + `.test.tsx`, `CreateChannelDialog.tsx` + `.test.tsx`
- Create via registry: `ui/empty.tsx` — `bunx shadcn@latest add empty`

**Interfaces:**

- Produces: `/` = global feed; `/d/:slug` = channel feed; sort/window in the URL (`?sort=top&window=week`), pagination by offset. Sidebar gets the `+ Create channel` entry (3 max) and the active channel highlight.

- [x] **Step 1: routes.ts** — inside the shell layout: `route('d/:slug', './routes/channel.tsx')`. Home stays `index()`.

- [x] **Step 2: FeedControls** — shadcn `Tabs` + `TabsList` with `TabsTrigger asChild` wrapping `Link`s (Hot / New / Top, preserving the other params; `Tabs value={sort}` stays controlled — navigation drives it, zero client state to hydrate wrong). When `sort=top`, window chips `day | week | all` appear as `Button asChild` `Link`s (`size="sm"`, active = `variant="secondary"`, inactive = `variant="ghost"`).

- [x] **Step 3: home.tsx loader + render** — loader reads `new URL(request.url).searchParams` (whitelist via the same values the API validates), `apiFetch(request, '/api/posts?sort=…&window=…&limit=25&offset=…')`, returns `{ posts, sort, window, offset }`. Render: `FeedControls`, `PostCard` list, `Load more` / `Newer` as `Link`s stepping offset by 25 (hide Load more on <25 rows; hide Newer at offset 0). Empty feed: shadcn `Empty` composition (`EmptyMedia` icon, `EmptyTitle` `No claims yet — be the first`, `EmptyDescription` + `Button asChild` submit CTA when signed in, login link otherwise).

- [x] **Step 4: channel.tsx** — loader fetches domains + posts in parallel; unknown slug (not in domains) → `throw new Response('Not Found', { status: 404 })` (error boundary renders). Header: `channelHandle(slug)` + name + description, then the same feed list with `&domain=slug` on the API call and params preserved on controls.

- [x] **Step 5: `_shell.tsx` + ChannelSidebar** — `_shell` derives `activeSlug` from `useLocation().pathname` (`/d/<slug>` prefix) and passes it; ChannelSidebar appends a `+ Create channel` `Button variant="ghost" size="sm"` with `Plus` icon `data-icon="inline-start"` at the bottom of its existing scroll zone (logged-in only — sidebar receives `user` prop; the rest of the sidebar is Plan 2's locked structure, untouched) opening `CreateChannelDialog`: `Dialog` + `DialogTitle` `Create a channel`, fields in `FieldGroup`/`Field` (`FieldLabel` + `Input` for slug and name, `Textarea` for description, live slug hint `3–32 lowercase, digits, hyphens` as `FieldDescription`), submit → `apiJson POST /api/domains` → **navigate to `/d/<slug>`** (landing on the channel refetches the shell loader — `useRevalidator` needs a data router, which MemoryRouter-based tests do not provide) → toast `Channel created`; 429 from the API surfaces as a destructive `Alert` inside the dialog `Channel creation limit reached (3 per user)`; 400 surfaces the server message).

- [x] **Step 6: Tests** — FeedControls: three sort tabs link to expected search params; window chips only when top. CreateChannelDialog: submit posts payload (fetch stubbed in the test per web convention), error alert on 429 stub. ChannelSidebar: create button renders with user, not without; active channel highlighted. home/channel loader-level tests stay light — page components tested with passed-in posts fixture.

- [x] **Step 7: Verify + commit** — `bun run check`, `vitest run apps/web`, `cd apps/web && bun run typecheck` (route types regenerate). Commit: `feat: global and channel feeds with sorting and channel creation`.

---

## Task 9: Web — Post detail + comment thread

**Files:**

- Create: `apps/web/app/routes/post.tsx`, `apps/web/app/components/CommentThread.tsx` + `.test.tsx`, `CommentComposer.tsx` + `.test.tsx`
- Create via registry: `ui/breadcrumb.tsx`, `ui/collapsible.tsx` — `bunx shadcn@latest add breadcrumb collapsible`
- Modify: `apps/web/app/routes.ts` (`route('p/:id', './routes/post.tsx')`)

**Interfaces:**

- Produces: Frame 02 — full-height post (hero embed, body, votes), comments below, `best / new` sort tabs, replies collapsible.

- [ ] **Step 1: post.tsx loader** — parallel `apiFetch` of `/api/posts/:id` and `/api/posts/:id/comments` (both cookie-forwarded → `viewerVote` arrives server-rendered). 404 → error boundary.

- [ ] **Step 2: post render** — breadcrumb via shadcn `Breadcrumb` (`BreadcrumbList` → `BreadcrumbItem` with `BreadcrumbLink` to the channel via `channelHandle`, `BreadcrumbSeparator`, post title as `BreadcrumbPage`), wide `PostCard`-shaped hero: VoteArrows, channel + provider badges, title, question line, `<Embed post full />` (hero thumbnail scale per frame), body paragraphs, meta + Share/Report. Voting here reuses the page-level handler (`apiJson POST /api/posts/:id/vote`, optimistic score from Task 6 contract).

- [ ] **Step 3: CommentComposer** — `Card` with a `Textarea` (`Add to the discussion — cite what you checked`) + `Button` per the frame; `parentId` optional for replies. Signed-out: the button is a `Button asChild` wrapping a `Link` to `/login`. Submit → `apiJson POST /api/posts/:id/comments` → `revalidate` → toast on 400 (`Comment must be 1-4000 characters`).

- [ ] **Step 4: CommentThread** — the API returns a flat oldest-first list with `depth`; render as tree: group by `parentId` into children maps, roots first, indent by `depth` with `Separator`/thread-line styling per frame. Each comment: `Avatar` + `AvatarFallback` initials (fallback is mandatory), `userHandle(author)`, meta, VoteArrows (compact, wired to `/api/comments/:id/vote` optimistic), body, Reply (toggles a `CommentComposer` with `parentId`), Report. Sort tabs `best | new` = client-side `Tabs` with `onValueChange` reordering the top-level list (children stay anchored to parents): `best` → score desc, `new` → createdAt asc (API order). Reply collapse: shadcn `Collapsible` per parent — `CollapsibleTrigger` shows the reply count, `CollapsibleContent` unfolds the children.

- [ ] **Step 5: Tests** — CommentThread: nested fixture renders child under parent with indent, vote callbacks fire with ids, sort tabs reorder. CommentComposer: signed-out renders login link; signed-in submits body via stubbed fetch; rejects empty body before fetch.

- [ ] **Step 6: Verify + commit** — `bun run check`, `vitest run apps/web`, `bun run typecheck` in apps/web. Commit: `feat: post detail with threaded comments and voting`.

---

## Task 10: Web — Submit page

**Files:**

- Create: `apps/web/app/routes/submit.tsx` + `.test.tsx`
- Create via registry: `ui/toggle-group.tsx` — `bunx shadcn@latest add toggle-group` (brings `toggle.tsx` along)
- Modify: `apps/web/app/routes.ts` (`route('submit', './routes/submit.tsx')` — **outside** the shell layout, like auth pages; frame: "A real route, not a dialog")

**Interfaces:**

- Produces: Frame 03 — full-screen form: Channel select, Title, Source type, Source URL, Body, Post claim / Go back. `SUPPORTED_PROVIDERS` drives the type row; Instagram/Facebook shown disabled with `v2` chips.

- [ ] **Step 1: loader + gate** — loader: `requireUser` equivalent for the web = fetch `/api/auth/getSession`-backed check via `apiFetch('/api/posts' …)` is wrong; use the shell's pattern — the page renders signed-out state with a login CTA (same as auth pages pattern), no redirect dance. Channel options from `apiFetch('/api/domains')`.

- [ ] **Step 2: form** — controlled state per field, laid out with `FieldGroup` + `Field` + `FieldLabel` (Channel = `Select` with `SelectItem`s inside a `SelectGroup`; Title/URL = `Input`; Body = `Textarea`). Source type row: shadcn `ToggleGroup type="single"` with a `ToggleGroupItem` per `SUPPORTED_PROVIDERS` entry, plus `instagram reel` / `facebook reel` items `disabled` with a `v2` `Badge` — selecting a type only changes the hint text under the URL field (`Paste a YouTube link` etc.); detection stays server-side (`detectProvider` in the worker), the chip is UI guidance, not a payload field (API contract: `domainSlug, title, body?, url` — do not add fields). Inline validation mirrors the service: title 5–300, URL parses as http/https — invalid fields set `data-invalid` on the `Field` + `aria-invalid` on the control + a `FieldError` message. Submit → `apiJson POST /api/posts` with the button showing `Spinner data-icon="inline-end"` + `disabled` while pending (Button has no isPending — compose it) → success: toast `Post created` + `navigate('/p/' + id)`. Server 400/403 (locked domain): `Alert` with the message. Go back = `navigate(-1)`.

- [ ] **Step 3: Tests** — renders all fields + disabled v2 chips; validation rejects short title and non-URL before fetch; submit success navigates (stubbed fetch); API error surfaces in Alert; signed-out renders login CTA.

- [ ] **Step 4: Verify + commit** — `bun run check`, `vitest run apps/web`, typecheck. Commit: `feat: submit page with provider registry chips and validation`.

---

## Task 11: Web — Profile page

**Files:**

- Create: `apps/web/app/routes/profile.tsx` + `.test.tsx`
- Modify: `apps/web/app/routes.ts` (`route('u/:username', './routes/profile.tsx')` inside the shell)

**Interfaces:**

- Produces: Frame 06 — header (avatar initials, `userHandle`, stats: swag / posts / comments / member since), Posts|Comments tabs, mini post rows, right card with the swag breakdown.

- [ ] **Step 1: loader** — `apiFetch('/api/users/:username')` → `UserProfileDto`; 404 → error boundary. Unknown-user test lives at the component level.

- [ ] **Step 2: render** — header per frame: `Avatar` + `AvatarFallback` with initials (first two chars uppercased), `userHandle(username)` as h3, stats row `swag | posts | comments | member since <Mon YYYY>` (`Intl.DateTimeFormat('en', { month:'short', year:'numeric' })`). Tabs `Posts | Comments` (client-side `Tabs`): Posts = mini rows (channel badge, title link to `/p/:id`, `+score` in up-token color, `· timeAgo · N comments` — comments count unknown on profile rows, omit it and keep `· timeAgo`); Comments tab = count-only in v1: a muted card `N comments across the site — comment browsing arrives in v2` (frame note: "comments count-only in v1"). Right card `Swag breakdown`: `Card` composition (`CardHeader` + `CardTitle` + `CardContent` holding the two stat rows) with `post swag` / `comment swag` values + hint `recounted periodically from raw votes — self-healing`.

- [ ] **Step 3: Tests** — header stats render from fixture DTO; posts tab lists rows with links; comments tab shows the count-only note; breakdown card shows both numbers.

- [ ] **Step 4: Verify + commit** — `bun run check`, `vitest run apps/web`, typecheck. Commit: `feat: public profile page with swag breakdown and post history`.

---

## Task 12: End-to-end smoke + exit verification

**Files:**

- Modify: none (verification task; fix whatever it finds)

- [ ] **Step 1: Full stack up** — reset DB, `bun run apps/api/scripts/seed.ts`, API (`bun run dev` in apps/api), worker (`bun run worker` in apps/api), web (`bun run dev` in apps/web).

- [ ] **Step 2: Smoke pass (the spec's v1 core loop, by hand):** feed lists seeded posts with link cards → worker tick turns the YouTube-seeded post into a thumbnail card → click loads the `youtube-nocookie` iframe → vote persists after reload (`viewerVote` survives SSR) → comment + reply + comment vote → submit a new post (appears in feed under `new`; embed job drains within one poll) → profile shows swag breakdown → report a post → mod queue resolves it → `hot` ordering changes plausibly with votes.

- [ ] **Step 3: Toolchain exit gates** — `bun run check` zero warnings; `vitest run` green (shared + web suites); `bun test` green (API suite, real Postgres); `cd apps/web && bun run typecheck` green. API refuses startup without `DATABASE_URL` still passing.

- [ ] **Step 4: Final commit** — `chore: plan 3 content screens complete`.

---

## Plan 3 Exit Criteria

1. Frames 01, 02, 03, 06 exist as live routes matching `claim-tracker-ui-frames.html` (frame 04/05 were Plan 2's).
2. Every user-facing action hits a Plan 1 API endpoint — zero new unauthenticated write paths, zero CORS, no DB access from web.
3. No third-party iframe byte loads before a user click (GDPR posture intact).
4. `bun run worker` drains the seeded jobs table to zero pending within one poll interval; failed fetches leave the link-card fallback, never a stuck UI.
5. `hot` sort reflects score + age via the worker's recompute (not a constant column).
6. All existing tests still pass; every new component/module has its co-located test file.

## Explicitly NOT in Plan 3 (deferred, with reasons)

- **Search** — no API endpoint exists; the navbar input stays a decorative placeholder until a search spec lands (v2).
- **Subscriptions / "joined" state in the sidebar** — frame 01 shows join chips, but there is no subscription table in v1; the sidebar lists all channels (spec v2 backlog).
- **Instagram/Facebook embeds** — need Meta app tokens (spec v2); chips render disabled.
- **Karma recount worker for swag caching** — `getUserProfile` computes live sums (already fast at v1 scale); a persisted recount moves to the worker only when profiles show up in flame graphs.
- **Redis/external queue** — the `jobs` table poll is the v1 queue by design (spec §Stack).
- **Rate limiting on the new write endpoints** — beyond login brute-force, deferred per spec v2; vote/comment spam is a moderation problem until then.
- **`/mod` restyle** — mod screens keep default theme tokens (per the frame's own note); a tweakcn override is a later cosmetic pass.
- **Pagination beyond offset links** — no infinite scroll; offset-link pagination matches SSR and the API's limit=100 cap.
- **Deploy hardening of `/api/dev/jobs`** — it's dev-only tooling; gating it behind `NODE_ENV` lands with the deployment plan (Hetzner), not the content plan.

## Self-Review Notes

- **Order:** Tasks 1–4 are API/shared (worker unblocks embed rendering everywhere); 5 is the web plumbing seam; 6–7 build the card vocabulary; 8–11 are the four screens; 12 verifies. Tasks 6–11 are serializable but 8/9/10/11 only depend on 5–7, so two implementers could parallelize screens after Task 7.
- **`viewerVote` is optional** on the DTO (`viewerVote?: VoteValue | null`) so `ModPostDto`/mod table and every existing consumer stay source-compatible; the web reads `post.viewerVote ?? null`.
- **Comment count on cards:** the feed API doesn't return per-post comment counts; rather than widen `PostDto` for one badge, cards take an optional count and the detail page is the source of truth. If the badge matters in feeds, that's a one-query API addendum — flagged for the user to rule on.
- **Worker claim safety:** single UPDATE…WHERE id=(SELECT…) claim is atomic per row and single-process by design (student budget, one worker). Two worker processes would race harmlessly (status transition guards), but recomputeHot double-running is wasteful — document one-process deployment.
- **The hot constants (`/12`, 30-day window) are guesses** pinned by tests but tunable — call them out for user review at demo time.
- **Fixture server in worker tests is real HTTP on localhost**, not a mock — consistent with the repo's no-mock posture (the `check_no_mock` scanner bans `vi.mock`, which no test here needs).
- **No plan-level DB migrations:** every column the plan touches (`provider`, `embed`, `hot_rank`, `jobs.status`) already exists from Plan 1 — the worker only writes to them.
- **shadcn-first pass:** every screen composes registry primitives — 8 additions, all verified to resolve in this project's registry config (dry-run): sonner, field, spinner, aspect-ratio, empty, breadcrumb, collapsible, toggle-group (brings toggle). Custom markup survives only where no registry shape exists (vote arrows, click-to-load embed surface). Two registry gotchas are pinned in Task 6 Step 1, both ruled on by the user: `next-themes` is removed outright from `sonner.tsx` (the project owns dark mode), and the `field` add is accepted with its `label.tsx`/`separator.tsx` overwrite after a diff confirms upstream-only changes.
- **Execution order (user-adjusted):** the web feed chain runs before the worker — T5 → T6 → T8 → T7 → T4 — so seeded content is visible on `/` as soon as possible; embeds render as link cards until T7 upgrades the card slot and T4 drains the queued `fetch_embed` jobs. T9–T11 follow unchanged. The Plan 2 sidebar was rechecked — it already follows the composition rules (ScrollArea, semantic tokens, `gap` spacing) and stays locked except for the appended create-channel button.

- **Fallow audit (pre-T8 gate, `npx fallow audit --base main`):** Fixed — feed-query parser extraction (`post.routes.ts` CRAP 63.6 → flat handler), FieldError suppression syntax (reason lives on its own line — fallow tokenizes every word after the directive as an issue kind). Accepted with reasons — `field.tsx`/`spinner.tsx` unused files (their consumers land in T8), `isbot` unused dep (react-router typegen auto-reinstalls it — framework-required, never imported by app code), `comment.service.ts` row-mapper complexity + 4 clone groups (plan-1-inherited, test-pinned). Maintainability 90.8 (good); the remaining exit-1 findings are all accounted for above.
