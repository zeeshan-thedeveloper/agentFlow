# AgentFlow

> Build, run, and debug autonomous AI workflows — visually.

<p align="center">
  <img src="docs/assets/agentflow-canvas.png" alt="AgentFlow canvas showing trigger, AI agent, tool, and output nodes connected in a workflow" width="900" />
</p>

<p align="center">
  <em>Design multi-step AI workflows by connecting nodes on a canvas. Run them. Inspect every step.</em>
</p>

---

## What is AgentFlow?

Most AI integrations are hardcoded scripts or single-prompt chatbots. AgentFlow is a different approach: a visual canvas where you connect **triggers**, **AI agents**, **tools**, and **outputs** into workflows — then run and inspect them step by step.

The idea is simple: AI workflows should be **visible, debuggable, and composable** — not buried in code.

You drag nodes onto a canvas, connect them, configure each one, and hit run. The execution engine processes them in dependency order, persisting every input and output along the way so you can see exactly what happened at each step.

---

## The Problem It Solves

Building multi-step AI pipelines is messy:

- **Hardcoded scripts** are brittle and hard to reason about
- **Chatbot demos** don't compose — one prompt, one response, done
- **Debugging LLM chains** means digging through logs or adding print statements
- **Changing a workflow** means touching code, re-deploying, hoping it works

AgentFlow makes the workflow the product: design it on a canvas, run it, see what each node received and returned, iterate.

---

## How It Works

```
Trigger → Agent → Tool → Output
                    ↓
              Run History (every step, every input/output)
```

1. **Design** — drag nodes onto the canvas, connect them with edges
2. **Configure** — set prompts, models, and API keys per node
3. **Run** — the backend topologically sorts nodes and executes them in order
4. **Inspect** — every step's input and output JSON is stored and viewable

The execution model is intentionally simple: each node is a typed handler, the executor walks the graph, and everything is persisted. No black boxes.

---

## Core Concepts

**Nodes** are the building blocks. Each has a type, a configuration, and defined inputs/outputs:

| Node Type | What it does |
|-----------|-------------|
| Trigger | Entry point — starts the workflow with an initial payload |
| Agent | Calls an LLM (OpenAI) with a configured prompt and input |
| Tool | Runs a capability: query a DB, call an API, transform data |
| Output | Captures and displays the final result |
| Database | Configures a PostgreSQL connection for query nodes |
| Query Runner | Executes a parameterized SQL query against a connected DB |

**Handler Registry** — every node type maps to a handler. Adding a new node type means writing a handler and registering it — the executor doesn't need to change.

**BYOK (Bring Your Own Key)** — users supply their own LLM API keys. Keys are encrypted with AES-256-GCM before storage and decrypted only at execution time. The server never logs or returns raw keys.

**Run History** — every workflow execution persists each step as a record: what went in, what came out, when it ran, whether it succeeded. This makes debugging a workflow a data query, not a log hunt.

---

## Why Build This?

This is a portfolio project exploring what it takes to build a real AI product — not just an API wrapper or a chatbot.

The interesting engineering problems:

- **Graph execution** — topological sort, dependency resolution, typed handler dispatch
- **Credential security** — BYOK flow, AES-256-GCM encryption, key masking in the UI
- **Canvas UX** — stateful drag-and-drop, edge routing, node configuration panels
- **Auditability** — persisting every execution step as structured data, not logs
- **Full-stack architecture** — Next.js + NestJS monorepo, shared types, Docker Compose, Prisma

The goal was to build something that *actually works end to end* — canvas to execution to history — not just scaffold a monorepo and stop.

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

## License

MIT
