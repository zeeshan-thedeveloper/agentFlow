# AgentFlow

> A visual platform for building **agentic AI workflows**: tool-using LLM agents with **RAG knowledge bases**, real app integrations and a full execution trace.

<p align="center">
<img width="1918" height="968" alt="AgentFlow canvas" src="https://github.com/user-attachments/assets/e4421a52-05ab-4c06-a097-a2189689ebc3" />
</p>

<p align="center">
  <em>Wire triggers, agents, knowledge bases, databases and apps on a canvas. Start a run from Slack or Telegram. Watch every reasoning step and tool call.</em>
</p>

---

## What it is

AgentFlow is a full-stack product I designed and built end to end to show what production-minded **agentic AI** and **retrieval-augmented generation** look like beyond a single-prompt chatbot.

On the canvas you connect nodes into a workflow:

- a **Trigger** (a button click, a Slack mention or a Telegram message),
- one or more **Agents** that reason in a ReAct loop and call tools,
- **tool nodes** wired into an agent: a **Knowledge** base (RAG), a **PostgreSQL** database, **Files** in S3-compatible object storage, and apps like **Slack**, **Telegram** and **GitHub**,
- an **Output** that keeps the result or replies in the chat that started the run.

The backend walks the graph, runs each agent's tool loop, and stores every input, output and tool call so a run can be inspected step by step.

---

## Highlights

### Agentic AI
- **ReAct tool loop.** Each agent calls OpenAI function-calling in a loop: think, call a tool, read the result, repeat until it has an answer or hits an iteration cap.
- **Tools that come from the graph.** Wiring a node into an agent gives it tools: `search_knowledge`, `run_sql`, `create_pdf`/`list_files`, `slack_send_message`, `telegram_send_message`, GitHub tools (read repos, issues and files; open issues and comment), plus web search, page reading and HTTP requests.
- **Multi-agent workflows.** Agents pass results along data edges; a run plan decides which steps run in parallel and which in order.
- **Chat-triggered runs.** A Slack mention or Telegram message starts matching workflows through signed webhooks, and the answer is posted back in the same thread.
- **Guardrails by design.** Databases are queried in read-only transactions with table allow-lists; writes to apps are opt-in per node; text the agent reads is marked as data, not instructions, to reduce prompt-injection risk; outbound requests are blocked from private networks (SSRF and DNS-rebinding protection).

### RAG knowledge bases
- **Bring your own vector store.** A Knowledge node points at any PostgreSQL database with **pgvector**. A free **Neon** database works out of the box.
- **Ingestion pipeline.** Pasted text or uploaded `.txt`/`.md` files are split into overlapping, boundary-aware chunks, embedded with `text-embedding-3-small`, and stored with an **HNSW** cosine index (created automatically).
- **Semantic retrieval as a tool.** The agent decides when to call `search_knowledge`, can rephrase and search again, and grounds its answer in the passages it found, with document names and relevance scores.
- **Several knowledge bases per database**, managed from the canvas (add, replace, remove documents).

### Agent-created files
- A **Files** node lets an agent write a report in Markdown and save it as a **PDF** in your own **S3-compatible object storage** (Neon storage, Cloudflare R2, AWS S3).
- New files, whether an agent created them or you uploaded them, can be announced on **Slack** or **Telegram** with the PDF attached.

### Platform engineering
- **Execution engine.** Topological sort, run plans, typed handler dispatch per node type, and every step persisted as structured data.
- **Live run view.** Runs started from chat light up on the canvas as they happen; History shows each step's output and every tool call with its arguments.
- **Bring your own keys.** OpenAI and Tavily keys, app tokens and connection strings are encrypted with AES-256-GCM and only decrypted to run your workflows.
- **Service-to-service auth.** The API trusts only the web app (shared secret) or short-lived signed run tokens; chat webhooks verify Slack signatures and Telegram secret tokens.

---

## How a RAG run works

```
Slack message ──► Trigger ──► Agent ◄── Knowledge (Neon + pgvector)
                                │  ◄── Files (S3 bucket) ──► Slack / Telegram notification
                                ▼
                     Output: reply in the Slack thread
```

1. Someone mentions the bot in Slack. The webhook verifies the signature and starts every workflow listening for it.
2. The agent gets the message, its prompt, and one tool per wired node.
3. It calls `search_knowledge`: the query is embedded and the nearest chunks are fetched with `ORDER BY embedding <=> $query`.
4. It answers from those passages, optionally saving a PDF summary with `create_pdf`, which also notifies the team.
5. The Output node replies in the Slack thread, and the whole trace is saved to run history.

---

## Node types

| Node | What it does |
|------|--------------|
| Trigger | Starts a run: manually, or from a Slack or Telegram message (with an optional keyword filter) |
| Agent | An OpenAI model with a prompt, running a tool loop |
| Knowledge | A RAG knowledge base in your Postgres (pgvector); gives the agent `search_knowledge` |
| Database | A PostgreSQL connection the agent can query read-only with `run_sql` |
| Files | A folder in your S3-compatible storage; the agent can create PDFs there, with Slack/Telegram notifications |
| Slack / Telegram / GitHub | Apps the agent can use as tools |
| Output | Keeps the result, or replies in the chat that started the run |

---

## Architecture

```
apps/web   Next.js 14 · React 18 · Tailwind   canvas, config panels, auth, API proxy
apps/api   NestJS 10 · Prisma 5 · pg · OpenAI  execution engine, agents, tools, RAG, webhooks
packages/types                                 shared types
```

- **Handler registry.** Every node type maps to a handler; adding a node means writing one handler, not changing the executor.
- **Tools are plain objects** (`definition` + `run`), so database, knowledge, file and app tools all plug into the same agent loop.
- **User data stays in user infrastructure.** Knowledge chunks go to the user's Postgres and files to the user's own bucket, not to AgentFlow's database.

More detail is in [docs/architecture](docs/architecture).

---

## Tech stack

| Area | Technology |
|------|-----------|
| LLM and embeddings | OpenAI chat completions with function calling, `text-embedding-3-small` |
| Vector search | PostgreSQL + pgvector (HNSW, cosine distance); Neon works on the free tier |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | NestJS 10, TypeScript, Prisma 5, node-postgres |
| Documents and storage | PDFKit, AWS SDK v3 (S3-compatible object storage) |
| Integrations | Slack Events API, Telegram Bot API, GitHub REST API, Tavily web search |
| Auth and security | NextAuth (Google, GitHub sign-in), AES-256-GCM secrets, HMAC run tokens, SSRF guard |
| Infrastructure | Docker, Docker Compose, GitHub Actions, pnpm workspaces |

---

## Running locally

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL, NEXTAUTH_SECRET, API_KEY_ENCRYPTION_SECRET, ...
docker compose up -d postgres redis
pnpm --filter @agentflow/api exec prisma migrate deploy
pnpm dev                      # web on :18100, api on :3001
```

Then open the canvas, add your OpenAI key under **Keys**, add a **Knowledge** node, connect a Neon database, paste a document, and wire it into an Agent.

---

## License

MIT. Free to use, fork and build on.
