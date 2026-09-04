# NoCaP — Design Spec

**Date:** 2026-09-01 (renamed 2026-09-03)
**Status:** approved in conversation, pending implementation plan
**Name:** **NoCaP** (decided 2026-09-03; was working title "Claim Tracker")

## 1. Purpose

A Reddit-like forum where users post claims with media links (YouTube, TikTok, Instagram) across user-created domains (politics, sports, shopping, …). The community rates **sourcing quality**, not agreement: each post carries one question — *"Is this well-sourced?"* — answered by a single up/down vote pair. Users accumulate karma from votes received, rewarding contribution quality over time.

**Primary goal: real launch** with actual users. Moderation, authentication, terms, and deployment are day-one requirements, not afterthoughts.

**Constraints:**
- Solo developer, student budget (target under €5/month infrastructure)
- Host: Hetzner Cloud CX22 (x86, 2 vCPU / 4 GB, DE/FI datacenters), free subdomain initially (DuckDNS or is-a.dev), custom domain (~€10/yr) when justified
- Developer conventions: strict TypeScript, service/presentation layer separation, Testing Library rules, user runs all verification (lint/build/tests), git untouched by the assistant

## 2. Product definition

### Core loop

1. User posts a claim: title + URL (+ optional body text)
2. System fetches embed metadata asynchronously; post shows a link card until then
3. Community votes yes/no on "Is this well-sourced?"
4. Post score and author karma update; feeds rank by hot/new/top
5. Viewers discuss in threaded comments (comments are also votable)

### v1 scope (all approved)

- Email + password accounts (Argon2id), session cookies
- Posts with media links, embeds rendered inline (YouTube first, TikTok, generic og-tags; Instagram deferred)
- Single-axis vote per post and per comment
- User-created domains (rate-limited), domain feeds, global feed
- Karma + public profiles (post + comment karma)
- Threaded comments
- Sorting: hot / new / top (day, week, all)
- Reports + moderation queue + mod action log
- ToS, Privacy Policy, published contact email
- Click-to-load embeds (GDPR mitigation)

### v2 backlog (explicitly out of v1)

OAuth login, Redis queue, per-domain moderators, full consent banner, Instagram embeds (needs Meta app token), Playwright e2e, CI, password reset by email (needs SMTP), rate limiting beyond login brute-force protection.

## 3. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Web | React Router v8, framework mode (SSR), Vite 7, Bun | SEO for content pages; v8 requires React 19.2.7+, Vite 7+, Node 22.22+ (Bun implements the Node API — verify week one) |
| UI | Tailwind v4 + shadcn/ui (blocks) | Copied source, no dep lock; prebuilt layouts speed up feed/mod UI |
| API | Hono on Bun | Single runtime for web-facing services; `app.request()` enables server-free route tests |
| ORM | Drizzle | Typed queries, strict-TS friendly, SQL-first migrations |
| Worker | Python + uv + uvicorn (async), FastAPI as job runner | Slow jobs off the request path |
| DB | PostgreSQL 17 | Relational fit; row-level constraints protect vote integrity |
| Queue | `jobs` table, `SELECT … FOR UPDATE SKIP LOCKED` | No Redis until queue pressure demands it |
| Proxy | Caddy | Automatic TLS, minimal config |
| Deploy | Docker Compose on Hetzner CX22, `git pull && docker compose up -d --build` | Cheapest path that stays boring |

## 4. Architecture

```
            ┌──────────────┐
 internet ──│ Caddy :80/:443 │   auto-TLS, routes by hostname
            └──────┬───────┘
        ┌──────────┴─────────────┐
   app.example.org          api.example.org
        ▼                        ▼
  ┌───────────┐            ┌───────────┐     ┌─────────────┐
  │ web       │  fetch ───▶│ api       │────▶│ Postgres 17 │
  │ RRv8 SSR  │            │ Hono+Bun  │     │ (volume)    │
  │ :3000     │            │ :3001     │     └─────────────┘
  └───────────┘            └─────┬─────┘            ▲
                                 │ enqueues jobs      │
                                 ▼                    │
                           ┌────────────┐             │
                           │ worker     │─────────────┘
                           │ uvicorn    │  oEmbed fetch, hot-rank recompute,
                           └────────────┘  karma recount, vote-score reconcile
```

Rules:
- **Web never touches the database.** SSR loaders call the Hono API over localhost. The API is the single source of truth and can later serve mobile clients.
- **Worker polls the `jobs` table**; slow oEmbed fetches never block API requests.
- **Deploy** = SSH, `git pull`, `docker compose up -d --build`. No CI in v1.

Monorepo layout (Bun workspaces):

```
apps/web         React Router v8 framework mode
apps/api         Hono + Drizzle
apps/worker      Python (uv project)
packages/shared  TS types shared web ↔ api (vote values, DTOs)
docker-compose.yml, Caddyfile at repo root
```

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `users` | username, email, password_hash, role (`user`/`mod`/`admin`), karma | role drives mod tools; no separate mod system |
| `sessions` | token_hash, user_id, expires_at | httpOnly cookie maps to row |
| `domains` | slug, name, description, created_by, is_locked | user-created; `is_locked` hides spam domains |
| `posts` | domain_id, author_id, title, body, url, provider, embed_json, score, hot_rank, created_at, deleted_at | `score`/`hot_rank` cached — feeds read, worker recomputes |
| `votes` | post_id, user_id, value (+1/-1), UNIQUE(post_id, user_id) | DB constraint = race-proof one-vote-per-user |
| `comments` | post_id, author_id, parent_id (NULL = top-level), body, score, created_at, deleted_at | read via recursive CTE |
| `comment_votes` | comment_id, user_id, value | same pattern as `votes` |
| `reports` | reporter_id, post_id/comment_id, reason, status (`open`/`resolved`/`dismissed`), created_at | notice-and-action paper trail |
| `mod_actions` | mod_id, action, target_id, reason, created_at | accountability log |
| `jobs` | type, payload, status, run_at | DB queue |

