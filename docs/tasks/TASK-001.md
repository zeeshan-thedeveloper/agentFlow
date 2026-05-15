# TASK-001 — Prisma Migration: UserIntegrationCredential Table

**Phase:** 1  
**Status:** Done  
**Depends on:** —  
**Blocks:** TASK-006

---

## Context

The project already uses Prisma with PostgreSQL (internal DB). The existing `UserApiKey` table stores LLM provider keys (OpenAI, Anthropic). Integration credentials (database connection strings, Slack tokens, etc.) are a different concept — they need a flexible encrypted JSON blob and a row per integration per user.

Look at existing migrations for reference:
- `apps/api/prisma/migrations/20260428203000_add_user_api_keys/migration.sql` — shows the pattern for encrypted key storage
- `apps/api/prisma/schema.prisma` — where to add the new model

---

## What To Do

### 1. Add model to Prisma schema

Open `apps/api/prisma/schema.prisma` and add the following model at the end of the file:

```prisma
model UserIntegrationCredential {
  id            String   @id @default(cuid())
  userId        String
  integrationId String
  // integrationId examples:
  //   'database'         — single database connection
  //   'database:prod'    — named connection (Phase 3)
  //   'slack'
  //   'github'

  authType      String
  // 'connection_string' for database
  // 'api_key' for Slack/GitHub
  // 'oauth2' for future OAuth integrations

  encryptedData String   @db.Text
  // AES-256-GCM encrypted JSON blob. Contents depend on authType:
  //   connection_string: { "connectionString": "postgresql://..." }
  //   api_key:           { "apiKey": "xoxb-..." }
  //   oauth2:            { "accessToken": "...", "refreshToken": "...", "expiresAt": "ISO8601" }

  maskedHint    String?
  // Human-readable hint with password stripped, shown in UI only.
  // Example: "postgresql://readonly_user:****@db.example.com:5432/mydb"

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, integrationId])
  @@index([userId])
  @@map("user_integration_credentials")
}
```

Also add the reverse relation on the `User` model (find the existing `User` model and add a line):

```prisma
integrationCredentials UserIntegrationCredential[]
```

### 2. Generate and run the migration

```bash
cd apps/api
npx prisma migrate dev --name add_user_integration_credentials
```

This will:
- Create a new file at `apps/api/prisma/migrations/<timestamp>_add_user_integration_credentials/migration.sql`
- Apply it to the local dev database
- Regenerate the Prisma client

### 3. Verify

After migration:
- `npx prisma studio` (optional) — the `user_integration_credentials` table should appear
- Run `npx prisma generate` if the client wasn't regenerated automatically

---

## Acceptance Criteria

- [ ] `UserIntegrationCredential` model exists in `apps/api/prisma/schema.prisma`
- [ ] `User` model has `integrationCredentials UserIntegrationCredential[]` relation
- [ ] Migration SQL file exists under `apps/api/prisma/migrations/`
- [ ] `npx prisma migrate status` shows all migrations applied
- [ ] `PrismaClient` TypeScript types include `userIntegrationCredential` (auto-generated)
