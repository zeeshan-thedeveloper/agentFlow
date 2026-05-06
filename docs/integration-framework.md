# Integration Framework — Design Plan

> Written: 2026-05-02  
> Status: Planning (not yet started)  
> References: PLAN.md "Integration Framework" section, STATUS.md

---

## Goal

Build a first-class integration framework so any external platform (Slack, GitHub, Notion, HTTP APIs, etc.) can be added as a **canvas node** with credentials managed securely per user. Integrations are distinct from agent tools — they are discrete workflow steps, not LLM-callable functions.

---

## Scope of This Document

- Framework skeleton (interfaces, registry, handler, DB table)
- Credential management (API key + OAuth2 flows)
- Canvas-side node type + dynamic ConfigPanel
- First three integrations: HTTP Request, Slack, GitHub
- What's out of scope (marked explicitly)

---

## How Integrations Differ From Agent Tools

| | Agent Tools | Integration Nodes |
|---|---|---|
| Who calls them | The LLM (via function calling) | The execution engine (canvas node) |
| When they run | Inside the ReAct loop, mid-iteration | As a discrete step in the workflow DAG |
| Defined in | `apps/api/src/handlers/tools/` | `apps/api/src/integrations/` |
| Canvas representation | Checkbox on Agent node config | Standalone node on canvas |
| Example | `http_request` tool the agent invokes autonomously | "Post to Slack" node that always runs at step 3 |

Both can eventually call the same underlying API client — but they serve different control flows.

---

## Architecture

```
Canvas (IntegrationNode)
  └── ConfigPanel
        ├── Integration picker (HTTP / Slack / GitHub / ...)
        ├── Action picker (filtered by integration)
        ├── Dynamic param form (driven by action.paramSchema)
        └── Credential status badge (connected / not connected)
              └── "Connect" button → CredentialDialog

Backend Execution
  └── IntegrationHandler  (implements NodeHandler)
        └── IntegrationRegistry
              └── Integration  (Slack | GitHub | HTTP | ...)
                    └── IntegrationAction  (send_message | create_issue | http_request | ...)
                          └── CredentialResolver
                                └── UserIntegrationCredential  (DB, encrypted)

API (metadata endpoint)
  └── GET /integrations  →  returns registry metadata (id, name, authType, actions[])
                             consumed by ConfigPanel to build dynamic forms
```

---

## Core Interfaces

These go in `packages/types/src/index.ts` (shared between web and api).

```typescript
// Defines a single param in an action's form
export interface ActionParamDef {
  name: string;         // field key  e.g. 'channel'
  label: string;        // display label e.g. 'Channel ID'
  type: 'string' | 'text' | 'number' | 'boolean' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];  // for 'select' type
  secret?: boolean;     // render as password input
}

// A single action an integration can perform
export interface IntegrationAction {
  id: string;           // e.g. 'send_message'
  name: string;         // e.g. 'Send Message'
  description: string;
  paramSchema: ActionParamDef[];
}

// Integration metadata (safe to expose to frontend)
export interface IntegrationMeta {
  id: string;           // e.g. 'slack'
  name: string;         // e.g. 'Slack'
  description: string;
  authType: 'api_key' | 'oauth2' | 'none';
  credentialLabel?: string;   // e.g. 'Bot Token' (for api_key type)
  actions: IntegrationAction[];
}
```

Backend-only interfaces (live in `apps/api/src/integrations/`):

```typescript
// Resolved credentials passed to execute()
export interface ResolvedCredentials {
  apiKey?: string;
  accessToken?: string;   // OAuth2
  [key: string]: string | undefined;
}

// What every integration must implement
export interface Integration extends IntegrationMeta {
  execute(
    actionId: string,
    params: Record<string, unknown>,
    input: unknown,
    credentials: ResolvedCredentials,
  ): Promise<unknown>;
}
```

---

## Database Changes

### New table: `UserIntegrationCredential`