Soft delete (`deleted_at`) for all moderator-visible content: hidden publicly, retained for disputes and legal requests.

Karma = sum of votes received on posts + comments, cached on `users`, recomputed by the worker (not transactional per vote — cheaper and self-healing).

## 6. Core loops

### Voting

`POST /api/posts/:id/vote` body `{value: 1 | -1 | 0}` (0 removes the vote).
One transaction: upsert into `votes`, atomic `posts.score` update. Worker recounts from raw votes periodically to heal any drift.

### Ranking

Worker recomputes `hot_rank` every ~2 minutes for posts created in the last 48 h, using Reddit's hot formula:

```python
def hot(ups: int, downs: int, timestamp: int) -> float:
    score = ups - downs
    order = math.log10(max(abs(score), 1))
    sign = 1 if score > 0 else -1 if score < 0 else 0
    return round(order + sign * timestamp / 45000, 7)
```

Feeds: **hot** = `ORDER BY hot_rank` (default); **new** = `created_at DESC`; **top** = `score DESC` within day/week/all windows. Reads never compute.

### Embeds

```
post created → job {type: fetch_embed}
worker: match provider → fetch oEmbed → store embed_json + provider
```

Provider adapters: **YouTube** (public oEmbed, no auth — build first), **TikTok** (public oEmbed), **generic** (fetch `og:title`/`og:image`, render link card). Instagram and Facebook reels deferred to v2 (Meta app token friction). Universal fallback: link card. Posts never block on embed fetching.

The allowed source types shown in the submit form come from a registry constant `SUPPORTED_PROVIDERS` in `packages/shared` (youtube, tiktok, link in v1). Provider adapters are separate modules: adding a type = one registry entry + one adapter module, no form or schema changes.

GDPR: embeds are click-to-load — thumbnail until user clicks, iframe after. Defers full consent banner to v2.

### Auth

Email + password, Argon2id hashes, session = httpOnly `SameSite=Lax` cookie backed by `sessions` table, Hono middleware guards routes. Login brute-force protection = failed-attempt counter per email + IP. Password reset deferred (needs SMTP).

## 7. Moderation and legal (EU)

- Report reasons: spam | harassment | personal info | illegal | off-domain
- Flow: report → queue → mod resolves (remove = soft delete, or dismiss) → `mod_actions` row logs who/what/why/when
- Roles: `user` → `mod` (global in v1) → `admin`
- Domain creation rate-limited (3 per user); spam domains locked via `is_locked`
- ToS + Privacy Policy live **before first signup**. GDPR data: email, password hash, 90-day IP logs for abuse handling. Nothing else collected — no ads, no trackers
- Published contact email = DSA notice point; target response 48 h; illegal content removed on notice
- Not legal advice; one consult with a qualified person recommended before promoting the site

## 8. API surface (v1)

```
POST   /api/auth/signup            POST /api/auth/login        POST /api/auth/logout
GET    /api/domains                POST /api/domains
GET    /api/posts?domain=&sort=    POST /api/posts             GET /api/posts/:id
POST   /api/posts/:id/vote
GET    /api/posts/:id/comments     POST /api/posts/:id/comments
POST   /api/comments/:id/vote
GET    /api/users/:username        (profile + karma)
POST   /api/reports
GET    /api/mod/reports (mod+)     POST /api/mod/actions (mod+)
```

## 9. Testing

| Layer | Tool | Shape |
|---|---|---|
| Web components | Vitest + Testing Library | one test file per component, `getByRole` for buttons, all props passed, no `waitFor(async …)` |
| API routes | Hono `app.request()` | no server boot; service functions pure and tested directly |
| Worker | pytest | hot-score math and embed parsing as pure functions, no mocks |

E2E deferred. All verification runs are executed by the developer, never the assistant.

## 10. Operations

- Nightly `pg_dump` cron to off-box storage (even a second free-tier provider); restore tested once before launch
- Backups, snapshots, and monitoring beyond uptime checks are out of v1 scope
- Upgrade path: CX22 → CX32 if CPU/memory pressure appears; Redis and per-domain moderation when scale demands

## 11. Risks and open decisions

| Item | Status |
|---|---|
| Bun + Vite 7 + RRv8 compatibility | Low risk, verify in week one with a skeleton app before committing to the stack |
| Instagram embeds | Deferred; needs Meta app token |
| GDPR/DSA posture | Mitigations designed in (click-to-load, data minimization, report flow); qualified review recommended pre-promotion |
| Product name | **Decided: NoCaP** (2026-09-03). Display handles reuse the name as a sigil: channels `nocap/<slug>`, profiles `nocap/<username>`, both built from one constant `SITE_HANDLE = "nocap"` in `packages/shared` (changeable later). Domain choice follows |
| Free subdomain | DuckDNS (instant) vs is-a.dev (PR-based, cleaner); custom domain later |
| Vote brigading | v1 relies on one-vote-per-user + logged-in requirement; IP heuristics later if needed |

## 12. Launch criteria (definition of done)

1. Signup/login/vote/comment works end to end for two separate accounts
2. YouTube embed renders via click-to-load
3. Hot feed reflects recent votes; top feed respects time windows
4. Report → mod queue → soft delete flow works and logs
5. ToS, Privacy Policy, contact email reachable from the site footer
6. Nightly backup running; one restore verified
7. Deployed on Hetzner via `docker compose up -d` behind Caddy with valid TLS
