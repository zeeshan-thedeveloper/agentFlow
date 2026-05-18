FROM node:20.18-bookworm-slim AS base
RUN apt-get update -y \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g corepack@latest && corepack enable && corepack prepare pnpm@10.33.2 --activate

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

# ── portable production bundle (correct node_modules layout for node dist/main) ─
FROM build AS bundle
WORKDIR /app
ENV NODE_ENV=production
RUN pnpm --filter @agentflow/api deploy --prod --legacy /bundle/api \
  && cp -r apps/api/dist /bundle/api/dist \
  && cp -r apps/api/prisma /bundle/api/prisma \
  && cd /bundle/api && npx prisma generate

# ── runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
WORKDIR /bundle/api

COPY --from=bundle /bundle/api ./

ENV NODE_ENV=production
ENV PORT=18001
EXPOSE 18001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||18001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

RUN groupadd -r app && useradd -r -g app -d /bundle/api -s /usr/sbin/nologin app \
  && chown -R app:app /bundle/api
USER app

CMD ["node", "dist/main.js"]
