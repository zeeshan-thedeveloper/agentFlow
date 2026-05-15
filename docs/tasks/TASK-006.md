# TASK-006 — REST API: Credential Endpoints + Test-Connection

**Phase:** 1  
**Status:** Done  
**Depends on:** TASK-001, TASK-005  
**Blocks:** TASK-008

---

## Context

The frontend needs three things from the API:
1. **Store** a connection string (encrypted) for the current user.
2. **Check** whether a credential is already stored (for the status badge).
3. **Test** a connection string *before* saving (the "Test Connection" button in the dialog).

These endpoints live in a new NestJS `IntegrationsModule`. They are auth-protected — the user's `userId` comes from the session (same as other authenticated routes in this app).

Look at how `apps/api/src/workflows/workflows.controller.ts` handles auth to follow the same pattern.

---

## What To Do

### 1. Create `integrations.module.ts`

Create `apps/api/src/integrations/integrations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { CredentialResolver } from './credential.resolver';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CredentialResolver, PrismaService],
  exports: [CredentialResolver],
})
export class IntegrationsModule {}
```

Register it in `apps/api/src/app.module.ts` by importing `IntegrationsModule`.

### 2. Create `integrations.service.ts`

Create `apps/api/src/integrations/integrations.service.ts`:

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { integrationRegistry } from './integration.registry';
import { testConnection } from './providers/database/database.connection';
import { maskConnectionString } from './providers/database/database.sanitizer';
import { createCipheriv, randomBytes } from 'crypto';

function encryptCredential(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Returns metadata for all registered integrations (safe for frontend).
  getAll() {
    return integrationRegistry.getAll().map(({ id, name, description, authType, credentialLabel, actions }) => ({
      id, name, description, authType, credentialLabel, actions,
    }));
  }

  // Returns { connected: boolean, maskedHint?: string }
  async getCredentialStatus(userId: string, integrationId: string) {
    const record = await this.prisma.userIntegrationCredential.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
      select: { maskedHint: true },
    });
    return { connected: !!record, maskedHint: record?.maskedHint ?? null };
  }

  // Encrypt and store a connection string credential.
  async saveCredential(userId: string, integrationId: string, connectionString: string) {
    const maskedHint = maskConnectionString(connectionString);
    const encryptedData = encryptCredential(JSON.stringify({ connectionString }));

    await this.prisma.userIntegrationCredential.upsert({
      where: { userId_integrationId: { userId, integrationId } },
      update: { encryptedData, maskedHint, authType: 'connection_string' },
      create: { userId, integrationId, authType: 'connection_string', encryptedData, maskedHint },
    });

    return { ok: true, maskedHint };
  }

  async deleteCredential(userId: string, integrationId: string) {
    const existing = await this.prisma.userIntegrationCredential.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
    });
    if (!existing) throw new NotFoundException(`No credential found for "${integrationId}".`);

    await this.prisma.userIntegrationCredential.delete({
      where: { userId_integrationId: { userId, integrationId } },
    });

    return { ok: true };
  }

  // Test a connection string WITHOUT storing it.
  async testDatabaseConnection(connectionString: string) {
    try {
      const version = await testConnection(connectionString);
      return { ok: true, serverVersion: version };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Connection failed: ${message}`);
    }
  }
}
```

### 3. Create `integrations.controller.ts`

Create `apps/api/src/integrations/integrations.controller.ts`:

```typescript
import {
  Controller, Get, Post, Delete, Body, Param, Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
// Import whatever auth guard this project uses — check workflows.controller.ts for the pattern.
// Example: import { AuthGuard } from '../auth/auth.guard';

@Controller('integrations')
// @UseGuards(AuthGuard)   ← uncomment once you've confirmed the guard name
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  // GET /integrations — returns all integration metadata (for ConfigPanel dropdowns)
  @Get()
  getAll() {
    return this.service.getAll();
  }

  // GET /integrations/:id/credentials/status
  @Get(':id/credentials/status')
  getStatus(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id ?? req.userId; // adjust to match session shape
    return this.service.getCredentialStatus(userId, id);
  }

  // POST /integrations/:id/credentials
  @Post(':id/credentials')
  saveCredential(
    @Param('id') id: string,
    @Body() body: { connectionString: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id ?? req.userId;
    return this.service.saveCredential(userId, id, body.connectionString);
  }

  // DELETE /integrations/:id/credentials
  @Delete(':id/credentials')
  @HttpCode(200)
  deleteCredential(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id ?? req.userId;
    return this.service.deleteCredential(userId, id);
  }

  // POST /integrations/database/credentials/test
  @Post('database/credentials/test')
  testConnection(@Body() body: { connectionString: string }) {
    return this.service.testDatabaseConnection(body.connectionString);
  }
}
```

> **Important:** Check `apps/api/src/workflows/workflows.controller.ts` to see how `userId` is extracted from the request (it may be `req.user.id`, `req.session.userId`, or injected via a custom decorator). Mirror that pattern exactly.

### 4. Register the module in `app.module.ts`

Open `apps/api/src/app.module.ts` and add `IntegrationsModule` to the `imports` array.

---

## REST API Summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/integrations` | Yes | All integration metadata |
| `GET` | `/integrations/:id/credentials/status` | Yes | Connected badge info |
| `POST` | `/integrations/:id/credentials` | Yes | Save encrypted credential |
| `DELETE` | `/integrations/:id/credentials` | Yes | Remove credential |
| `POST` | `/integrations/database/credentials/test` | Yes | Test before saving |

---

## Acceptance Criteria

- [ ] `GET /integrations` returns an array that includes `{ id: 'database', name: 'Database', authType: 'connection_string', actions: [...] }`
- [ ] `POST /integrations/database/credentials` with `{ connectionString: "postgresql://..." }` stores an encrypted record and returns `{ ok: true, maskedHint: "postgresql://user:****@..." }`
- [ ] `GET /integrations/database/credentials/status` returns `{ connected: true, maskedHint: "..." }` after saving
- [ ] `DELETE /integrations/database/credentials` removes the record; subsequent status check returns `{ connected: false }`
- [ ] `POST /integrations/database/credentials/test` with a valid local PG connection string returns `{ ok: true, serverVersion: "..." }`
- [ ] `POST /integrations/database/credentials/test` with an invalid string returns a `400` with a descriptive error message
- [ ] All endpoints require authentication (userId must be resolved from session/token)
- [ ] TypeScript compiles with no errors
