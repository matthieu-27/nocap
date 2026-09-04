# NoCaP — web app

React Router (framework mode) + Tailwind CSS frontend for the NoCaP monorepo.

## Setup

This app lives in a bun workspace. From the repo root:

```bash
bun install
```

Never use npm here — it creates a stray lockfile and `node_modules` that fight `bun.lock`.

## Development

Run both dev servers, each from its own app directory:

```bash
# in apps/api — API on :3001
bun run dev

# in apps/web — web on :3000
bun run dev
```

The Vite `/api` proxy forwards API calls to :3001, so the site runs as one origin at `http://localhost:3000`.

## Build

From `apps/web`:

```bash
bun run build
```

## Tests

- From the repo root: `bun run test` (vitest)
- From `apps/api`: `bun test` (API suite, runs against local Postgres)

## Lint

From the repo root:

```bash
bun run check
```
