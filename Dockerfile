# One image for both Render services (nocap-api, nocap-web). The bun
# workspace monorepo rules out Render's native node runtime (it cannot
# install bun workspaces), and Render non-blueprint services build from a
# Dockerfile at the repo root — so the root context carries the whole
# workspace and each service picks its entry point via START_PATH.
#   nocap-api:  START_PATH=apps/api/src/index.ts
#   nocap-web:  START_PATH=apps/web/server.mjs
FROM oven/bun:1.3.12

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile

# Web build lives in the image so the api service (which never serves it)
# and the web service share one build; ~a minute of Docker build time.
RUN cd apps/web && bun run build

# exec keeps bun as PID 1 (signals reach the server, no sh wrapper).
CMD ["sh", "-c", "exec bun run \"$START_PATH\""]
