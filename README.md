# AgentFlow

A visual AI agent builder — design, run, and monitor autonomous workflows through a drag-and-drop canvas. Connect triggers, LLM agents, tools, and outputs into pipelines without writing boilerplate.

---

## Features

- **Visual canvas editor** — node-based workflow builder powered by React Flow
- **Bring-Your-Own-Key (BYOK)** — store OpenAI / Claude API keys encrypted at rest; decrypted only at execution time
- **Workflow execution engine** — topological sort + handler registry; full step-by-step audit trail persisted per run
- **Run history** — inspect every step's input/output JSON for any past run
- **Google OAuth** — sign in with Google via NextAuth; demo mode works locally without credentials
- **Monorepo** — Next.js frontend + NestJS API sharing TypeScript types in a single pnpm workspace

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, React 18 |
| Canvas | @xyflow/react |
| Styling | Tailwind CSS |
| Backend | NestJS 10, TypeScript strict |
| Database | PostgreSQL 16 + Prisma 5 |
| Queue | Redis 7 + BullMQ |
| Auth | NextAuth 4 (Google OAuth) |
| Encryption | Node.js crypto — AES-256-GCM |
| LLM | OpenAI SDK (Claude support in progress) |
| Package manager | pnpm 10 workspaces |
| Dev infra | Docker + Docker Compose |

---

## Project Structure

```
agentflow/
├── apps/
│   ├── web/          # Next.js frontend  (port 3100)
│   └── api/          # NestJS backend    (port 3001)
│       └── prisma/   # Schema & migrations
├── packages/
│   └── types/        # Shared TypeScript types
├── docs/             # Architecture & deployment guides
├── docker-compose.yml
└── .env.example
```

### Key source locations

| Path | What it does |
|---|---|
| [apps/web/src/components/canvas/](apps/web/src/components/canvas/) | Canvas editor — board, nodes, config panel, toolbar |
| [apps/api/src/runs/executor.ts](apps/api/src/runs/executor.ts) | Topological sort + node execution loop |
| [apps/api/src/handlers/registry.ts](apps/api/src/handlers/registry.ts) | Node type → handler dispatch table |
| [apps/api/src/handlers/agent.handler.ts](apps/api/src/handlers/agent.handler.ts) | LLM API calls (OpenAI / Claude) |
| [apps/web/src/server/apiKeyCrypto.ts](apps/web/src/server/apiKeyCrypto.ts) | AES-256-GCM encrypt / decrypt helpers |
| [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) | Full database schema |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker + Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/your-username/agentflow.git
cd agentflow
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `PORT` | API server port (default `3001`) |
| `NEXT_PUBLIC_API_URL` | URL the browser uses to reach the API |
| `NEXTAUTH_URL` | Frontend base URL |
| `NEXTAUTH_SECRET` | Random 32-byte secret for NextAuth sessions |
| `API_KEY_ENCRYPTION_SECRET` | Random 32-byte secret for encrypting stored API keys |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID *(optional — app works in demo mode without it)* |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For Google sign-in, create an OAuth client in [Google Cloud Console](https://console.cloud.google.com) and add this authorized redirect URI:
```
http://localhost:3100/api/auth/callback/google
```

### 3. Start infrastructure

```bash
docker-compose up -d   # starts Postgres + Redis
```

### 4. Run database migrations

```bash
cd apps/api
pnpm prisma migrate dev --name init
cd ../..
```

### 5. Start dev servers

```bash
pnpm dev   # runs frontend and backend in parallel
```

| Service | URL |
|---|---|
| Canvas editor | http://localhost:3100/canvas |
| API | http://localhost:3001 |

---

## Docker (Full Stack)

The `docker-compose.yml` runs the complete stack with hot-reload — no local Node.js required:

```bash
docker-compose up
```

Services: `postgres`, `redis`, `api` (NestJS with auto-migration), `web` (Next.js).

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/workflows/:id/run` | Execute a workflow (optional JSON body passed as initial input) |
| `GET` | `/runs/:id/steps` | Fetch all execution steps for a run |

---

## Architecture

### Handler Registry

Node types are never eval'd. Each type maps to a TypeScript handler class:

```
Canvas JSON → topological sort → per-node handler dispatch → step persisted to DB
```

```
registry["agent"]   → AgentHandler   (calls LLM API)
registry["trigger"] → TriggerHandler (start conditions)
registry["output"]  → OutputHandler  (result formatting)
```

Adding a new node type means adding a new handler class and registering it — no changes to the executor.

### Credential Security

- API keys encrypted at rest with AES-256-GCM; master key lives only in the environment variable, never in the database
- Decrypted in-memory at execution time only — never returned to the frontend or logged
- Only the last 4 characters are shown in the UI (`sk-...Ab3X`)

### Execution Model

1. Load the workflow's `canvasJson`
2. Topologically sort nodes by dependency edges
3. Execute each node via its handler, passing prior outputs forward
4. Persist every step's input + output JSON as an `AgentStep` record

This gives free replay capability, debugging visibility, and a complete audit trail.

---

## Deployment

Recommended free / low-cost production setup:

| Role | Platform |
|---|---|
| Frontend | [Vercel](https://vercel.com) — connect `apps/web` |
| API | [Railway](https://railway.app) — connect `apps/api` |
| Database | [Neon](https://neon.tech) — PostgreSQL serverless |
| Cache / Queue | [Upstash](https://upstash.com) — Redis serverless |

See [docs/deployment-options.md](docs/deployment-options.md) for step-by-step instructions.

---

## Roadmap

- [ ] BullMQ background job queue for async execution
- [ ] Real-time run status via SSE / WebSocket
- [ ] Multi-step LLM reasoning with tool-calling loops
- [ ] Condition / branch nodes
- [ ] HTTP request nodes
- [ ] Claude model toggle in UI
- [ ] GitHub integration
- [ ] Slack integration

---

## Contributing

1. Fork the repo and create a feature branch off `main`
2. `pnpm install` → `docker-compose up -d` → `pnpm dev`
3. Open a pull request — describe what changed and why

---

## License

MIT
