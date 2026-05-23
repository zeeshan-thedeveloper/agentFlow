# AgentFlow

> A visual AI agent workflow builder for designing, running, and inspecting autonomous multi-step workflows.

> **Portfolio project** — built to explore full-stack AI product engineering: visual canvas, typed execution engine, encrypted credential handling, and persisted run history.

<p align="center">
  <img src="docs/assets/agentflow-canvas.png" alt="AgentFlow canvas showing trigger, AI agent, tool, and output nodes connected in a workflow" width="900" />
</p>

<p align="center">
  <em>AgentFlow canvas: build, run, and inspect AI workflows through connected trigger, agent, tool, and output nodes.</em>
</p>

---

## Problem

AI workflows often become hardcoded scripts or simple chatbot demos. Teams need a visual way to design, run, debug, and inspect multi-step AI workflows. AgentFlow explores how to connect triggers, LLM agents, tools, and outputs through a typed execution engine — making workflow logic visible, inspectable, and iteratable.

---

## Product Flow

```
Trigger → Agent → Tool/Skill → Output → Run History
```

1. User designs a workflow on the visual canvas by connecting nodes.
2. Workflow is saved as canvas JSON (nodes + edges).
3. Backend topologically sorts nodes to determine execution order.
4. Each node executes through a typed handler registry.
5. Inputs and outputs are persisted as run steps for debugging and replay.

---

## Architecture

```
apps/
  web/        ← Next.js canvas UI + auth
  api/        ← NestJS execution engine + REST API
packages/
  types/      ← Shared TypeScript types
docs/
docker-compose.yml
```

```
Canvas UI → API → Executor → Handler Registry → LLM/Tools → PostgreSQL Run History
```

---

## Key Features

- **Visual workflow canvas** — drag-and-drop node editor powered by React Flow / @xyflow
- **Topological execution engine** — dependency-aware node sorting for correct workflow ordering
- **Handler registry pattern** — extensible typed node execution; add handlers without touching the executor
- **Bring-Your-Own-Key (BYOK)** — encrypted at-rest API key storage; decrypted only at execution time
- **Run history** — persist every step's input/output JSON for debugging and replay
- **Node types implemented** — Trigger, Agent (LLM calls with OpenAI), Tool, Output, Database config, Query runner, Schema introspection
- **Google OAuth** — sign in with Google; demo mode for local development without credentials
- **Database integration** — configure PostgreSQL connections; introspect schema; run parameterized queries
- **Full-stack TypeScript** — shared types across Next.js frontend and NestJS backend

---

## Why This Project Matters

AgentFlow demonstrates AI product engineering beyond a chatbot demo:

- **Visual workflow orchestration** with typed nodes and edges
- **Backend execution engine** using topological sorting
- **Handler registry pattern** for extensible node execution
- **BYOK credential handling** with AES-256-GCM encryption boundaries
- **Persisted run history** for debugging and auditability
- **Full-stack product architecture**: canvas UI + API + database + infrastructure

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Canvas | @xyflow/react (React Flow) |
| Backend | NestJS 10, TypeScript strict mode |
| Database | PostgreSQL 16, Prisma 5 ORM |
| Auth | NextAuth.js 4, Google OAuth |
| Encryption | Node.js crypto — AES-256-GCM |
| Infrastructure | Docker, Docker Compose |
| Package Manager | pnpm 10 workspaces |

---

## Current Status

| Area | Status |
|------|--------|
| Canvas editor | Implemented |
| Workflow persistence | Implemented |
| Execution engine (topological sort) | Implemented |
| Handler registry | Implemented |
| LLM agent node (OpenAI) | Implemented |
| Run history & step audit trail | Implemented |
| Google OAuth | Implemented |
| Demo mode | Implemented |
| Database integration | Implemented |
| Query runner node | Implemented |
| Schema introspection | Implemented |
| Docker local setup | Implemented |
| Async queue (BullMQ) | Planned |
| Real-time run status (WebSocket/SSE) | Planned |
| Multi-model selector (Claude/Gemini) | Planned |
| More node types (HTTP, conditions) | Planned |

---

## Local Setup

### Prerequisites

- Node.js 18+
- pnpm
- Docker + Docker Compose

### Setup

