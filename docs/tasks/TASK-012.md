# TASK-012 — Schema + API: Named Database Connections

**Phase:** 3  
**Status:** Done  
**Depends on:** TASK-006  
**Blocks:** TASK-013

---

## Context

A user might need to query both their production and staging database in different workflows. Currently `@@unique([userId, integrationId])` allows only one credential per integration per user. Named connections allow multiple by appending a suffix: `database:prod`, `database:staging`.

This ticket adds:
1. A `name` display field to `UserIntegrationCredential`
2. API changes to list, save, and delete named connections
3. The `integrationId` suffix pattern to support multiple records per user per integration type

---

## What To Do

### 1. Prisma migration — add `name` field

Open `apps/api/prisma/schema.prisma`. Update `UserIntegrationCredential`:

```prisma
model UserIntegrationCredential {
  id            String   @id @default(cuid())
  userId        String
  integrationId String
  // For named connections, integrationId includes the suffix:
  // 'database'         → default (no name / first connection)
  // 'database:prod'    → named "Production DB"
  // 'database:staging' → named "Staging DB"

  name          String?  // Human label: "Production DB", "Staging DB", etc.
  authType      String
  encryptedData String   @db.Text
  maskedHint    String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, integrationId])
  @@index([userId])
  @@map("user_integration_credentials")
}
```

Run the migration:

```bash
cd apps/api
npx prisma migrate dev --name add_name_to_integration_credentials
```

### 2. Update `IntegrationsService` to handle named connections

Open `apps/api/src/integrations/integrations.service.ts`.

#### Add: `listDatabaseConnections`

```typescript
async listDatabaseConnections(userId: string) {
  const records = await this.prisma.userIntegrationCredential.findMany({
    where: {
      userId,
      integrationId: { startsWith: 'database' },
    },
    select: { integrationId: true, name: true, maskedHint: true, updatedAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return records.map((r) => ({
    integrationId: r.integrationId,
    name: r.name ?? r.integrationId,
    maskedHint: r.maskedHint,
    updatedAt: r.updatedAt,
  }));
}
```

#### Update: `saveCredential` to accept `name`

Update the method signature and body:

```typescript
async saveCredential(
  userId: string,
  integrationId: string,
  connectionString: string,
  name?: string,
) {
  const maskedHint = maskConnectionString(connectionString);
  const encryptedData = encryptCredential(JSON.stringify({ connectionString }));

  await this.prisma.userIntegrationCredential.upsert({
    where: { userId_integrationId: { userId, integrationId } },
    update: { encryptedData, maskedHint, authType: 'connection_string', name: name ?? null },
    create: {
      userId,
      integrationId,
      name: name ?? null,
      authType: 'connection_string',
      encryptedData,
      maskedHint,
    },
  });

  return { ok: true, maskedHint };
}
```

### 3. Update `IntegrationsController` — new endpoints

Open `apps/api/src/integrations/integrations.controller.ts`. Add:

```typescript
// GET /integrations/database/credentials — list all named DB connections for the user
@Get('database/credentials')
listDatabaseConnections(@Req() req: any) {
  const userId = req.user?.id ?? req.userId;
  return this.service.listDatabaseConnections(userId);
}

// DELETE /integrations/database/credentials/:integrationId
// integrationId param here is the full key, e.g. 'database:prod'
@Delete('database/credentials/:integrationId')
@HttpCode(200)
deleteDatabaseCredential(@Param('integrationId') integrationId: string, @Req() req: any) {
  const userId = req.user?.id ?? req.userId;
  return this.service.deleteCredential(userId, integrationId);
}
```

Also update the existing `saveCredential` endpoint to accept `name` in the body:

```typescript
@Post(':id/credentials')
saveCredential(
  @Param('id') id: string,
  @Body() body: { connectionString: string; name?: string },
  @Req() req: any,
) {
  const userId = req.user?.id ?? req.userId;
  return this.service.saveCredential(userId, id, body.connectionString, body.name);
}
```

### 4. Naming convention for `integrationId`

When the user saves with a name, the frontend constructs the `integrationId`:
- No name → `'database'` (default)
- Name = "Production DB" → `'database:' + slugify('Production DB')` → `'database:production-db'`

The slugify logic lives in the frontend (TASK-013). The backend treats `integrationId` as an opaque string with the constraint that it starts with `'database'` for database connections.

`integrationRegistry.get('database:prod')` already handles the suffix by splitting on `:` and looking up `'database'` — see TASK-005.

---

## REST API Changes Summary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/integrations/database/credentials` | List all named DB connections |
| `POST` | `/integrations/:id/credentials` | Save (now accepts optional `name` in body) |
| `DELETE` | `/integrations/database/credentials/:integrationId` | Delete a named connection |

---

## Acceptance Criteria

- [ ] Migration runs cleanly; `name` column exists on `user_integration_credentials`
- [ ] `POST /integrations/database:prod/credentials` with `{ connectionString, name: "Production DB" }` creates a new row with `integrationId = 'database:prod'`
- [ ] `GET /integrations/database/credentials` returns both `'database'` and `'database:prod'` rows for the user
- [ ] `DELETE /integrations/database/credentials/database:prod` removes only that row, not the default `'database'` row
- [ ] `integrationRegistry.get('database:prod')` still resolves to `DatabaseIntegration`
- [ ] TypeScript compiles with no errors
