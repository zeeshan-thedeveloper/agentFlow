FROM node:20-bookworm-slim AS base
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# ── deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/types ./packages/types
COPY apps/api ./apps/api
RUN pnpm --filter @agentflow/api exec prisma generate
RUN pnpm --filter @agentflow/api build

# ── runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json

# Copy node_modules from build so the generated Prisma client is included
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma

ENV NODE_ENV=production
ENV PORT=18001
EXPOSE 18001

WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
