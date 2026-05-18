# AgentFlow — Deployment Runbook

Production layout for this repository as of 2026-05-18.

## Infrastructure inventory

| Component | Value |
|---|---|
| Web (Vercel) | https://agentflow.zeeshanahmed.app |
| API (DigitalOcean droplet + Caddy) | https://agentflow-api.zeeshanahmed.app |
| API container image | `ghcr.io/zeeshan-thedeveloper/agentflow-api` |
| Droplet SSH user | `zeesh` |
| Droplet app path | `~/apps/agentflow` |
| Database | Neon PostgreSQL (connection string in `DATABASE_URL`) |
| DNS | Cloudflare — `agentflow` and `agentflow-api` → droplet / Vercel per record |

Set `DROPLET_HOST` in GitHub Actions to the droplet's public IPv4 (do not commit the IP in git).

### GitHub Actions secrets

| Secret | Used by | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | CI, Deploy | Default; GHCR push |
| `SSH_PRIVATE_KEY` | Deploy | Base64-encoded private key for droplet SSH |
| `DROPLET_HOST` | Deploy | Droplet public IP or hostname |
| `SLACK_WEBHOOK_URL` | Deploy, E2E | Optional deploy/E2E notifications |

### Runtime environment (droplet `~/apps/agentflow/.env`)

| Variable | Required |
|---|---|
| `DATABASE_URL` | Yes |
| `REDIS_URL` | Yes |
| `NEXTAUTH_SECRET` | Yes (≥32 chars) |
| `API_KEY_ENCRYPTION_SECRET` | Yes (≥32 chars) |
| `SENTRY_DSN` | No |

### Vercel (web) environment

Same secrets as API where shared (`DATABASE_URL`, `NEXTAUTH_SECRET`, `API_KEY_ENCRYPTION_SECRET`, Google OAuth vars). Optional: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`.

---

## CI / CD flow

1. Push to `main` runs **CI** (type-check, test, lint, build).
2. On CI success, **Deploy** builds and pushes `agentflow-api:latest` and `agentflow-api:sha-<full-sha>`.
3. Migrations run in a one-off container, then `docker compose -f docker-compose.prod.yml up -d --force-recreate api`.
4. Deploy polls `GET /health` for up to 60s; on failure it rolls back to `last-good-sha.txt` on the droplet.
5. On Deploy success, **E2E** runs Playwright smoke tests against production URLs.

---

## Manual deploy

```bash
# From your machine, with SSH access to the droplet
export DROPLET_HOST="<your-droplet-ip>"
export SHA="<git-commit-sha>"

ssh zeesh@$DROPLET_HOST "docker pull ghcr.io/zeeshan-thedeveloper/agentflow-api:sha-$SHA"

ssh zeesh@$DROPLET_HOST "docker run --rm --env-file ~/apps/agentflow/.env \
  ghcr.io/zeeshan-thedeveloper/agentflow-api:sha-$SHA \
  npx prisma migrate deploy"

ssh zeesh@$DROPLET_HOST "cd ~/apps/agentflow && \
  docker tag ghcr.io/zeeshan-thedeveloper/agentflow-api:sha-$SHA \
             ghcr.io/zeeshan-thedeveloper/agentflow-api:latest && \
  docker compose -f docker-compose.prod.yml pull && \
  docker compose -f docker-compose.prod.yml up -d --force-recreate api"
```

Verify:

```bash
curl -fsS https://agentflow-api.zeeshanahmed.app/health
curl -fsS https://agentflow-api.zeeshanahmed.app/health/ready
```

Record the good SHA on the droplet:

```bash
ssh zeesh@$DROPLET_HOST "echo '$SHA' > ~/apps/agentflow/last-good-sha.txt"
```

---

## Manual rollback

Use the SHA written in `last-good-sha.txt` (or pick any known-good `sha-*` tag from GHCR).

```bash
export DROPLET_HOST="<your-droplet-ip>"
export PREV_SHA="$(ssh zeesh@$DROPLET_HOST 'cat ~/apps/agentflow/last-good-sha.txt')"

ssh zeesh@$DROPLET_HOST "docker pull ghcr.io/zeeshan-thedeveloper/agentflow-api:sha-$PREV_SHA && \
  docker tag ghcr.io/zeeshan-thedeveloper/agentflow-api:sha-$PREV_SHA \
             ghcr.io/zeeshan-thedeveloper/agentflow-api:latest && \
  cd ~/apps/agentflow && docker compose -f docker-compose.prod.yml up -d --force-recreate api"
```

Confirm health, then stop if unhealthy and investigate logs.

---

## Secret rotation

### `API_KEY_ENCRYPTION_SECRET` / `NEXTAUTH_SECRET`

1. Generate new values: `openssl rand -base64 32`
2. Update droplet `~/apps/agentflow/.env` and Vercel project env.
3. Redeploy API and Vercel web so both runtimes match.
4. Users may need to re-save encrypted API keys if the encryption secret changed.

### Google OAuth

1. Rotate client secret in Google Cloud Console.
2. Update `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` on Vercel (and locally).
3. Redeploy web; no API image change required unless API validates OAuth directly.

### SSH deploy key

1. Add new public key to droplet `~/.ssh/authorized_keys`.
2. Base64-encode new private key into GitHub `SSH_PRIVATE_KEY`.
3. Remove old key from droplet after a successful deploy.

---

## Database restore (Neon)

1. Open the Neon console → project → **Branches** / **Restore**.
2. Create a branch or restore point from backup.
3. Copy the new connection string into `DATABASE_URL` on droplet and Vercel.
4. Run `prisma migrate deploy` against the new URL (one-off container command above).
5. Redeploy API and web.

---

## Local development

Copy env templates and fill values:

- [apps/api/.env.example](../apps/api/.env.example) → `apps/api/.env`
- [apps/web/.env.local.example](../apps/web/.env.local.example) → `apps/web/.env.local`

```bash
pnpm install
docker compose up -d postgres redis   # infra only
cd apps/api && pnpm exec prisma migrate dev
cd ../..
pnpm dev
```

`docker compose up` (full stack) requires `NEXTAUTH_SECRET` and `API_KEY_ENCRYPTION_SECRET` — compose fails fast if they are missing.

---

## Incident response

### API logs (droplet)

```bash
ssh zeesh@$DROPLET_HOST "docker ps --format '{{.Names}}' | grep api"
ssh zeesh@$DROPLET_HOST "docker logs -f --tail 200 agentflow-api-1"
```

Request lines include `[request-id] METHOD path status durationMs` and responses expose `X-Request-Id`.

### Web logs

Vercel project → **Deployments** → select deployment → **Functions** / **Runtime Logs**.

### Shell into API container

```bash
ssh zeesh@$DROPLET_HOST "docker exec -it agentflow-api-1 sh"
```

### Ad-hoc Prisma command

```bash
ssh zeesh@$DROPLET_HOST "docker run --rm -it --env-file ~/apps/agentflow/.env \
  ghcr.io/zeeshan-thedeveloper/agentflow-api:latest \
  npx prisma studio"
```

Replace `studio` with `migrate status`, `db pull`, etc.

### Health checks

```bash
curl -i https://agentflow-api.zeeshanahmed.app/health
curl -i https://agentflow-api.zeeshanahmed.app/health/ready
```

---

## Optional observability

- **Sentry:** set `SENTRY_DSN` (API) and `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (web). Leave empty to disable.
- **Slack:** set `SLACK_WEBHOOK_URL` in GitHub for deploy and E2E failure notifications.