The existing `UserApiKey` table stays as-is (it's for LLM provider keys — OpenAI, Anthropic). Integration credentials are a different concept and need a flexible JSON blob.

```prisma
model UserIntegrationCredential {
  id            String   @id @default(cuid())
  userId        String
  integrationId String   // 'slack' | 'github' | 'notion' | 'http' | ...

  authType      String   // 'api_key' | 'oauth2' | 'none'
  encryptedData String   @db.Text
  // Encrypted JSON blob. Contents depend on authType:
  //   api_key: { "apiKey": "xoxb-..." }
  //   oauth2:  { "accessToken": "...", "refreshToken": "...", "expiresAt": "ISO8601" }

  maskedHint    String?  // e.g. "xoxb-...xxxx" for display only

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, integrationId])
  @@index([userId])
  @@map("user_integration_credentials")
}
```

Same AES-256-GCM encryption used for `UserApiKey` — reuse `encryptApiKey` / `decryptApiKey` from `apps/web/src/server/apiKeyCrypto.ts`.

### Canvas node type change

Add `'integration'` to the `NodeType` union and extend `FlowNode`:

```typescript
// In packages/types/src/index.ts or apps/web/src/components/canvas/types.ts
export type NodeType = 'trigger' | 'agent' | 'output' | 'integration';

// New fields on FlowNode
integrationId?: string;    // e.g. 'slack'
actionId?: string;         // e.g. 'send_message'
actionParams?: Record<string, unknown>;  // filled in by ConfigPanel form
```

---

## Backend Implementation

### Module structure

```
apps/api/src/
├── integrations/
│   ├── integrations.module.ts        NestJS module
│   ├── integrations.controller.ts    GET /integrations (metadata)
│   │                                 POST /integrations/:id/credentials
│   │                                 DELETE /integrations/:id/credentials
│   ├── integrations.service.ts       CredentialResolver logic
│   ├── integration.registry.ts       Registry map: id → Integration instance
│   ├── integration.handler.ts        NodeHandler that dispatches to registry
│   ├── base.integration.ts           Integration interface (or abstract class)
│   └── providers/
│       ├── http.integration.ts       HTTP Request (no auth)
│       ├── slack.integration.ts      Slack (bot token)
│       └── github.integration.ts     GitHub (personal access token)
```

### `IntegrationHandler` (NodeHandler)

```typescript
// Registered in handler registry as 'integration'
async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
  const { integrationId, actionId, actionParams, userId } = params;

  const integration = integrationRegistry.get(integrationId);
  if (!integration) throw new Error(`Unknown integration: ${integrationId}`);

  const credentials = await credentialResolver.resolve(userId, integrationId);

  return integration.execute(actionId, actionParams, input, credentials);
}
```

### `CredentialResolver` service

```typescript
async resolve(userId: string, integrationId: string): Promise<ResolvedCredentials> {
  const integration = integrationRegistry.get(integrationId);

  if (integration.authType === 'none') return {};

  const record = await prisma.userIntegrationCredential.findUnique({
    where: { userId_integrationId: { userId, integrationId } },
  });

  if (!record) throw new Error(`No credentials for ${integrationId}. Connect it first.`);

  const data = JSON.parse(decryptApiKey(record.encryptedData));

  if (integration.authType === 'oauth2' && data.expiresAt) {
    const expiry = new Date(data.expiresAt);
    if (expiry < new Date(Date.now() + 60_000)) {
      // Token within 1 minute of expiry — refresh it
      return this.refreshOAuthToken(userId, integrationId, data);
    }
  }

  return data;
}
```

### `IntegrationRegistry`

```typescript
const registry = new Map<string, Integration>([
  ['http',   new HttpIntegration()],
  ['slack',  new SlackIntegration()],
  ['github', new GithubIntegration()],
]);
```

### REST endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/integrations` | Returns `IntegrationMeta[]` — consumed by ConfigPanel |
| `POST` | `/integrations/:id/credentials` | Encrypt and store credentials (body: `{ apiKey }` or OAuth tokens) |
| `DELETE` | `/integrations/:id/credentials` | Remove stored credentials |
| `GET` | `/integrations/:id/credentials/status` | Returns `{ connected: boolean, maskedHint? }` |

Note: OAuth2 callback goes through Next.js (see Frontend section), not directly to the NestJS API.

---

## Frontend Implementation

### 1. Canvas node type

Add to `NODE_TYPES` in `constants.tsx`:

```typescript
integration: {
  label: 'Integration',
  color: '#10B981',   // Emerald green
  icon: <PlugIcon />,
  lib: {
    desc: 'Call an external platform',
    options: [],  // dynamic — populated from /integrations
  },
}
```

### 2. ConfigPanel for integration nodes

The panel has three sections rendered in sequence:

**Section A — Integration picker**
- Dropdown: fetches `GET /integrations` on mount, renders name list
- On change: clears `actionId` and `actionParams`, sets `integrationId`
- Shows credential status badge (green dot = connected, red = not connected)
- "Connect" button opens `CredentialDialog` (see below)

**Section B — Action picker**
- Dropdown: filtered to `integration.actions` based on selected `integrationId`
- On change: clears `actionParams`, sets `actionId`

**Section C — Dynamic param form**
- Rendered from `action.paramSchema` (array of `ActionParamDef`)
- Each param → appropriate input: text, textarea, number, checkbox, select
- `secret: true` → password input
- Values stored in `node.actionParams`

### 3. `CredentialDialog` component

For `api_key` integrations:
- Text input labeled with `integration.credentialLabel` (e.g. "Bot Token")
- `POST /integrations/:id/credentials` on save
- Success → badge turns green

For `oauth2` integrations:
- "Connect with [Provider]" button → opens popup or redirects to `/api/integrations/oauth/[id]`
- Callback stores tokens and closes dialog

### 4. OAuth2 callback route (Next.js)

```
apps/web/src/app/api/integrations/oauth/[integrationId]/route.ts
apps/web/src/app/api/integrations/oauth/callback/route.ts
```

Flow:
1. User clicks "Connect with GitHub" → redirect to GitHub OAuth URL with state param
2. GitHub redirects to `/api/integrations/oauth/callback?code=...&state=...`
3. Next.js route exchanges code for tokens
4. Calls NestJS `POST /integrations/:id/credentials` with tokens
5. Redirects back to canvas with `?connected=github`

---

## First Three Integrations

### 1. HTTP Request (`http`)
- `authType: 'none'`
- Actions: `http_request`
- Params: `method` (GET/POST/PUT/DELETE), `url`, `headers` (JSON), `body` (text)
- Purpose: validates the full framework with zero credential complexity; replaces the planned "HTTP Request Node" backlog item

### 2. Slack (`slack`)
- `authType: 'api_key'`, `credentialLabel: 'Bot Token'`
- Actions: `send_message` (channel + text), `get_channel_history` (channel + limit)
- Uses `@slack/web-api` SDK
- Purpose: first real-credential integration; common output node for notification workflows

### 3. GitHub (`github`)
- `authType: 'api_key'`, `credentialLabel: 'Personal Access Token'`
- Actions: `create_issue` (owner/repo/title/body), `read_file` (owner/repo/path/branch), `add_comment` (owner/repo/issue_number/body)
- Uses `@octokit/rest` SDK
- Purpose: second API key integration; useful for code automation workflows

---

## Implementation Phases

### Phase A — Framework skeleton (no integrations)
1. Add `IntegrationMeta`, `IntegrationAction`, `ActionParamDef` to `packages/types/`
2. Create `apps/api/src/integrations/` module with `IntegrationRegistry`, `CredentialResolver`, `IntegrationHandler`
3. Prisma migration: add `UserIntegrationCredential` table
4. REST endpoints: `GET /integrations`, `POST /integrations/:id/credentials`, `DELETE`, `GET status`
5. Register `'integration'` in handler registry
6. Add `integration` node type to canvas (`types.ts`, `constants.tsx`)
7. Add basic integration ConfigPanel section (hardcoded placeholder, no dynamic form yet)

**Checkpoint:** Can add an integration node to canvas and save the workflow. No execution yet.

### Phase B — HTTP integration (end-to-end smoke test)
1. `HttpIntegration` with `http_request` action
2. Dynamic param form in ConfigPanel (method, url, headers, body)
3. Wire `IntegrationHandler` → `IntegrationRegistry` → `HttpIntegration.execute()`
4. Test: build a workflow with HTTP Request node, run it, verify step output

**Checkpoint:** Integration nodes execute end-to-end. Framework is proven.

### Phase C — Credential UI
1. `CredentialDialog` component
2. API key connect flow for Slack (bot token)
3. Credential status badge in ConfigPanel
4. Masked hint display + "Disconnect" button

**Checkpoint:** Users can connect and disconnect integrations from the canvas.

### Phase D — Slack integration
1. Install `@slack/web-api`
2. `SlackIntegration`: `send_message`, `get_channel_history`
3. Wire into registry, test end-to-end

### Phase E — GitHub integration
1. Install `@octokit/rest`
2. `GithubIntegration`: `create_issue`, `read_file`, `add_comment`
3. Wire into registry, test end-to-end

### Phase F — OAuth2 foundation (future)
1. Next.js OAuth callback route
2. Token refresh in `CredentialResolver`
3. First OAuth2 integration (Notion or Google Sheets)

_Phase F is out of scope for now — API key integrations cover the immediate use cases and OAuth2 adds significant frontend complexity (popup/redirect flow, CSRF state param, token refresh)._

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Separate `UserIntegrationCredential` from `UserApiKey` | `UserApiKey` is for LLM providers — different schema, different purpose. Integration creds need a JSON blob to support OAuth2 tokens alongside API keys |
| `authType` lives on `Integration`, not on credential record | A given integration always uses the same auth method; no per-row polymorphism needed |
| `paramSchema` array drives ConfigPanel dynamically | Avoids hardcoding a new ConfigPanel section for every integration; the schema is defined once in the integration class |
| HTTP integration first | Zero credential complexity; validates the full framework path before introducing auth |
| Same encryption for integration credentials | Reuse `encryptApiKey`/`decryptApiKey` — AES-256-GCM is already there, no reason to add a second crypto path |
| `GET /integrations` metadata endpoint | Frontend needs to know available integrations + action schemas at runtime. Hardcoding this in the frontend would mean two places to update for every new integration |
| Integration nodes ≠ agent tools | Tools are LLM-invoked mid-ReAct-loop. Integration nodes are canvas steps. They're separate control flows even if they call the same external APIs |
| OAuth2 deferred to Phase F | API key integrations cover the near-term use cases. OAuth2 adds a callback route, CSRF state, token refresh, and popup UX — a meaningful chunk of work. Build it when a specific OAuth2 integration is needed |
