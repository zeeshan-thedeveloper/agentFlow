# AgentFlow

AgentFlow is a visual AI agent builder that lets you design, run, and monitor autonomous AI workflows through a drag-and-drop canvas interface. Connect triggers, agents, skills, and outputs to build automation pipelines — no boilerplate required.

## Tech Stack

| Layer            | Technology                                   |
|------------------|----------------------------------------------|
| Frontend         | Next.js 14 (App Router), TypeScript strict   |
| Canvas           | React Flow (`@xyflow/react`)                 |
| Styling          | Tailwind CSS                                 |
| Backend          | NestJS, TypeScript strict                    |
| ORM              | Prisma                                       |
| Database         | PostgreSQL 16                                |
| Queue            | Redis 7 + BullMQ                             |
| Containerisation | Docker + Docker Compose                      |
| Package manager  | pnpm workspaces                              |

## Project Structure

```
agentflow/
├── apps/
│   ├── web/               # Next.js frontend  → http://localhost:3100
│   └── api/               # NestJS backend    → http://localhost:3001
├── packages/
│   └── types/             # Shared TypeScript types
├── docker-compose.yml
├── .env.example
└── pnpm-workspace.yaml
```

## Running Locally

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

### Steps

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd agentflow
   pnpm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example apps/api/.env
   cp .env.example apps/web/.env.local
   ```

   For Google sign-in, create an OAuth client in Google Cloud Console with this authorized redirect URI:

   ```text
   http://localhost:3100/api/auth/callback/google
   ```

   Then fill these values in `apps/web/.env.local`:

   ```env
   NEXTAUTH_URL=http://localhost:3100
   NEXTAUTH_SECRET=<random-secret>
   GOOGLE_CLIENT_ID=<google-client-id>
   GOOGLE_CLIENT_SECRET=<google-client-secret>
   DATABASE_URL=postgresql://agent_user:agent_pass@localhost:15432/agentflow
   ```

3. **Start infrastructure (Postgres + Redis)**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations**
   ```bash
   cd apps/api
   pnpm prisma migrate dev --name init
   cd ../..
   ```

5. **Start both apps**
   ```bash
   pnpm dev
   ```

   - Frontend: http://localhost:3100/canvas
   - API: http://localhost:3001

## What's Coming

- Canvas interactions — drag, drop, and connect nodes
- Agent execution engine — BullMQ workers running the pipeline
- LLM tool-calling loop — multi-step reasoning with Groq
- GitHub + Slack integrations
- Real-time run monitoring and step inspection
