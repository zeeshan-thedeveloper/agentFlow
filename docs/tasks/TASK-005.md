# TASK-005 — IntegrationRegistry + IntegrationHandler + Register in Handler Registry

**Phase:** 1  
**Status:** Done  
**Depends on:** TASK-004  
**Blocks:** TASK-006

---

## Context

The execution engine (in `apps/api/src/handlers/registry.ts`) dispatches canvas nodes by type. Currently it has `trigger`, `agent`, `output`. We need to:

1. Create an `IntegrationRegistry` — a map of `integrationId → Integration` instance.
2. Create an `IntegrationHandler` — a `NodeHandler` that reads the canvas node's `integrationId`, looks it up in the registry, resolves credentials from the DB, and calls `execute()`.
3. Register `'integration'` in the existing handler registry.

The credential resolver needs to decrypt the stored `encryptedData` — this project already has `encryptApiKey` / `decryptApiKey` from `apps/web/src/server/apiKeyCrypto.ts`. The API side needs its own copy of the decrypt function (or a shared package). For now, replicate the decrypt logic in `apps/api/src/integrations/credential.resolver.ts` using the same `ENCRYPTION_KEY` env var.

---

## What To Do

### 1. Create `integration.registry.ts`

Create `apps/api/src/integrations/integration.registry.ts`:

```typescript
import type { Integration } from './integration.interfaces';
import { DatabaseIntegration } from './providers/database/database.integration';

const registryMap = new Map<string, Integration>([
  ['database', new DatabaseIntegration()],
  // add ['slack', new SlackIntegration()] etc. in future tickets
]);

export const integrationRegistry = {
  get(id: string): Integration | undefined {
    // Support named connections: 'database:prod' → looks up 'database'
    const baseId = id.split(':')[0];
    return registryMap.get(baseId);
  },

  getAll(): Integration[] {
    return [...registryMap.values()];
  },
};
```

### 2. Create `credential.resolver.ts`

Create `apps/api/src/integrations/credential.resolver.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createDecipheriv } from 'crypto';
import type { ResolvedCredentials } from './integration.interfaces';

function decryptCredential(encrypted: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const [ivHex, authTagHex, ciphertext] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
}

@Injectable()
export class CredentialResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string, integrationId: string): Promise<ResolvedCredentials> {
    const record = await this.prisma.userIntegrationCredential.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });

    if (!record) {
      throw new Error(
        `No credentials found for "${integrationId}". Connect it in the canvas config panel first.`,
      );
    }

    const data = JSON.parse(decryptCredential(record.encryptedData)) as ResolvedCredentials;
    return data;
  }
}
```

> **Note on `PrismaService`:** Check if `apps/api/src/prisma/prisma.service.ts` exists. If not, create a minimal one:
> ```typescript
> import { Injectable, OnModuleInit } from '@nestjs/common';
> import { PrismaClient } from '@prisma/client';
> 
> @Injectable()
> export class PrismaService extends PrismaClient implements OnModuleInit {
>   async onModuleInit() { await this.$connect(); }
> }
> ```
> And a `prisma.module.ts` that exports it globally.

### 3. Create `integration.handler.ts`

Create `apps/api/src/integrations/integration.handler.ts`:

```typescript
import type { NodeHandler } from '../handlers/base.handler';
import { integrationRegistry } from './integration.registry';
import { CredentialResolver } from './credential.resolver';

export class IntegrationHandler implements NodeHandler {
  constructor(private readonly credentialResolver: CredentialResolver) {}

  async execute(params: Record<string, unknown>, input: unknown): Promise<unknown> {
    const integrationId = String(params.integrationId ?? '');
    const actionId = String(params.actionId ?? '');
    const userId = String(params.userId ?? '');
    const actionParams = (params.actionParams ?? {}) as Record<string, unknown>;

    if (!integrationId) throw new Error('integrationId is required on integration nodes.');
    if (!actionId) throw new Error('actionId is required on integration nodes.');
    if (!userId) throw new Error('userId was not injected into integration node params.');

    const integration = integrationRegistry.get(integrationId);
    if (!integration) throw new Error(`Unknown integration: "${integrationId}".`);

    const credentials = await this.credentialResolver.resolve(userId, integrationId);

    return integration.execute(actionId, actionParams, input, credentials);
  }
}
```

### 4. Register `'integration'` in the handler registry

Open `apps/api/src/handlers/registry.ts`. It currently looks like:

```typescript
import type { NodeHandler } from './base.handler';
import { AgentHandler } from './agent.handler';
import { OutputHandler } from './output.handler';
import { TriggerHandler } from './trigger.handler';

export const registry: Record<string, NodeHandler> = {
  trigger: new TriggerHandler(),
  agent: new AgentHandler(),
  output: new OutputHandler(),
};
```

The `IntegrationHandler` requires `CredentialResolver` (which requires `PrismaService`). Rather than wiring DI here, instantiate it manually for now (consistent with how the other handlers are instantiated):

```typescript
import type { NodeHandler } from './base.handler';
import { AgentHandler } from './agent.handler';
import { OutputHandler } from './output.handler';
import { TriggerHandler } from './trigger.handler';
import { IntegrationHandler } from '../integrations/integration.handler';
import { CredentialResolver } from '../integrations/credential.resolver';
import { PrismaService } from '../prisma/prisma.service';

const prisma = new PrismaService();
const credentialResolver = new CredentialResolver(prisma);

export const registry: Record<string, NodeHandler> = {
  trigger: new TriggerHandler(),
  agent: new AgentHandler(),
  output: new OutputHandler(),
  integration: new IntegrationHandler(credentialResolver),
};
```

> If the app is fully NestJS DI-wired, adjust accordingly. The important thing is that `registry['integration']` resolves to an `IntegrationHandler` instance.

### 5. Ensure `userId` is injected into node params at execution time

Find where `registry[node.type].execute(params, input)` is called (likely `apps/api/src/runs/runs.service.ts` or an `executor.ts`). Ensure `userId` (the workflow owner's userId) is merged into `params` before dispatch for integration nodes:

```typescript
const enrichedParams =
  node.type === 'integration'
    ? { ...node.params, userId: run.userId }
    : node.params;

const output = await registry[node.type].execute(enrichedParams, previousOutput);
```

---

## Acceptance Criteria

- [ ] `integration.registry.ts` exports `integrationRegistry` with `get()` and `getAll()`
- [ ] `integrationRegistry.get('database')` returns a `DatabaseIntegration` instance
- [ ] `integrationRegistry.get('database:prod')` also returns a `DatabaseIntegration` instance (strips suffix)
- [ ] `credential.resolver.ts` decrypts `encryptedData` using `ENCRYPTION_KEY` env var and returns parsed JSON
- [ ] `CredentialResolver.resolve` throws if no record found for the given `userId + integrationId`
- [ ] `integration.handler.ts` calls `integrationRegistry.get(integrationId)` and then `integration.execute()`
- [ ] `registry['integration']` exists in `apps/api/src/handlers/registry.ts`
- [ ] `userId` is present in params when `IntegrationHandler.execute()` is called
- [ ] TypeScript compiles with no errors