```bash
# Clone
git clone https://github.com/zeeshan-thedeveloper/agentFlow.git
cd agentFlow

# Install dependencies
pnpm install

# Copy environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start infrastructure
docker compose up -d

# Run database migrations
pnpm --filter api prisma migrate dev

# Start development servers
pnpm dev
```

### Service URLs

| Service | URL |
|---------|-----|
| Web app | http://localhost:3100 |
| API | http://localhost:3001 |
| PostgreSQL | localhost:15432 |

---

## Environment Variables

### Root (`.env`)

```env
DATABASE_URL=postgresql://agent_user:agent_pass@localhost:15432/agentflow
REDIS_URL=redis://localhost:6379
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3100
NEXTAUTH_SECRET=replace-with-random-32-byte-secret
API_KEY_ENCRYPTION_SECRET=replace-with-random-32-byte-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
```

### API (`.env` in `apps/api/`)

```env
DATABASE_URL=postgresql://agent_user:agent_pass@localhost:15432/agentflow
REDIS_URL=redis://localhost:6379
PORT=3001
API_KEY_ENCRYPTION_SECRET=replace-with-random-32-byte-secret
NEXTAUTH_SECRET=replace-with-random-32-byte-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
TAVILY_API_KEY=replace-with-tavily-api-key-if-used
```

### Web (`.env` in `apps/web/`)

```env
DATABASE_URL=postgresql://agent_user:agent_pass@localhost:15432/agentflow
NEXTAUTH_URL=http://localhost:3100
NEXTAUTH_SECRET=replace-with-random-32-byte-secret
API_KEY_ENCRYPTION_SECRET=replace-with-random-32-byte-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
GITHUB_CLIENT_ID=replace-with-github-client-id
GITHUB_CLIENT_SECRET=replace-with-github-client-secret
NEXT_PUBLIC_API_URL=http://localhost:3001
INTERNAL_API_URL=http://localhost:3001
```

> **LLM provider API keys** (OpenAI, etc.) are supplied by users at runtime through the BYOK flow and stored encrypted in the database. They are not required as server environment variables.

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/workflows/:id/run` | Execute a workflow (optional JSON body passed as initial input) |
| `GET` | `/workflows` | List all workflows for the authenticated user |
| `GET` | `/workflows/:id` | Fetch workflow details |
| `POST` | `/workflows` | Create a new workflow |
| `PUT` | `/workflows/:id` | Update workflow (canvas JSON) |
| `GET` | `/runs/:id/steps` | Fetch all execution steps for a run |
| `GET` | `/integrations` | List available integrations and their actions |
| `POST` | `/integrations/credentials` | Store encrypted integration credentials |
| `POST` | `/integrations/test-connection` | Test a database connection |

---

## Security Notes

- **BYOK API keys** are encrypted at rest using AES-256-GCM. The master encryption secret lives in environment variables only and is never stored in the database.
- **Raw API keys** are never logged or returned to the frontend after storage.
- **Masked hints** are shown in the UI only (e.g., `sk-...Ab3X`).
- **Demo/local mode** is not production-grade — intended for development and portfolio demonstration.
- **Production deployment** would require: stricter tenant isolation, rate limiting, key rotation, audit log hardening, credentials rotation, and monitoring.

---

## Prototype vs Production

This is a portfolio prototype, not a production SaaS product:

- **Not production-ready** — use for development and demonstration only.
- **Limited node types** — expanding the handler registry is a roadmap item.
- **LLM output reliability** depends on prompt quality and model behavior.
- **No full multi-tenant SaaS security hardening** — demo/local mode is sufficient for learning and portfolios.
- **Async queue** (BullMQ) is planned but not yet implemented; execution is synchronous.
- **Observability and monitoring** are minimal.
- **Test coverage** is limited — more tests are a roadmap item.

---

## Roadmap

- [ ] BullMQ async execution queue for background job processing
- [ ] Real-time run status via WebSocket or Server-Sent Events
- [ ] Additional node types (HTTP request, conditional branch, data transform)
- [ ] Multi-model support (Anthropic Claude, Google Gemini)
- [ ] Model selector in agent node configuration
- [ ] GitHub integration node
- [ ] Slack integration node
- [ ] Expanded test coverage and CI pipeline
- [ ] Public demo deployment
- [ ] Visual step-by-step run replay

---

## Deployment

See [docs/deployment-options.md](docs/deployment-options.md) for deployment guides covering free and low-cost options (Vercel, Railway, Neon, Upstash).

---

## License

MIT
